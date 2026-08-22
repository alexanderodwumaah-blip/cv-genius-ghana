// ===== CV GENIUS GHANA — Firebase Auth + Firestore =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signOut, onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, setDoc, updateDoc, query, where, orderBy, doc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

// ===== FORGOT PASSWORD =====
window.userForgotPassword = async function() {
  const email = document.getElementById('authEmail').value.trim();
  const msgEl = document.getElementById('authMsg');
  if (!email) {
    if (msgEl) {
      msgEl.style.background = '#fff0f0'; msgEl.style.color = 'var(--red)';
      msgEl.textContent = 'Enter your email address above first.';
      msgEl.style.display = 'block';
    } else { showToast('Enter your email address first.', true); }
    document.getElementById('authEmail').focus();
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    if (msgEl) {
      msgEl.style.background = '#e8f5ee'; msgEl.style.color = 'var(--primary, #006b3f)';
      msgEl.textContent = '✅ Password reset email sent! Check your inbox.';
      msgEl.style.display = 'block';
    } else { showToast('Password reset email sent! Check your inbox.'); }
  } catch (e) {
    const msg = e.code === 'auth/user-not-found' ? 'No account found with that email address.' :
                e.code === 'auth/invalid-email' ? 'Invalid email address.' :
                'Could not send reset email. Please try again.';
    if (msgEl) {
      msgEl.style.background = '#fff0f0'; msgEl.style.color = 'var(--red)';
      msgEl.textContent = '❌ ' + msg;
      msgEl.style.display = 'block';
    } else { showToast(msg, true); }
  }
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
  // Always start on the CVs tab
  openDashboardTab('cvs');
  const list = document.getElementById('dashboardList');
  list.innerHTML = `<div style="text-align:center;padding:40px;color:#5a5a7a;font-family:'Inter',sans-serif;"><div class="spinner" style="border-top-color:var(--primary);margin:0 auto 12px;width:32px;height:32px;border-width:3px;"></div><p>Loading your CVs...</p></div>`;

  // ===== SUBSCRIPTION STATUS NOTIFICATION =====
  try {
    const sub = await window.checkSubscription();
    const subBar = document.getElementById('subStatusBar');
    if (subBar) subBar.remove();
    if (sub.status === 'active') {
      const expiry = sub.expiresAt?.toDate ? sub.expiresAt.toDate().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '';
      const planLabel = sub.planLabel || sub.plan || 'Premium';
      const bar = document.createElement('div');
      bar.id = 'subStatusBar';
      bar.style.cssText = 'background:linear-gradient(135deg,#e8f5ee,#f0faf5);border:1.5px solid #006b3f;border-radius:12px;padding:14px 18px;margin-bottom:18px;display:flex;align-items:center;gap:14px;font-family:"Inter",sans-serif;flex-wrap:wrap;';
      bar.innerHTML = `
        <div style="font-size:1.5rem;">👑</div>
        <div style="flex:1;min-width:180px;">
          <div style="color:#004d2d;font-weight:700;font-size:0.88rem;">Premium Active — ${planLabel}</div>
          <div style="color:#5a7a6a;font-size:0.78rem;margin-top:1px;">${expiry ? `Valid until ${expiry}` : 'Active subscription'}</div>
        </div>
        <button onclick="openDashboardTab('subscription')" style="background:#006b3f;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:0.78rem;font-weight:700;cursor:pointer;white-space:nowrap;">Manage Plan</button>`;
      list.before(bar);
    } else if (sub.status === 'pending') {
      const bar = document.createElement('div');
      bar.id = 'subStatusBar';
      bar.style.cssText = 'background:#fffbea;border:1.5px solid #fcd116;border-radius:12px;padding:14px 18px;margin-bottom:18px;display:flex;align-items:center;gap:14px;font-family:"Inter",sans-serif;flex-wrap:wrap;';
      bar.innerHTML = `
        <div style="font-size:1.5rem;">⏳</div>
        <div style="flex:1;min-width:180px;">
          <div style="color:#7a6000;font-weight:700;font-size:0.88rem;">Payment Under Verification</div>
          <div style="color:#9a8020;font-size:0.78rem;margin-top:1px;">We received your request. Activation usually takes a few hours.</div>
        </div>`;
      list.before(bar);
    }
  } catch(e) { /* silent */ }

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
          ${d.type === 'built' ? `<button class="btn-outline" style="font-size:0.8rem;padding:8px 14px;" onclick="editBuiltCV('${docSnap.id}')" title="Edit this CV"><i class="fas fa-pencil-alt"></i> Edit</button>` : ''}
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
  document.getElementById('subStatusBar')?.remove();
  document.getElementById('subActivationBanner')?.remove();
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

// ===== SUBSCRIPTION SYSTEM =====

// Plan definitions
const PLANS = {
  'all_gh35':     { label: 'All Features',   features: ['refine','review','builder'], price: 35 },
  'refine_gh20':  { label: 'Smart CV Refine',features: ['refine'],                   price: 20 },
  'review_gh20':  { label: 'Expert Review',  features: ['review'],                   price: 20 },
  'builder_gh20': { label: 'CV Builder',     features: ['builder'],                  price: 20 },
};

// In-memory cache so we don't hit Firestore on every button press
window._subCache = null;
window._subCacheUid = null;

// Check whether the current user has an active subscription.
// Returns: { status, features:[], plan, expiresAt, exportCount, exportCountDate, flagged }
window.checkSubscription = async function(featureNeeded) {
  if (!currentUser) return { status: 'none', features: [] };
  if (window._subCache && window._subCacheUid === currentUser.uid) {
    const c = window._subCache;
    if (featureNeeded && c.status === 'active') {
      return { ...c, status: (c.features||[]).includes(featureNeeded) ? 'active' : 'none' };
    }
    return c;
  }
  try {
    const snap = await getDoc(doc(db, 'subscriptions', currentUser.uid));
    if (!snap.exists()) {
      window._subCache = { status: 'none', features: [] };
    } else {
      const d = snap.data();
      let status = d.status || 'none';
      // Auto-detect expiry
      if (status === 'active' && d.expiresAt?.toDate && d.expiresAt.toDate() < new Date()) {
        status = 'expired';
        updateDoc(doc(db, 'subscriptions', currentUser.uid), { status: 'expired' }).catch(() => {});
      }
      // Derive features from plan field
      const planKey = d.plan || '';
      const features = PLANS[planKey]?.features || (planKey === '6months_gh20' ? ['refine','builder'] : []);
      window._subCache = {
        status, features, plan: planKey,
        expiresAt: d.expiresAt,
        exportCount: d.exportCount || 0,
        exportCountDate: d.exportCountDate || '',
        flagged: d.flagged || false,
        wasJustActivated: d.wasJustActivated || false
      };
    }
    window._subCacheUid = currentUser.uid;
    // Check for just-activated notification
    if (window._subCache.wasJustActivated) {
      _showActivationNotification(window._subCache);
      // Clear the flag in Firestore silently
      updateDoc(doc(db, 'subscriptions', currentUser.uid), { wasJustActivated: false }).catch(() => {});
    }
    const c = window._subCache;
    if (featureNeeded && c.status === 'active') {
      return { ...c, status: (c.features||[]).includes(featureNeeded) ? 'active' : 'none' };
    }
    return c;
  } catch (e) {
    console.warn('checkSubscription error:', e.message);
    return { status: 'none', features: [] };
  }
};

function _showActivationNotification(sub) {
  const planLabel = PLANS[sub.plan]?.label || 'Premium';
  const expiry = sub.expiresAt?.toDate ? sub.expiresAt.toDate().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }) : '6 months';
  showToast(`🎉 Your ${planLabel} subscription is now ACTIVE! Valid until ${expiry}.`);
  // Also show banner in dashboard if it's open
  const list = document.getElementById('dashboardList');
  if (list) {
    const banner = document.createElement('div');
    banner.id = 'subActivationBanner';
    banner.style.cssText = 'background:linear-gradient(135deg,#006b3f,#004d2d);border-radius:12px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:14px;font-family:"Inter",sans-serif;animation:fadeInUp 0.4s ease;';
    banner.innerHTML = `
      <div style="font-size:1.8rem;">🎉</div>
      <div style="flex:1;">
        <div style="color:#fcd116;font-weight:700;font-size:0.9rem;">Premium Activated — ${planLabel}!</div>
        <div style="color:rgba(255,255,255,0.85);font-size:0.8rem;margin-top:2px;">Your subscription is active and valid until ${expiry}. Go ahead and use all your premium features!</div>
      </div>
      <button onclick="this.parentElement.remove()" style="background:rgba(255,255,255,0.15);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:0.85rem;flex-shrink:0;">✕</button>`;
    list.before(banner);
  }
}

