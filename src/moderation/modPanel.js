// =============================================================================
// admin.js — Admin Panel for ShadowChat 2.0
// =============================================================================

import { db, ref, get, update, set } from '../firebase.js';

function _injectStyles() {
  if (document.getElementById('sc-admin-styles')) return;
  const s = document.createElement('style');
  s.id = 'sc-admin-styles';
  s.textContent = `
    .ad-overlay {
      position: fixed; inset: 0; z-index: 600;
      background: rgba(0,0,0,0.8); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      animation: adFadeIn 0.2s ease;
    }
    @keyframes adFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes adSlideIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    .ad-modal {
      background: #11111b; border: 1px solid rgba(247,37,133,0.3);
      border-radius: 16px; width: 95%; max-width: 600px; max-height: 85vh;
      display: flex; flex-direction: column; overflow: hidden;
      animation: adSlideIn 0.3s ease; font-family: 'Inter', sans-serif;
      box-shadow: 0 0 50px rgba(247,37,133,0.15);
    }
    .ad-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.06);
      background: linear-gradient(90deg, rgba(247,37,133,0.1), transparent);
    }
    .ad-title { font-size: 1.2rem; font-weight: 700; color: #e2e8f0; margin: 0; display:flex; align-items:center; gap:8px;}
    .ad-close {
      width: 32px; height: 32px; border-radius: 8px; border: none;
      background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5);
      font-size: 1.2rem; cursor: pointer; display: flex;
      align-items: center; justify-content: center; transition: all 0.2s;
    }
    .ad-close:hover { background: rgba(255,255,255,0.1); color: #fff; }
    
    .ad-body { padding: 0; overflow-y: auto; flex: 1; }
    .ad-loading { padding: 40px; text-align: center; color: rgba(255,255,255,0.4); }
    
    .ad-user-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.03);
      transition: background 0.2s;
    }
    .ad-user-row:hover { background: rgba(255,255,255,0.02); }
    .ad-user-info { display: flex; align-items: center; gap: 12px; }
    .ad-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; background: #2a2a35; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:1.2rem; color:#fff;}
    .ad-details { display: flex; flex-direction: column; }
    .ad-name { font-weight: 600; color: #fff; font-size: 0.95rem; }
    .ad-id { font-size: 0.7rem; color: rgba(255,255,255,0.3); font-family: monospace; }
    .ad-status { font-size: 0.75rem; margin-top: 2px; }
    
    .ad-actions { display: flex; gap: 8px; }
    .ad-btn {
      padding: 6px 12px; border-radius: 6px; border: none;
      font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s;
      font-family: 'Inter', sans-serif;
    }
    .ad-btn-mute { background: rgba(255, 190, 11, 0.1); color: #ffbe0b; border: 1px solid rgba(255, 190, 11, 0.2); }
    .ad-btn-mute:hover { background: rgba(255, 190, 11, 0.2); }
    .ad-btn-mute.active { background: #ffbe0b; color: #000; }
    
    .ad-btn-time { background: rgba(58, 134, 255, 0.1); color: #3a86ff; border: 1px solid rgba(58, 134, 255, 0.2); }
    .ad-btn-time:hover { background: rgba(58, 134, 255, 0.2); }
    .ad-btn-time.active { background: #3a86ff; color: #fff; }
    
    .ad-btn-ban { background: rgba(251, 86, 7, 0.1); color: #fb5607; border: 1px solid rgba(251, 86, 7, 0.2); }
    .ad-btn-ban:hover { background: rgba(251, 86, 7, 0.2); }
    .ad-btn-ban.active { background: #fb5607; color: #fff; }
    
    .ad-btn-del { background: rgba(255, 0, 84, 0.1); color: #ff0054; border: 1px solid rgba(255, 0, 84, 0.2); }
    .ad-btn-del:hover { background: rgba(255, 0, 84, 0.2); }
    .ad-btn-del.active { background: #ff0054; color: #fff; }

    .ad-btn-read { background: rgba(0, 245, 212, 0.1); color: #00f5d4; border: 1px solid rgba(0, 245, 212, 0.2); }
    .ad-btn-read:hover { background: rgba(0, 245, 212, 0.2); }
    .ad-btn-read.active { background: #00f5d4; color: #000; }
  `;
  document.head.appendChild(s);
}

let _overlayEl = null;

export async function showAdminModal(container, currentUser) {
  _injectStyles();

  _overlayEl = document.createElement('div');
  _overlayEl.className = 'ad-overlay';

  const modal = document.createElement('div');
  modal.className = 'ad-modal';

  modal.innerHTML = `
    <div class="ad-header">
      <h3 class="ad-title">🛡️ Panel de Control Admin</h3>
      <button class="ad-close">✕</button>
    </div>
    <div class="ad-body" id="ad-body">
      <div class="ad-loading">Cargando usuarios...</div>
    </div>
  `;

  _overlayEl.appendChild(modal);
  container.appendChild(_overlayEl);

  const closeBtn = modal.querySelector('.ad-close');
  closeBtn.addEventListener('click', () => {
    _overlayEl.remove();
    _overlayEl = null;
  });

  _overlayEl.addEventListener('click', (e) => {
    if (e.target === _overlayEl) {
      _overlayEl.remove();
      _overlayEl = null;
    }
  });

  await _loadUsers(modal.querySelector('#ad-body'), currentUser);
}

