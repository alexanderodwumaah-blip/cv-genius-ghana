// ===== CV GENIUS GHANA - Main App =====

// ===== NAVBAR SCROLL + SCROLL-TO-TOP =====
window.addEventListener('scroll', () => {
  const nb = document.getElementById('navbar');
  const stb = document.getElementById('scrollTopBtn');
  if (window.scrollY > 20) nb.classList.add('scrolled');
  else nb.classList.remove('scrolled');
  if (stb) {
    if (window.scrollY > 400) stb.classList.add('visible');
    else stb.classList.remove('visible');
  }
  // Show Expert Review banner after scrolling past hero
  showExpertReviewBanner();
});

// ===== EXPERT REVIEW FLOATING BANNER =====
let _bannerShown = false;
function showExpertReviewBanner() {
  if (_bannerShown) return;
  if (sessionStorage.getItem('bannerDismissed')) return;
  if (window.scrollY > 500) {
    const banner = document.getElementById('expertReviewBanner');
    if (banner) { banner.style.display = 'flex'; _bannerShown = true; }
  }
}
function dismissReviewBanner() {
  const banner = document.getElementById('expertReviewBanner');
  if (banner) banner.style.display = 'none';
  sessionStorage.setItem('bannerDismissed', '1');
}
// expose globally
window.dismissReviewBanner = dismissReviewBanner;

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

function toggleMenu() {
  const menu = document.getElementById('mobileMenu');
  if (menu) menu.classList.toggle('open');
}

function closeMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  if (menu) menu.classList.remove('open');
}
window.closeMobileMenu = closeMobileMenu;

// ===== STEP NAVIGATION (Refine) =====
let currentStep = 1;
let uploadedFile = null;
let uploadedText = '';

function goToStep(n) {
  if (n > 1 && n === 2) {
    const target = document.querySelector('input[name="target"]:checked');
    if (!target) { showToast('Please select a target opportunity first.', true); return; }
    // Cover Letter Only — tell the user to upload/paste their CV, then we generate the letter
    if (target.value === 'cover_letter') {
      showToast('Upload your CV below and we\'ll generate a professional cover letter from it.', false);
    }
  }
  if (n > 2 && n === 3) {
    const text = document.getElementById('cvPasteText').value.trim();
    if (!uploadedFile && !text) { showToast('Please upload a file or paste your CV text.', true); return; }
    uploadedText = text;
  }

  for (let i = 1; i <= 4; i++) {
    document.getElementById(`refine-step-${i}`).classList.add('hidden');
    const ind = document.getElementById(`step-indicator-${i}`);
    ind.classList.remove('active', 'completed');
    if (i < n) ind.classList.add('completed');
  }
  document.getElementById(`refine-step-${n}`).classList.remove('hidden');
  document.getElementById(`step-indicator-${n}`).classList.add('active');
  currentStep = n;
  document.getElementById('refine').scrollIntoView({ behavior: 'smooth' });
}

// ===== FILE UPLOAD =====
function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.add('dragover');
}
function handleDragLeave(e) {
  document.getElementById('uploadZone').classList.remove('dragover');
}
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
}
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}
function processFile(file) {
  const allowed = ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain'];
  if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|txt)$/i)) {
    showToast('Unsupported file type. Please upload PDF, DOCX, DOC, or TXT.', true); return;
  }
  if (file.size > 10 * 1024 * 1024) { showToast('File is too large. Max 10MB.', true); return; }
  uploadedFile = file;
  document.getElementById('fileName').textContent = file.name;
  document.getElementById('fileSize').textContent = formatFileSize(file.size);
  document.getElementById('uploadPreview').classList.remove('hidden');
  document.getElementById('uploadZone').style.opacity = '0.5';

  // Read text if TXT
  if (file.type === 'text/plain') {
    const reader = new FileReader();
    reader.onload = (e) => { document.getElementById('cvPasteText').value = e.target.result; };
    reader.readAsText(file);
  }
  showToast('File uploaded successfully!');
}
function removeFile() {
  uploadedFile = null;
  document.getElementById('uploadPreview').classList.add('hidden');
  document.getElementById('uploadZone').style.opacity = '1';
  document.getElementById('fileInput').value = '';
}
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ===== GEMINI API CONFIG =====
const GEMINI_API_KEY = window.__GEMINI_KEY__ || '';

// Model list ordered: best quality first, with free-tier fallbacks.
const GEMINI_MODELS = [
  'gemini-2.5-flash',       // Best price/performance — primary
  'gemini-2.5-flash-lite',  // Fastest, most budget-friendly
  'gemini-3.5-flash',       // Previous-gen flash, still stable
  'gemini-3.6-flash',       // Stable fallback
  'gemini-2.5-pro'          // Most advanced — last resort
];

// Per-request timeout for a single Gemini fetch (90 seconds).
// Without this, a hung TCP connection keeps the spinner running forever.
const GEMINI_FETCH_TIMEOUT_MS = 90_000;

async function callGemini(requestBody) {
  let lastError = null;
  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    // Wrap each fetch in an AbortController so we can time it out cleanly.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const msg = err.error?.message || `HTTP ${response.status}`;
        // Skip to next model for: model not found/deprecated OR quota exceeded (429)
        const shouldFallback =
          response.status === 404 ||
          response.status === 429 ||
          (response.status === 400 && (
            msg.includes('not found') || msg.includes('not supported') ||
            msg.includes('no longer available') || msg.includes('deprecated') ||
            msg.includes('ListModels') || msg.includes('INVALID_ARGUMENT')
          )) ||
          msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('rate limit') || msg.includes('not found') ||
          msg.includes('not supported') || msg.includes('no longer available') ||
          msg.includes('deprecated');
        if (shouldFallback) {
          console.warn(`Model ${model} unavailable (${response.status}): ${msg.substring(0, 80)} — trying next model…`);
          lastError = new Error(msg);
          continue;
        }
        throw new Error(msg);
      }
      const data = await response.json();
      // Tag the response with the model that succeeded (useful for debugging)
      data._modelUsed = model;
      return data;
    } catch (e) {
      clearTimeout(timeoutId);
      const msg = e.message || '';
      // AbortError means our timeout fired — treat as "busy, try next model"
      if (e.name === 'AbortError') {
        console.warn(`Model ${model} timed out after ${GEMINI_FETCH_TIMEOUT_MS / 1000}s — trying next model…`);
        lastError = new Error(`Model ${model} timed out`);
        continue;
      }
      if (msg.includes('not found') || msg.includes('not supported') ||
          msg.includes('no longer available') || msg.includes('ListModels') ||
          msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('rate limit') || msg.includes('deprecated')) {
        console.warn(`Model ${model} threw: ${msg.substring(0, 80)} — trying next model…`);
        lastError = e;
        continue;
      }
      throw e;
    }
  }
  throw new Error(
    'All AI models are currently busy or at capacity. ' +
    'Please wait 60 seconds and try again — this is a free-tier rate limit, not an error with your CV.'
  );
}

// ===== PDF TEXT EXTRACTION =====
async function extractTextFromFile(file) {
  return new Promise((resolve) => {
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = e => {
        // Put the text in the paste area too so scoring works
        const ta = document.getElementById('cvPasteText');
        if (ta && !ta.value.trim()) ta.value = e.target.result;
        resolve({ text: e.target.result });
      };
      reader.readAsText(file);
      return;
    }
    // For PDF/DOCX — convert to base64 and send directly to Gemini's vision
    const reader = new FileReader();
    reader.onload = e => resolve({ base64: e.target.result.split(',')[1], mimeType: file.type });
    reader.readAsDataURL(file);
  });
}

// ===== TARGET / TONE / SPELLING LABELS (shared by refineCV + cover letter) =====
const TARGET_LABELS = {
  corporate_job:      'a Corporate / Industry Job',
  national_service:   'a National Service Placement in Ghana',
  graduate_programme: 'a Competitive Graduate Programme',
  postgraduate:       'Postgraduate / Graduate School Admission',
  internship:         'an Internship Application',
  academia:           'an Academic or Research Position',
  ngo:                'an NGO / Development Sector Role',
  banking:            'a Banking & Finance Role',
  tech:               'a Technology / Engineering Role',
  cover_letter:       'a Cover Letter',
  general:            'a General Professional Application'
};

const TONE_LABELS = {
  professional: 'professional and formal',
  academic:     'academic and research-focused',
  dynamic:      'dynamic, results-driven, and impactful',
  concise:      'concise and punchy'
};

// Target-specific coaching tips injected into the prompt so the AI
// knows exactly what recruiters in each field want to see.
const TARGET_COACHING = {
  banking: `
BANKING-SPECIFIC RULES:
- Lead with Finance: put financial modelling, CFA, Bloomberg, deal experience, and quantitative results at the top
- Quantify deal values in GHS or USD: "evaluated loans exceeding GHS 500,000", "managed portfolio of USD 2M+"
- Highlight analytical tools: Excel (Advanced), Bloomberg Terminal, Refinitiv, Python, SQL
- Use finance vocabulary: loan appraisal, portfolio management, credit analysis, equity research, financial modelling, DCF, LBO
- Show commercial awareness: mention market knowledge, regulatory understanding (SEC, BoG, NPRA)
- For internships: emphasise client exposure, reporting, and any deal work even if minor`,

  tech: `
TECH-SPECIFIC RULES:
- Lead with a concise skills section listing exact technologies: languages, frameworks, tools, platforms (e.g. Python, React, Node.js, AWS, Docker)
- Every project bullet must mention the technology stack used
- Quantify impact: "reduced load time by 40%", "served 10,000+ monthly active users", "automated 8 hours of manual work per week"
- GitHub / portfolio link is critical — surface it prominently in contact line
- Separate "Technical Skills" from "Soft Skills" clearly
- For student roles: include academic projects, hackathons, open-source contributions`,

  academia: `
ACADEMIA-SPECIFIC RULES:
- Academic standing / GPA / class of degree must be prominent — place immediately under each degree
- List relevant courses that align with the research area
- Highlight thesis/dissertation title and supervisor if available
- Publications, conference presentations, and working papers get their own section
- Research methodology skills (Stata, R, Python, SPSS, NVivo, ATLAS.ti) are critical
- Scholarships and academic awards carry more weight than extracurriculars here
- Professional experience is secondary to research experience`,

  national_service: `
NATIONAL SERVICE-SPECIFIC RULES:
- Ghana context: this is the NSS placement form — academic credentials are the primary selector
- Degree class and CGPA must be immediately visible under the degree
- Relevant internship/work experience shows practical readiness
- Leadership roles (student associations, community projects) signal character
- Skills section: Microsoft Office proficiency, communication, teamwork are valued
- Keep to 1 page — NSS reviewers read hundreds of applications`,

  graduate_programme: `
GRADUATE PROGRAMME-SPECIFIC RULES:
- Commercial awareness is critical: show you understand the industry, competitors, market trends
- Leadership potential: highlight any team-leading, initiative-taking, event-organising roles
- Internship/work experience is the strongest differentiator — expand these sections
- Extracurricular depth: quality over quantity — one substantial leadership role beats five minor ones
- Show numerical impact in every bullet: team sizes, budgets managed, results achieved
- Most grad schemes are 1-page for students with under 2 years experience`,

  postgraduate: `
POSTGRADUATE ADMISSION-SPECIFIC RULES:
- Academic excellence dominates: GPA, class of degree, thesis grade, publications, awards
- Research experience is paramount — expand on any RA, lab, or field work
- Statement of research interest (if included) must be precise and scholarly
- Professional experience should connect to the postgrad research area
- Referees section: "References available upon request" unless specific referees requested
- Keep language precise and academic — avoid overly casual phrasing`,

  internship: `
INTERNSHIP-SPECIFIC RULES:
- Most internship applicants are students with limited experience — this is expected
- Lead with strong academic performance (GPA, relevant courses, academic prizes)
- Any prior work experience — no matter how small — must be maximally expanded
- Extracurricular leadership and society involvement demonstrate work ethic and initiative
- Skills section: be specific about software proficiency levels
- 1 page strictly — no exceptions for internship applications`,

  ngo: `
NGO/DEVELOPMENT-SPECIFIC RULES:
- Mission alignment: every bullet should echo commitment to community impact and development goals
- Quantify beneficiaries: "directly benefiting 1,200+ community members", "reached 500 households"
- Volunteer and community work carries equal weight to paid roles — expand these
- Highlight language skills, especially local Ghanaian languages and French (useful for ECOWAS/Africa-wide roles)
- Relevant certifications: M&E training, project management (Prince2, PMD Pro), USAID compliance
- Show understanding of the development sector: mention SDGs, theory of change, stakeholder engagement`
};