// Invalidate the in-memory cache
window.clearSubCache = function() {
  window._subCache = null;
  window._subCacheUid = null;
};

// Submit a subscription payment request for a specific plan.
window.requestSubscription = async function(payerName, payerPhone, planKey) {
  if (!currentUser) { showToast('Please sign in first.', true); return false; }
  const plan = PLANS[planKey] || PLANS['refine_gh20'];
  try {
    await setDoc(doc(db, 'subscriptions', currentUser.uid), {
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: currentUser.displayName || payerName || '',
      payerName: payerName || '',
      payerPhone: payerPhone || '',
      status: 'pending',
      plan: planKey || 'refine_gh20',
      planLabel: plan.label,
      planPrice: plan.price,
      requestedAt: serverTimestamp(),
      approvedAt: null,
      approvedBy: null,
      expiresAt: null,
      exportCount: 0,
      exportCountDate: '',
      flagged: false,
      wasJustActivated: false
    }, { merge: true });
    window.clearSubCache();
    return true;
  } catch (e) {
    showToast('Could not submit request: ' + e.message, true);
    return false;
  }
};

// Record an export against the daily cap. Returns true if allowed, false if capped.
// Cap = 8 exports per 24 hours. If exceeded, flags the account in Firestore.
window.recordExport = async function() {
  if (!currentUser) return true; // not logged in — allow (no tracking)
  const DAILY_CAP = 8;
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  try {
    const snap = await getDoc(doc(db, 'subscriptions', currentUser.uid));
    if (!snap.exists()) return true; // no sub doc — free tier, allow
    const d = snap.data();
    if (d.status !== 'active') return true; // not active premium — allow (paywall handles this)
    const sameDay = d.exportCountDate === today;
    const count = sameDay ? (d.exportCount || 0) : 0;
    if (count >= DAILY_CAP) {
      // Flag if not already flagged
      if (!d.flagged) {
        await updateDoc(doc(db, 'subscriptions', currentUser.uid), { flagged: true, flaggedAt: serverTimestamp(), flagReason: `Exceeded ${DAILY_CAP} exports/day` });
      }
      window.clearSubCache();
      showToast(`Daily export limit reached (${DAILY_CAP}/day). Try again tomorrow.`, true);
      return false;
    }
    // Increment counter
    await updateDoc(doc(db, 'subscriptions', currentUser.uid), {
      exportCount: count + 1,
      exportCountDate: today
    });
    window.clearSubCache();
    return true;
  } catch (e) {
    console.warn('recordExport error:', e.message);
    return true; // on error, don't block the user
  }
};

