// =============================================================================
// profile.js — Profile settings modal (ShadowChat 2.0)
// =============================================================================

import { auth, db, ref, set, get, updateProfile, signOut, updatePassword } from '../firebase.js';
import { uploadProfilePhoto, validateFile } from './media.js';
import { THEMES, applyTheme } from './themes.js';

function _injectStyles() {
  if (document.getElementById('sc-profile-styles')) return;
  const s = document.createElement('style');
  s.id = 'sc-profile-styles';
  s.textContent = `
    .pf-overlay {
      position: fixed; inset: 0; z-index: 500;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      animation: pfFadeIn 0.2s ease;
    }
    @keyframes pfFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes pfSlideIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    .pf-modal {
      background: #11111b; border: 1px solid rgba(168,85,247,0.2);
      border-radius: 16px; width: 90%; max-width: 400px; max-height: 90vh;
      box-sizing: border-box;
      display: flex; flex-direction: column; overflow: hidden;
      animation: pfSlideIn 0.3s ease; font-family: 'Inter', sans-serif;
      box-shadow: 0 0 40px rgba(168,85,247,0.1);
    }
    .pf-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 20px 16px; border-bottom: 1px solid rgba(255,255,255,0.06);
      box-sizing: border-box; width: 100%;
    }
    .pf-title { font-size: 1.1rem; font-weight: 700; color: #e2e8f0; margin: 0; }
    .pf-close {
      width: 32px; height: 32px; border-radius: 8px; border: none;
      background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5);
      font-size: 1.2rem; cursor: pointer; display: flex;
      flex-shrink: 0; margin-left: 12px;
      align-items: center; justify-content: center; transition: all 0.2s;
    }
    .pf-close:hover { background: rgba(255,255,255,0.1); color: #fff; }
    .pf-body { padding: 24px 20px; display: flex; flex-direction: column; align-items: center; gap: 20px; overflow-y: auto; }
    .pf-avatar-wrap {
      position: relative; width: 120px; height: 120px; border-radius: 50%;
      cursor: pointer; overflow: hidden;
    }
    .pf-avatar-img {
      width: 120px; height: 120px; border-radius: 50%; object-fit: cover;
      border: 3px solid rgba(168,85,247,0.3);
    }
    .pf-avatar-letter {
      width: 120px; height: 120px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 2.5rem; color: #fff;
      background: linear-gradient(135deg, #a855f7, #6366f1);
      border: 3px solid rgba(168,85,247,0.3);
    }
    .pf-avatar-overlay {
      position: absolute; inset: 0; border-radius: 50%;
      background: rgba(0,0,0,0.5); display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 4px;
      opacity: 0; transition: opacity 0.2s; color: #fff; font-size: 0.7rem;
    }
    .pf-avatar-wrap:hover .pf-avatar-overlay { opacity: 1; }
    .pf-avatar-overlay svg { width: 24px; height: 24px; }
    .pf-uploading {
      font-size: 0.8rem; color: #00f5d4; text-align: center;
    }
    .pf-field { width: 100%; }
    .pf-label { font-size: 0.78rem; color: rgba(255,255,255,0.35); margin-bottom: 6px; }
    .pf-input {
      width: 100%; padding: 10px 12px; border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04);
      color: #e2e8f0; font-size: 0.9rem; font-family: 'Inter', sans-serif;
      outline: none; box-sizing: border-box; transition: border-color 0.2s;
    }
    .pf-input:focus { border-color: rgba(168,85,247,0.4); }
    .pf-input:disabled { opacity: 0.4; cursor: not-allowed; }
    .pf-save-btn {
      width: 100%; padding: 10px; border-radius: 10px; border: none;
      background: linear-gradient(135deg, #a855f7, #6366f1); color: #fff;
      font-size: 0.88rem; font-weight: 600; font-family: 'Inter', sans-serif;
      cursor: pointer; transition: all 0.2s; margin-top: 4px;
    }
    .pf-save-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(168,85,247,0.3); }
    .pf-save-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .pf-info { font-size: 0.78rem; color: rgba(255,255,255,0.25); text-align: center; }
    .pf-logout-btn {
      width: 100%; padding: 10px; border-radius: 10px;
      border: 1px solid rgba(247,37,133,0.25); background: transparent;
      color: #f72585; font-size: 0.85rem; font-weight: 500;
      font-family: 'Inter', sans-serif; cursor: pointer; transition: all 0.2s;
    }
    .pf-logout-btn:hover { background: rgba(247,37,133,0.1); }
    .pf-msg {
      font-size: 0.8rem; padding: 6px 10px; border-radius: 8px; text-align: center;
      animation: pfFadeIn 0.2s ease;
    }
    .pf-msg.success { background: rgba(0,245,212,0.1); color: #00f5d4; }
    .pf-themes { display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; justify-content: center; }
    .pf-theme-dot { width: 32px; height: 32px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; transition: transform 0.2s, border-color 0.2s; position: relative; }
    .pf-theme-dot:hover { transform: scale(1.1); }
    .pf-theme-dot.active { border-color: #fff; transform: scale(1.1); }
  `;
  document.head.appendChild(s);
}