async function _loadUsers(bodyEl, currentUser) {
  try {
    const snap = await get(ref(db, 'users'));
    if (!snap.exists()) {
      bodyEl.innerHTML = '<div class="ad-loading">No hay usuarios.</div>';
      return;
    }

    const usersData = snap.val();
    bodyEl.innerHTML = '';
    
    let visibleUsersCount = 0;

    for (const [uid, udata] of Object.entries(usersData)) {
      if (uid === currentUser.uid) continue; // Don't show the admin themselves
      if (udata.deleted) continue; // Hide deleted users
      
      visibleUsersCount++;

      const row = document.createElement('div');
      row.className = 'ad-user-row';
      
      const avatarHtml = udata.photoURL 
        ? `<img class="ad-avatar" src="${udata.photoURL}">`
        : `<div class="ad-avatar">${(udata.username || '?')[0].toUpperCase()}</div>`;
        
      let statusHtml = '';
      if (udata.banned) statusHtml = '<span style="color:#fb5607">Baneado</span>';
      else if (udata.timeoutUntil && udata.timeoutUntil > Date.now()) {
        const d = new Date(udata.timeoutUntil);
        statusHtml = `<span style="color:#3a86ff">Timeout hasta ${d.toLocaleDateString()} ${d.toLocaleTimeString()}</span>`;
      } else if (udata.muted) {
        statusHtml = '<span style="color:#ffbe0b">Silenciado</span>';
      } else {
        statusHtml = '<span style="color:#00f5d4">Activo</span>';
      }

      row.innerHTML = `
        <div class="ad-user-info">
          ${avatarHtml}
          <div class="ad-details">
            <span class="ad-name">${udata.username || 'Sin nombre'}</span>
            <span class="ad-id">${uid}</span>
            <div class="ad-status" id="status-${uid}">${statusHtml}</div>
          </div>
        </div>
        <div class="ad-actions">
          <button class="ad-btn ad-btn-mute ${udata.muted ? 'active' : ''}" data-uid="${uid}" data-action="mute">Mute</button>
          <button class="ad-btn ad-btn-time" data-uid="${uid}" data-action="timeout">Timeout</button>
          <button class="ad-btn ad-btn-ban ${udata.banned ? 'active' : ''}" data-uid="${uid}" data-action="ban">Ban</button>
          <button class="ad-btn ad-btn-read ${udata.canSeeReadReceipts === false ? 'active' : ''}" data-uid="${uid}" data-action="toggleRead" title="Bloquear doble check azul">Vistos</button>
          <button class="ad-btn ad-btn-del" data-uid="${uid}" data-action="delete">Borrar</button>
        </div>
      `;

      // Event listeners for actions
      row.querySelectorAll('.ad-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.dataset.action;
          const targetUid = btn.dataset.uid;
          
          try {
            if (action === 'mute') {
              const isMuted = !btn.classList.contains('active');
              await update(ref(db, `users/${targetUid}`), { muted: isMuted });
              btn.classList.toggle('active');
              _updateStatus(targetUid, isMuted ? '<span style="color:#ffbe0b">Silenciado</span>' : '<span style="color:#00f5d4">Activo</span>');
            } 
            else if (action === 'timeout') {
              const hours = prompt('¿Cuántas horas de timeout? (0 para quitar)');
              if (hours !== null) {
                const h = parseFloat(hours);
                if (!isNaN(h)) {
                  const t = h > 0 ? Date.now() + (h * 60 * 60 * 1000) : null;
                  await update(ref(db, `users/${targetUid}`), { timeoutUntil: t });
                  _loadUsers(bodyEl, currentUser); // Reload to update status safely
                }
              }
            }
            else if (action === 'ban') {
              const isBanned = !btn.classList.contains('active');
              if (isBanned) {
                 if (!confirm(`¿Banear permanentemente a ${udata.username}?`)) return;
              }
              await update(ref(db, `users/${targetUid}`), { banned: isBanned });
              btn.classList.toggle('active');
              _updateStatus(targetUid, isBanned ? '<span style="color:#fb5607">Baneado</span>' : '<span style="color:#00f5d4">Activo</span>');
            }
            else if (action === 'delete') {
              if (confirm(`¿ELIMINAR directamente el registro de ${udata.username}? Esta acción es irreversible.`)) {
                // Set as deleted, effectively blocking them
                await set(ref(db, `users/${targetUid}`), { deleted: true });
                row.remove(); // Remove from UI
              }
            }
          } catch (e) {
            console.error('Error in admin action:', e);
            alert('Error al ejecutar la acción.');
          }
        });
      });

      bodyEl.appendChild(row);
    }
    
    if (visibleUsersCount === 0) {
      bodyEl.innerHTML = '<div class="ad-loading">No hay otros usuarios registrados actualmente.</div>';
    }
  } catch (err) {
    console.error('Admin error:', err);
    bodyEl.innerHTML = '<div class="ad-loading">Error al cargar usuarios.</div>';
  }
}

function _updateStatus(uid, html) {
  const el = document.getElementById(`status-${uid}`);
  if (el) el.innerHTML = html;
}