// ===== REFINE CV ENGINE =====
async function refineCV() {
  const targetEl = document.querySelector('input[name="target"]:checked');
  if (!targetEl) { showToast('Please select a target opportunity first.', true); return; }

  const target    = targetEl.value;
  const specificRole = document.getElementById('specific-role').value.trim();
  const pasteText = document.getElementById('cvPasteText').value.trim();

  // ── Cover Letter Only target: skip CV refining, go straight to CL generator ──
  if (target === 'cover_letter') {
    if (!uploadedFile && !pasteText) {
      showToast('Please upload or paste your CV so we can generate your cover letter.', true); return;
    }
    const cvText = pasteText || (uploadedText || '');
    showCoverLetter(null, null, 'general', specificRole, cvText);
    return;
  }
  const length    = document.getElementById('cvLength').value;
  const tone      = document.getElementById('cvTone').value;
  const spelling  = document.getElementById('spelling').value;
  const includeCL = document.getElementById('includeCL').value;
  const extra     = document.getElementById('extraInstructions').value.trim();

  if (!uploadedFile && !pasteText) {
    showToast('Please upload a file or paste your CV text first.', true); return;
  }

  const btn = document.querySelector('#refine-step-3 .btn-primary');
  const originalBtnText = '<i class="fas fa-magic"></i> Refine My CV';
  btn.innerHTML = '<span class="spinner"></span> AI is reading your CV…';
  btn.disabled = true;

  const progressMessages = [
    'AI is reading your CV…',
    'Extracting every detail…',
    'Rewriting with impact language…',
    'Quantifying your achievements…',
    'Applying professional formatting…',
    'Polishing the final output…'
  ];
  let msgIdx = 0;
  const msgTimer = setInterval(() => {
    msgIdx = Math.min(msgIdx + 1, progressMessages.length - 1);
    if (btn.disabled) btn.innerHTML = `<span class="spinner"></span> ${progressMessages[msgIdx]}`;
  }, 3500);

  // Always restore the button — even if an error or sub-check throws
  const restoreBtn = () => {
    clearInterval(msgTimer);
    btn.innerHTML = originalBtnText;
    btn.disabled = false;
  };

  try {
    const spellingLabel = spelling === 'british' ? 'British English' : 'American English';
    const lengthNote =
      length === '1page' ? 'STRICTLY 1 page — cut ruthlessly if needed, keep only the strongest content.' :
      length === '2page' ? 'Up to 2 pages — use the space fully if the experience warrants it.' :
      'Auto: use as many pages as needed to represent ALL relevant content faithfully (typically 1–2 pages for students/early career; up to 3 pages for candidates with rich, relevant experience). Never truncate substantive, relevant content just to fit a page limit. If in doubt, include it — relevance is more important than brevity.';

    const targetCoaching = TARGET_COACHING[target] || '';

    // ── MASTER PROMPT ──────────────────────────────────────────────────────────
    const prompt = `You are the world's most accomplished professional CV writer, combining the expertise of a Goldman Sachs recruiter, a McKinsey career coach, and a top-tier headhunter with 30 years of experience in Ghana, the UK, and globally. You have personally reviewed over 50,000 CVs and know exactly — within 6 seconds — which ones get interviews and which get binned.

Your job right now: take this person's existing CV and transform it into a flawless, interview-winning document. This is not a light edit. This is a complete professional transformation while keeping every fact from the original exactly as provided.

━━━ PARAMETERS ━━━
TARGET OPPORTUNITY : ${TARGET_LABELS[target] || 'a Professional Position'}${specificRole ? `\nSPECIFIC ROLE / PROGRAMME : ${specificRole}` : ''}
TONE               : ${TONE_LABELS[tone] || 'professional and formal'}
SPELLING           : ${spellingLabel} — enforced rigorously on every single word
PAGE LENGTH        : ${lengthNote}
${extra ? `\nUSER'S ADDITIONAL INSTRUCTIONS (follow exactly, highest priority):\n${extra}` : ''}
${targetCoaching}

━━━ PHASE 1 — EXTRACTION (do this first, mentally) ━━━
Before writing a single word of output, mentally scan the entire CV and catalogue:
• Full name and ALL contact details (email, phone with country code, LinkedIn URL, portfolio/GitHub)
• Every education entry: institution, location, exact degree title, start–end dates, GPA/class/standing, relevant courses, thesis title if present
• Every work experience entry: company name, location, exact job title, department, start–end dates, every bullet/achievement listed
• Every leadership / extracurricular role: organisation, role title, dates, any achievements
• Every skill listed: technical, soft, languages (with proficiency)
• Every certification, award, publication, membership
• Any additional sections (volunteer work, research, professional bodies, references)

DO NOT skip, drop, merge, or omit ANY entry, no matter how minor it seems. If something is in the original, it MUST appear in your output.
DO NOT fabricate any fact, figure, date, company name, or achievement that is not in the original.

━━━ PHASE 2 — TRANSFORMATION RULES ━━━

BULLET POINT MASTERY:
Every single bullet must:
1. Open with a STRONG past-tense action verb (Led, Built, Delivered, Executed, Analysed, Designed, Developed, Increased, Reduced, Managed, Spearheaded, Negotiated, Launched, Authored, Implemented, Coordinated, Oversaw, Streamlined, Pioneered, Drove, Secured, Generated, Evaluated, Supervised, Mentored, Facilitated, Transformed, Optimised)
2. State WHAT you did with PRECISION
3. Show the RESULT or SCALE wherever possible: numbers, %, GHS/USD values, team sizes, time saved, users reached, deals closed
4. Be a single crisp sentence — no run-ons, no passive voice, no "I"

BANNED PHRASES — never appear in output:
"Responsible for" | "Was involved in" | "Helped with" | "Worked on" | "Assisted in" | "Participated in" | "Duties included" | "Was on the team" | "Gained experience in" | "Exposure to"

DATES — without exception:
• Format: "Jun 2024 – Aug 2024" (3-letter month abbreviation, 4-digit year, en-dash with spaces)
• Current roles: "Oct 2025 – Present"
• NEVER write: "June 2024", "6/2024", "2024-06", "June–August 2024"
• Apply this format to EVERY date in the document, including education

STRUCTURE ORDER:
[Professional Summary — only if present in original or strongly beneficial]
EDUCATION
PROFESSIONAL EXPERIENCE  (most recent first within section)
LEADERSHIP EXPERIENCE    (most recent first within section)
SKILLS
CERTIFICATIONS & AWARDS
[Any other sections from original: Publications, Research, Professional Bodies, Volunteer, References]

SECTION TITLES: ALL CAPS, exactly as shown above.

CONTENT HYGIENE:
• Remove: home address, date of birth, gender, marital status, nationality, religion, passport number, photo reference
• Remove: secondary school / high school (unless applying to a programme that explicitly requires it)
• Keep: ONLY languages at Intermediate level or above
• References: replace with "References available upon request" as a plain line at the end, only if space allows

━━━ PHASE 3 — HTML OUTPUT FORMAT ━━━

Return ONLY raw HTML using EXACTLY these classes. No markdown. No code fences. No commentary. No preamble. Start your response directly with <div class="cv-name">.

CRITICAL SPACING RULES — follow exactly like the Veronica Mensah sample CV:
• Between sections: use <div style="margin-top:10px;"></div> — NOT <br/> tags which cause excessive gaps
• Bullet lists: margin-top:3px, no extra padding, li margin-bottom:2px max
• Between roles within same section: margin-top:8px only
• Line-height on all text: 1.35 maximum — never 1.6 or higher
• Font size: 10pt throughout body, 10.5pt max — name is larger
• Keep everything compact and tight — a well-packed CV like Veronica's sample

EXACT HTML STRUCTURE TO USE:

<div class="cv-name">FIRSTNAME MIDDLENAME LASTNAME</div>
<div class="cv-contact">email@example.com | +233 XX XXX XXXX | linkedin.com/in/handle (omit any absent)</div>

[If professional summary exists or is strongly beneficial:]
<div class="cv-section-title">PROFESSIONAL SUMMARY</div>
<div style="font-size:10pt;line-height:1.35;margin-bottom:6px;">3–4 sentence summary. Specific, confident, no clichés.</div>

<div class="cv-section-title">EDUCATION</div>
<div class="cv-entry-header"><span class="cv-entry-org">Full Institution Name</span><span class="cv-entry-loc">City, Country</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Degree Title</span><span class="cv-entry-date">Mon YYYY – Mon YYYY</span></div>
<div style="font-size:10pt;margin-top:1px;margin-bottom:6px;line-height:1.35;">Academic Standing: [class/GPA] | Relevant Courses: [list]</div>
[repeat cv-entry-header blocks for each additional degree, with margin-top:6px between entries]

<div class="cv-section-title">PROFESSIONAL EXPERIENCE</div>
<div class="cv-entry-header"><span class="cv-entry-org">Company Name</span><span class="cv-entry-loc">City, Country</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Job Title</span><span class="cv-entry-date">Mon YYYY – Mon YYYY</span></div>
<ul class="cv-bullets" style="margin-top:3px;margin-bottom:0;">
<li style="margin-bottom:2px;">Strong action verb + what you did + measurable result.</li>
<li style="margin-bottom:2px;">Strong action verb + what you did + measurable result.</li>
</ul>
<div style="margin-top:8px;"></div>
[repeat for each role, most recent first — use div margin-top:8px between roles, NOT br tags]

<div class="cv-section-title">LEADERSHIP EXPERIENCE</div>
<div class="cv-entry-header"><span class="cv-entry-title">Role Title, Organisation Name</span><span class="cv-entry-date">Mon YYYY – Mon YYYY</span></div>
<ul class="cv-bullets" style="margin-top:3px;margin-bottom:0;">
<li style="margin-bottom:2px;">Strong bullet.</li>
</ul>
<div style="margin-top:6px;"></div>
[repeat for each role — if a leadership role has NO bullet (just title + dates), list it as a single cv-entry-header line with no ul]

<div class="cv-section-title">SKILLS</div>
<div style="font-size:10pt;margin-bottom:3px;line-height:1.35;"><strong>Technical:</strong> Skill 1, Skill 2, Skill 3</div>
<div style="font-size:10pt;margin-bottom:3px;line-height:1.35;"><strong>Professional:</strong> Skill 1, Skill 2</div>
<div style="font-size:10pt;line-height:1.35;"><strong>Languages:</strong> English (Fluent), [others at Intermediate+]</div>

<div class="cv-section-title">CERTIFICATIONS & AWARDS</div>
<ul class="cv-awards-list" style="margin-top:3px;">
<li style="margin-bottom:2px;">Full Certification Name, Issuing Body (Year)</li>
<li style="margin-bottom:2px;">Award Name, Institution (Year)</li>
</ul>

[Add any other sections from the original CV — Volunteer, Research, Projects, Professional Bodies, etc. — using cv-section-title + appropriate tight content. Never omit a section that exists in the original.]`;
    // ── END MASTER PROMPT ──────────────────────────────────────────────────────

    let requestBody;

    if (uploadedFile && !pasteText) {
      // File upload path — send as base64 multimodal
      const fileData = await extractTextFromFile(uploadedFile);
      if (fileData && fileData.base64) {
        // Gemini supports PDF and DOCX directly as inline_data
        // .doc (old binary) may not parse — normalise to a safe MIME
        const mimeType = (fileData.mimeType === 'application/msword')
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : fileData.mimeType;
        requestBody = {
          contents: [{
            parts: [
              { text: prompt + '\n\n[THE CV DOCUMENT IS ATTACHED — read it completely before writing a single word of output]' },
              { inline_data: { mime_type: mimeType, data: fileData.base64 } }
            ]
          }],
          generationConfig: { temperature: 0.12, maxOutputTokens: 8192 }
        };
      } else {
        // TXT fallback
        const extracted = fileData?.text || '';
        requestBody = {
          contents: [{ parts: [{ text: prompt + `\n\n━━━ CV TO REFINE ━━━\n${extracted}` }] }],
          generationConfig: { temperature: 0.12, maxOutputTokens: 8192 }
        };
      }
    } else {
      // Pasted text path
      requestBody = {
        contents: [{ parts: [{ text: prompt + `\n\n━━━ CV TO REFINE ━━━\n${pasteText}` }] }],
        generationConfig: { temperature: 0.12, maxOutputTokens: 8192 }
      };
    }

    const response = await callGemini(requestBody);
    const modelUsed = response._modelUsed || 'gemini';
    let refinedHTML = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Strip any markdown code fences the model might wrap around the output
    refinedHTML = refinedHTML
      .replace(/^```html\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    // If the model returned a <html> or <body> wrapper, strip it
    refinedHTML = refinedHTML
      .replace(/^<!DOCTYPE[^>]*>\s*/i, '')
      .replace(/^<html[^>]*>\s*<head[^>]*>.*?<\/head>\s*<body[^>]*>/is, '')
      .replace(/<\/body>\s*<\/html>\s*$/i, '')
      .trim();

    if (!refinedHTML || refinedHTML.length < 300) {
      throw new Error('The AI returned an incomplete response. Please try again in a moment.');
    }

    // Ensure the output starts cleanly with the name div
    if (!refinedHTML.startsWith('<div')) {
      const divIdx = refinedHTML.indexOf('<div');
      if (divIdx > 0) refinedHTML = refinedHTML.substring(divIdx);
    }

    // Add refinement footer
    refinedHTML += `
<br/>
<div style="text-align:center;font-size:8pt;color:#aaa;border-top:1px solid #e8e8f0;padding-top:10px;margin-top:18px;font-family:'Inter',sans-serif;letter-spacing:0.02em;">
  ✦ AI-Refined by CV Genius Ghana &nbsp;·&nbsp; ${TARGET_LABELS[target]}${specificRole ? ' — ' + specificRole : ''} &nbsp;·&nbsp; ${spellingLabel}
</div>`;

    document.getElementById('refinedOutput').innerHTML = refinedHTML;

    const improvements = buildImprovementsList(refinedHTML, target, includeCL, pasteText || '');
    document.getElementById('improvementsList').innerHTML =
      improvements.map(i => `<li>${i}</li>`).join('');

    // Restore the button now — before the subscription check so the UI is
    // always responsive even if the sub check is slow or fails.
    restoreBtn();

    // ── PAYWALL CHECK ──────────────────────────────────────────────────────────
    // Check subscription status AFTER generating output (AI always runs fully).
    // Non-premium users see a blurred preview and an unlock prompt.
    // Guard with try/catch so a Firestore error never prevents step 4 from showing.
    let sub = { status: 'none' };
    try {
      sub = window.checkSubscription ? await window.checkSubscription() : { status: 'none' };
    } catch (subErr) {
      console.warn('Subscription check failed (non-fatal):', subErr.message);
    }

    if (sub.status === 'active') {
      // Premium user — show full output, wire up download button normally
      document.getElementById('refinedOutput').style.webkitMaskImage = '';
      document.getElementById('refinedOutput').style.maskImage = '';
      document.getElementById('refinedOutputBlurOverlay')?.remove();
      document.getElementById('btnDownloadRefined').onclick = downloadRefinedCV;
      document.getElementById('btnDownloadRefined').innerHTML = '<i class="fas fa-download"></i> Download as PDF';
    } else {
      // Free / pending / expired — blur the bottom portion and show upgrade CTA
      applyRefinePaywall(sub.status);
    }

    goToStep(4);

  } catch (err) {
    restoreBtn();

    // Give a clear, non-technical error message
    let userMsg = err.message || 'Something went wrong.';
    if (userMsg.includes('quota') || userMsg.includes('rate limit') ||
        userMsg.includes('RESOURCE_EXHAUSTED') || userMsg.includes('busy') ||
        userMsg.includes('capacity') || userMsg.includes('timed out')) {
      userMsg = 'The AI is at capacity right now. Please wait 30–60 seconds and tap "Refine My CV" again.';
    } else if (userMsg.includes('incomplete') || userMsg.includes('empty')) {
      userMsg = 'The AI returned an incomplete result. Please try again.';
    } else if (userMsg.includes('network') || userMsg.includes('fetch') ||
               userMsg.includes('Failed to fetch') || userMsg.includes('AbortError')) {
      userMsg = 'Network error — please check your internet connection and try again.';
    }
    showToast(userMsg, true);
    console.error('refineCV error:', err);
  }
}

function buildImprovementsList(refinedHTML, target, includeCL, originalText) {
  const improvements = [];
  const text = refinedHTML.replace(/<[^>]+>/g, ' ');

  // Detect what was actually improved
  if (/developed|built|led|executed|analysed|designed|implemented/i.test(text))
    improvements.push('Replaced passive and weak language with strong action verbs throughout');
  if (/\d+[%+]|\d+,\d+|\d+ (team|client|member|project|transaction)/i.test(text))
    improvements.push('Quantified achievements with real figures, percentages, and measurable impact');
  if (/Jun|Jul|Aug|Sep|Oct|Nov|Dec|Jan|Feb|Mar|Apr|May/.test(text))
    improvements.push('Standardised all dates to consistent abbreviated format (e.g. Jun 2024 – Aug 2024)');
  if (refinedHTML.includes('cv-section-title'))
    improvements.push('Structured CV with clearly defined, professionally formatted sections');
  if (refinedHTML.includes('cv-entry-header'))
    improvements.push('Applied consistent entry formatting: organisation, role, location, and dates properly aligned');

  const targetTips = {
    banking: 'Foregrounded financial experience, deal values, and quantified portfolio impact for banking applications',
    tech: 'Prioritised technical skills, project outcomes, and engineering experience for tech roles',
    academia: 'Emphasised academic standing, GPA, research experience, and scholarly achievements',
    national_service: 'Highlighted academic credentials, leadership, and community impact for national service placement',
    postgraduate: 'Tailored structure and language for graduate school admission — research and academic excellence foregrounded',
    graduate_programme: 'Structured for graduate scheme applications — commercial awareness, leadership, and internship impact highlighted',
    internship: 'Optimised for internship applications — concise, focused on academic performance and any relevant experience',
    ngo: 'Emphasised community impact, volunteer work, and mission alignment for development sector roles'
  };
  if (targetTips[target]) improvements.push(targetTips[target]);

  if (includeCL === 'yes')
    improvements.push('Cover letter generated — use the "Generate Cover Letter" button below to view and download it');

  if (improvements.length < 3)
    improvements.push('Applied SEO Africa professional CV guidelines throughout the document');

  return improvements;
}


// ===== REFINE PAYWALL OVERLAY =====
function applyRefinePaywall(subStatus) {
  const outputEl = document.getElementById('refinedOutput');

  // Blur the bottom ~80% using a CSS mask gradient — only top 20% visible as teaser
  outputEl.style.webkitMaskImage = 'linear-gradient(to bottom, black 18%, transparent 32%)';
  outputEl.style.maskImage        = 'linear-gradient(to bottom, black 18%, transparent 32%)';
  outputEl.style.userSelect       = 'none';

  // Remove any existing overlay first
  document.getElementById('refinedOutputBlurOverlay')?.remove();

  const statusMsg = subStatus === 'pending'
    ? `<div style="background:#fff8e1;border:1.5px solid #fcd116;border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:0.83rem;color:#7a6000;display:flex;align-items:center;gap:8px;"><i class="fas fa-clock"></i> <span>Your payment is <strong>being verified</strong>. We'll notify you once your Premium is activated — usually within a few hours.</span></div>`
    : subStatus === 'expired'
    ? `<div style="background:#fff0f0;border:1.5px solid #ce1126;border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:0.83rem;color:#8b0000;display:flex;align-items:center;gap:8px;"><i class="fas fa-exclamation-circle"></i> <span>Your Premium subscription has <strong>expired</strong>. Renew for another 6 months to download.</span></div>`
    : '';

  const overlay = document.createElement('div');
  overlay.id = 'refinedOutputBlurOverlay';
  overlay.innerHTML = `
    <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to bottom,rgba(255,255,255,0) 0%,rgba(255,255,255,0.97) 30%,#fff 60%);padding:32px 24px 28px;text-align:center;border-radius:0 0 16px 16px;z-index:10;">
      ${statusMsg}
      <div style="font-size:1.5rem;margin-bottom:8px;">🔒</div>
      <h3 style="font-family:'Inter',sans-serif;font-size:1.05rem;font-weight:800;color:#1a1a2e;margin-bottom:6px;">Your refined CV is ready!</h3>
      <p style="font-family:'Inter',sans-serif;font-size:0.85rem;color:#5a5a7a;margin-bottom:18px;max-width:340px;margin-left:auto;margin-right:auto;line-height:1.6;">Download and export your professionally refined CV with a <strong>Premium subscription</strong> — just <strong>GH₵20 for 6 full months</strong> of unlimited use.</p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <button onclick="window.openSubscribeModal('refine')" style="background:linear-gradient(135deg,#006b3f,#004d2d);color:#fff;border:none;border-radius:10px;padding:13px 26px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;display:inline-flex;align-items:center;gap:8px;box-shadow:0 4px 16px rgba(0,107,63,0.3);">
          <i class="fas fa-crown"></i> Unlock — GH₵20 / 6 Months
        </button>
        <button onclick="checkSubscriptionAndUnlock('refine')" style="background:transparent;color:#5a5a7a;border:1.5px solid #d0d0e8;border-radius:10px;padding:13px 18px;font-size:0.85rem;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;">
          <i class="fas fa-sync"></i> I've paid — check again
        </button>
      </div>
      <p style="font-family:'Inter',sans-serif;font-size:0.75rem;color:#aaa;margin-top:12px;">Includes: Unlimited AI CV Refinement · Builder PDF Export · 6 months · Cancel by not renewing</p>
    </div>`;
  overlay.style.cssText = 'position:relative;margin-top:-120px;';

  const wrapper = outputEl.parentElement;
  wrapper.style.position = 'relative';
  wrapper.appendChild(overlay);

  // Change the download button to the upgrade CTA
  const dlBtn = document.getElementById('btnDownloadRefined');
  if (dlBtn) {
    dlBtn.innerHTML = '<i class="fas fa-crown"></i> Unlock to Download';
    dlBtn.onclick = () => window.openSubscribeModal('refine');
    dlBtn.style.background = 'linear-gradient(135deg,#006b3f,#004d2d)';
  }
}

// Called when user clicks "I've paid — check again"
window.checkSubscriptionAndUnlock = async function(context) {
  window.clearSubCache?.();
  const sub = window.checkSubscription ? await window.checkSubscription() : { status: 'none' };
  if (sub.status === 'active') {
    if (context === 'refine') {
      const outputEl = document.getElementById('refinedOutput');
      outputEl.style.webkitMaskImage = '';
      outputEl.style.maskImage = '';
      outputEl.style.userSelect = '';
      document.getElementById('refinedOutputBlurOverlay')?.remove();
      const dlBtn = document.getElementById('btnDownloadRefined');
      if (dlBtn) {
        dlBtn.innerHTML = '<i class="fas fa-download"></i> Download as PDF';
        dlBtn.onclick = downloadRefinedCV;
        dlBtn.style.background = '';
      }
      showToast('🎉 Premium activated! You can now download your CV.');
    } else if (context === 'builder') {
      document.getElementById('builderPaywallOverlay')?.remove();
      const dlBtn = document.getElementById('btnDownloadBuilt');
      if (dlBtn) {
        dlBtn.innerHTML = '<i class="fas fa-download"></i> Download PDF';
        dlBtn.onclick = downloadBuiltCV;
        dlBtn.style.background = '';
      }
      showToast('🎉 Premium activated! You can now download your CV.');
    }
  } else if (sub.status === 'pending') {
    showToast('Your payment is still being verified. We\'ll activate your account shortly.', true);
  } else {
    showToast('No active subscription found. Please subscribe or try again after payment.', true);
  }
};

// ===== DOWNLOAD REFINED CV =====
async function downloadRefinedCV() {
  const sub = window.checkSubscription ? await window.checkSubscription() : { status: 'none' };
  if (sub.status !== 'active') { window.openSubscribeModal?.('refine'); return; }
  const allowed = window.recordExport ? await window.recordExport() : true;
  if (!allowed) return;

  const content = document.getElementById('refinedOutput').innerHTML;
  const target = document.querySelector('input[name="target"]:checked')?.value || 'general';
  const role = document.getElementById('specific-role').value.trim();
  const title = `Refined CV${role ? ' – ' + role : ''} (${new Date().toLocaleDateString('en-GB')})`;
  printCV(content, 'Refined_CV');
  if (window.saveCVToFirestore) saveCVToFirestore('refined', title, content, target, role);
}

function copyRefinedCV() {
  const text = document.getElementById('refinedOutput').innerText;
  navigator.clipboard.writeText(text).then(() => showToast('CV copied to clipboard!'));
}

