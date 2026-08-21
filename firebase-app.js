// ===== CV GENIUS GHANA — Firebase Auth + Firestore =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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
  const mobAuthBtn = document.getElementById('mobAuthBtn');
  const mobUserChip = document.getElementById('mobUserChip');
  const mobMenuUser = document.getElementById('mobMenuUser');
  const mobSignInSection = document.getElementById('mobSignInSection');
  const mobSignOutBtn = document.getElementById('mobSignOutBtn');
  const mobSignedInDivider = document.getElementById('mobSignedInDivider');

  if (user) {
    const displayName = user.displayName ? user.displayName.split(' ')[0] : user.email.split('@')[0];
    const initial = (user.displayName || user.email)[0].toUpperCase();

    // Desktop chip
    if (authBtn) authBtn.style.display = 'none';
    if (userChip) {
      userChip.classList.remove('hidden');
      const avatarEl = userChip.querySelector('.user-avatar');
      const nameEl = userChip.querySelector('.user-name');
      if (avatarEl) avatarEl.textContent = initial;
      if (nameEl) nameEl.textContent = displayName;
    }
    // Mobile avatar button
    if (mobAuthBtn) mobAuthBtn.style.display = 'none';
    if (mobUserChip) {
      mobUserChip.classList.remove('hidden');
      document.getElementById('mobAvatar').textContent = initial;
    }
    // Mobile menu user info
    if (mobMenuUser) {
      mobMenuUser.style.display = 'flex';
      document.getElementById('mobMenuAvatar').textContent = initial;
      document.getElementById('mobMenuName').textContent = user.displayName || displayName;
      document.getElementById('mobMenuEmail').textContent = user.email;
    }
    if (mobSignInSection) mobSignInSection.style.display = 'none';
    if (mobSignOutBtn) mobSignOutBtn.style.display = 'flex';
    if (mobSignedInDivider) mobSignedInDivider.style.display = 'block';

    // Update dashboard subtitle
    const subtitle = document.getElementById('dashboardSubtitle');
    if (subtitle) subtitle.textContent = `Welcome back, ${displayName} — your CVs and reviews are here`;

  } else {
    if (authBtn) authBtn.style.display = 'flex';
    if (userChip) userChip.classList.add('hidden');
    if (mobAuthBtn) mobAuthBtn.style.display = 'flex';
    if (mobUserChip) mobUserChip.classList.add('hidden');
    if (mobMenuUser) mobMenuUser.style.display = 'none';
    if (mobSignInSection) mobSignInSection.style.display = 'block';
    if (mobSignOutBtn) mobSignOutBtn.style.display = 'none';
    if (mobSignedInDivider) mobSignedInDivider.style.display = 'none';
  }
}

// Close mobile menu when clicking outside
document.addEventListener('click', function(e) {
  const menu = document.getElementById('mobileMenu');
  const hamburger = document.getElementById('hamburger');
  if (menu && menu.classList.contains('open') && !menu.contains(e.target) && !hamburger.contains(e.target)) {
    menu.classList.remove('open');
  }
});

// ===== HANDLE GOOGLE REDIRECT RESULT (fires when returning from mobile redirect) =====
getRedirectResult(auth).then(result => {
  if (result && result.user) {
    // Modal won't be open after a redirect, so just show the toast
    document.getElementById('authModal')?.classList.remove('active');
    showToast('Welcome! You are now signed in.');
  }
}).catch(e => {
  if (e.code !== 'auth/no-auth-event' && e.code !== 'auth/null-user') {
    showToast('Google sign-in failed: ' + e.message.replace('Firebase: ', ''), true);
  }
});