// ===== EDIT BUILT CV (repopulate builder from saved htmlContent) =====
window.editBuiltCV = function(id) {
  const data = window._dashSnap?.[id];
  if (!data || data.type !== 'built') return;
  closeDashboard();

  // Small delay to let modal close before manipulating tabs
  setTimeout(() => {
    try {
      const parser = new DOMParser();
      const cvDoc = parser.parseFromString(data.htmlContent, 'text/html');

      // ── Name ──
      const nameEl = cvDoc.querySelector('.cv-name');
      if (nameEl) {
        const nameParts = (nameEl.textContent || '').trim().split(' ');
        if (nameParts.length >= 2) {
          document.getElementById('b-firstName').value = nameParts[0] || '';
          document.getElementById('b-lastName').value  = nameParts[nameParts.length - 1] || '';
          if (nameParts.length >= 3) document.getElementById('b-middleName').value = nameParts.slice(1, -1).join(' ');
        }
      }

      // ── Contact ──
      const contactEl = cvDoc.querySelector('.cv-contact');
      if (contactEl) {
        const parts = contactEl.textContent.split('|').map(s => s.trim()).filter(Boolean);
        parts.forEach(p => {
          if (p.includes('@')) document.getElementById('b-email').value = p;
          else if (/^\+?\d[\d\s\-()]+$/.test(p)) document.getElementById('b-phone').value = p;
          else if (p.includes('linkedin')) document.getElementById('b-linkedin').value = p;
          else if (p.includes('github') || p.includes('portfolio') || p.includes('http')) document.getElementById('b-portfolio').value = p;
        });
      }

      // ── Education entries ──
      const sectionTitles = cvDoc.querySelectorAll('.cv-section-title');
      let eduSection = null;
      sectionTitles.forEach(el => { if (el.textContent.trim().toUpperCase().includes('EDUCATION')) eduSection = el; });
      if (eduSection) {
        // Collect all edu entry-header pairs up to the next section title
        const eduHeaders = [];
        let cur = eduSection.nextElementSibling;
        while (cur && !cur.classList.contains('cv-section-title')) {
          if (cur.classList.contains('cv-entry-header')) eduHeaders.push(cur);
          cur = cur.nextElementSibling;
        }
        // Group in pairs (org+loc, then title+date)
        for (let i = 0; i < eduHeaders.length; i += 2) {
          const orgRow = eduHeaders[i];
          const titleRow = eduHeaders[i + 1];
          const entryIndex = Math.floor(i / 2);
          // Add entries if needed
          if (entryIndex > 0) {
            const existing = document.querySelectorAll('#educationEntries .entry-card');
            if (entryIndex >= existing.length) addEducationEntry?.();
          }
          const entries = document.querySelectorAll('#educationEntries .entry-card');
          const entry = entries[entryIndex];
          if (!entry) continue;
          if (orgRow) {
            entry.querySelector('.edu-uni').value  = orgRow.querySelector('.cv-entry-org')?.textContent.trim() || '';
            entry.querySelector('.edu-loc').value  = orgRow.querySelector('.cv-entry-loc')?.textContent.trim() || '';
          }
          if (titleRow) {
            entry.querySelector('.edu-degree').value = titleRow.querySelector('.cv-entry-title')?.textContent.trim() || '';
            const dateStr = titleRow.querySelector('.cv-entry-date')?.textContent.trim() || '';
            const dateParts = dateStr.split('–').map(s => s.trim());
            entry.querySelector('.edu-start').value = dateParts[0] || '';
            entry.querySelector('.edu-end').value   = dateParts[1] || '';
          }
        }
      }

      // ── Experience entries ──
      let expSection = null;
      sectionTitles.forEach(el => { if (el.textContent.trim().toUpperCase().includes('PROFESSIONAL EXPERIENCE')) expSection = el; });
      if (expSection) {
        let cur = expSection.nextElementSibling;
        let expIndex = 0;
        while (cur && !cur.classList.contains('cv-section-title')) {
          if (cur.classList.contains('cv-entry-header') && cur.querySelector('.cv-entry-org')) {
            if (expIndex > 0) {
              const existing = document.querySelectorAll('#experienceEntries .entry-card');
              if (expIndex >= existing.length) addExperienceEntry?.();
            }
            const entries = document.querySelectorAll('#experienceEntries .entry-card');
            const entry = entries[expIndex];
            if (entry) {
              entry.querySelector('.exp-org').value = cur.querySelector('.cv-entry-org')?.textContent.trim() || '';
              entry.querySelector('.exp-loc').value = cur.querySelector('.cv-entry-loc')?.textContent.trim() || '';
              const nextRow = cur.nextElementSibling;
              if (nextRow?.classList.contains('cv-entry-header')) {
                entry.querySelector('.exp-title').value = nextRow.querySelector('.cv-entry-title')?.textContent.trim() || '';
                const dateStr = nextRow.querySelector('.cv-entry-date')?.textContent.trim() || '';
                const dateParts = dateStr.split('–').map(s => s.trim());
                entry.querySelector('.exp-start').value = dateParts[0] || '';
                entry.querySelector('.exp-end').value   = dateParts[1] || '';
                // bullets
                const bulletsEl = nextRow.nextElementSibling;
                if (bulletsEl?.classList.contains('cv-bullets')) {
                  const bulletLines = Array.from(bulletsEl.querySelectorAll('li')).map(li => '• ' + li.textContent.trim());
                  const bulletsTA = entry.querySelector('.exp-bullets');
                  if (bulletsTA) bulletsTA.value = bulletLines.join('\n');
                }
              }
            }
            expIndex++;
          }
          cur = cur.nextElementSibling;
        }
      }

      // ── Skills ──
      const allDivs = cvDoc.querySelectorAll('[style]');
      allDivs.forEach(div => {
        const txt = div.textContent || '';
        if (txt.includes('Technical:')) document.getElementById('b-techSkills').value = txt.replace('Technical:', '').trim();
        else if (txt.includes('Professional:')) document.getElementById('b-softSkills').value = txt.replace('Professional:', '').trim();
        else if (txt.includes('Languages:')) document.getElementById('b-languages').value = txt.replace('Languages:', '').trim();
      });

      // Inject back the saved HTML into the preview container so it's immediately visible
      document.getElementById('cvPreviewContainer').innerHTML = data.htmlContent;

      // Navigate to the builder preview tab
      scrollToSection('build');
      switchTab('preview');
      showToast('CV loaded for editing — make your changes and click Generate Preview to update.');
    } catch (e) {
      console.warn('editBuiltCV parse error:', e);
      showToast('Could not reload CV fields. You can still edit from the builder tabs.', true);
      scrollToSection('build');
      switchTab('personal');
    }
  }, 350);
};
