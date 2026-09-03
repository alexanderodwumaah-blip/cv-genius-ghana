// ===== CV GENIUS GHANA — Firebase Review System Module =====
// NOTE: Uses Firestore only (no Firebase Storage) — works on free Spark plan
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, getDoc, updateDoc, deleteDoc,
  query, where, doc, serverTimestamp, onSnapshot, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAhRkNIidv-ud3fua35NQR-nUTTZkoE37A",
  authDomain: "cv-genius-ghana.firebaseapp.com",
  projectId: "cv-genius-ghana",
  storageBucket: "cv-genius-ghana.firebasestorage.app",
  messagingSenderId: "6396208691",
  appId: "1:6396208691:web:1aa1eb5058e2365d376546"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===== GEMINI CONFIG =====
const GEMINI_KEY = window.__GEMINI_KEY__ || '';

// Current working models — updated to current Gemini API stable endpoints
const GEMINI_MODELS_REVIEW = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-2.5-pro'
];

// Per-request fetch timeout — prevents a hung TCP connection from keeping
// the admin "Scanning…" state forever.
const REVIEW_FETCH_TIMEOUT_MS = 90_000;

async function callGeminiReview(requestBody) {
  let lastError = null;
  for (const model of GEMINI_MODELS_REVIEW) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REVIEW_FETCH_TIMEOUT_MS);
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (resp.ok) {
        const data = await resp.json();
        return data;
      }
      const err = await resp.json().catch(() => ({}));
      const msg = err.error?.message || `HTTP ${resp.status}`;
      const shouldFallback =
        resp.status === 404 || resp.status === 429 ||
        (resp.status === 400 && (msg.includes('not found') || msg.includes('not supported') || msg.includes('INVALID_ARGUMENT'))) ||
        msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('not found') || msg.includes('not supported') ||
        msg.includes('no longer available') || msg.includes('ListModels');
      if (shouldFallback) { lastError = new Error(msg); continue; }
      throw new Error(msg);
    } catch (e) {
      clearTimeout(timeoutId);
      const msg = e.message || '';
      if (e.name === 'AbortError') {
        console.warn(`Review scan: model ${model} timed out — trying next…`);
        lastError = new Error(`${model} timed out`);
        continue;
      }
      if (msg.includes('not found') || msg.includes('not supported') ||
          msg.includes('no longer available') || msg.includes('ListModels') ||
          msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        lastError = e; continue;
      }
      throw e;
    }
  }
  throw lastError || new Error('All Gemini models unavailable for review scan.');
}

// ===== CHECK ADMIN =====
async function isAdmin(uid) {
  if (!uid) return false;
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch { return false; }
}

// ===== CONVERT FILE TO BASE64 =====
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result); // full data URL: "data:application/pdf;base64,..."
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ===== SUBMIT CV FOR REVIEW (stored in Firestore as base64) =====
// Firestore doc limit is 1MB. PDFs are typically 50-400KB base64-encoded.
// For files > 900KB we store only the metadata and ask user to paste text.
async function submitCVForReview(uid, userName, userEmail, file, notes, targetOpportunity, onProgress) {
  if (onProgress) onProgress(20);

  const ext = file.name.split('.').pop().toLowerCase();
  const MAX_SIZE = 900 * 1024; // 900KB — safe Firestore doc limit

  let fileData = null;
  let fileDataUrl = null;
  let fileTooLarge = false;

  if (file.size <= MAX_SIZE) {
    fileDataUrl = await fileToBase64(file);
    // Strip the data URL prefix to get pure base64
    fileData = fileDataUrl.split(',')[1];
  } else {
    fileTooLarge = true;
  }

  if (onProgress) onProgress(60);

  const docRef = await addDoc(collection(db, 'cv_submissions'), {
    uid,
    userName,
    userEmail,
    fileName: file.name,
    fileExt: ext,
    fileMimeType: file.type,
    fileSize: file.size,
    fileData: fileData,           // base64 string (null if too large)
    fileTooLarge: fileTooLarge,   // flag for admin to know
    notes: notes || '',
    targetOpportunity: targetOpportunity || 'general',
    status: 'pending',
    aiScanStatus: 'pending',
    aiScanResult: null,
    submittedAt: serverTimestamp(),
    reviewedAt: null
  });

  if (onProgress) onProgress(100);
  return { id: docRef.id, fileTooLarge };
}