// ===== PRINT/PDF =====
const PRINT_CSS = `
  @page {
    size: A4;
    margin: 1.8cm 1.8cm 1.8cm 1.8cm;
  }
  @media print {
    html, body { margin: 0 !important; padding: 0 !important; }
    /* Suppress browser-generated headers/footers (date, time, URL, title) */
    @page { margin: 1.8cm; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  * { box-sizing: border-box; }
  body {
    font-family: 'Times New Roman', serif;
    font-size: 10.5pt;
    margin: 0;
    padding: 0;
    color: #000;
    line-height: 1.35;
  }
  .cv-name {
    text-align: center;
    font-size: 20pt;
    font-weight: bold;
    text-transform: uppercase;
    margin-bottom: 3px;
    letter-spacing: 0.02em;
  }
  .cv-contact {
    text-align: center;
    font-size: 10pt;
    margin-bottom: 10px;
    line-height: 1.35;
  }
  .cv-section-title {
    font-size: 10.5pt;
    font-weight: bold;
    text-transform: uppercase;
    border-bottom: 1.5px solid #000;
    margin: 10px 0 4px;
    padding-bottom: 2px;
    letter-spacing: 0.04em;
  }
  .cv-entry-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    line-height: 1.35;
  }
  .cv-entry-org { font-weight: bold; font-size: 10pt; }
  .cv-entry-loc { font-size: 10pt; font-style: italic; }
  .cv-entry-title { font-weight: bold; font-size: 10pt; }
  .cv-entry-date { font-size: 10pt; }
  .cv-bullets {
    margin: 2px 0 0 16px;
    padding: 0;
  }
  .cv-bullets li {
    margin-bottom: 2px;
    font-size: 10pt;
    line-height: 1.35;
  }
  .cv-awards-list {
    list-style: disc;
    margin-left: 16px;
    padding: 0;
  }
  .cv-awards-list li {
    font-size: 10pt;
    margin-bottom: 2px;
    line-height: 1.35;
  }
  /* Strip any footer/header injected by the AI */
  [style*="font-size:8pt"], [style*="font-size: 8pt"] { display: none !important; }
`;

