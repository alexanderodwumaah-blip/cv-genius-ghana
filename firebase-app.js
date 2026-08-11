// ===== CV GENIUS GHANA — Firebase Auth + Firestore =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, doc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAhRkNIidv-ud3fua35NQR-nUTTZkoE37A",
  authDomain: "cv-genius-ghana.firebaseapp.com",
  projectId: "cv-genius-ghana",
  storageBucket: "cv-genius-ghana.firebasestorage.app",
  messagingSenderId: "6396208691",
  appId: "1:6396208691:web:1aa1eb5058e2365d376546"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ===== AUTH STATE =====
let currentUser = null;

onAuthStateChanged(auth, user => {
  currentUser = user;
  updateNavAuth(user);
  if (user && document.getElementById('dashboardModal')?.classList.contains('active')) {
    loadDashboard();
  }
});

function updateNavAuth(user) {
  const authBtn = document.getElementById('navAuthBtn');
  const userChip = document.getElementById('navUserChip');
  if (!authBtn || !userChip) return;
  if (user) {
    authBtn.style.display = 'none';
    userChip.style.display = 'flex';
    userChip.querySelector('.user-name').textContent = user.displayName || user.email.split('@')[0];
    userChip.querySelector('.user-avatar').textContent = (user.displayName || user.email)[0].toUpperCase();
  } else {
    authBtn.style.display = 'flex';
    userChip.style.display = 'none';
  }
}

// ===== SIGN IN WITH GOOGLE =====
window.signInWithGoogle = async function() {
  try {
    await signInWithPopup(auth, googleProvider);
    closeAuthModal();
    showToast('Welcome! You are now signed in.');
  } catch (e) {
    showToast('Sign-in failed: ' + e.message, true);
  }
};

// ===== SIGN IN WITH EMAIL =====
window.signInEmail = async function() {
  const email = document.getElementById('authEmail').value.trim();
  const pass = document.getElementById('authPassword').value;
  const mode = document.getElementById('authModal').dataset.mode;
  if (!email || !pass) { showToast('Please enter email and password.', true); return; }
  try {
    if (mode === 'signup') {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      closeAuthModal();
      showToast('Account created! Welcome to CV Genius Ghana.');
    } else {
      await signInWithEmailAndPassword(auth, email, pass);
      closeAuthModal();
      showToast('Welcome back!');
    }
  } catch (e) {
    const msg = e.code === 'auth/wrong-password' ? 'Incorrect password.' :
                e.code === 'auth/user-not-found' ? 'No account found with that email.' :
                e.code === 'auth/email-already-in-use' ? 'Email already registered. Please sign in.' :
                e.code === 'auth/weak-password' ? 'Password must be at least 6 characters.' :
                e.message;
    showToast(msg, true);
  }
};

// ===== SIGN OUT =====
window.signOutUser = async function() {
  await signOut(auth);
  showToast('Signed out successfully.');
};

