/**
 * Authentication Module
 * Handles both UI rendering and auth logic for login/registration.
 * Dark-themed, premium design with glow effects and smooth transitions.
 * Error messages in Spanish.
 */

import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  updateProfile,
  ref,
  set,
  get,
  signOut
} from '../firebase.js';

// ─── Animated Shield SVG Icon ───────────────────────────────────────────────────
const SHIELD_SVG = `
<svg class="auth-shield-icon" viewBox="0 0 64 64" width="56" height="56" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#a855f7;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#6366f1;stop-opacity:1" />
    </linearGradient>
  </defs>
  <path d="M32 4 L56 16 V32 C56 46.4 45.6 58.4 32 62 C18.4 58.4 8 46.4 8 32 V16 L32 4Z"
        stroke="url(#shieldGrad)" stroke-width="2.5" fill="none" opacity="0.9">
    <animate attributeName="opacity" values="0.9;0.5;0.9" dur="2.5s" repeatCount="indefinite"/>
  </path>
  <path d="M32 10 L50 19 V32 C50 43.2 42.4 52.8 32 56 C21.6 52.8 14 43.2 14 32 V19 L32 10Z"
        fill="url(#shieldGrad)" opacity="0.15">
    <animate attributeName="opacity" values="0.15;0.25;0.15" dur="3s" repeatCount="indefinite"/>
  </path>
  <rect x="24" y="26" width="16" height="14" rx="3" stroke="url(#shieldGrad)" stroke-width="2" fill="none"/>
  <path d="M26 26 V22 C26 18.7 28.7 16 32 16 C35.3 16 38 18.7 38 22 V26"
        stroke="url(#shieldGrad)" stroke-width="2" fill="none" stroke-linecap="round"/>
  <circle cx="32" cy="33" r="2" fill="url(#shieldGrad)">
    <animate attributeName="r" values="2;2.5;2" dur="1.5s" repeatCount="indefinite"/>
  </circle>
  <line x1="32" y1="35" x2="32" y2="38" stroke="url(#shieldGrad)" stroke-width="2" stroke-linecap="round"/>
</svg>
`;