function printCV(htmlContent, filename) {
  const printWin = window.open('', '_blank', 'width=900,height=1100');
  if (!printWin) {
    showToast('Popup blocked. Please allow popups for this site and try again.', true);
    return;
  }
  // Strip the AI-generated footer line (✦ Refined by... line)
  const cleanContent = htmlContent
    .replace(/<div[^>]*font-size:8pt[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<br\s*\/?>\s*<div[^>]*border-top[^>]*>[\s\S]*?<\/div>/gi, '');

  printWin.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>${filename}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>${cleanContent}</body>
</html>`);
  printWin.document.close();
  // Wait for fonts/layout to settle before printing
  printWin.onload = function() {
    setTimeout(() => {
      printWin.focus();
      printWin.print();
    }, 400);
  };
  // Fallback if onload doesn't fire
  setTimeout(() => {
    try { printWin.focus(); printWin.print(); } catch(e) {}
  }, 900);
}

// ===== BUILDER TAB NAVIGATION =====
function switchTab(tab) {
  document.querySelectorAll('.builder-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`panel-${tab}`).classList.add('active');
  document.getElementById('build').scrollIntoView({ behavior: 'smooth' });
}

// ===== DYNAMIC ENTRY ADDITION =====
let eduCount = 1, expCount = 1, leadCount = 1, awardCount = 1;

function addEducationEntry() {
  const id = `edu-${eduCount++}`;
  const div = document.createElement('div');
  div.className = 'entry-card'; div.id = id;
  div.innerHTML = `<div class="entry-header"><span>Education Entry ${eduCount}</span><button class="remove-entry" onclick="removeEntry('${id}')"><i class="fas fa-trash"></i></button></div>
  <div class="form-row"><div class="form-group"><label>University / Institution *</label><input type="text" class="form-input edu-uni" placeholder="e.g. KNUST"/></div><div class="form-group"><label>Location *</label><input type="text" class="form-input edu-loc" placeholder="e.g. Kumasi, Ghana"/></div></div>
  <div class="form-row"><div class="form-group"><label>Degree / Programme *</label><input type="text" class="form-input edu-degree" placeholder="e.g. BSc. Computer Engineering"/></div><div class="form-group"><label>Academic Standing</label><input type="text" class="form-input edu-standing" placeholder="e.g. Second Class Upper / GPA 3.5/4.0"/></div></div>
  <div class="form-row"><div class="form-group"><label>Start Date *</label><input type="text" class="form-input edu-start" placeholder="e.g. Sep 2020"/></div><div class="form-group"><label>End Date / Expected *</label><input type="text" class="form-input edu-end" placeholder="e.g. Jun 2024"/></div></div>
  <div class="form-group"><label>Relevant Courses (optional)</label><input type="text" class="form-input edu-courses" placeholder="e.g. Algorithms, Data Structures, Database Systems"/></div>`;
  document.getElementById('educationEntries').appendChild(div);
}

function addExperienceEntry() {
  const id = `exp-${expCount++}`;
  const div = document.createElement('div');
  div.className = 'entry-card'; div.id = id;
  div.innerHTML = `<div class="entry-header"><span>Experience Entry ${expCount}</span><button class="remove-entry" onclick="removeEntry('${id}')"><i class="fas fa-trash"></i></button></div>
  <div class="form-row"><div class="form-group"><label>Organisation Name *</label><input type="text" class="form-input exp-org" placeholder="e.g. Standard Chartered Bank PLC"/></div><div class="form-group"><label>Location *</label><input type="text" class="form-input exp-loc" placeholder="e.g. Accra, Ghana"/></div></div>
  <div class="form-row"><div class="form-group"><label>Your Title / Role *</label><input type="text" class="form-input exp-title" placeholder="e.g. Enterprise Banking Intern"/></div><div class="form-group"><label>Department (optional)</label><input type="text" class="form-input exp-dept" placeholder="e.g. Corporate Banking"/></div></div>
  <div class="form-row"><div class="form-group"><label>Start Date *</label><input type="text" class="form-input exp-start" placeholder="e.g. Jul 2023"/></div><div class="form-group"><label>End Date *</label><input type="text" class="form-input exp-end" placeholder="e.g. Aug 2023"/></div></div>
  <div class="form-group"><label>Key Achievements *</label><textarea class="form-textarea exp-bullets" rows="4" placeholder="• Built an Excel dashboard tracking 1,000+ weekly metrics&#10;• Evaluated financial capacity of 15+ companies for loans exceeding GHS 170,000"></textarea></div>`;
  document.getElementById('experienceEntries').appendChild(div);
}

function addLeadershipEntry() {
  const id = `lead-${leadCount++}`;
  const div = document.createElement('div');
  div.className = 'entry-card'; div.id = id;
  div.innerHTML = `<div class="entry-header"><span>Leadership Entry ${leadCount}</span><button class="remove-entry" onclick="removeEntry('${id}')"><i class="fas fa-trash"></i></button></div>
  <div class="form-row"><div class="form-group"><label>Organisation *</label><input type="text" class="form-input lead-org" placeholder="e.g. NUGS, GhIE Students Chapter"/></div><div class="form-group"><label>Your Role *</label><input type="text" class="form-input lead-role" placeholder="e.g. President"/></div></div>
  <div class="form-row"><div class="form-group"><label>Start Date</label><input type="text" class="form-input lead-start" placeholder="e.g. Sep 2023"/></div><div class="form-group"><label>End Date</label><input type="text" class="form-input lead-end" placeholder="e.g. Sep 2024"/></div></div>
  <div class="form-group"><label>Key Achievements (optional)</label><textarea class="form-textarea lead-bullets" rows="3" placeholder="• Led [X] to achieve [Y]..."></textarea></div>`;
  document.getElementById('leadershipEntries').appendChild(div);
}

function addAwardEntry() {
  const id = `award-${awardCount++}`;
  const div = document.createElement('div');
  div.className = 'entry-card'; div.id = id;
  div.innerHTML = `<div class="entry-header"><span>Entry ${awardCount}</span><button class="remove-entry" onclick="removeEntry('${id}')"><i class="fas fa-trash"></i></button></div>
  <div class="form-row"><div class="form-group"><label>Certification / Award Name *</label><input type="text" class="form-input award-name" placeholder="e.g. 2023 Sub-Regional Champion, CFA Institute Research Challenge"/></div><div class="form-group"><label>Issuing Organisation</label><input type="text" class="form-input award-org" placeholder="e.g. CFA Institute"/></div></div>
  <div class="form-row"><div class="form-group"><label>Year</label><input type="text" class="form-input award-year" placeholder="e.g. 2023"/></div></div>`;
  document.getElementById('awardsEntries').appendChild(div);
}

function removeEntry(id) {
  document.getElementById(id)?.remove();
}

// ===== GENERATE CV PREVIEW FROM BUILDER =====
function generateCVPreview() {
  const firstName = document.getElementById('b-firstName').value.trim();
  const middleName = document.getElementById('b-middleName').value.trim();
  const lastName = document.getElementById('b-lastName').value.trim();
  const email = document.getElementById('b-email').value.trim();
  const phone = document.getElementById('b-phone').value.trim();
  const linkedin = document.getElementById('b-linkedin').value.trim();
  const portfolio = document.getElementById('b-portfolio').value.trim();

  if (!firstName || !lastName) {
    showToast('Please fill in at least your first and last name in Personal Info.', true);
    switchTab('personal'); return;
  }

  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').toUpperCase();
  let contactParts = [];
  if (email) contactParts.push(email);
  if (phone) contactParts.push(phone);
  if (linkedin) contactParts.push(linkedin);
  if (portfolio) contactParts.push(portfolio);

  let html = `<div class="cv-name">${fullName}</div>`;
  html += `<div class="cv-contact">${contactParts.join(' | ')}</div>`;

  // PROFESSIONAL SUMMARY (extra section — goes before education)
  const summaryText = document.getElementById('es-summary-text')?.value.trim();
  if (summaryText) {
    html += `<div class="cv-section-title">PROFESSIONAL SUMMARY</div>`;
    html += `<div style="font-size:10pt;line-height:1.6;margin-bottom:4px;">${renderRichText(summaryText).replace(/\n/g,'<br/>')}</div>`;
  }

  // EDUCATION
  const eduEntries = document.querySelectorAll('#educationEntries .entry-card');
  if (eduEntries.length > 0) {
    html += `<div class="cv-section-title">EDUCATION</div>`;
    eduEntries.forEach(e => {
      const uni = e.querySelector('.edu-uni')?.value.trim();
      const loc = e.querySelector('.edu-loc')?.value.trim();
      const degree = e.querySelector('.edu-degree')?.value.trim();
      const standing = e.querySelector('.edu-standing')?.value.trim();
      const start = e.querySelector('.edu-start')?.value.trim();
      const end = e.querySelector('.edu-end')?.value.trim();
      const courses = e.querySelector('.edu-courses')?.value.trim();
      if (!uni) return;
      html += `<div class="cv-entry-header"><span class="cv-entry-org">${uni}</span><span class="cv-entry-loc">${loc || ''}</span></div>`;
      html += `<div class="cv-entry-header"><span class="cv-entry-title">${degree || ''}</span><span class="cv-entry-date">${[start,end].filter(Boolean).join(' – ')}</span></div>`;
      if (standing) html += `<div style="font-size:10pt; margin-top:2px;">Academic Standing: ${standing}</div>`;
      if (courses) html += `<div style="font-size:10pt;">Relevant Courses: ${courses}</div>`;
      html += `<br/>`;
    });
  }

  // EXPERIENCE
  const expEntries = document.querySelectorAll('#experienceEntries .entry-card');
  if (expEntries.length > 0) {
    html += `<div class="cv-section-title">PROFESSIONAL EXPERIENCE</div>`;
    expEntries.forEach(e => {
      const org = e.querySelector('.exp-org')?.value.trim();
      const loc = e.querySelector('.exp-loc')?.value.trim();
      const title = e.querySelector('.exp-title')?.value.trim();
      const dept = e.querySelector('.exp-dept')?.value.trim();
      const start = e.querySelector('.exp-start')?.value.trim();
      const end = e.querySelector('.exp-end')?.value.trim();
      const bullets = e.querySelector('.exp-bullets')?.value.trim();
      if (!org) return;
      html += `<div class="cv-entry-header"><span class="cv-entry-org">${org}</span><span class="cv-entry-loc">${loc || ''}</span></div>`;
      const titleFull = dept ? `${title} (${dept})` : title;
      html += `<div class="cv-entry-header"><span class="cv-entry-title">${titleFull || ''}</span><span class="cv-entry-date">${[start,end].filter(Boolean).join(' – ')}</span></div>`;
      if (bullets) {
        const lines = bullets.split('\n').filter(l => l.trim());
        html += `<ul class="cv-bullets">`;
        lines.forEach(l => { html += `<li>${renderRichText(l.replace(/^[•\-*]\s*/,''))}</li>`; });
        html += `</ul>`;
      }
      html += `<br/>`;
    });
  }

  // LEADERSHIP
  const leadEntries = document.querySelectorAll('#leadershipEntries .entry-card');
  const hasLeadData = Array.from(leadEntries).some(e => e.querySelector('.lead-org')?.value.trim());
  if (hasLeadData) {
    html += `<div class="cv-section-title">LEADERSHIP EXPERIENCE</div>`;
    leadEntries.forEach(e => {
      const org = e.querySelector('.lead-org')?.value.trim();
      const role = e.querySelector('.lead-role')?.value.trim();
      const start = e.querySelector('.lead-start')?.value.trim();
      const end = e.querySelector('.lead-end')?.value.trim();
      const bullets = e.querySelector('.lead-bullets')?.value.trim();
      if (!org) return;
      html += `<div class="cv-entry-header"><span class="cv-entry-title">${role ? role + ', ' + org : org}</span><span class="cv-entry-date">${[start,end].filter(Boolean).join(' – ')}</span></div>`;
      if (bullets) {
        const lines = bullets.split('\n').filter(l => l.trim());
        html += `<ul class="cv-bullets">`;
        lines.forEach(l => { html += `<li>${l.replace(/^[•\-*]\s*/,'')}</li>`; });
        html += `</ul>`;
      }
      html += `<br/>`;
    });
  }

  // SKILLS
  const tech = document.getElementById('b-techSkills')?.value.trim();
  const soft = document.getElementById('b-softSkills')?.value.trim();
  const langs = document.getElementById('b-languages')?.value.trim();
  if (tech || soft || langs) {
    html += `<div class="cv-section-title">SKILLS</div>`;
    if (tech) html += `<div style="font-size:10pt; margin-bottom:4px;"><strong>Technical:</strong> ${tech}</div>`;
    if (soft) html += `<div style="font-size:10pt; margin-bottom:4px;"><strong>Professional:</strong> ${soft}</div>`;
    if (langs) html += `<div style="font-size:10pt; margin-bottom:4px;"><strong>Languages:</strong> ${langs}</div>`;
    html += `<br/>`;
  }

  // AWARDS
  const awardEntries = document.querySelectorAll('#awardsEntries .entry-card');
  const hasAwards = Array.from(awardEntries).some(e => e.querySelector('.award-name')?.value.trim());
  if (hasAwards) {
    html += `<div class="cv-section-title">CERTIFICATIONS & AWARDS</div><ul class="cv-awards-list">`;
    awardEntries.forEach(e => {
      const name = e.querySelector('.award-name')?.value.trim();
      const org = e.querySelector('.award-org')?.value.trim();
      const year = e.querySelector('.award-year')?.value.trim();
      if (!name) return;
      let entry = name;
      if (org) entry += `, ${org}`;
      if (year) entry += ` (${year})`;
      html += `<li>${entry}</li>`;
    });
    html += `</ul>`;
  }

  // ===== EXTRA SECTIONS =====
  html += buildExtraSectionsHTML();

  const container = document.getElementById('cvPreviewContainer');
  container.innerHTML = html;
  showToast('CV preview generated!');
}

async function downloadBuiltCV() {
  const content = document.getElementById('cvPreviewContainer').innerHTML;
  if (!content || content.includes('cv-preview-placeholder')) {
    showToast('Please generate a preview first.', true); return;
  }

  // ── PAYWALL CHECK ──
  const sub = window.checkSubscription ? await window.checkSubscription() : { status: 'none' };
  if (sub.status !== 'active') {
    applyBuilderPaywall(sub.status);
    return;
  }
  const allowed = window.recordExport ? await window.recordExport() : true;
  if (!allowed) return;

  const firstName = document.getElementById('b-firstName').value.trim();
  const lastName = document.getElementById('b-lastName').value.trim();
  const title = `${firstName} ${lastName} CV (${new Date().toLocaleDateString('en-GB')})`;
  printCV(content, `${firstName}_${lastName}_CV`);
  if (window.saveCVToFirestore) saveCVToFirestore('built', title, content, document.getElementById('previewTarget')?.value || 'general', '');
}

// ===== BUILDER PAYWALL OVERLAY =====
function applyBuilderPaywall(subStatus) {
  document.getElementById('builderPaywallOverlay')?.remove();

  const statusMsg = subStatus === 'pending'
    ? `<div style="background:#fff8e1;border:1.5px solid #fcd116;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:0.82rem;color:#7a6000;"><i class="fas fa-clock" style="margin-right:6px;"></i>Your payment is <strong>being verified</strong>. Usually activated within a few hours.</div>`
    : subStatus === 'expired'
    ? `<div style="background:#fff0f0;border:1.5px solid #ce1126;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:0.82rem;color:#8b0000;"><i class="fas fa-exclamation-circle" style="margin-right:6px;"></i>Your subscription has <strong>expired</strong>. Renew for another 6 months.</div>`
    : '';

  const overlay = document.createElement('div');
  overlay.id = 'builderPaywallOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,30,0.72);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:36px 32px;max-width:420px;width:100%;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,0.25);font-family:'Inter',sans-serif;">
      <div style="font-size:2.5rem;margin-bottom:12px;">&#128274;</div>
      <h2 style="font-size:1.2rem;font-weight:800;color:#1a1a2e;margin-bottom:8px;">Your CV is built!</h2>
      <p style="font-size:0.88rem;color:#5a5a7a;line-height:1.7;margin-bottom:6px;">You can copy the text for free. To <strong>download a print-ready PDF</strong>, upgrade to Premium.</p>
      ${statusMsg}
      <div style="background:linear-gradient(135deg,#006b3f,#004d2d);border-radius:14px;padding:18px 20px;margin:18px 0;color:#fff;">
        <div style="font-size:0.75rem;font-weight:700;letter-spacing:0.08em;opacity:0.8;margin-bottom:4px;">PREMIUM PLAN</div>
        <div style="font-size:2rem;font-weight:800;margin-bottom:2px;">GH&#8373;20</div>
        <div style="font-size:0.8rem;opacity:0.85;">for 6 full months &middot; Unlimited use</div>
        <div style="margin-top:10px;font-size:0.78rem;opacity:0.75;line-height:1.6;">&#10003; Unlimited CV Builder PDF exports<br>&#10003; Unlimited AI CV Refinement downloads<br>&#10003; Daily export cap: 8 CVs/day</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button onclick="window.openSubscribeModal('builder')" style="background:linear-gradient(135deg,#006b3f,#004d2d);color:#fff;border:none;border-radius:10px;padding:14px;font-size:0.92rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 16px rgba(0,107,63,0.3);">
          <i class="fas fa-crown"></i> Subscribe &mdash; GH&#8373;20 / 6 Months
        </button>
        <button onclick="checkSubscriptionAndUnlock('builder')" style="background:#f0f0f8;color:#5a5a7a;border:none;border-radius:10px;padding:12px;font-size:0.85rem;font-weight:600;cursor:pointer;">
          <i class="fas fa-sync"></i> I've already paid &mdash; check now
        </button>
      </div>
      <p style="font-size:0.72rem;color:#ccc;margin-top:14px;">Payment via MoMo &middot; Verified manually within hours &middot; No auto-renewal</p>
    </div>`;
  document.body.appendChild(overlay);
}

function copyBuiltCV() {
  const content = document.getElementById('cvPreviewContainer').innerText;
  if (!content || content.includes('Generate Preview')) {
    showToast('Please generate a preview first.', true); return;
  }
  navigator.clipboard.writeText(content).then(() => showToast('CV copied to clipboard!'));
}

// ===== TIPS TABS =====
function showTipsTab(tab) {
  document.querySelectorAll('.tips-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tips-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`.tips-tab[onclick="showTipsTab('${tab}')"]`).classList.add('active');
  document.getElementById(`tips-${tab}`).classList.add('active');
}

// ===== SAMPLE CVs MODAL =====
const sampleData = {
  veronica: `<div class="cv-name">VERONICA MENSAH</div>
<div class="cv-contact">vmensah@gmail.com | +233 54 023 4567 | linkedin.com/in/veronica-mensah</div>
<div class="cv-section-title">EDUCATION</div>
<div class="cv-entry-header"><span class="cv-entry-org">University of Ghana</span><span class="cv-entry-loc">Accra, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">BSc. Accounting and Finance</span><span class="cv-entry-date">Expected Jun 2026</span></div>
<div style="font-size:10pt; margin-top:2px;">Academic Standing: First Class Honours</div>
<div style="font-size:10pt;">Relevant Courses: Corporate Finance and Financial Accounting</div>
<div class="cv-section-title">PROFESSIONAL EXPERIENCE</div>
<div class="cv-entry-header"><span class="cv-entry-org">JPMorgan Chase & Co.</span><span class="cv-entry-loc">London, United Kingdom</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Investment Banking Summer Analyst (Mergers & Acquisitions)</span><span class="cv-entry-date">Jun 2024 – Aug 2024</span></div>
<ul class="cv-bullets">
  <li>Contributed to deal strategy and execution for 2 M&A transactions (average EV: £3bn), providing critical analysis and strategic insights.</li>
  <li>Developed key sections of the CIM for a £300m technology sell-side transaction, showcasing critical financial and operational insights to attract potential buyers.</li>
  <li>Led the VDR management, organising and uploading sensitive data to streamline due diligence for key stakeholders.</li>
</ul>
<div class="cv-entry-header" style="margin-top:8px;"><span class="cv-entry-org">Standard Chartered Bank PLC</span><span class="cv-entry-loc">Accra, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Enterprise Banking Intern</span><span class="cv-entry-date">Jul 2023 – Aug 2023</span></div>
<ul class="cv-bullets">
  <li>Built an Excel dashboard tracking 1,000+ weekly metrics, enhancing data-driven decision-making in enterprise banking.</li>
  <li>Evaluated the financial capacity of 15+ companies to secure loans exceeding 170,000 cedis, mitigating risk and optimising lending.</li>
  <li>Successfully onboarded 5 new enterprise clients, expanding the bank's SME portfolio.</li>
</ul>
<div class="cv-entry-header" style="margin-top:8px;"><span class="cv-entry-org">Databank Asset Management Services Limited</span><span class="cv-entry-loc">Accra, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Asset Management Intern</span><span class="cv-entry-date">Oct 2019 – Mar 2020</span></div>
<ul class="cv-bullets">
  <li>Developed a Taylor-rule-based financial model to forecast 2020 inflation and interest rates, utilised in budget planning.</li>
  <li>Collaborated with the dealing desk to purchase over 500,000 cedis in government bonds, contributing to portfolio management for pension clients.</li>
  <li>Reported 2019 Q4 investment holdings to the Securities and Exchange Commission (SEC) and the National Pensions Regulatory Authority (NPRA).</li>
</ul>
<div class="cv-section-title">LEADERSHIP EXPERIENCE</div>
<div class="cv-entry-header"><span class="cv-entry-title">Vice President of Projects, Enactus University of Ghana</span><span class="cv-entry-date">Oct 2024 – Present</span></div>
<ul class="cv-bullets">
  <li>Oversaw 3 high-impact social innovation projects, coordinating 25 team members and achieving a 40% increase in funding while directly benefiting 1,200+ community members in one year.</li>
</ul>
<div class="cv-section-title">CERTIFICATIONS & AWARDS</div>
<ul class="cv-awards-list">
  <li>Financial Modelling & Valuation Analyst (FMVA) Certification, Corporate Finance Institute (CFI)</li>
  <li>2023 Sub-Regional Champion, CFA Institute Research Challenge</li>
  <li>Chancellor's Award for Academic Excellence, University of Ghana (2024)</li>
</ul>`,

  engineering: `<div class="cv-name">KWABENA MENSAH BOATENG</div>
<div class="cv-contact">kboateng.eng@gmail.com | +233 24 876 5432 | linkedin.com/in/kwabena-boateng-eng</div>

<div class="cv-section-title">EDUCATION</div>
<div class="cv-entry-header"><span class="cv-entry-org">University of Energy and Natural Resources (UENR)</span><span class="cv-entry-loc">Sunyani, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">BSc. Electrical and Electronics Engineering</span><span class="cv-entry-date">Sep 2021 – Jun 2025</span></div>
<div style="font-size:10pt; margin-top:2px;">Academic Standing: Second Class Upper (Honours) &nbsp;|&nbsp; CGPA: 3.61 / 4.00</div>
<div style="font-size:10pt; margin-top:1px;">Final Year Project: Design and Simulation of a Grid-Tied Solar PV System for an Off-Grid Community in the Bono Region — Achieved 94% in project assessment.</div>
<div style="font-size:10pt; margin-top:1px;">Relevant Courses: Power System Analysis, High Voltage Engineering, Power Generation Transmission &amp; Distribution, Renewable Energy Systems, Digital Electronics, Control Systems Engineering, Industrial Automation</div>

<div class="cv-section-title">PROFESSIONAL EXPERIENCE</div>
<div class="cv-entry-header"><span class="cv-entry-org">Ghana Grid Company Limited (GRIDCo)</span><span class="cv-entry-loc">Accra, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">National Service Personnel – System Operations &amp; Maintenance Planning Department</span><span class="cv-entry-date">Oct 2025 – Present</span></div>
<ul class="cv-bullets">
  <li>Monitors real-time power flow across Ghana's national 161kV/330kV transmission network, supporting load dispatch decisions and frequency regulation in the National Control Centre.</li>
  <li>Redesigned 12 weekly system performance report templates in Excel, reducing preparation time by 35% and improving reporting accuracy by 25% as confirmed by the Department Head.</li>
  <li>Participated in the commissioning of the Pokuase 330/161kV substation extension — assisted in protection relay testing, secondary injection testing, and energisation sequence verification for 2 new transformer bays.</li>
  <li>Compiled and maintained a centralised fault register tracking outage events on 8 transmission corridors, enabling a 20% improvement in fault pattern identification for quarterly maintenance planning.</li>
  <li>Contributed to the preparation of the Q1 2026 Annual Maintenance Programme (AMP), identifying 14 priority maintenance items across transmission lines in the Northern Interconnected System.</li>
</ul>

<div class="cv-entry-header" style="margin-top:8px;"><span class="cv-entry-org">Volta River Authority (VRA) – Generation &amp; Transmission Division</span><span class="cv-entry-loc">Tema, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Electrical Engineering Intern</span><span class="cv-entry-date">Jul 2024 – Sep 2024</span></div>
<ul class="cv-bullets">
  <li>Rotated across Generation, Transmission, and System Control departments at Akosombo and Kpong plants — gained hands-on exposure to 160MW hydro generation units, step-up transformers, and SCADA monitoring systems.</li>
  <li>Developed a MATLAB/Simulink load-flow simulation model for a 12-bus section of the VRA transmission network, validating active and reactive power flows within 3% of measured field values.</li>
  <li>Compiled and cross-referenced monthly inspection reports for 5 generator units (totalling 640MW nameplate capacity), identifying 2 anomalies flagged for engineering review.</li>
  <li>Assisted in post-fault analysis of a protection misoperation on the Akosombo–Tema 161kV line, contributing findings to the Incident Report submitted to the Transmission Manager.</li>
</ul>

<div class="cv-entry-header" style="margin-top:8px;"><span class="cv-entry-org">Electricity Company of Ghana (ECG) – Brong-Ahafo Regional Office</span><span class="cv-entry-loc">Sunyani, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Electrical Engineering Intern – Distribution &amp; Maintenance</span><span class="cv-entry-date">Jun 2023 – Aug 2023</span></div>
<ul class="cv-bullets">
  <li>Deployed with the Fault &amp; Maintenance crew on 33kV and 11kV distribution line patrols covering 6 feeders serving over 4,000 customers across the Sunyani municipality — reduced average fault response time by 22% through improved patrol scheduling.</li>
  <li>Supported the installation, stringing, and testing of 3 new 315kVA pole-mounted distribution transformers in Fiapre and Atronie communities, directly restoring reliable supply to approximately 850 households.</li>
  <li>Calculated transformer loading ratios for 10 distribution transformers using field meter readings, identifying 2 units operating above 85% rated capacity and recommending deloading measures adopted by the Regional Engineer.</li>
  <li>Prepared technical field reports for 18 maintenance interventions, maintaining 100% documentation compliance for the regional supervisor's monthly submission to ECG headquarters.</li>
</ul>

<div class="cv-section-title">FINAL YEAR PROJECT</div>
<div class="cv-entry-header"><span class="cv-entry-title">Design and Simulation of a Grid-Tied 50kW Solar PV System — Bono Region, Ghana</span><span class="cv-entry-date">Jan 2025 – Jun 2025</span></div>
<ul class="cv-bullets">
  <li>Conducted site assessment and solar irradiance analysis using NASA POWER data for a selected community in the Bono Region with 6.2 kWh/m²/day average insolation.</li>
  <li>Designed a 50kW grid-tied PV system in PVsyst, specifying panel tilt, inverter sizing, string configuration, and protection scheme — projected annual energy yield of 72,500 kWh with PR of 81.4%.</li>
  <li>Performed harmonic distortion analysis and developed a filter design in MATLAB to reduce THD from 8.3% to under 3% as per IEEE 519-2022 standards.</li>
  <li>Produced full technical documentation (single-line diagram, equipment schedule, load flow report) and presented findings to a panel of 5 faculty assessors, receiving a score of 94/100.</li>
</ul>

<div class="cv-section-title">LEADERSHIP EXPERIENCE</div>
<div class="cv-entry-header"><span class="cv-entry-title">General Secretary, Electrical &amp; Electronics Engineering Students' Association (ELEESA-UENR)</span><span class="cv-entry-date">Oct 2023 – Sep 2024</span></div>
<ul class="cv-bullets">
  <li>Planned and executed 4 technical seminars — topics included Power System Stability and Renewable Energy Integration — attended by 150+ engineering students and 6 industry speakers from GRIDCo, ECG, and BXC Energy.</li>
  <li>Organised 2 industry immersion visits to GRIDCo's Tema Substation and ECG's Brong-Ahafo Region, coordinating logistics for 45 students and securing GHS 8,500 in sponsorship from 3 corporate partners.</li>
  <li>Managed the association's official correspondence, budget records, and meeting minutes — improved administrative response time by 40% by introducing a shared digital filing system.</li>
</ul>
<div class="cv-entry-header" style="margin-top:8px;"><span class="cv-entry-title">Project Team Lead, Arduino &amp; Embedded Systems Bootcamp (ELEESA-UENR)</span><span class="cv-entry-date">Aug 2023</span></div>
<ul class="cv-bullets">
  <li>Led a 4-person team to build an automated street lighting prototype using Arduino, LDR sensors, and relay modules — demonstrated live to 80+ students at the closing exhibition.</li>
</ul>

<div class="cv-section-title">SKILLS</div>
<div style="font-size:10pt; margin-bottom:4px;"><strong>Power &amp; Electrical:</strong> Power System Analysis, Protection Relay Coordination, Load Flow Studies (ETAP, MATLAB/Simulink), Substation Design, AutoCAD Electrical, PVsyst</div>
<div style="font-size:10pt; margin-bottom:4px;"><strong>Programming &amp; Software:</strong> Python (NumPy, Pandas), MATLAB, C/C++, Multisim, Microsoft Excel (Advanced), PLC Basics (Siemens S7)</div>
<div style="font-size:10pt; margin-bottom:4px;"><strong>Professional:</strong> Technical Report Writing, Project Management, Engineering Presentations, Root-Cause Fault Analysis, Team Leadership</div>
<div style="font-size:10pt;"><strong>Languages:</strong> English (Fluent), Twi (Fluent)</div>

<div class="cv-section-title">CERTIFICATIONS &amp; AWARDS</div>
<ul class="cv-awards-list">
  <li>Best Engineering Final Year Project, UENR School of Engineering Annual Fair (2025) — Solar PV Design Project</li>
  <li>Best Engineering Project Presentation, UENR School of Engineering Annual Fair (2024)</li>
  <li>Certificate of Completion, Introduction to Renewable Energy Systems, Coursera – Duke University (2024)</li>
  <li>Certificate of Participation, 5-Day Arduino &amp; Embedded Systems Programming Bootcamp, ELEESA-UENR (2023)</li>
  <li>Certificate of Completion, Python for Everybody (Specialisation), Coursera – University of Michigan (2023)</li>
</ul>

<div class="cv-section-title">PROFESSIONAL BODIES</div>
<ul class="cv-awards-list">
  <li>Student Member, Ghana Institution of Engineering (GhIE)</li>
  <li>Student Member, Institute of Electrical and Electronics Engineers (IEEE) – Ghana Section</li>
</ul>`,

  national_service: `<div class="cv-name">KWAME ASANTE BOATENG</div>
<div class="cv-contact">kwameboateng@gmail.com | +233 50 123 4567 | linkedin.com/in/kwame-boateng</div>
<div class="cv-section-title">EDUCATION</div>
<div class="cv-entry-header"><span class="cv-entry-org">Kwame Nkrumah University of Science and Technology (KNUST)</span><span class="cv-entry-loc">Kumasi, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">BSc. Business Administration (Finance Option)</span><span class="cv-entry-date">Sep 2020 – Jun 2024</span></div>
<div style="font-size:10pt; margin-top:2px;">Academic Standing: Second Class Upper | CGPA: 3.6/4.0</div>
<div style="font-size:10pt;">Relevant Courses: Corporate Finance, Business Statistics, Financial Management, Entrepreneurship</div>
<div class="cv-section-title">PROFESSIONAL EXPERIENCE</div>
<div class="cv-entry-header"><span class="cv-entry-org">Ecobank Ghana Limited</span><span class="cv-entry-loc">Kumasi, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Finance Intern</span><span class="cv-entry-date">Jun 2023 – Aug 2023</span></div>
<ul class="cv-bullets">
  <li>Analysed 10+ customer financial profiles to support loan application decisions, contributing to a GHS 200,000 lending portfolio review.</li>
  <li>Developed weekly Excel reports for branch management, improving visibility of key retail banking metrics by 30%.</li>
  <li>Assisted in onboarding 8 new business clients, expanding the branch's SME customer base.</li>
</ul>
<div class="cv-section-title">LEADERSHIP EXPERIENCE</div>
<div class="cv-entry-header"><span class="cv-entry-title">Financial Secretary, KNUST Business Students Association</span><span class="cv-entry-date">Sep 2022 – Aug 2023</span></div>
<ul class="cv-bullets"><li>Managed a GHS 15,000 departmental budget, ensuring transparent reporting and a 20% reduction in administrative expenditure.</li></ul>
<div class="cv-section-title">SKILLS</div>
<div style="font-size:10pt; margin-bottom:4px;"><strong>Technical:</strong> Microsoft Excel (Advanced), PowerPoint, Word, Financial Modelling (Basic), Accounting Software (QuickBooks)</div>
<div style="font-size:10pt; margin-bottom:4px;"><strong>Professional:</strong> Communication, Analytical Thinking, Teamwork, Problem Solving</div>
<div style="font-size:10pt;"><strong>Languages:</strong> English (Fluent), Twi (Fluent), Fante (Intermediate)</div>
<div class="cv-section-title">CERTIFICATIONS & AWARDS</div>
<ul class="cv-awards-list">
  <li>Best Finance Student Award, KNUST SoBS (2024)</li>
  <li>Certificate of Completion, Google Digital Marketing Fundamentals (2023)</li>
</ul>`,

  postgrad: `<div class="cv-name">ABENA ASIEDUA FRIMPONG</div>
<div class="cv-contact">afrimpong@gmail.com | +233 24 765 4321 | linkedin.com/in/abena-frimpong</div>
<div class="cv-section-title">EDUCATION</div>
<div class="cv-entry-header"><span class="cv-entry-org">University of Ghana, Legon</span><span class="cv-entry-loc">Accra, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">BSc. Economics</span><span class="cv-entry-date">Sep 2018 – Jun 2022</span></div>
<div style="font-size:10pt; margin-top:2px;">Academic Standing: First Class Honours | CGPA: 3.92/4.00</div>
<div style="font-size:10pt;">Relevant Courses: Econometrics, Development Economics, Public Finance, Research Methods</div>
<div class="cv-section-title">PROFESSIONAL EXPERIENCE</div>
<div class="cv-entry-header"><span class="cv-entry-org">Ghana Revenue Authority</span><span class="cv-entry-loc">Accra, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Research & Policy Analyst</span><span class="cv-entry-date">Aug 2022 – Present</span></div>
<ul class="cv-bullets">
  <li>Developed econometric models to forecast tax revenue for the 2024 National Budget, with outputs adopted in official budget documentation.</li>
  <li>Authored 3 policy briefs on VAT compliance and informal sector taxation, presented to the Commissioner-General and Ministry of Finance.</li>
  <li>Led a team of 4 analysts to evaluate the fiscal impact of tax exemptions in the 2023 Annual Revenue Report.</li>
</ul>
<div class="cv-entry-header" style="margin-top:8px;"><span class="cv-entry-org">Institute of Statistical, Social and Economic Research (ISSER), UG</span><span class="cv-entry-loc">Accra, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Research Assistant</span><span class="cv-entry-date">Jan 2022 – Jul 2022</span></div>
<ul class="cv-bullets">
  <li>Assisted in data collection and analysis for a World Bank-funded study on financial inclusion in rural Ghana, covering 500+ household surveys.</li>
  <li>Contributed to three published working papers on poverty dynamics and social protection in sub-Saharan Africa.</li>
</ul>
<div class="cv-section-title">SKILLS & RESEARCH METHODS</div>
<div style="font-size:10pt; margin-bottom:4px;"><strong>Statistical Software:</strong> Stata, R, SPSS, Python (Pandas, NumPy)</div>
<div style="font-size:10pt; margin-bottom:4px;"><strong>Research:</strong> Econometric Modelling, Survey Design, Qualitative & Quantitative Analysis, Policy Evaluation</div>
<div style="font-size:10pt;"><strong>Languages:</strong> English (Fluent), French (Intermediate)</div>
<div class="cv-section-title">CERTIFICATIONS & AWARDS</div>
<ul class="cv-awards-list">
  <li>Vice-Chancellor's Award for Academic Excellence, University of Ghana (2022)</li>
  <li>African Economic Research Consortium (AERC) Short Course Certificate in Macroeconomics (2023)</li>
  <li>Best Graduating Student, Department of Economics, University of Ghana (2022)</li>
</ul>`,

  oil_gas: `<div class="cv-name">EMMANUEL ASANTE ACHEAMPONG</div>
<div class="cv-contact">e.acheampong@gmail.com | +233 20 456 7890 | linkedin.com/in/emmanuel-acheampong-eng</div>

<div class="cv-section-title">EDUCATION</div>
<div class="cv-entry-header"><span class="cv-entry-org">Kwame Nkrumah University of Science &amp; Technology (KNUST)</span><span class="cv-entry-loc">Kumasi, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">BSc. Chemical Engineering</span><span class="cv-entry-date">Sep 2019 – Jun 2023</span></div>
<div style="font-size:10pt; margin-top:2px;">Academic Standing: First Class Honours &nbsp;|&nbsp; CGPA: 3.78 / 4.00</div>
<div style="font-size:10pt; margin-top:1px;">Final Year Project: Optimisation of Gas Processing Parameters at a Simulated Upstream Separator — Supervisor: Prof. K. Agyemang, Dept. of Chemical Engineering.</div>
<div style="font-size:10pt; margin-top:1px;">Relevant Courses: Petroleum Refining &amp; Petrochemicals, Thermodynamics, Mass Transfer, Process Simulation (Aspen HYSYS), HSE Management, Fluid Mechanics</div>

<div class="cv-section-title">PROFESSIONAL EXPERIENCE</div>
<div class="cv-entry-header"><span class="cv-entry-org">Ghana National Petroleum Corporation (GNPC)</span><span class="cv-entry-loc">Accra, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">National Service Personnel – Upstream Operations &amp; Technical Services</span><span class="cv-entry-date">Oct 2023 – Sep 2024</span></div>
<ul class="cv-bullets">
  <li>Supported the Technical Services team in monitoring production data from the Jubilee and TEN fields (combined capacity ~100,000 bopd), preparing daily production variance reports that flagged a 4.3% decline trend prompting an engineering review.</li>
  <li>Assisted in the preparation of the Q2 2024 Well Integrity Assessment Report for 6 producing wells, compiling pressure build-up test data and gas-oil ratio trends across 3 reservoir zones.</li>
  <li>Participated in a 3-day offshore logistics and HSE orientation at the Jubilee FPSO — certified in Well Control Level 1 (IWCF) and Offshore Survival &amp; Firefighting (OPITO BOSIET).</li>
  <li>Developed an Excel macro tool to automate reconciliation of daily oil allocation data from 4 co-venturers, reducing manual processing time by 60% and eliminating a recurring discrepancy in the monthly production statement.</li>
  <li>Contributed to the Environmental Impact Assessment (EIA) review for a proposed gas flare-out project, researching international best practices and summarising findings in a 12-page technical note adopted by the Environmental Affairs unit.</li>
</ul>
<div class="cv-entry-header" style="margin-top:8px;"><span class="cv-entry-org">Tullow Oil Ghana Limited</span><span class="cv-entry-loc">Accra, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Process Engineering Intern</span><span class="cv-entry-date">Jun 2022 – Aug 2022</span></div>
<ul class="cv-bullets">
  <li>Assigned to the Process &amp; Facilities team supporting topsides operations at the Jubilee FPSO — rotated across separation, compression, and water injection modules.</li>
  <li>Built an Aspen HYSYS simulation model for a 3-stage separator to evaluate the effect of inlet GOR variation on gas export quality, findings validated against measured field data to within 2.1%.</li>
  <li>Conducted a root-cause analysis of recurring high-level alarms on the produced water treatment unit, identifying a calibration drift in 2 level transmitters — recommended remedial action adopted by the Maintenance Supervisor.</li>
  <li>Prepared a Process Flow Diagram (PFD) update for a new chemical injection skid, collaborating with the Integrity and Instrumentation teams to ensure accuracy for the Management of Change (MOC) package.</li>
</ul>
<div class="cv-entry-header" style="margin-top:8px;"><span class="cv-entry-org">Tema Oil Refinery (TOR)</span><span class="cv-entry-loc">Tema, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Chemical Engineering Intern – Refinery Operations</span><span class="cv-entry-date">Jul 2021 – Aug 2021</span></div>
<ul class="cv-bullets">
  <li>Rotated through Crude Distillation Unit (CDU), Fluid Catalytic Cracking (FCC), and Utilities departments — logged operating parameters and compiled shift handover reports for 3 process units.</li>
  <li>Assisted in a heat exchanger fouling study, calculating heat transfer coefficients from plant data and estimating an 8.5% reduction in thermal efficiency on the CDU preheat train.</li>
</ul>

<div class="cv-section-title">LEADERSHIP EXPERIENCE</div>
<div class="cv-entry-header"><span class="cv-entry-title">President, Chemical Engineering Students' Association (CESA-KNUST)</span><span class="cv-entry-date">Oct 2021 – Sep 2022</span></div>
<ul class="cv-bullets">
  <li>Led a 12-member executive team, organising 3 industry talks (GNPC, TOR, Unilever) and an annual inter-departmental process design competition attended by 200+ students.</li>
  <li>Secured GHS 22,000 in sponsorship from 4 corporate partners to fund the association's Annual Dinner and Awards ceremony — largest fundraise in the association's 8-year history.</li>
</ul>

<div class="cv-section-title">SKILLS</div>
<div style="font-size:10pt; margin-bottom:4px;"><strong>Process &amp; Engineering:</strong> Aspen HYSYS, Aspen Plus, AutoCAD P&amp;ID, MATLAB, Python, Microsoft Excel (Advanced VBA), Gas Chromatography (Basic)</div>
<div style="font-size:10pt; margin-bottom:4px;"><strong>Industry:</strong> Upstream Operations, Separator Design, Well Integrity, Flare Management, HAZOP Studies (Participant), Permit-to-Work (PTW) Systems</div>
<div style="font-size:10pt; margin-bottom:4px;"><strong>HSE:</strong> IWCF Well Control Level 1, OPITO BOSIET (Offshore Survival), ISO 14001 Environmental Awareness</div>
<div style="font-size:10pt;"><strong>Languages:</strong> English (Fluent), Twi (Fluent)</div>

<div class="cv-section-title">CERTIFICATIONS &amp; AWARDS</div>
<ul class="cv-awards-list">
  <li>IWCF Well Control Level 1 Certification (Subsea) — International Well Control Forum (2024)</li>
  <li>OPITO BOSIET — Offshore Survival &amp; Firefighting Certification (2024)</li>
  <li>First Class Honours, BSc Chemical Engineering, KNUST (2023)</li>
  <li>Best Final Year Project, Department of Chemical Engineering, KNUST (2023)</li>
  <li>Aspen HYSYS Process Simulation Certificate, AspenTech (2022)</li>
</ul>

<div class="cv-section-title">PROFESSIONAL BODIES</div>
<ul class="cv-awards-list">
  <li>Graduate Member, Ghana Institution of Engineering (GhIE)</li>
  <li>Student Member, Society of Petroleum Engineers (SPE) – Ghana Section</li>
</ul>`,

  mining: `<div class="cv-name">ABIGAIL KONADU ASANTE</div>
<div class="cv-contact">a.asante.mining@gmail.com | +233 27 345 6789 | linkedin.com/in/abigail-asante-mining</div>

<div class="cv-section-title">EDUCATION</div>
<div class="cv-entry-header"><span class="cv-entry-org">University of Mines and Technology (UMaT)</span><span class="cv-entry-loc">Tarkwa, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">BSc. Mining Engineering</span><span class="cv-entry-date">Sep 2019 – Jun 2023</span></div>
<div style="font-size:10pt; margin-top:2px;">Academic Standing: Second Class Upper (Honours) &nbsp;|&nbsp; CGPA: 3.54 / 4.00</div>
<div style="font-size:10pt; margin-top:1px;">Final Year Project: Slope Stability Analysis for the Southern Cutback of the Damang Open-Pit Mine using Rocscience RS2 — achieved factor of safety of 1.42 under saturated conditions.</div>
<div style="font-size:10pt; margin-top:1px;">Relevant Courses: Rock Mechanics, Mine Planning &amp; Design, Drill &amp; Blast Engineering, Mine Ventilation, Environmental Management in Mining, Ore Reserve Estimation, Geotechnical Engineering</div>

<div class="cv-section-title">PROFESSIONAL EXPERIENCE</div>
<div class="cv-entry-header"><span class="cv-entry-org">AngloGold Ashanti (Obuasi Mine)</span><span class="cv-entry-loc">Obuasi, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">National Service Personnel – Underground Mine Planning &amp; Technical Services</span><span class="cv-entry-date">Oct 2023 – Sep 2024</span></div>
<ul class="cv-bullets">
  <li>Supported the Mine Planning team in updating the Annual Mine Plan for Levels 42–47 of the Obuasi underground mine, contributing to short-range scheduling of 4 active stopes with combined planned ore tonnage of 38,000 t/month.</li>
  <li>Conducted daily underground inspection rounds on active development headings, recording advance rates, support conditions, and blast results — maintained a 100% reporting compliance rate for the 8-month period.</li>
  <li>Performed ore reserve reconciliation between the geological block model and actual mined tonnage for Q1 2024, identifying a 6.2% dilution variance in Stope 4215 and presenting findings to the Mine Manager.</li>
  <li>Assisted in the design of 3 crown pillar configurations using Rocscience Examine3D, evaluating failure risk under varying stress conditions — designs adopted in the H2 2024 stope extraction sequence.</li>
  <li>Compiled the weekly Blasting Performance Report, tracking powder factor, fragmentation index, and overbreak volumes across 12 blast events, contributing to a 9% improvement in average fragmentation score over the service year.</li>
</ul>
<div class="cv-entry-header" style="margin-top:8px;"><span class="cv-entry-org">Gold Fields Ghana (Tarkwa Mine)</span><span class="cv-entry-loc">Tarkwa, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Mining Engineering Intern – Open Pit Operations</span><span class="cv-entry-date">Jun 2022 – Aug 2022</span></div>
<ul class="cv-bullets">
  <li>Embedded with the Drill &amp; Blast team on Tarkwa's South Pit — assisted in blast design calculations (burden, spacing, stemming) for 8 production blasts targeting a 15m bench height in oxide ore.</li>
  <li>Used Vulcan 3D software to generate pit outline cross-sections for a proposed pushback, verifying slope angles against the Geotechnical Design Parameters Manual and flagging a 3° inconsistency for review.</li>
  <li>Shadowed the Grade Control Geologist on ore–waste boundary delineation, sampling 22 blast holes and contributing to the daily dig-limit map used by the excavator operators.</li>
  <li>Prepared a mine site water management audit comparing the actual tailings dam freeboard level against the ICMM Standard — identified a 0.4m shortfall and escalated to the Environmental Coordinator.</li>
</ul>
<div class="cv-entry-header" style="margin-top:8px;"><span class="cv-entry-org">Ghana Manganese Company (GMC)</span><span class="cv-entry-loc">Nsuta, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Mining Engineering Intern – Open Cast Operations</span><span class="cv-entry-date">Jul 2021 – Aug 2021</span></div>
<ul class="cv-bullets">
  <li>Supported dragline and shovel operations on the main open-cast benches, monitoring daily production KPIs (tonnes moved, fuel consumption, downtime hours) and reporting against budget targets.</li>
  <li>Assisted in a haul road condition assessment covering 4.2km of mine roads, logging rut depth, surface defects, and drainage blockages — survey informed the Q3 maintenance priority schedule.</li>
</ul>

<div class="cv-section-title">LEADERSHIP EXPERIENCE</div>
<div class="cv-entry-header"><span class="cv-entry-title">Vice President, Mining Engineering Students' Association (MESA-UMaT)</span><span class="cv-entry-date">Oct 2021 – Sep 2022</span></div>
<ul class="cv-bullets">
  <li>Co-organised the annual MESA Underground Mine Tour to AngloGold Ashanti Obuasi for 55 students, managing logistics, safety inductions, and post-visit technical reports — received the Dean's commendation for industry engagement.</li>
  <li>Launched a peer-tutoring programme for 2nd-year Rock Mechanics students, recruiting 6 tutors and improving the cohort's average assessment score by 18%.</li>
</ul>

<div class="cv-section-title">SKILLS</div>
<div style="font-size:10pt; margin-bottom:4px;"><strong>Mining Software:</strong> Vulcan 3D (Intermediate), Rocscience Suite (RS2, Slide, Examine3D), AutoCAD, Surpac (Basic), Microsoft Excel (Advanced)</div>
<div style="font-size:10pt; margin-bottom:4px;"><strong>Technical:</strong> Slope Stability Analysis, Drill &amp; Blast Design, Underground Mine Planning, Ore Reserve Estimation (JORC Framework), Geotechnical Monitoring, Ventilation Calculations</div>
<div style="font-size:10pt; margin-bottom:4px;"><strong>HSE:</strong> ICMM Tailings Standard Awareness, Mine Rescue (Trained), Permit-to-Work (PTW), GHS Mining Regulations (LI 2182)</div>
<div style="font-size:10pt;"><strong>Languages:</strong> English (Fluent), Twi (Fluent), Fante (Intermediate)</div>

<div class="cv-section-title">CERTIFICATIONS &amp; AWARDS</div>
<ul class="cv-awards-list">
  <li>Best Final Year Project, Department of Mining Engineering, UMaT (2023) — Slope Stability Analysis, Damang Mine</li>
  <li>Certificate of Completion, Rocscience RS2 Geotechnical Analysis Training, UMaT (2023)</li>
  <li>Mine Rescue Certificate, Ghana Mines Rescue Brigade, UMaT (2022)</li>
  <li>Merit Award, UMaT School of Engineering &amp; Technology (2022) — Top 5 in Year 3 cohort</li>
</ul>

<div class="cv-section-title">PROFESSIONAL BODIES</div>
<ul class="cv-awards-list">
  <li>Graduate Member, Ghana Institution of Engineering (GhIE)</li>
  <li>Student Member, Australasian Institute of Mining and Metallurgy (AusIMM) – Student Chapter</li>
</ul>`,

  renewable: `<div class="cv-name">DANIEL OFORI-MENSAH</div>
<div class="cv-contact">d.oforimensah@gmail.com | +233 55 678 9012 | linkedin.com/in/daniel-ofori-mensah</div>

<div class="cv-section-title">EDUCATION</div>
<div class="cv-entry-header"><span class="cv-entry-org">Kwame Nkrumah University of Science &amp; Technology (KNUST)</span><span class="cv-entry-loc">Kumasi, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">BSc. Mechanical Engineering</span><span class="cv-entry-date">Sep 2019 – Jun 2023</span></div>
<div style="font-size:10pt; margin-top:2px;">Academic Standing: Second Class Upper (Honours) &nbsp;|&nbsp; CGPA: 3.65 / 4.00</div>
<div style="font-size:10pt; margin-top:1px;">Final Year Project: Performance Analysis of a Hybrid Solar-Wind Mini-Grid System for a Rural Community in Northern Ghana — simulated in HOMER Pro with optimal LCOE of $0.19/kWh.</div>
<div style="font-size:10pt; margin-top:1px;">Relevant Courses: Thermodynamics, Heat Transfer, Renewable Energy Technology, Engineering Materials, Fluid Mechanics, Mechanical Design, CAD/CAM, Project Management</div>

<div class="cv-section-title">PROFESSIONAL EXPERIENCE</div>
<div class="cv-entry-header"><span class="cv-entry-org">BXC Energy Ghana Limited</span><span class="cv-entry-loc">Accra, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">National Service Personnel – Solar Projects &amp; Engineering</span><span class="cv-entry-date">Oct 2023 – Sep 2024</span></div>
<ul class="cv-bullets">
  <li>Supported the delivery of 6 rooftop solar PV installations (ranging from 15kW to 120kW) for commercial and industrial clients in Greater Accra and Ashanti regions, contributing to a combined installed capacity of 385kWp within the service year.</li>
  <li>Conducted pre-installation site assessments (roof load surveys, shading analysis, grid connection studies) for 11 prospective projects and compiled feasibility reports adopted directly in client proposals worth a combined GHS 3.2m.</li>
  <li>Used PVsyst and AutoCAD to produce system design drawings, energy yield simulations, and single-line diagrams for 4 projects, achieving within 5% accuracy against post-commissioning measured output on 3 completed sites.</li>
  <li>Coordinated with the procurement team on equipment specifications for inverters and mounting structures, comparing technical datasheets for 7 supplier quotations and recommending selections that reduced average BOS cost by 12%.</li>
  <li>Developed a commissioning checklist and handover documentation template adopted company-wide, reducing post-handover technical queries from clients by an estimated 30%.</li>
</ul>
<div class="cv-entry-header" style="margin-top:8px;"><span class="cv-entry-org">Public Utilities Regulatory Commission (PURC)</span><span class="cv-entry-loc">Accra, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Engineering Intern – Renewable Energy &amp; Technical Regulation</span><span class="cv-entry-date">Jun 2022 – Aug 2022</span></div>
<ul class="cv-bullets">
  <li>Assisted the Technical Division in reviewing 8 mini-grid licence applications, assessing technical specifications for compliance with the PURC Renewable Energy Act (Act 832) and the Mini-Grid Regulations (LI 2395).</li>
  <li>Compiled a comparative analysis of mini-grid tariff structures across 5 West African regulatory jurisdictions (Ghana, Senegal, Nigeria, Sierra Leone, Uganda) — research used in the preparation of PURC's 2022 Mini-Grid Policy Position Paper.</li>
  <li>Participated in a 2-day technical site inspection of a 100kW solar mini-grid project in the Savannah Region, evaluating battery bank condition, protection relay settings, and metering accuracy against approved design documentation.</li>
</ul>
<div class="cv-entry-header" style="margin-top:8px;"><span class="cv-entry-org">Mechanical Engineering Workshop, KNUST</span><span class="cv-entry-loc">Kumasi, Ghana</span></div>
<div class="cv-entry-header"><span class="cv-entry-title">Research Assistant – Solar Thermal Performance Testing</span><span class="cv-entry-date">Jan 2023 – Jun 2023</span></div>
<ul class="cv-bullets">
  <li>Built and instrumented a flat-plate solar collector test rig for a departmental research project, logging temperature, flow rate, and irradiance data across 60+ test cycles.</li>
  <li>Analysed collector efficiency curves using MATLAB, demonstrating a 14% improvement in thermal output with a double-glazed cover plate — findings submitted to the Journal of Renewable &amp; Sustainable Energy (under review).</li>
</ul>

<div class="cv-section-title">LEADERSHIP EXPERIENCE</div>
<div class="cv-entry-header"><span class="cv-entry-title">Coordinator, Clean Energy Student Initiative (CESI-KNUST)</span><span class="cv-entry-date">Sep 2021 – Jun 2023</span></div>
<ul class="cv-bullets">
  <li>Co-founded and led a 35-member student energy advocacy group — organised Ghana's first student-led Solar Rooftop Campaign, engaging 400+ students on the economics and environmental impact of distributed solar generation.</li>
  <li>Partnered with BXC Energy and the Energy Commission to host a 2-day Clean Energy Career Forum attended by 180 students and 9 industry speakers — received the Vice-Chancellor's Award for Student Innovation (2022).</li>
</ul>

<div class="cv-section-title">SKILLS</div>
<div style="font-size:10pt; margin-bottom:4px;"><strong>Renewable Energy:</strong> PVsyst, HOMER Pro, SAM (NREL), MATLAB/Simulink, SolarEdge Monitoring, AutoCAD (Electrical Layouts), PV System Design, Mini-Grid Sizing</div>
<div style="font-size:10pt; margin-bottom:4px;"><strong>Mechanical:</strong> SolidWorks (3D Modelling), ANSYS Fluent (Basic CFD), Thermodynamic System Analysis, Heat Exchanger Design, AutoCAD Mechanical</div>
<div style="font-size:10pt; margin-bottom:4px;"><strong>Professional:</strong> Technical Proposal Writing, Project Management (MS Project), Stakeholder Reporting, Procurement Support, Commissioning Documentation</div>
<div style="font-size:10pt;"><strong>Languages:</strong> English (Fluent), Twi (Fluent), French (Basic)</div>

<div class="cv-section-title">CERTIFICATIONS &amp; AWARDS</div>
<ul class="cv-awards-list">
  <li>Vice-Chancellor's Award for Student Innovation, KNUST (2022) — Clean Energy Career Forum</li>
  <li>Best Final Year Project, Department of Mechanical Engineering, KNUST (2023)</li>
  <li>Solar Energy International (SEI) — PV Design Certificate (2023)</li>
  <li>Certificate of Completion, HOMER Pro Microgrid Design, Homer Energy (2022)</li>
  <li>Certificate of Completion, Introduction to Sustainable Energy, edX – MIT (2022)</li>
</ul>

<div class="cv-section-title">PROFESSIONAL BODIES</div>
<ul class="cv-awards-list">
  <li>Graduate Member, Ghana Institution of Engineering (GhIE)</li>
  <li>Member, Ghana Renewable Energy Association (GREA)</li>
</ul>`,

  cover_letter_sample: `<div style="font-family:'Times New Roman',serif;font-size:11pt;line-height:1.8;color:#000;padding:8px 0;">
<p style="margin-bottom:18px;">15 October 2025</p>

<p style="margin-bottom:18px;">The Head of Graduate Recruitment<br>
Ghana Grid Company Limited (GRIDCo)<br>
Electro Volta House, Accra<br>
Ghana</p>

<p style="margin-bottom:18px;"><strong>RE: Application for Graduate Electrical Engineer — Transmission System Operations</strong></p>

<p style="margin-bottom:14px;">When Ghana's national grid faced its most severe load-shedding crisis in a decade, GRIDCo's System Operations team managed the country's 161kV/330kV transmission network through it — balancing generation dispatch, managing emergency outages, and keeping industrial production running across the country. That operational complexity is precisely where I want to build my career, and where I believe I can contribute immediately.</p>

<p style="margin-bottom:14px;">As a National Service Personnel in GRIDCo's System Operations &amp; Maintenance Planning Department since October 2025, I have already developed a working understanding of your environment: monitoring real-time power flow in the National Control Centre, contributing to the Pokuase 330/161kV substation commissioning, and redesigning 12 weekly reporting templates that reduced preparation time by 35%. Before joining GRIDCo, I built a load-flow simulation model in MATLAB/Simulink for a 12-bus section of the VRA transmission network — validating active and reactive power flows within 3% of measured field values — and designed a 50kW grid-tied solar PV system achieving a performance ratio of 81.4%, which was awarded Best Final Year Project at the UENR School of Engineering Annual Fair 2025.</p>

<p style="margin-bottom:14px;">GRIDCo's Graduate Engineer programme offers structured exposure across Transmission Planning, System Operations, and Protection &amp; Control — the three technical pillars that underpin every aspect of Ghana's energy transition. My hands-on experience across GRIDCo, VRA, and ECG, combined with proficiency in ETAP, MATLAB/Simulink, and AutoCAD Electrical, means I can contribute from day one while developing the depth your senior engineering roles demand. I am particularly motivated by GRIDCo's ongoing work on the Coastal Transmission Backbone and the integration of utility-scale renewables — challenges I have studied academically and encountered first-hand during my service.</p>

<p style="margin-bottom:18px;">I would welcome the opportunity to discuss how my background and commitment to Ghana's power sector can support GRIDCo's mission. Thank you for your time and consideration.</p>

<p style="margin-bottom:4px;">Yours faithfully,</p>
<p style="margin-bottom:4px;"><strong>KWABENA MENSAH BOATENG</strong></p>
<p style="margin-bottom:0px;">BSc. Electrical &amp; Electronics Engineering (Second Class Upper), UENR</p>
<p style="margin-bottom:0px;">kboateng.eng@gmail.com &nbsp;|&nbsp; +233 24 876 5432</p>
</div>`
};

function showSample(key) {
  document.getElementById('modalContent').innerHTML = sampleData[key] || '<p>Sample not found.</p>';
  document.getElementById('sampleModal').classList.add('active');
  document.getElementById('sampleModal').dataset.currentKey = key;
  // Update modal title for cover letter sample
  const titleEl = document.getElementById('sampleModalTitle');
  if (titleEl) {
    if (key === 'cover_letter_sample') {
      titleEl.textContent = 'Sample Cover Letter — GRIDCo Graduate Engineer';
    } else {
      titleEl.textContent = 'Sample CV';
    }
  }
}

function downloadSampleCV() {
  const content = document.getElementById('modalContent').innerHTML;
  const key = document.getElementById('sampleModal').dataset.currentKey || 'sample';
  const names = {
    veronica: 'Veronica_Mensah_CV',
    engineering: 'Kwabena_Mensah_Boateng_CV',
    national_service: 'National_Service_Sample_CV',
    postgrad: 'Postgraduate_Sample_CV',
    oil_gas: 'Emmanuel_Acheampong_CV',
    mining: 'Abigail_Asante_CV',
    renewable: 'Daniel_Ofori_Mensah_CV',
    cover_letter_sample: 'Sample_Cover_Letter_GRIDCo'
  };
  printCV(content, names[key] || 'Sample_CV');
}

function useSampleAsTemplate() {
  const content = document.getElementById('modalContent').innerText;
  // Switch to builder, paste into the paste area encouragement
  closeSampleModal(null, true);
  scrollToSection('build');
  showToast('Study this sample and use the Builder below to create your own version!');
}

function closeSampleModal(e, force) {
  if (force || (e && e.target === document.getElementById('sampleModal'))) {
    document.getElementById('sampleModal').classList.remove('active');
  }
}

// ===== TOAST NOTIFICATIONS =====
let toastTimer;
function showToast(message, isError = false) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast${isError ? ' error' : ''}`;
  requestAnimationFrame(() => toast.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

// ===== CV SCORE ENGINE =====
function scoreCVFromPaste() {
  const text = document.getElementById('cvPasteText').value.trim();
  if (!text) { showToast('Please paste your CV text first in Step 2.', true); return; }
  const target = document.querySelector('input[name="target"]:checked')?.value || 'general';
  showCVScore(text, target);
}

function scoreBuiltCV() {
  const firstName = document.getElementById('b-firstName').value.trim();
  const lastName = document.getElementById('b-lastName').value.trim();
  if (!firstName || !lastName) { showToast('Please fill in your details first.', true); return; }
  // Build a text representation of the CV for scoring
  const html = document.getElementById('cvPreviewContainer').innerHTML;
  const text = document.getElementById('cvPreviewContainer').innerText || '';
  if (text.includes('Generate Preview') || text.length < 50) {
    showToast('Please generate a preview first.', true); return;
  }
  showCVScore(text, 'general');
}

function showCVScore(text, target) {
  const scores = calculateCVScore(text, target);
  const total = Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length);
  const grade = total >= 85 ? { label: 'Excellent', color: '#006b3f' }
    : total >= 70 ? { label: 'Good', color: '#2196F3' }
    : total >= 55 ? { label: 'Average', color: '#FF9800' }
    : { label: 'Needs Work', color: '#ce1126' };

  let html = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="width:100px;height:100px;border-radius:50%;background:${grade.color};color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto 12px;font-family:'Inter',sans-serif;">
        <span style="font-size:2rem;font-weight:800;">${total}</span>
        <span style="font-size:0.7rem;font-weight:600;opacity:0.9;">/ 100</span>
      </div>
      <div style="font-size:1.3rem;font-weight:700;color:${grade.color};font-family:'Inter',sans-serif;">${grade.label}</div>
      <div style="font-size:0.85rem;color:#5a5a7a;font-family:'Inter',sans-serif;margin-top:4px;">CV Overall Score</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;font-family:'Inter',sans-serif;">`;

  scores.forEach(s => {
    const pct = Math.min(100, Math.max(0, s.score));
    const barColor = pct >= 80 ? '#006b3f' : pct >= 60 ? '#2196F3' : pct >= 40 ? '#FF9800' : '#ce1126';
    html += `
      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
          <span style="font-size:0.85rem;font-weight:600;color:#1a1a2e;">${s.label}</span>
          <span style="font-size:0.85rem;font-weight:700;color:${barColor};">${pct}%</span>
        </div>
        <div style="background:#f0f0f8;border-radius:100px;height:8px;overflow:hidden;">
          <div style="width:${pct}%;background:${barColor};height:100%;border-radius:100px;transition:width 1s ease;"></div>
        </div>
        <p style="font-size:0.78rem;color:#5a5a7a;margin-top:4px;">${s.tip}</p>
      </div>`;
  });
  html += `</div>
    <div style="margin-top:20px;padding:14px;background:#e8f5ee;border-radius:10px;border-left:4px solid #006b3f;font-family:'Inter',sans-serif;">
      <p style="font-size:0.85rem;color:#004d2d;font-weight:600;">💡 Pro Tip:</p>
      <p style="font-size:0.83rem;color:#1a1a2e;margin-top:4px;">${getScoreTip(total, target)}</p>
    </div>`;

  document.getElementById('scoreContent').innerHTML = html;
  document.getElementById('scoreModal').classList.add('active');
}

function calculateCVScore(text, target) {
  const lower = text.toLowerCase();
  const actionVerbs = ['developed','built','led','executed','managed','analysed','analyzed','designed','increased','reduced','implemented','coordinated','delivered','achieved','established','oversaw','spearheaded','contributed','collaborated','streamlined','launched','created','improved','generated','negotiated','secured','drove','facilitated','authored','trained'];
  const weakPhrases = ['responsible for','was on','worked on','helped with','assisted in','duties included','tasked with','was involved in','was part of'];
  const hasQuantity = /\b\d+[\s%+,]/.test(text);
  const hasEmail = /[\w.]+@[\w.]+/.test(text);
  const hasPhone = /\+?\d[\d\s\-()]{8,}/.test(text);
  const hasLinkedIn = /linkedin\.com/i.test(text);
  const hasDates = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}/i.test(text);
  const hasActionVerb = actionVerbs.some(v => lower.includes(v));
  const weakCount = weakPhrases.filter(p => lower.includes(p)).length;
  const sectionCount = ['education','experience','skill','leadership','certif','award'].filter(s => lower.includes(s)).length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const lineCount = text.split('\n').filter(l => l.trim()).length;

  // Consistency checks
  const dateVariants = (text.match(/\b(January|February|March|April|June|July|August|September|October|November|December)\b/g) || []).length;
  const consistencyScore = dateVariants === 0 ? 90 : 60; // Mixing full months with abbreviated is penalised

  return [
    {
      label: 'Contact Information',
      score: (hasEmail ? 35 : 0) + (hasPhone ? 35 : 0) + (hasLinkedIn ? 30 : 0),
      tip: !hasEmail ? 'Add a professional email address.' : !hasPhone ? 'Add your phone number with country code (+233...).' : !hasLinkedIn ? 'Add your LinkedIn profile URL for more credibility.' : 'Contact information looks complete.'
    },
    {
      label: 'Section Structure',
      score: Math.min(100, sectionCount * 17),
      tip: sectionCount >= 5 ? 'Your CV has a well-rounded structure.' : `Add more sections — include Education, Experience, Skills, Leadership, and Certifications.`
    },
    {
      label: 'Action Language',
      score: hasActionVerb ? (weakCount === 0 ? 95 : weakCount === 1 ? 75 : 55) : 30,
      tip: !hasActionVerb ? 'Use strong action verbs: Developed, Built, Led, Executed, Analysed.' : weakCount > 0 ? `Remove weak phrases like "responsible for" or "was on" — replace with action verbs.` : 'Great use of action verbs throughout.'
    },
    {
      label: 'Quantified Achievements',
      score: hasQuantity ? 85 : 35,
      tip: hasQuantity ? 'Good — you have figures in your CV. Ensure every major bullet has a number.' : 'Add real figures to your bullets: percentages, cedis, team sizes, number of clients, etc.'
    },
    {
      label: 'Date Consistency',
      score: hasDates ? consistencyScore : 45,
      tip: !hasDates ? 'Ensure all dates are in a consistent format (e.g. Jun 2024).' : dateVariants > 0 ? 'Mix of full and abbreviated month names detected — use one format only (e.g. Jun 2024).' : 'Date format appears consistent.'
    },
    {
      label: 'Length & Density',
      score: wordCount < 50 ? 20 : wordCount < 150 ? 50 : wordCount < 500 ? 80 : wordCount < 900 ? 95 : 70,
      tip: wordCount < 150 ? 'Your CV seems too short — add more detail to your experience and achievements.' : wordCount > 900 ? 'Your CV may be too long — be more concise. Aim for 1 page (under 3 years experience).' : 'Good length and density for a professional CV.'
    },
  ];
}