// ===== SAVE CV TO FIRESTORE =====
window.saveCVToFirestore = async function(type, title, htmlContent, target, role) {
  if (!currentUser) return; // silently skip if not logged in
  try {
    await addDoc(collection(db, 'cvs'), {
      uid: currentUser.uid,
      type,           // 'built' | 'refined' | 'cover_letter'
      title,          // e.g. "Veronica Mensah CV" or "Refined CV – Banking"
      target: target || '',
      role: role || '',
      htmlContent,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.warn('Could not save CV:', e.message);
  }
};

// ===== LOAD DASHBOARD =====
window.loadDashboard = async function() {
  if (!currentUser) {
    openAuthModal('signin');
    return;
  }
  document.getElementById('dashboardModal').classList.add('active');
  const list = document.getElementById('dashboardList');
  list.innerHTML = `<div style="text-align:center;padding:40px;color:#5a5a7a;font-family:'Inter',sans-serif;"><div class="spinner" style="border-top-color:var(--primary);margin:0 auto 12px;width:32px;height:32px;border-width:3px;"></div><p>Loading your CVs...</p></div>`;

  try {
    const q = query(
      collection(db, 'cvs'),
      where('uid', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      list.innerHTML = `<div style="text-align:center;padding:60px 20px;font-family:'Inter',sans-serif;">
        <div style="font-size:3rem;margin-bottom:16px;">📄</div>
        <h3 style="color:#1a1a2e;margin-bottom:8px;">No saved CVs yet</h3>
        <p style="color:#5a5a7a;font-size:0.9rem;">Build or refine a CV and it will appear here automatically.</p>
        <button class="btn-primary" style="margin-top:20px;" onclick="closeDashboard();scrollToSection('build')"><i class="fas fa-pen"></i> Build My First CV</button>
      </div>`;
      return;
    }

    const icons = { built: '🏗️', refined: '✨', cover_letter: '✉️' };
    const labels = { built: 'Built from Scratch', refined: 'Refined CV', cover_letter: 'Cover Letter' };

    let html = `<div class="dashboard-grid">`;
    snap.forEach(docSnap => {
      const d = docSnap.data();
      const date = d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : 'Recently';
      html += `<div class="dash-card">
        <div class="dash-card-top">
          <span class="dash-icon">${icons[d.type] || '📄'}</span>
          <div class="dash-meta">
            <span class="dash-type">${labels[d.type] || d.type}</span>
            <span class="dash-date">${date}</span>
          </div>
          <button class="dash-delete" onclick="deleteCV('${docSnap.id}')" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
        <h4 class="dash-title">${d.title || 'Untitled CV'}</h4>
        ${d.target ? `<span class="dash-tag">${d.target}</span>` : ''}
        ${d.role ? `<p class="dash-role">${d.role}</p>` : ''}
        <div class="dash-actions">
          <button class="btn-primary" style="font-size:0.8rem;padding:8px 14px;" onclick="viewSavedCV('${docSnap.id}')"><i class="fas fa-eye"></i> View</button>
          <button class="btn-outline" style="font-size:0.8rem;padding:8px 14px;" onclick="downloadSavedCV('${docSnap.id}')"><i class="fas fa-download"></i> Download</button>
        </div>
      </div>`;
    });
    html += `</div>`;
    list.innerHTML = html;

    // Store snapshot for view/download actions
    window._dashSnap = {};
    snap.forEach(d => { window._dashSnap[d.id] = d.data(); });

  } catch (e) {
    list.innerHTML = `<div style="text-align:center;padding:40px;color:#ce1126;font-family:'Inter',sans-serif;">
      <p>⚠️ Could not load your CVs. Make sure Firestore is enabled in your Firebase console.</p>
      <p style="font-size:0.8rem;margin-top:8px;">${e.message}</p>
    </div>`;
  }
};

window.viewSavedCV = function(id) {
  const data = window._dashSnap?.[id];
  if (!data) return;
  document.getElementById('modalContent').innerHTML = data.htmlContent || '<p>No content available.</p>';
  document.getElementById('sampleModal').classList.add('active');
  document.getElementById('sampleModal').dataset.currentKey = null;
};

window.downloadSavedCV = function(id) {
  const data = window._dashSnap?.[id];
  if (!data) return;
  printCV(data.htmlContent, data.title || 'My_CV');
};

window.deleteCV = async function(id) {
  if (!confirm('Delete this CV? This cannot be undone.')) return;
  try {
    await deleteDoc(doc(db, 'cvs', id));
    showToast('CV deleted.');
    loadDashboard();
  } catch (e) {
    showToast('Could not delete: ' + e.message, true);
  }
};

window.closeDashboard = function() {
  document.getElementById('dashboardModal').classList.remove('active');
};

// ===== AUTH MODAL =====
window.openAuthModal = function(mode) {
  const modal = document.getElementById('authModal');
  modal.dataset.mode = mode || 'signin';
  modal.classList.add('active');
  document.getElementById('authModalTitle').textContent = mode === 'signup' ? 'Create Account' : 'Sign In';
  document.getElementById('authSubmitBtn').textContent = mode === 'signup' ? 'Create Account' : 'Sign In';
  document.getElementById('authToggleText').innerHTML = mode === 'signup'
    ? 'Already have an account? <a href="#" onclick="switchAuthMode(\'signin\')">Sign in</a>'
    : 'New here? <a href="#" onclick="switchAuthMode(\'signup\')">Create an account</a>';
};

window.switchAuthMode = function(mode) {
  openAuthModal(mode);
};

window.closeAuthModal = function(e, force) {
  if (force || !e || e.target === document.getElementById('authModal')) {
    document.getElementById('authModal').classList.remove('active');
  }
};

console.log('%c Firebase connected ✓ ', 'background:#006b3f;color:#fcd116;font-weight:bold;padding:4px 8px;border-radius:4px;');