// ─── Auth Styles ────────────────────────────────────────────────────────────────
const AUTH_STYLES = `
  .auth-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    min-height: 100dvh;
    width: 100%;
    padding: 24px;
    position: relative;
    overflow: hidden;
    background: #050508;
    animation: authFadeIn 0.5s ease-out;
  }

  .auth-wrapper::before,
  .auth-wrapper::after {
    content: '';
    position: absolute;
    width: 600px;
    height: 600px;
    border-radius: 50%;
    filter: blur(120px);
    opacity: 0.15;
    z-index: 0;
    pointer-events: none;
  }

  .auth-wrapper::before {
    background: #f72585;
    top: -100px;
    left: -200px;
    animation: floatOrb 15s ease-in-out infinite alternate;
  }

  .auth-wrapper::after {
    background: #00f5d4;
    bottom: -100px;
    right: -200px;
    animation: floatOrb 20s ease-in-out infinite alternate-reverse;
  }

  @keyframes floatOrb {
    0% { transform: translate(0, 0) scale(1); }
    100% { transform: translate(100px, 50px) scale(1.2); }
  }

  @keyframes authFadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes authPulseGlow {
    0%, 100% { box-shadow: 0 0 20px rgba(168, 85, 247, 0.15), 0 0 60px rgba(99, 102, 241, 0.05); }
    50% { box-shadow: 0 0 30px rgba(168, 85, 247, 0.25), 0 0 80px rgba(99, 102, 241, 0.1); }
  }

  @keyframes shieldFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }

  @keyframes spinLoader {
    to { transform: rotate(360deg); }
  }

  @keyframes inputFocusGlow {
    0%, 100% { box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.3); }
    50% { box-shadow: 0 0 0 4px rgba(168, 85, 247, 0.15); }
  }

  @keyframes slideDown {
    from { opacity: 0; max-height: 0; transform: translateY(-10px); }
    to { opacity: 1; max-height: 80px; transform: translateY(0); }
  }

  @keyframes slideUp {
    from { opacity: 1; max-height: 80px; transform: translateY(0); }
    to { opacity: 0; max-height: 0; transform: translateY(-10px); }
  }

  .auth-card {
    background: rgba(15, 15, 25, 0.95);
    border: 1px solid rgba(168, 85, 247, 0.2);
    border-radius: 20px;
    padding: 40px 36px;
    width: 100%;
    max-width: 400px;
    backdrop-filter: blur(20px);
    animation: authPulseGlow 4s ease-in-out infinite;
    position: relative;
    overflow: hidden;
    z-index: 1;
  }

  /* Two column layout on desktop */
  @media (min-width: 900px) {
    .auth-wrapper {
      padding: 60px;
      justify-content: center;
      gap: 100px;
    }
    
    .auth-brand-side {
      display: flex;
      flex-direction: column;
      max-width: 450px;
      z-index: 1;
    }
    
    .auth-brand-title {
      font-size: 4rem;
      font-weight: 800;
      background: linear-gradient(135deg, #00f5d4, #a855f7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin: 0 0 20px 0;
      line-height: 1.1;
      letter-spacing: -1px;
    }
    
    .auth-brand-subtitle {
      font-size: 1.2rem;
      color: rgba(255,255,255,0.7);
      line-height: 1.6;
      margin-bottom: 40px;
    }
    
    .auth-brand-features {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    
    .auth-feature {
      display: flex;
      align-items: center;
      gap: 16px;
      color: rgba(255,255,255,0.9);
      font-size: 1.1rem;
    }
    
    .auth-feature svg {
      width: 28px;
      height: 28px;
      color: #00f5d4;
    }
  }
  
  @media (max-width: 899px) {
    .auth-brand-side {
      display: none;
    }
  }

  .auth-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.5), rgba(99, 102, 241, 0.5), transparent);
  }

  .auth-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .auth-shield-icon {
    animation: shieldFloat 3s ease-in-out infinite;
    margin-bottom: 16px;
    filter: drop-shadow(0 0 12px rgba(168, 85, 247, 0.3));
  }

  .auth-title {
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    font-size: 1.6rem;
    font-weight: 700;
    background: linear-gradient(135deg, #c084fc, #818cf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0 0 6px 0;
    transition: opacity 0.3s ease;
  }

  .auth-subtitle {
    color: rgba(255, 255, 255, 0.4);
    font-size: 0.85rem;
    margin: 0;
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .auth-input-group {
    position: relative;
    overflow: hidden;
    transition: all 0.3s ease;
  }

  .auth-input-group.hidden {
    animation: slideUp 0.3s ease forwards;
    pointer-events: none;
  }

  .auth-input-group.visible {
    animation: slideDown 0.3s ease forwards;
  }

  .auth-input {
    width: 100%;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    color: #e2e8f0;
    font-size: 0.95rem;
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    outline: none;
    transition: all 0.3s ease;
    box-sizing: border-box;
  }

  .auth-input::placeholder {
    color: rgba(255, 255, 255, 0.25);
  }

  .auth-input:focus {
    border-color: rgba(168, 85, 247, 0.5);
    background: rgba(255, 255, 255, 0.06);
    animation: inputFocusGlow 2s ease-in-out infinite;
  }

  .auth-submit-btn {
    width: 100%;
    padding: 14px;
    background: linear-gradient(135deg, #a855f7, #6366f1);
    border: none;
    border-radius: 12px;
    color: #fff;
    font-size: 1rem;
    font-weight: 600;
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
    margin-top: 8px;
  }

  .auth-submit-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(168, 85, 247, 0.35);
  }

  .auth-submit-btn:active {
    transform: translateY(0);
  }

  .auth-submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .auth-submit-btn .btn-text {
    transition: opacity 0.3s ease;
  }

  .auth-submit-btn .btn-loader {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 22px;
    height: 22px;
    border: 2.5px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spinLoader 0.7s linear infinite;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .auth-submit-btn.loading .btn-text {
    opacity: 0;
  }

  .auth-submit-btn.loading .btn-loader {
    opacity: 1;
  }

  .auth-error {
    color: #f87171;
    font-size: 0.82rem;
    text-align: center;
    padding: 10px 14px;
    background: rgba(248, 113, 113, 0.08);
    border: 1px solid rgba(248, 113, 113, 0.15);
    border-radius: 10px;
    margin: 0;
    animation: authFadeIn 0.3s ease-out;
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    display: none;
  }

  .auth-error.visible {
    display: block;
  }

  .auth-toggle {
    text-align: center;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .auth-toggle-text {
    color: rgba(255, 255, 255, 0.4);
    font-size: 0.85rem;
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
  }

  .auth-toggle-link {
    color: #a78bfa;
    cursor: pointer;
    font-weight: 600;
    transition: color 0.2s ease;
    background: none;
    border: none;
    font-size: 0.85rem;
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    padding: 0;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .auth-toggle-link:hover {
    color: #c4b5fd;
  }
`;