// ===== AI SCAN CV =====
async function aiScanCV(submissionId, fileData, fileMimeType, fileName) {
  await updateDoc(doc(db, 'cv_submissions', submissionId), { aiScanStatus: 'scanning' });

  const currentYear = new Date().getFullYear(); // e.g. 2026

  const prompt = `You are an expert professional CV reviewer with 20+ years of experience in recruitment and career coaching for the Ghanaian and international job market.

IMPORTANT DATE CONTEXT: The current year is ${currentYear}. Dates up to and including ${currentYear} are NOT future dates — they are valid past or present dates. A candidate who completed an internship in OCT 2025 – DEC 2025 did so in the past relative to today (${currentYear}). Do NOT flag any date in ${currentYear - 1} or ${currentYear} as a "future" or "incorrect" date — these are recent, legitimate dates. Only flag dates clearly beyond ${currentYear} as future/incorrect.

PAGE LENGTH POLICY: A CV may be 1, 2, or up to 3 pages. Do NOT flag a CV as "too long" solely because it exceeds 1 page. A 2-page CV is perfectly appropriate for candidates with 2+ years of experience, multiple internships, or rich academic backgrounds. A 3-page CV is acceptable if all content is highly relevant and substantive. Only flag length as an issue if the CV contains genuinely unnecessary filler, repetition, or irrelevant content that should be cut. Assess relevance of content first — if everything on the CV is relevant, the length is justified.

Analyse this CV thoroughly and return a JSON object with this EXACT structure (no markdown, valid JSON only):

{
  "overallScore": <0-100>,
  "overallGrade": "<Excellent|Good|Average|Needs Work|Poor>",
  "executiveSummary": "<2-3 sentence assessment>",
  "strengths": ["<strength 1>","<strength 2>","<strength 3>"],
  "criticalIssues": [
    {"severity":"<High|Medium|Low>","category":"<Formatting|Content|Language|Structure|ATS|Other>","issue":"<problem>","fix":"<fix>"}
  ],
  "formattingAnalysis": {"score":<0-100>,"fontConsistency":"<obs>","spacing":"<obs>","sectionStructure":"<obs>","lengthAssessment":"<obs — note: 1-3 pages is acceptable if content is relevant>","issues":["<issue>"]},
  "contentAnalysis": {"score":<0-100>,"contactInfo":"<assessment>","educationSection":"<assessment>","experienceSection":"<assessment>","skillsSection":"<assessment>","achievementsQuality":"<assessment>","quantification":"<assessment>"},
  "languageAnalysis": {"score":<0-100>,"actionVerbUsage":"<assessment>","typosOrGrammarErrors":["<error>"],"spellingConsistency":"<British|American|Mixed>","weakPhrases":["<phrase>"],"toneAndProfessionalism":"<assessment>"},
  "structuralAnalysis": {"score":<0-100>,"sectionOrder":"<assessment>","missingSections":["<section>"],"unnecessarySections":["<section>"],"cvLength":"<too short|appropriate|too long — only flag too long if filler/irrelevant content exists>"},
  "atsCompatibility": {"score":<0-100>,"assessment":"<ATS friendly?>","issues":["<issue>"]},
  "topRecommendations": ["<rec 1>","<rec 2>","<rec 3>","<rec 4>","<rec 5>"],
  "readyToSend": <true|false>,
  "readyToSendNote": "<why ready or not>"
}`;

  try {
    let requestBody;

    if (fileData) {
      // Send the actual CV file to Gemini for reading
      requestBody = {
        contents: [{
          parts: [
            { text: prompt + '\n\n[CV document attached — read and analyse every section]' },
            { inline_data: { mime_type: fileMimeType, data: fileData } }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
      };
    } else {
      // File was too large — ask Gemini to note this
      requestBody = {
        contents: [{ parts: [{ text: prompt + `\n\nNote: CV file "${fileName}" was too large to attach. Provide a partial analysis indicating the file needs to be reviewed manually.` }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
      };
    }

    // Try Gemini models via the fallback helper
    const data = await callGeminiReview(requestBody);
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // ── Robust JSON extraction ──────────────────────────────────────────────
    // Gemini sometimes wraps output in markdown fences, adds prose before/after,
    // or returns trailing commas / comments inside the JSON block.
    // Strategy: strip fences → find first '{' to last '}' → repair → parse.

    // 1. Strip ALL markdown code fences (```json … ``` or ``` … ```)
    text = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();

    // 2. Extract the JSON object: everything from the first '{' to the last '}'
    const firstBrace = text.indexOf('{');
    const lastBrace  = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      text = text.slice(firstBrace, lastBrace + 1);
    }

    // 3. Light repair: remove JavaScript-style trailing commas before } or ]
    //    e.g.  ["foo", "bar",]  →  ["foo", "bar"]
    text = text.replace(/,\s*([}\]])/g, '$1');

    // 4. Attempt parse; if it still fails, surface a clear error message
    let result;
    try {
      result = JSON.parse(text);
    } catch (parseErr) {
      // Try one more time after stripping single-line // comments (rare but seen)
      const stripped = text.replace(/\/\/[^\n]*/g, '').replace(/,\s*([}\]])/g, '$1');
      try {
        result = JSON.parse(stripped);
      } catch {
        throw new Error(
          `AI returned a response that could not be parsed as JSON. ` +
          `Raw preview: ${text.slice(0, 120)}…`
        );
      }
    }
    // ── End robust JSON extraction ──────────────────────────────────────────

    await updateDoc(doc(db, 'cv_submissions', submissionId), {
      aiScanStatus: 'done',
      aiScanResult: result,
      status: 'in_review'
    });
    return result;
  } catch (err) {
    await updateDoc(doc(db, 'cv_submissions', submissionId), {
      aiScanStatus: 'error',
      aiScanError: err.message
    });
    throw err;
  }
}

// ===== PUSH REVIEW TO USER =====
async function pushReviewToUser(submissionId, adminId, reviewData) {
  const { uid, feedback, annotatedImageData, refinedCVData, refinedCVName, adminRefinedHTML, isDraft } = reviewData;

  await setDoc(doc(db, 'cv_reviews', submissionId), {
    submissionId,
    uid,
    adminId,
    feedback: feedback || '',
    annotatedImageData: annotatedImageData || null,   // base64 PNG
    refinedCVData: refinedCVData || null,             // base64 of refined CV file
    refinedCVName: refinedCVName || null,
    adminRefinedHTML: adminRefinedHTML || null,       // AI-rewritten CV HTML (admin refine tab)
    isDraft: isDraft || false,
    pushedAt: serverTimestamp(),
    seenByUser: false
  }, { merge: true });

  await updateDoc(doc(db, 'cv_submissions', submissionId), {
    status: isDraft ? 'in_review' : 'reviewed',
    reviewedAt: serverTimestamp(),
    hasReview: true
  });
}

// ===== UPLOAD REFINED CV (admin uploads refined version) =====
async function uploadRefinedCV(file, submissionId, onProgress) {
  if (onProgress) onProgress(30);
  const dataUrl = await fileToBase64(file);
  const base64 = dataUrl.split(',')[1];
  if (onProgress) onProgress(80);
  // Save to review doc
  await setDoc(doc(db, 'cv_reviews', submissionId), {
    submissionId,
    refinedCVData: base64,
    refinedCVName: file.name,
    refinedCVMime: file.type,
    isDraft: true,
    pushedAt: serverTimestamp(),
    seenByUser: false
  }, { merge: true });
  if (onProgress) onProgress(100);
  return { name: file.name, mime: file.type };
}

// ===== SEND MESSAGE =====
async function sendMessage(submissionId, senderId, senderName, senderRole, text) {
  await addDoc(collection(db, 'cv_messages'), {
    submissionId,
    senderId,
    senderName,
    senderRole,
    text,
    sentAt: serverTimestamp(),
    uid: senderId
  });
}

// ===== GET MESSAGES =====
async function getMessages(submissionId) {
  const q = query(collection(db, 'cv_messages'), where('submissionId', '==', submissionId));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.sentAt?.toMillis?.() || 0) - (b.sentAt?.toMillis?.() || 0));
}

// ===== LISTEN TO MESSAGES =====
function listenMessages(submissionId, callback) {
  const q = query(collection(db, 'cv_messages'), where('submissionId', '==', submissionId));
  return onSnapshot(q, snap => {
    const sorted = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.sentAt?.toMillis?.() || 0) - (b.sentAt?.toMillis?.() || 0));
    callback(sorted);
  });
}

export {
  auth, db,
  isAdmin, onAuthStateChanged,
  fileToBase64,
  submitCVForReview,
  aiScanCV,
  callGeminiReview,
  pushReviewToUser,
  uploadRefinedCV,
  sendMessage, getMessages, listenMessages,
  collection, addDoc, getDocs, getDoc, updateDoc, deleteDoc,
  query, where, doc, serverTimestamp, onSnapshot, setDoc
};