// ===== SIGN IN WITH GOOGLE =====
window.signInWithGoogle = async function() {
  // Mobile browsers block popups — use redirect instead
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  if (isMobile) {
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (e) {
      showToast('Google sign-in failed: ' + e.message.replace('Firebase: ', ''), true);
    }
  } else {
    try {
      await signInWithPopup(auth, googleProvider);
      closeAuthModal();
      showToast('Welcome! You are now signed in.');
    } catch (e) {
      showToast('Google sign-in failed: ' + e.message.replace('Firebase: ', ''), true);
    }
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
    const msg = e.code === 'auth/invalid-credential' ? 'Incorrect email or password.' :
                e.code === 'auth/wrong-password' ? 'Incorrect password.' :
                e.code === 'auth/user-not-found' ? 'No account found with that email.' :
                e.code === 'auth/email-already-in-use' ? 'Email already registered. Please sign in.' :
                e.code === 'auth/weak-password' ? 'Password must be at least 6 characters.' :
                e.code === 'auth/invalid-email' ? 'Invalid email address.' :
                e.code === 'auth/too-many-requests' ? 'Too many attempts. Please wait a moment and try again.' :
                'Sign-in failed. Please check your details.';
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

  // ===== EXPERT REVIEW NOTIFICATIONS =====
  // Remove any stale notification bar from previous open
  document.getElementById('reviewNotifBar')?.remove();
  try {
    const reviewsQ = query(
      collection(db, 'cv_reviews'),
      where('uid', '==', currentUser.uid)
    );
    const reviewsSnap = await getDocs(reviewsQ);
    const unseenReviews = [];
    reviewsSnap.forEach(d => { const r = d.data(); if (!r.isDraft && !r.seenByUser) unseenReviews.push({ id: d.id, ...r }); });
    if (unseenReviews.length) {
      const notifBar = document.createElement('div');
      notifBar.id = 'reviewNotifBar';
      notifBar.style.cssText = 'background:linear-gradient(135deg,#006b3f,#004d2d);border-radius:12px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:14px;font-family:"Inter",sans-serif;animation:fadeInUp 0.4s ease;';
      notifBar.innerHTML = `
        <div style="font-size:1.8rem;">🎉</div>
        <div style="flex:1;">
          <div style="color:#fcd116;font-weight:700;font-size:0.9rem;">You have ${unseenReviews.length} new expert review${unseenReviews.length>1?'s':''}!</div>
          <div style="color:rgba(255,255,255,0.8);font-size:0.8rem;margin-top:2px;">Your CV has been reviewed. Click to see the detailed feedback.</div>
        </div>
        <a href="cv-upload.html" style="background:#fcd116;color:#1a1a2e;font-weight:700;font-size:0.82rem;padding:10px 18px;border-radius:8px;text-decoration:none;white-space:nowrap;display:inline-flex;align-items:center;gap:6px;flex-shrink:0;">
          <i class="fas fa-star"></i> View Review
        </a>`;
      list.before(notifBar);
    }
  } catch (e) { console.warn('Review check error:', e.message); }

  try {
    // No orderBy to avoid composite index — sort client-side
    const q = query(
      collection(db, 'cvs'),
      where('uid', '==', currentUser.uid)
    );
    const snap = await getDocs(q);
    // Sort by createdAt descending client-side
    const sortedDocs = snap.docs
      .sort((a, b) => {
        const tA = a.data().createdAt?.toMillis ? a.data().createdAt.toMillis() : 0;
        const tB = b.data().createdAt?.toMillis ? b.data().createdAt.toMillis() : 0;
        return tB - tA;
      });
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
    sortedDocs.forEach(docSnap => {
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
    sortedDocs.forEach(d => { window._dashSnap[d.id] = d.data(); });

  } catch (e) {
    console.error('Dashboard load error:', e);
    // User-friendly error — no Firebase jargon
    list.innerHTML = `<div style="text-align:center;padding:48px 20px;font-family:'Inter',sans-serif;">
      <div style="font-size:2.5rem;margin-bottom:16px;">😕</div>
      <h3 style="color:#1a1a2e;font-size:1rem;margin-bottom:8px;">Couldn't load your CVs</h3>
      <p style="color:#5a5a7a;font-size:0.85rem;margin-bottom:20px;max-width:320px;margin-left:auto;margin-right:auto;line-height:1.6;">
        This can happen if you're offline or if there's a temporary connection issue. Please try again.
      </p>
      <button class="btn-primary" style="font-size:0.88rem;" onclick="loadDashboard()">
        <i class="fas fa-sync"></i> Try Again
      </button>
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
  document.getElementById('reviewNotifBar')?.remove();
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