function getScoreTip(total, target) {
  if (total >= 85) return 'Your CV is in great shape! Make sure to tailor the content for each specific opportunity you apply for.';
  if (total >= 70) return 'Good foundation. Focus on adding quantified achievements and strengthening your action verbs to push your score higher.';
  const tips = {
    banking: 'For banking & finance roles, quantify every achievement with deal values, portfolio sizes, or percentage improvements.',
    tech: 'For tech roles, highlight GitHub, technical certifications, and specific programming languages with proficiency levels.',
    academic: 'For academic applications, foreground your GPA, research experience, publications, and academic honours.',
    national_service: 'For national service, emphasise your academic standing, leadership roles, and community involvement.',
    postgraduate: 'For postgraduate applications, lead with your academic excellence, research interests, and relevant professional experience.'
  };
  return tips[target] || 'Focus on using strong action verbs, quantifying your impact with numbers, and ensuring all sections are complete.';
}

function closeScoreModal(e, force) {
  if (force || (e && e.target === document.getElementById('scoreModal'))) {
    document.getElementById('scoreModal').classList.remove('active');
  }
}

// ===== COVER LETTER GENERATOR =====

// ===== COVER LETTER GENERATOR =====

// OpenAI config — key loaded from config.js
const OPENAI_API_KEY = window.__OPENAI_KEY__ || '';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