// ─── Error Messages (Spanish) ───────────────────────────────────────────────────
function getSpanishError(errorCode) {
  const errors = {
    'auth/email-already-in-use': 'El email ya está en uso',
    'auth/invalid-email': 'El formato del email no es válido',
    'auth/weak-password': 'La contraseña es demasiado débil (mínimo 6 caracteres)',
    'auth/wrong-password': 'Contraseña incorrecta',
    'auth/user-not-found': 'No se encontró una cuenta con ese email',
    'auth/invalid-credential': 'Credenciales inválidas. Verifica tu email y contraseña',
    'auth/too-many-requests': 'Demasiados intentos. Intenta de nuevo más tarde',
    'auth/network-request-failed': 'Error de conexión. Verifica tu internet',
    'auth/user-disabled': 'Esta cuenta ha sido deshabilitada',
    'auth/operation-not-allowed': 'Operación no permitida',
    'auth/requires-recent-login': 'Debes iniciar sesión de nuevo para esta acción',
  };
  return errors[errorCode] || 'Ha ocurrido un error. Intenta de nuevo';
}

// ─── State ──────────────────────────────────────────────────────────────────────
let currentMode = 'login'; // 'login' | 'register'
let styleElement = null;

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Renders auth UI into container and sets up auth logic.
 * @param {HTMLElement} container - DOM element to render into.
 * @param {Function} onAuthSuccess - Called with Firebase user object on successful auth.
 */
export function initAuth(container, onAuthSuccess) {
  currentMode = 'login';

  // Inject styles
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.textContent = AUTH_STYLES;
    document.head.appendChild(styleElement);
  }

  renderAuthUI(container, onAuthSuccess);
}

/**
 * Check if user is already logged in.
 * @param {Function} onAuthSuccess - Called with Firebase user if already authenticated.
 */
export function checkExistingAuth(onAuthSuccess) {
  document.getElementById('error-overlay').innerText += "checkExistingAuth() entered.\n";
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    document.getElementById('error-overlay').innerText += "onAuthStateChanged fired! User: " + (user ? user.uid : "null") + "\n";
    unsubscribe(); // Only need to check once
    if (user) {
      try {
        document.getElementById('error-overlay').innerText += "Getting user data from DB...\n";
        const snap = await get(ref(db, `users/${user.uid}`));
        document.getElementById('error-overlay').innerText += "Got user data.\n";
        if (snap.exists()) {
          const udata = snap.val();
          if (udata.deleted) throw new Error('account-deleted');
          if (udata.banned) throw new Error('account-banned');
          if (udata.timeoutUntil && udata.timeoutUntil > Date.now()) throw new Error('account-timeout');
        } else {
          throw new Error('account-deleted');
        }

        // Update online status
        set(ref(db, `users/${user.uid}/online`), true).catch(() => {});
        set(ref(db, `users/${user.uid}/lastSeen`), Date.now()).catch(() => {});
        onAuthSuccess(user);
      } catch (err) {
        // Force sign out
        await signOut(auth).catch(() => {});
        onAuthSuccess(null);

        // Wait for UI to render then show error
        setTimeout(() => {
          const errEl = document.getElementById('auth-error');
          if (errEl) {
            let msg = 'Acceso denegado.';
            if (err.message === 'account-deleted') msg = 'Tu cuenta ha sido eliminada permanentemente por un administrador.';
            if (err.message === 'account-banned') msg = 'Tu cuenta ha sido baneada permanentemente por un administrador.';
            if (err.message === 'account-timeout') msg = 'Tu cuenta ha sido suspendida temporalmente por un administrador.';
            showError(errEl, msg);
          }
        }, 100);
      }
    } else {
      onAuthSuccess(null);
    }
  });
}

// ─── Render ─────────────────────────────────────────────────────────────────────