const ICON_CAMERA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;

let _overlayEl = null;

/**
 * Shows the profile settings modal.
 */
export function showProfileModal(container, currentUser, onUpdate) {
  _injectStyles();

  _overlayEl = document.createElement('div');
  _overlayEl.className = 'pf-overlay';

  const modal = document.createElement('div');
  modal.className = 'pf-modal';

  const avatarHtml = currentUser.photoURL
    ? `<img class="pf-avatar-img" id="pf-avatar" src="${currentUser.photoURL}" alt="">`
    : `<div class="pf-avatar-letter" id="pf-avatar">${(currentUser.displayName || 'U')[0].toUpperCase()}</div>`;

  const createdDate = currentUser.metadata?.creationTime
    ? new Date(currentUser.metadata.creationTime).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Desconocido';

  let themeHtml = '<div class="pf-themes" id="pf-themes">';
  THEMES.forEach(t => {
    themeHtml += `<button class="pf-theme-dot" data-id="${t.id}" style="background: ${t.color};" title="${t.name}"></button>`;
  });
  themeHtml += '</div>';

  modal.innerHTML = `
    <div class="pf-header">
      <h3 class="pf-title">Mi Perfil</h3>
      <button class="pf-close">✕</button>
    </div>
    <div class="pf-body">
      <div class="pf-avatar-wrap" id="pf-avatar-wrap">
        ${avatarHtml}
        <div class="pf-avatar-overlay">
          ${ICON_CAMERA}
          <span>Cambiar foto</span>
        </div>
        <input type="file" id="pf-file-input" accept="image/jpeg,image/png,image/webp" style="display:none">
      </div>
      <div id="pf-upload-status"></div>

      <div class="pf-field">
        <div class="pf-label">Nombre de usuario</div>
        <input class="pf-input" id="pf-username" value="${currentUser.displayName || ''}" maxlength="25" placeholder="Tu nombre...">
      </div>

      <button class="pf-save-btn" id="pf-save-btn">Guardar cambios</button>
      <div id="pf-msg-area"></div>

      <div class="pf-field">
        <div class="pf-label">Tema del chat</div>
        ${themeHtml}
      </div>

      <div class="pf-field">
        <div class="pf-label">Email</div>
        <input class="pf-input" value="${currentUser.email || ''}" disabled>
      </div>

      <div class="pf-field">
        <div class="pf-label">Dead Man's Switch (Wipe Out automático)</div>
        <select class="pf-input" id="pf-deadmanswitch">
          <option value="0">Desactivado</option>
          <option value="3">3 días</option>
          <option value="4">4 días</option>
          <option value="5">5 días</option>
          <option value="6">6 días</option>
          <option value="7">7 días</option>
          <option value="10">10 días</option>
          <option value="15">15 días</option>
          <option value="20">20 días</option>
          <option value="30">30 días (1 mes)</option>
          <option value="60">60 días (2 meses)</option>
          <option value="90">90 días (3 meses)</option>
        </select>
        <div style="font-size:0.7rem; color:rgba(255,255,255,0.4); margin-top:4px;">Si no abres la app en este tiempo, se borrará tu cuenta cuando tus contactos entren.</div>
      </div>
      
      <div class="pf-field">
        <div class="pf-label">Cambiar contraseña (opcional)</div>
        <input class="pf-input" type="password" id="pf-password" placeholder="Nueva contraseña (min 6 caracteres)">
      </div>

      <div class="pf-info">Miembro desde: ${createdDate}</div>

      <button class="pf-logout-btn" id="pf-logout-btn">Cerrar sesión</button>
    </div>
  `;

  _overlayEl.appendChild(modal);
  container.appendChild(_overlayEl);

  // Elements
  const closeBtn = modal.querySelector('.pf-close');
  const avatarWrap = modal.querySelector('#pf-avatar-wrap');
  const fileInput = modal.querySelector('#pf-file-input');
  const uploadStatus = modal.querySelector('#pf-upload-status');
  const usernameInput = modal.querySelector('#pf-username');
  const passwordInput = modal.querySelector('#pf-password');
  const saveBtn = modal.querySelector('#pf-save-btn');
  const msgArea = modal.querySelector('#pf-msg-area');
  const logoutBtn = modal.querySelector('#pf-logout-btn');

  // Close
  closeBtn.addEventListener('click', hideProfileModal);
  _overlayEl.addEventListener('click', (e) => {
    if (e.target === _overlayEl) hideProfileModal();
  });

  // Themes and Dead Man's Switch
  const themeDots = modal.querySelectorAll('.pf-theme-dot');
  const deadManInput = modal.querySelector('#pf-deadmanswitch');
  
  get(ref(db, `users/${currentUser.uid}`)).then(snap => {
    if (snap.exists()) {
      const data = snap.val();
      const activeId = data.theme !== undefined ? data.theme : 0;
      themeDots.forEach(dot => {
        dot.classList.toggle('active', parseInt(dot.dataset.id) === activeId);
      });
      if (data.deadManSwitch !== undefined) {
        deadManInput.value = data.deadManSwitch;
      }
    }
  });

  themeDots.forEach(dot => {
    dot.addEventListener('click', async () => {
      const newId = parseInt(dot.dataset.id);
      themeDots.forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      applyTheme(newId);
      await set(ref(db, `users/${currentUser.uid}/theme`), newId);
    });
  });

  // Avatar upload
  avatarWrap.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    const validation = validateFile(file, 'image');
    if (!validation.valid) {
      uploadStatus.innerHTML = `<div class="pf-msg error">${validation.error}</div>`;
      return;
    }

    uploadStatus.innerHTML = `<div class="pf-uploading">Subiendo foto...</div>`;

    try {
      const url = await uploadProfilePhoto(file, currentUser.uid);

      // Update Auth profile
      await updateProfile(auth.currentUser, { photoURL: url });
      // Update database
      await set(ref(db, `users/${currentUser.uid}/photoURL`), url);

      // Update avatar in modal
      const avatarEl = modal.querySelector('#pf-avatar');
      const img = document.createElement('img');
      img.className = 'pf-avatar-img';
      img.id = 'pf-avatar';
      img.src = url;
      avatarEl.replaceWith(img);

      uploadStatus.innerHTML = `<div class="pf-msg success">Foto actualizada</div>`;
      setTimeout(() => { uploadStatus.innerHTML = ''; }, 2000);

      if (onUpdate) onUpdate({ photoURL: url, displayName: currentUser.displayName });
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        uploadStatus.innerHTML = `<div class="pf-msg error">Debes cerrar sesión y volver a entrar</div>`;
      } else {
        uploadStatus.innerHTML = `<div class="pf-msg error">${err.message}</div>`;
      }
      setTimeout(() => { uploadStatus.innerHTML = ''; }, 3000);
    }
  });

  // Save changes
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';
    try {
      const newName = usernameInput.value.trim();
      const newPassword = passwordInput.value.trim();

      if (newName !== currentUser.displayName) {
        if (!newName) throw new Error('El nombre no puede estar vacío');
        await updateProfile(currentUser, { displayName: newName });
        await set(ref(db, `users/${currentUser.uid}/username`), newName);
      }

      if (newPassword) {
        if (newPassword.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
        await updatePassword(currentUser, newPassword);
      }

      const deadManValue = parseInt(deadManInput.value) || 0;
      await set(ref(db, `users/${currentUser.uid}/deadManSwitch`), deadManValue);

      msgArea.innerHTML = `<div class="pf-msg success">Cambios guardados correctamente</div>`;
      setTimeout(() => { msgArea.innerHTML = ''; }, 2000);
      if (onUpdate) onUpdate({ photoURL: currentUser.photoURL, displayName: newName });
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        msgArea.innerHTML = `<div class="pf-msg error">Debes cerrar sesión y volver a entrar para cambiar tu contraseña</div>`;
      } else {
        msgArea.innerHTML = `<div class="pf-msg error">${err.message}</div>`;
      }
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar cambios';
    }
  });

  // Logout
  logoutBtn.addEventListener('click', async () => {
    try {
      await set(ref(db, `users/${currentUser.uid}/online`), false);
      await signOut(auth);
      window.location.reload();
    } catch (error) {
      console.error('[Profile] Logout error:', error);
    }
  });
}

/**
 * Hides and removes the profile modal.
 */
export function hideProfileModal() {
  if (_overlayEl) {
    _overlayEl.style.animation = 'pfFadeIn 0.15s ease reverse';
    setTimeout(() => {
      _overlayEl?.remove();
      _overlayEl = null;
    }, 150);
  }
}