async function generateCoverLetterAI(name, contact, target, role, cvText) {
  const today = new Date();
  const months = ['January','February','March','April','May','June','July','August',
                  'September','October','November','December'];
  const dateStr = `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;

  // Auto-detect name from CV text if not provided by caller
  if (!name && cvText) {
    const lines = cvText.split('\n').filter(l => l.trim());
    for (const line of lines.slice(0, 5)) {
      if (line.length < 60 && /^[A-Z][A-Z\s\-'.]+$/.test(line.trim())) {
        name = line.trim(); break;
      }
      if (line.length < 60 && /^[A-Z][a-z]+ [A-Z]/.test(line.trim())) {
        name = line.trim(); break;
      }
    }
  }
  name = name || 'Applicant';

  const targetLabel = TARGET_LABELS[target] || 'a Professional Position';

  const prompt = `You are a master cover letter writer with 20+ years of experience coaching candidates into top firms in Ghana, the UK, and globally. You write letters that get read — not skimmed — and that make recruiters pick up the phone.

Write a compelling, highly personalised cover letter for this applicant. Every sentence must earn its place.

━━━ PARAMETERS ━━━
APPLICANT NAME  : ${name}
TARGET          : ${targetLabel}${role ? ` — specifically: ${role}` : ''}
DATE            : ${dateStr}

━━━ LETTER REQUIREMENTS ━━━
FORMAT:
${dateStr}

Dear [appropriate salutation for the target — e.g. "Dear Hiring Manager," / "Dear Graduate Recruitment Team," / "Dear Admissions Committee,"],

RE: Application for [target — be specific if role is provided]

[Opening paragraph — DO NOT start with "I am writing to apply". Open with a strong hook: a specific achievement, a compelling statement about your fit, or a direct expression of value you bring. 2–3 sentences.]

[Second paragraph — draw 2–3 of the strongest, most specific achievements from the CV below. Include real figures, values, or outcomes. Show commercial awareness or domain expertise relevant to the target. 3–4 sentences.]

[Third paragraph — connect the applicant's background directly to the target opportunity. Show you understand what they are looking for and why this person is the answer. Be specific, not generic. 2–3 sentences.]

[Closing paragraph — confident, forward-looking call to action. Thank the reader. Express enthusiasm. 2 sentences.]

Yours faithfully,
${name}

RULES:
- British English spelling throughout
- 280–360 words total — not a word more
- Zero clichés: no "hardworking", no "team player", no "passionate about", no "I believe I would be a great fit"
- Every claim must be grounded in something from the CV below
- Professional but warm — not stiff or robotic

━━━ APPLICANT CV CONTENT ━━━
${cvText || '[No CV text provided — write the strongest possible general letter for the target]'}

Return ONLY the formatted cover letter text. No preamble, no notes, no markdown.`;

  // 1. Try OpenAI GPT-4o first (best quality)
  if (OPENAI_API_KEY && OPENAI_API_KEY.startsWith('sk-')) {
    try {
      const response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.45,
          max_tokens: 750
        })
      });
      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text && text.length > 100) return text;
      }
      // Non-200 (quota, billing, etc.) — fall through silently to Gemini
      console.warn('OpenAI returned non-OK:', response.status, '— falling back to Gemini');
    } catch (e) {
      console.warn('OpenAI request failed, using Gemini:', e.message);
    }
  }

  // 2. Gemini fallback — callGemini() already handles quota fallback across models
  try {
    const geminiData = await callGemini({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.45, maxOutputTokens: 800 }
    });
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || null;
  } catch (e) {
    console.warn('Gemini cover letter also failed:', e.message);
    return null;
  }
}

function generateCoverLetterFromRefine() {
  const target = document.querySelector('input[name="target"]:checked')?.value || 'general';
  const role = document.getElementById('specific-role').value.trim();
  const cvText = document.getElementById('cvPasteText').value.trim()
    || document.getElementById('refinedOutput')?.innerText || '';
  showCoverLetter(null, null, target, role, cvText);
}

function generateCoverLetterFromBuilder() {
  const firstName = document.getElementById('b-firstName').value.trim();
  const middleName = document.getElementById('b-middleName').value.trim();
  const lastName = document.getElementById('b-lastName').value.trim();
  if (!firstName || !lastName) { showToast('Please fill in your name in Personal Info first.', true); return; }
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
  const email = document.getElementById('b-email').value.trim();
  const phone = document.getElementById('b-phone').value.trim();
  const target = document.getElementById('previewTarget')?.value || 'general';
  const cvText = document.getElementById('cvPreviewContainer').innerText || '';
  showCoverLetter(fullName, { email, phone }, target, '', cvText);
}

async function showCoverLetter(name, contact, target, role, cvText) {
  const modal = document.getElementById('coverLetterModal');
  const contentEl = document.getElementById('coverLetterContent');

  // Track the current generation attempt so stale results are discarded
  // if the modal is closed and reopened before the previous call finishes.
  const generationId = Date.now();
  modal._generationId = generationId;

  // Show modal immediately with loading state
  contentEl.innerHTML = '';
  modal.classList.add('active');

  // Show spinner inside the modal content area
  contentEl.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:16px;color:#5a5a7a;font-family:'Inter',sans-serif;">
    <div class="spinner" style="width:40px;height:40px;border-width:4px;border-top-color:var(--primary);"></div>
    <p style="font-size:0.95rem;">AI is writing your cover letter…</p>
    <p style="font-size:0.78rem;color:#aaa;">Usually takes 10–20 seconds. Close this window at any time.</p>
  </div>`;

  let letterText = null;
  try {
    // Wrap the AI call in a 60-second timeout so the modal never stays
    // in a perpetual loading state if the network hangs.
    letterText = await Promise.race([
      generateCoverLetterAI(name, contact, target, role, cvText),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Cover letter generation timed out')), 60000)
      )
    ]);
  } catch (err) {
    const isQuota = err.message?.includes('quota') || err.message?.includes('capacity') ||
                    err.message?.includes('rate limit') || err.message?.includes('busy') ||
                    err.message?.includes('timed out');
    const msg = isQuota
      ? 'AI is busy right now — showing a template version. Try again in 30 seconds.'
      : 'AI generation failed — showing a template version.';
    console.warn('Cover letter AI error:', err.message);
    showToast(msg, true);
  }

  // Discard result if modal was closed or reopened during the async wait
  if (modal._generationId !== generationId) return;

  if (letterText) {
    contentEl.textContent = letterText;
    return;
  }

  // Fallback: static template
  const cl = buildCoverLetter(name, contact, target, role, cvText);
  contentEl.textContent = cl;
}