function renderAuthUI(container, onAuthSuccess) {
  const isLogin = currentMode === 'login';

  container.innerHTML = `
    <div class="auth-wrapper">
      <div class="auth-brand-side">
        <h1 class="auth-brand-title">Shadow<br>Chat.</h1>
        <p class="auth-brand-subtitle">Comunicación ultra rápida y segura. Conecta de forma anónima, sin rastros.</p>
        <div class="auth-brand-features">
          <div class="auth-feature">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Protección Avanzada
          </div>
          <div class="auth-feature">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4l3-9 5 18 3-9h5"/></svg>
            Tiempo Real
          </div>
          <div class="auth-feature">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Experiencia Inmersiva
          </div>
        </div>
      </div>

      <div class="auth-card">
        <div class="auth-header">
          ${SHIELD_SVG}
          <h2 class="auth-title">${isLogin ? 'Bienvenido de nuevo' : 'Crear Cuenta'}</h2>
          <p class="auth-subtitle">${isLogin ? 'Ingresa a tu sesión secreta' : 'Únete al lado oscuro'}</p>
        </div>

        <form class="auth-form" id="auth-form" autocomplete="off">
          ${!isLogin ? `
            <div class="auth-input-group visible">
              <input
                type="text"
                class="auth-input"
                id="auth-username"
                placeholder="Nombre de usuario"
                autocomplete="off"
                required
              />
            </div>
          ` : ''}

          <div class="auth-input-group">
            <input
              type="email"
              class="auth-input"
              id="auth-email"
              placeholder="Email"
              autocomplete="off"
              required
            />
          </div>

          <div class="auth-input-group">
            <input
              type="password"
              class="auth-input"
              id="auth-password"
              placeholder="Contraseña"
              autocomplete="off"
              required
              minlength="6"
            />
          </div>

          ${!isLogin ? `
            <div class="auth-input-group visible">
              <input
                type="password"
                class="auth-input"
                id="auth-confirm-password"
                placeholder="Confirmar contraseña"
                autocomplete="off"
                required
                minlength="6"
              />
            </div>
          ` : ''}

          <p class="auth-error" id="auth-error"></p>

          <button type="submit" class="auth-submit-btn" id="auth-submit-btn">
            <span class="btn-text">${isLogin ? 'Iniciar Sesión' : 'Registrarse'}</span>
            <span class="btn-loader"></span>
          </button>
        </form>

        <div class="auth-toggle">
          <span class="auth-toggle-text">
            ${isLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
          </span>
          <button class="auth-toggle-link" id="auth-toggle-btn">
            ${isLogin ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </div>
      </div>
    </div>
  `;

  // ── Event Listeners ──
  const form = container.querySelector('#auth-form');
  const toggleBtn = container.querySelector('#auth-toggle-btn');
  const errorEl = container.querySelector('#auth-error');
  const submitBtn = container.querySelector('#auth-submit-btn');

  // Toggle mode
  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    currentMode = currentMode === 'login' ? 'register' : 'login';
    renderAuthUI(container, onAuthSuccess);
  });

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(errorEl);

    const email = container.querySelector('#auth-email').value.trim();
    const password = container.querySelector('#auth-password').value;

    if (!email || !password) {
      showError(errorEl, 'Por favor completa todos los campos');
      return;
    }

    if (password.length < 6) {
      showError(errorEl, 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (currentMode === 'register') {
      const username = container.querySelector('#auth-username').value.trim();
      const confirmPassword = container.querySelector('#auth-confirm-password').value;

      if (!username) {
        showError(errorEl, 'Por favor ingresa un nombre de usuario');
        return;
      }

      if (password !== confirmPassword) {
        showError(errorEl, 'Las contraseñas no coinciden');
        return;
      }

      await handleRegister(email, password, username, errorEl, submitBtn, onAuthSuccess);
    } else {
      await handleLogin(email, password, errorEl, submitBtn, onAuthSuccess);
    }
  });
}

// ─── Auth Handlers ──────────────────────────────────────────────────────────────

async function handleRegister(email, password, username, errorEl, submitBtn, onAuthSuccess) {
  setLoading(submitBtn, true);

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Set display name
    await updateProfile(user, { displayName: username });

    // Save user data to database
    await set(ref(db, `users/${user.uid}`), {
      username: username,
      online: true,
      lastSeen: Date.now()
    });

    onAuthSuccess(user);
  } catch (error) {
    console.error('Registration error:', error);
    showError(errorEl, getSpanishError(error.code));
  } finally {
    setLoading(submitBtn, false);
  }
}

async function handleLogin(email, password, errorEl, submitBtn, onAuthSuccess) {
  setLoading(submitBtn, true);

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const snap = await get(ref(db, `users/${user.uid}`));
    if (snap.exists()) {
      const udata = snap.val();
      if (udata.deleted) throw new Error('account-deleted');
      if (udata.banned) throw new Error('account-banned');
      if (udata.timeoutUntil && udata.timeoutUntil > Date.now()) throw new Error('account-timeout');
    } else {
      throw new Error('account-deleted');
    }

    // Update online status
    await set(ref(db, `users/${user.uid}/online`), true);
    await set(ref(db, `users/${user.uid}/lastSeen`), Date.now());

    onAuthSuccess(user);
  } catch (error) {
    console.error('Login error:', error);
    let msg = getSpanishError(error.code);
    if (error.message === 'account-deleted') msg = 'Tu cuenta ha sido eliminada permanentemente por un administrador.';
    if (error.message === 'account-banned') msg = 'Tu cuenta ha sido baneada permanentemente por un administrador.';
    if (error.message === 'account-timeout') msg = 'Tu cuenta ha sido suspendida temporalmente por un administrador.';
    
    if (['account-deleted', 'account-banned', 'account-timeout'].includes(error.message)) {
      await signOut(auth).catch(() => {});
    }

    showError(errorEl, msg);
  } finally {
    setLoading(submitBtn, false);
  }
}

// ─── UI Helpers ─────────────────────────────────────────────────────────────────

function showError(el, message) {
  el.textContent = message;
  el.classList.add('visible');
}

function hideError(el) {
  el.textContent = '';
  el.classList.remove('visible');
}

function setLoading(btn, loading) {
  if (loading) {
    btn.classList.add('loading');
    btn.disabled = true;
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}