function buildCoverLetter(name, contact, target, role, cvText) {
  const today = new Date();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dateStr = `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;

  // Try to detect name from CV text if not provided
  if (!name) {
    const lines = cvText.split('\n').filter(l => l.trim());
    for (const line of lines) {
      if (line.length < 50 && /^[A-Z][A-Z\s]+$/.test(line.trim())) { name = line.trim(); break; }
      if (line.length < 50 && /^[A-Z][a-z]+ [A-Z]/.test(line.trim())) { name = line.trim().toUpperCase(); break; }
    }
    name = name || 'YOUR NAME';
  }

  const targetOrg = {
    corporate_job: 'the Hiring Manager',
    national_service: 'the National Service Secretariat Placement Officer',
    graduate_programme: 'the Graduate Recruitment Team',
    postgraduate: 'the Admissions Committee',
    internship: 'the Internship Coordinator',
    academia: 'the Head of Department / Research Supervisor',
    ngo: 'the Recruitment Officer',
    banking: 'the Graduate Recruitment Team',
    tech: 'the Engineering Hiring Manager',
    general: 'the Hiring Manager'
  };

  const opener = {
    corporate_job: `I am writing to express my keen interest in joining your esteemed organisation. With a strong academic foundation and hands-on professional experience, I am confident in my ability to contribute meaningfully from day one.`,
    national_service: `I am writing to apply for a national service placement with your organisation. As a recent graduate with strong academic credentials and relevant work experience, I am eager to contribute to your team during my national service year.`,
    graduate_programme: `I am writing to apply for your graduate programme. I am a high-achieving student with a passion for ${role ? role : 'the industry'}, and I am confident that your programme will provide the ideal platform to launch my career.`,
    postgraduate: `I am writing to apply for postgraduate studies at your institution. My academic performance, research experience, and professional background have prepared me well for advanced study in my chosen field.`,
    internship: `I am writing to apply for an internship opportunity with your organisation. I am a motivated student eager to apply my academic knowledge in a real-world setting and gain invaluable professional experience.`,
    academia: `I am writing to express my interest in joining your research team. My academic background and research experience make me well-suited to contribute to your work in a meaningful and impactful way.`,
    banking: `I am writing to express my strong interest in joining your banking and finance team. My analytical mindset, finance background, and proven track record of delivering results make me an ideal candidate for this role.`,
    tech: `I am writing to apply for an engineering or technology opportunity within your organisation. My technical skills, project experience, and problem-solving abilities equip me to contribute effectively to your technical teams.`,
    ngo: `I am writing to express my interest in working with your organisation. I am deeply committed to development work and believe my skills and experience align closely with your mission and values.`,
    general: `I am writing to express my interest in an opportunity with your organisation. I bring a strong combination of academic excellence, professional experience, and a determined work ethic that I believe would add real value to your team.`
  };

  const roleRef = role ? ` for the position of ${role}` : '';
  const emailLine = contact?.email ? `Email: ${contact.email}` : '';
  const phoneLine = contact?.phone ? `Tel: ${contact.phone}` : '';

  return `${name}
${emailLine}${emailLine && phoneLine ? '\n' : ''}${phoneLine}

${dateStr}

Dear ${targetOrg[target] || targetOrg.general},

RE: Application${roleRef}

${opener[target] || opener.general}

Throughout my academic and professional journey, I have demonstrated a consistent ability to deliver results, take initiative, and contribute to organisational goals. ${role ? `My background closely aligns with the requirements of ${role}, and I am excited by the opportunity to bring my skills and passion to your team.` : 'I am enthusiastic about the opportunity to bring my skills, dedication, and fresh perspective to your organisation.'}

I am particularly drawn to your organisation because of its reputation for excellence, innovation, and impact. I am confident that my academic achievements, practical experience, and strong interpersonal skills make me a strong fit for your team and culture.

I would welcome the opportunity to discuss my application further at your convenience. Please find my CV attached for your review.

Thank you sincerely for your time and consideration. I look forward to hearing from you.

Yours faithfully,

${name}`;
}

function downloadCoverLetter() {
  const contentEl = document.getElementById('coverLetterContent');
  const text = contentEl.textContent;
  if (!text || text.includes('AI is writing your cover letter')) {
    showToast('Please wait for the cover letter to finish generating.', true); return;
  }
  const printWin = window.open('', '_blank', 'width=900,height=1100');
  if (!printWin) { showToast('Popup blocked — please allow popups and try again.', true); return; }
  printWin.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Cover Letter</title>
    <style>
      @page { size: A4; margin: 2.5cm; }
      @media print { html,body { margin:0!important;padding:0!important; } @page { margin:2.5cm; } }
      body { font-family:'Times New Roman',serif; font-size:12pt; margin:0; padding:0; color:#000; line-height:1.8; }
      p { margin-bottom:12pt; }
    </style>
    </head><body><pre style="font-family:'Times New Roman',serif;font-size:12pt;white-space:pre-wrap;line-height:1.8;">${text}</pre></body></html>`);
  printWin.document.close();
  printWin.onload = function() { setTimeout(() => { printWin.focus(); printWin.print(); }, 400); };
  setTimeout(() => { try { printWin.focus(); printWin.print(); } catch(e) {} }, 900);
  // Auto-save to Firestore if logged in
  const htmlContent = `<pre style="font-family:'Times New Roman',serif;font-size:11pt;line-height:1.8;white-space:pre-wrap;">${text}</pre>`;
  if (window.saveCVToFirestore) saveCVToFirestore('cover_letter', `Cover Letter (${new Date().toLocaleDateString('en-GB')})`, htmlContent, '', '');
}

function copyCoverLetter() {
  const contentEl = document.getElementById('coverLetterContent');
  const text = contentEl.textContent;
  if (!text || text.includes('AI is writing your cover letter')) {
    showToast('Please wait for the cover letter to finish generating.', true); return;
  }
  navigator.clipboard.writeText(text).then(() => showToast('Cover letter copied to clipboard!'));
}

function closeCLModal(e, force) {
  if (force || (e && e.target === document.getElementById('coverLetterModal'))) {
    const modal = document.getElementById('coverLetterModal');
    // Invalidate any in-flight generation so its result is not displayed
    // after the user has already closed the modal.
    if (modal) modal._generationId = null;
    modal?.classList.remove('active');
  }
}

// ===== KEYBOARD CLOSE MODALS =====
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeSampleModal(null, true);
    closeScoreModal(null, true);
    closeCLModal(null, true);
  }
});


// ===== CLOSE NAV ON LINK CLICK (mobile) =====
document.querySelectorAll('.nav-links a').forEach(a => {
  a.addEventListener('click', () => document.getElementById('navLinks').classList.remove('open'));
});

console.log('%c CV Genius Ghana 🇬🇭 ', 'background:#006b3f; color:#fcd116; font-size:16px; padding:8px 16px; border-radius:8px; font-weight:bold;');


// ============================================================
// ===== RICH TEXT TOOLBAR ENGINE =====
// ============================================================

// Get the textarea associated with a toolbar button
function rtGetArea(btn) {
  const toolbar = btn.closest('.rich-toolbar');
  const targetId = toolbar?.dataset.target;
  return targetId ? document.getElementById(targetId) : toolbar?.nextElementSibling;
}

// Insert text at cursor position in a textarea
function rtInsertAt(area, text) {
  const start = area.selectionStart;
  const end = area.selectionEnd;
  const before = area.value.substring(0, start);
  const after = area.value.substring(end);
  area.value = before + text + after;
  area.selectionStart = area.selectionEnd = start + text.length;
  area.focus();
}

// Wrap selected text with markers
function rtWrapSelection(area, open, close) {
  const start = area.selectionStart;
  const end = area.selectionEnd;
  const selected = area.value.substring(start, end);
  if (!selected) { rtInsertAt(area, open + 'text' + close); return; }
  const before = area.value.substring(0, start);
  const after = area.value.substring(end);
  area.value = before + open + selected + close + after;
  area.selectionStart = start;
  area.selectionEnd = end + open.length + close.length;
  area.focus();
}

window.rtFormat = function(btn, type) {
  const area = rtGetArea(btn);
  if (!area) return;
  const cursorAtLineStart = area.value.slice(0, area.selectionStart).endsWith('\n') || area.selectionStart === 0;
  const prefix = (!cursorAtLineStart && area.value.length > 0) ? '\n' : '';
  switch (type) {
    case 'bullet':
      rtInsertAt(area, prefix + '• ');
      break;
    case 'number': {
      const lines = area.value.split('\n').filter(l => l.match(/^\d+\./));
      const next = lines.length + 1;
      rtInsertAt(area, prefix + next + '. ');
      break;
    }
    case 'bold':
      rtWrapSelection(area, '**', '**');
      break;
    case 'italic':
      rtWrapSelection(area, '_', '_');
      break;
    case 'underline':
      rtWrapSelection(area, '__', '__');
      break;
  }
  // Visual feedback
  btn.classList.add('rt-active');
  setTimeout(() => btn.classList.remove('rt-active'), 300);
};

// Action verb picker popup
const ACTION_VERBS = [
  'Developed','Built','Led','Executed','Managed','Analysed','Designed','Increased',
  'Reduced','Implemented','Coordinated','Delivered','Achieved','Established','Oversaw',
  'Spearheaded','Contributed','Collaborated','Streamlined','Launched','Created',
  'Improved','Generated','Negotiated','Secured','Drove','Facilitated','Authored',
  'Trained','Supervised','Directed','Championed','Delegated','Mentored','Evaluated',
  'Forecasted','Reported','Compiled','Administered','Presented','Advised','Pitched'
];

window.rtInsertVerb = function(btn) {
  const area = rtGetArea(btn);
  if (!area) return;
  // Remove existing picker if open
  const existing = document.querySelector('.verb-picker-popup');
  if (existing) { existing.remove(); return; }
  const popup = document.createElement('div');
  popup.className = 'verb-picker-popup';
  popup.innerHTML = `<div class="verb-picker-header"><span>⚡ Pick an Action Verb</span><button onclick="this.closest('.verb-picker-popup').remove()">✕</button></div>
    <div class="verb-picker-grid">${ACTION_VERBS.map(v =>
      `<button class="verb-chip" onclick="rtPickVerb(this,'${v}')">${v}</button>`
    ).join('')}</div>`;
  popup.dataset.areaId = area.id || '';
  // Position below the button
  const rect = btn.getBoundingClientRect();
  popup.style.cssText = `position:fixed;top:${rect.bottom+6}px;left:${Math.min(rect.left,window.innerWidth-320)}px;z-index:3000;`;
  document.body.appendChild(popup);
  // Store reference to area
  popup._area = area;
  setTimeout(() => document.addEventListener('click', function h(e) {
    if (!popup.contains(e.target) && e.target !== btn) { popup.remove(); document.removeEventListener('click', h); }
  }), 100);
};

window.rtPickVerb = function(chip, verb) {
  const popup = chip.closest('.verb-picker-popup');
  const area = popup._area;
  if (area) rtInsertAt(area, verb + ' ');
  popup.remove();
};

window.rtClear = function(btn) {
  const area = rtGetArea(btn);
  if (!area) return;
  if (confirm('Clear all content in this field?')) { area.value = ''; area.focus(); }
};

// Render inline markdown-like markers → HTML for CV preview
function renderRichText(text) {
  if (!text) return '';
  return text
    .split('\n')
    .filter(l => l.trim())
    .map(line => {
      // Apply inline formatting
      line = line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.+?)__/g, '<u>$1</u>')
        .replace(/_(.+?)_/g, '<em>$1</em>');
      return line;
    })
    .join('\n');
}

// ============================================================
// ===== EXTRA SECTIONS ENGINE =====
// ============================================================

const EXTRA_SECTION_DEFS = {
  summary: {
    label: 'Professional Summary',
    icon: '📝',
    note: 'Will appear at the top of your CV, before Education.',
    warn: false,
    fields: () => `
      <div class="form-group">
        <label>Professional Summary <span style="font-size:0.78rem;color:var(--text-light);">(3–5 sentences max)</span></label>
        <div class="rich-toolbar" data-target="es-summary-text">
          ${richToolbarHTML('es-summary-text')}
        </div>
        <textarea class="form-textarea rich-area" id="es-summary-text" rows="4"
          placeholder="e.g. Results-driven finance professional with 3+ years of experience in investment banking and asset management. Proven track record of delivering complex M&A transactions and building financial models. Seeking to leverage analytical expertise and leadership skills in a graduate finance role."></textarea>
      </div>`
  },
  publications: {
    label: 'Publications & Projects',
    icon: '📚',
    note: 'List academic papers, research publications, or major projects.',
    warn: false,
    fields: () => `<div id="es-pub-entries"><div class="es-sub-entry" id="es-pub-0">
      <div class="form-row">
        <div class="form-group"><label>Title *</label><input type="text" class="form-input es-pub-title" placeholder="e.g. Smart Grid Load Shedding Optimisation for Ghana's Power Sector"/></div>
        <div class="form-group"><label>Year</label><input type="text" class="form-input es-pub-year" placeholder="e.g. 2025"/></div>
      </div>
      <div class="form-group"><label>Publisher / Conference / Description</label><input type="text" class="form-input es-pub-desc" placeholder="e.g. Presented at GhIE Annual Conference, 2025 | UENR Final Year Project"/></div>
    </div></div>
    <button class="btn-outline mt-10" style="font-size:0.82rem;" onclick="addESSubEntry('es-pub-entries','pub')"><i class="fas fa-plus"></i> Add Another</button>`
  },
  research: {
    label: 'Research Area / Final Year Project',
    icon: '🔬',
    note: 'Great for students and academic applications.',
    warn: false,
    fields: () => `
      <div class="form-group"><label>Research Title / Project Title *</label>
        <input type="text" class="form-input" id="es-research-title" placeholder="e.g. Smart Grid Enabled Household-Level Load Shedding for Ghana's Demand Response Program Optimisation"/>
      </div>
      <div class="form-group mt-10"><label>Brief Description</label>
        <div class="rich-toolbar" data-target="es-research-desc">${richToolbarHTML('es-research-desc')}</div>
        <textarea class="form-textarea rich-area" id="es-research-desc" rows="3" placeholder="Describe your research focus, methodology, and key findings or objectives..."></textarea>
      </div>
      <div class="form-row mt-10">
        <div class="form-group"><label>Supervisor (optional)</label><input type="text" class="form-input" id="es-research-super" placeholder="e.g. Dr. Kofi Asante"/></div>
        <div class="form-group"><label>Status</label>
          <select class="form-select" id="es-research-status">
            <option value="ongoing">Ongoing</option><option value="completed">Completed</option><option value="published">Published</option>
          </select>
        </div>
      </div>`
  },
  profbodies: {
    label: 'Professional Bodies & Memberships',
    icon: '🏛️',
    note: 'e.g. Member, Ghana Institution of Engineering (GhIE)',
    warn: false,
    fields: () => `<div id="es-pb-entries"><div class="es-sub-entry" id="es-pb-0">
      <div class="form-row">
        <div class="form-group"><label>Organisation Name *</label><input type="text" class="form-input es-pb-org" placeholder="e.g. Ghana Institution of Engineering (GhIE)"/></div>
        <div class="form-group"><label>Membership Status</label><input type="text" class="form-input es-pb-status" placeholder="e.g. Student Member / Associate Member"/></div>
      </div>
      <div class="form-group"><label>Year Joined</label><input type="text" class="form-input es-pb-year" placeholder="e.g. 2023"/></div>
    </div></div>
    <button class="btn-outline mt-10" style="font-size:0.82rem;" onclick="addESSubEntry('es-pb-entries','pb')"><i class="fas fa-plus"></i> Add Another</button>`
  },
  volunteer: {
    label: 'Volunteer Experience',
    icon: '🤝',
    note: 'Community service, NGO work, tutoring, etc.',
    warn: false,
    fields: () => `<div id="es-vol-entries"><div class="es-sub-entry" id="es-vol-0">
      <div class="form-row">
        <div class="form-group"><label>Organisation *</label><input type="text" class="form-input es-vol-org" placeholder="e.g. Ghana Red Cross Society"/></div>
        <div class="form-group"><label>Role</label><input type="text" class="form-input es-vol-role" placeholder="e.g. Community Health Volunteer"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Start Date</label><input type="text" class="form-input es-vol-start" placeholder="e.g. Jan 2023"/></div>
        <div class="form-group"><label>End Date</label><input type="text" class="form-input es-vol-end" placeholder="e.g. Present"/></div>
      </div>
      <div class="form-group"><label>Description (optional)</label>
        <textarea class="form-textarea es-vol-desc" rows="2" placeholder="• Brief description of your contribution and impact..."></textarea>
      </div>
    </div></div>
    <button class="btn-outline mt-10" style="font-size:0.82rem;" onclick="addESSubEntry('es-vol-entries','vol')"><i class="fas fa-plus"></i> Add Another</button>`
  },
  references: {
    label: 'References',
    icon: '👥',
    note: 'Only include if the role specifically requests references.',
    warn: false,
    fields: () => `<div id="es-ref-entries"><div class="es-sub-entry" id="es-ref-0">
      <div class="form-row">
        <div class="form-group"><label>Full Name *</label><input type="text" class="form-input es-ref-name" placeholder="e.g. Prof. Kofi Mensah"/></div>
        <div class="form-group"><label>Position / Title *</label><input type="text" class="form-input es-ref-pos" placeholder="e.g. Head of Department, Electrical Engineering"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Institution / Organisation *</label><input type="text" class="form-input es-ref-inst" placeholder="e.g. University of Energy and Natural Resources (UENR)"/></div>
        <div class="form-group"><label>Relationship to You</label><input type="text" class="form-input es-ref-rel" placeholder="e.g. Academic Supervisor / Former Manager"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Email</label><input type="email" class="form-input es-ref-email" placeholder="e.g. kmensah@uenr.edu.gh"/></div>
        <div class="form-group"><label>Phone (optional)</label><input type="tel" class="form-input es-ref-phone" placeholder="e.g. +233 24 000 0000"/></div>
      </div>
    </div></div>
    <button class="btn-outline mt-10" style="font-size:0.82rem;" onclick="addESSubEntry('es-ref-entries','ref')"><i class="fas fa-plus"></i> Add Another Referee</button>`
  },
  hobbies: {
    label: 'Hobbies & Interests',
    icon: '🎯',
    note: '⚠️ Generally not recommended for professional CVs unless directly relevant.',
    warn: true,
    fields: () => `
      <div class="form-group">
        <label>Hobbies & Interests</label>
        <input type="text" class="form-input" id="es-hobbies-text" placeholder="e.g. Chess, Reading (Finance & Economics), Football, Community Mentoring"/>
      </div>`
  },
  languages: {
    label: 'Languages',
    icon: '🌍',
    note: 'Only include Intermediate level or above.',
    warn: false,
    fields: () => `<div id="es-lang-entries"><div class="es-sub-entry" id="es-lang-0">
      <div class="form-row">
        <div class="form-group"><label>Language *</label><input type="text" class="form-input es-lang-name" placeholder="e.g. French"/></div>
        <div class="form-group"><label>Proficiency</label>
          <select class="form-select es-lang-level">
            <option>Intermediate</option><option>Upper-Intermediate</option><option>Advanced</option><option>Fluent</option><option>Native</option>
          </select>
        </div>
      </div>
    </div></div>
    <button class="btn-outline mt-10" style="font-size:0.82rem;" onclick="addESSubEntry('es-lang-entries','lang')"><i class="fas fa-plus"></i> Add Another Language</button>`
  },
  custom: {
    label: 'Specify / Other',
    icon: '✏️',
    note: 'Create your own custom section with any title.',
    warn: false,
    fields: () => `
      <div class="form-group">
        <label>Section Title *</label>
        <input type="text" class="form-input" id="es-custom-title" placeholder="e.g. Conferences Attended / Extracurricular Activities / Training"/>
      </div>
      <div class="form-group mt-10">
        <label>Content</label>
        <div class="rich-toolbar" data-target="es-custom-content">${richToolbarHTML('es-custom-content')}</div>
        <textarea class="form-textarea rich-area" id="es-custom-content" rows="5"
          placeholder="• Enter each item on a new line&#10;• Use bullet points for a clean, professional look&#10;• Include dates where relevant (e.g. Jan 2024 – Mar 2024)"></textarea>
      </div>`
  }
};

// Helper: generate toolbar HTML for a given textarea id
function richToolbarHTML(targetId) {
  return `<button type="button" class="rt-btn" onclick="rtFormat(this,'bullet')" title="Bullet point">• Bullet</button>
  <div class="rt-divider"></div>
  <button type="button" class="rt-btn" onclick="rtFormat(this,'bold')" title="Bold"><b>B</b></button>
  <button type="button" class="rt-btn" onclick="rtFormat(this,'italic')" title="Italic"><i>I</i></button>
  <button type="button" class="rt-btn" onclick="rtFormat(this,'underline')" title="Underline"><u>U</u></button>
  <div class="rt-divider"></div>
  <button type="button" class="rt-btn" onclick="rtFormat(this,'number')" title="Numbered list">1. List</button>
  <button type="button" class="rt-btn rt-verb" onclick="rtInsertVerb(this)" title="Insert action verb">⚡ Verb</button>
  <button type="button" class="rt-btn rt-clear" onclick="rtClear(this)" title="Clear">✕</button>`;
}

// Track which extra sections have been added
const addedExtraSections = new Set();

window.addExtraSection = function(type) {
  if (addedExtraSections.has(type)) {
    showToast(`"${EXTRA_SECTION_DEFS[type].label}" is already added.`, true);
    return;
  }
  const def = EXTRA_SECTION_DEFS[type];
  if (!def) return;
  addedExtraSections.add(type);

  const list = document.getElementById('extraSectionsList');
  const div = document.createElement('div');
  div.className = 'extra-section-card' + (def.warn ? ' extra-section-warn' : '');
  div.id = `es-card-${type}`;
  div.innerHTML = `
    <div class="es-card-header">
      <span class="es-card-icon">${def.icon}</span>
      <span class="es-card-title">${def.label}</span>
      ${def.warn ? `<span class="es-warn-badge">⚠️ Not always advisable</span>` : ''}
      <button class="remove-entry" onclick="removeExtraSection('${type}')" title="Remove section"><i class="fas fa-trash"></i> Remove</button>
    </div>
    ${def.note ? `<p class="es-card-note">${def.note}</p>` : ''}
    <div class="es-card-fields">${def.fields()}</div>`;
  list.appendChild(div);

  // Mark picker option as added
  const opt = document.querySelector(`.picker-option[data-section="${type}"]`);
  if (opt) {
    opt.classList.add('picker-option-added');
    opt.querySelector('.picker-note').textContent = '✓ Added';
  }

  // Smooth scroll to new section
  setTimeout(() => div.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  showToast(`"${def.label}" section added!`);
};

window.removeExtraSection = function(type) {
  addedExtraSections.delete(type);
  document.getElementById(`es-card-${type}`)?.remove();
  const opt = document.querySelector(`.picker-option[data-section="${type}"]`);
  if (opt) {
    opt.classList.remove('picker-option-added');
    const def = EXTRA_SECTION_DEFS[type];
    if (def) opt.querySelector('.picker-note').textContent = def.note;
  }
};

// Add sub-entries (publications, references, etc.)
let esSubCounts = {};
window.addESSubEntry = function(containerId, type) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!esSubCounts[type]) esSubCounts[type] = 1;
  const n = esSubCounts[type]++;
  const id = `es-${type}-${n}`;
  const div = document.createElement('div');
  div.className = 'es-sub-entry';
  div.id = id;
  const templates = {
    pub: `<div class="es-sub-entry-header"><span>Entry ${n+1}</span><button class="remove-entry" onclick="this.closest('.es-sub-entry').remove()"><i class="fas fa-trash"></i></button></div>
      <div class="form-row">
        <div class="form-group"><label>Title *</label><input type="text" class="form-input es-pub-title" placeholder="Publication or project title"/></div>
        <div class="form-group"><label>Year</label><input type="text" class="form-input es-pub-year" placeholder="e.g. 2024"/></div>
      </div>
      <div class="form-group"><label>Publisher / Description</label><input type="text" class="form-input es-pub-desc" placeholder="Conference, journal, or brief description"/></div>`,
    pb: `<div class="es-sub-entry-header"><span>Entry ${n+1}</span><button class="remove-entry" onclick="this.closest('.es-sub-entry').remove()"><i class="fas fa-trash"></i></button></div>
      <div class="form-row">
        <div class="form-group"><label>Organisation *</label><input type="text" class="form-input es-pb-org" placeholder="e.g. Association of Chartered Certified Accountants (ACCA)"/></div>
        <div class="form-group"><label>Status</label><input type="text" class="form-input es-pb-status" placeholder="e.g. Affiliate Member"/></div>
      </div>
      <div class="form-group"><label>Year</label><input type="text" class="form-input es-pb-year" placeholder="e.g. 2024"/></div>`,
    vol: `<div class="es-sub-entry-header"><span>Entry ${n+1}</span><button class="remove-entry" onclick="this.closest('.es-sub-entry').remove()"><i class="fas fa-trash"></i></button></div>
      <div class="form-row">
        <div class="form-group"><label>Organisation *</label><input type="text" class="form-input es-vol-org" placeholder="Organisation"/></div>
        <div class="form-group"><label>Role</label><input type="text" class="form-input es-vol-role" placeholder="Your role"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Start</label><input type="text" class="form-input es-vol-start" placeholder="e.g. Jan 2023"/></div>
        <div class="form-group"><label>End</label><input type="text" class="form-input es-vol-end" placeholder="e.g. Present"/></div>
      </div>
      <div class="form-group"><label>Description</label><textarea class="form-textarea es-vol-desc" rows="2" placeholder="• Brief impact..."></textarea></div>`,
    ref: `<div class="es-sub-entry-header"><span>Referee ${n+1}</span><button class="remove-entry" onclick="this.closest('.es-sub-entry').remove()"><i class="fas fa-trash"></i></button></div>
      <div class="form-row">
        <div class="form-group"><label>Full Name *</label><input type="text" class="form-input es-ref-name" placeholder="e.g. Dr. Ama Owusu"/></div>
        <div class="form-group"><label>Position *</label><input type="text" class="form-input es-ref-pos" placeholder="e.g. Senior Lecturer"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Institution *</label><input type="text" class="form-input es-ref-inst" placeholder="Institution or organisation"/></div>
        <div class="form-group"><label>Relationship</label><input type="text" class="form-input es-ref-rel" placeholder="e.g. Thesis Supervisor"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Email</label><input type="email" class="form-input es-ref-email" placeholder="Email address"/></div>
        <div class="form-group"><label>Phone</label><input type="tel" class="form-input es-ref-phone" placeholder="+233 ..."/></div>
      </div>`,
    lang: `<div class="es-sub-entry-header"><span>Language ${n+1}</span><button class="remove-entry" onclick="this.closest('.es-sub-entry').remove()"><i class="fas fa-trash"></i></button></div>
      <div class="form-row">
        <div class="form-group"><label>Language *</label><input type="text" class="form-input es-lang-name" placeholder="e.g. Arabic"/></div>
        <div class="form-group"><label>Proficiency</label>
          <select class="form-select es-lang-level"><option>Intermediate</option><option>Upper-Intermediate</option><option>Advanced</option><option>Fluent</option><option>Native</option></select>
        </div>
      </div>`
  };
  div.innerHTML = templates[type] || '';
  container.appendChild(div);
};

// ============================================================
// ===== BUILD EXTRA SECTIONS HTML FOR CV PREVIEW =====
// ============================================================
function buildExtraSectionsHTML() {
  let html = '';

  // Publications / Projects
  if (addedExtraSections.has('publications')) {
    const entries = document.querySelectorAll('#es-pub-entries .es-sub-entry');
    const items = [];
    entries.forEach(e => {
      const title = e.querySelector('.es-pub-title')?.value.trim();
      const year = e.querySelector('.es-pub-year')?.value.trim();
      const desc = e.querySelector('.es-pub-desc')?.value.trim();
      if (title) items.push({ title, year, desc });
    });
    if (items.length) {
      html += `<div class="cv-section-title">PUBLICATIONS & PROJECTS</div><ul class="cv-awards-list">`;
      items.forEach(i => {
        let line = i.title;
        if (i.desc) line += ` — ${i.desc}`;
        if (i.year) line += ` (${i.year})`;
        html += `<li>${line}</li>`;
      });
      html += `</ul>`;
    }
  }

  // Research Area
  if (addedExtraSections.has('research')) {
    const title = document.getElementById('es-research-title')?.value.trim();
    const desc = document.getElementById('es-research-desc')?.value.trim();
    const supervisor = document.getElementById('es-research-super')?.value.trim();
    const status = document.getElementById('es-research-status')?.value;
    if (title) {
      html += `<div class="cv-section-title">RESEARCH AREA / FINAL YEAR PROJECT</div>`;
      html += `<div class="cv-entry-header"><span class="cv-entry-title">${title}</span><span class="cv-entry-date">${status ? status.charAt(0).toUpperCase()+status.slice(1) : ''}</span></div>`;
      if (desc) {
        const lines = desc.split('\n').filter(l => l.trim());
        html += `<ul class="cv-bullets">`;
        lines.forEach(l => { html += `<li>${renderRichText(l.replace(/^[•\-*\d.]\s*/,''))}</li>`; });
        html += `</ul>`;
      }
      if (supervisor) html += `<div style="font-size:10pt;margin-top:2px;"><em>Supervisor: ${supervisor}</em></div>`;
    }
  }

  // Professional Bodies
  if (addedExtraSections.has('profbodies')) {
    const entries = document.querySelectorAll('#es-pb-entries .es-sub-entry');
    const items = [];
    entries.forEach(e => {
      const org = e.querySelector('.es-pb-org')?.value.trim();
      const status = e.querySelector('.es-pb-status')?.value.trim();
      const year = e.querySelector('.es-pb-year')?.value.trim();
      if (org) items.push({ org, status, year });
    });
    if (items.length) {
      html += `<div class="cv-section-title">PROFESSIONAL BODIES & MEMBERSHIPS</div><ul class="cv-awards-list">`;
      items.forEach(i => {
        let line = i.status ? `${i.status}, ${i.org}` : i.org;
        if (i.year) line += ` (${i.year})`;
        html += `<li>${line}</li>`;
      });
      html += `</ul>`;
    }
  }

  // Volunteer Experience
  if (addedExtraSections.has('volunteer')) {
    const entries = document.querySelectorAll('#es-vol-entries .es-sub-entry');
    const hasVol = Array.from(entries).some(e => e.querySelector('.es-vol-org')?.value.trim());
    if (hasVol) {
      html += `<div class="cv-section-title">VOLUNTEER EXPERIENCE</div>`;
      entries.forEach(e => {
        const org = e.querySelector('.es-vol-org')?.value.trim();
        const role = e.querySelector('.es-vol-role')?.value.trim();
        const start = e.querySelector('.es-vol-start')?.value.trim();
        const end = e.querySelector('.es-vol-end')?.value.trim();
        const desc = e.querySelector('.es-vol-desc')?.value.trim();
        if (!org) return;
        html += `<div class="cv-entry-header"><span class="cv-entry-title">${role ? role+', '+org : org}</span><span class="cv-entry-date">${[start,end].filter(Boolean).join(' – ')}</span></div>`;
        if (desc) {
          const lines = desc.split('\n').filter(l => l.trim());
          html += `<ul class="cv-bullets">`;
          lines.forEach(l => { html += `<li>${renderRichText(l.replace(/^[•\-*]\s*/,''))}</li>`; });
          html += `</ul>`;
        }
      });
    }
  }

  // Languages (extra section)
  if (addedExtraSections.has('languages')) {
    const entries = document.querySelectorAll('#es-lang-entries .es-sub-entry');
    const langs = [];
    entries.forEach(e => {
      const name = e.querySelector('.es-lang-name')?.value.trim();
      const level = e.querySelector('.es-lang-level')?.value;
      if (name) langs.push(`${name} (${level})`);
    });
    if (langs.length) {
      html += `<div class="cv-section-title">LANGUAGES</div>`;
      html += `<div style="font-size:10pt;">${langs.join(' &nbsp;·&nbsp; ')}</div>`;
    }
  }

  // References
  if (addedExtraSections.has('references')) {
    const entries = document.querySelectorAll('#es-ref-entries .es-sub-entry');
    const refs = [];
    entries.forEach(e => {
      const name = e.querySelector('.es-ref-name')?.value.trim();
      const pos = e.querySelector('.es-ref-pos')?.value.trim();
      const inst = e.querySelector('.es-ref-inst')?.value.trim();
      const email = e.querySelector('.es-ref-email')?.value.trim();
      const phone = e.querySelector('.es-ref-phone')?.value.trim();
      if (name) refs.push({ name, pos, inst, email, phone });
    });
    if (refs.length) {
      html += `<div class="cv-section-title">REFERENCES</div>`;
      html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">`;
      refs.forEach(r => {
        html += `<div style="font-size:10pt;"><strong>${r.name}</strong><br/>${r.pos || ''}${r.inst ? '<br/>'+r.inst : ''}${r.email ? '<br/>'+r.email : ''}${r.phone ? '<br/>'+r.phone : ''}</div>`;
      });
      html += `</div>`;
    }
  }

  // Hobbies
  if (addedExtraSections.has('hobbies')) {
    const text = document.getElementById('es-hobbies-text')?.value.trim();
    if (text) {
      html += `<div class="cv-section-title">HOBBIES & INTERESTS</div>`;
      html += `<div style="font-size:10pt;">${text}</div>`;
    }
  }

  // Custom section
  if (addedExtraSections.has('custom')) {
    const title = document.getElementById('es-custom-title')?.value.trim();
    const content = document.getElementById('es-custom-content')?.value.trim();
    if (title) {
      html += `<div class="cv-section-title">${title.toUpperCase()}</div>`;
      if (content) {
        const lines = content.split('\n').filter(l => l.trim());
        html += `<ul class="cv-bullets">`;
        lines.forEach(l => { html += `<li>${renderRichText(l.replace(/^[•\-*\d.]\s*/,''))}</li>`; });
        html += `</ul>`;
      }
    }
  }

  return html;
}
