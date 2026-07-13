// =============================================================================
// newConversation.js — Create private/group conversations (ShadowChat 2.0)
// =============================================================================

import { db, auth, ref, get, push, set, onValue } from '../firebase.js';

function _injectStyles() {
  if (document.getElementById('sc-newconv-styles')) return;
  const s = document.createElement('style');
  s.id = 'sc-newconv-styles';
  s.textContent = `
    .nc-overlay {
      position: fixed; inset: 0; z-index: 500;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      animation: ncFadeIn 0.2s ease;
    }
    @keyframes ncFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes ncSlideIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    .nc-modal {
      background: #11111b; border: 1px solid rgba(168,85,247,0.2);
      border-radius: 16px; width: 90%; max-width: 440px; max-height: 80vh;
      display: flex; flex-direction: column; overflow: hidden;
      animation: ncSlideIn 0.3s ease; font-family: 'Inter', sans-serif;
      box-shadow: 0 0 40px rgba(168,85,247,0.1);
    }
    .nc-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 20px 16px; border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .nc-title { font-size: 1.1rem; font-weight: 700; color: #e2e8f0; margin: 0; }
    .nc-close {
      width: 32px; height: 32px; border-radius: 8px; border: none;
      background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5);
      font-size: 1.2rem; cursor: pointer; display: flex;
      align-items: center; justify-content: center; transition: all 0.2s;
    }
    .nc-close:hover { background: rgba(255,255,255,0.1); color: #fff; }
    .nc-body { padding: 16px 20px; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
    .nc-body::-webkit-scrollbar { width: 4px; }
    .nc-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
    .nc-toggle {
      display: flex; gap: 8px;
    }
    .nc-pill {
      flex: 1; padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);
      background: transparent; color: rgba(255,255,255,0.5); font-size: 0.85rem;
      font-family: 'Inter', sans-serif; cursor: pointer; text-align: center;
      transition: all 0.2s; font-weight: 500;
    }
    .nc-pill.active {
      background: rgba(0,245,212,0.1); border-color: rgba(0,245,212,0.3);
      color: #00f5d4;
    }
    .nc-input {
      width: 100%; padding: 10px 12px; border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04);
      color: #e2e8f0; font-size: 0.85rem; font-family: 'Inter', sans-serif;
      outline: none; box-sizing: border-box; transition: border-color 0.2s;
    }
    .nc-input:focus { border-color: rgba(0,245,212,0.3); }
    .nc-label { font-size: 0.78rem; color: rgba(255,255,255,0.35); margin-bottom: 4px; }
    .nc-user-list { display: flex; flex-direction: column; gap: 4px; max-height: 280px; overflow-y: auto; }
    .nc-user-item {
      display: flex; align-items: center; gap: 10px; padding: 8px 10px;
      border-radius: 10px; cursor: pointer; transition: background 0.15s;
    }
    .nc-user-item:hover { background: rgba(255,255,255,0.04); }
    .nc-user-item.selected { background: rgba(0,245,212,0.08); }
    .nc-user-avatar {
      width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
    }
    .nc-user-avatar-letter {
      width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 0.85rem; color: #fff;
      background: linear-gradient(135deg, #6366f1, #a855f7);
    }
    .nc-user-name { flex: 1; font-size: 0.88rem; color: #e2e8f0; }
    .nc-user-check {
      width: 20px; height: 20px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.15);
      display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0;
    }
    .nc-user-item.selected .nc-user-check {
      background: #00f5d4; border-color: #00f5d4;
    }
    .nc-user-item.selected .nc-user-check::after {
      content: '✓'; font-size: 0.7rem; color: #0a0a0f; font-weight: 700;
    }
    .nc-footer { padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.06); }
    .nc-create-btn {
      width: 100%; padding: 12px; border-radius: 10px; border: none;
      background: linear-gradient(135deg, #00f5d4, #00c4a7); color: #0a0a0f;
      font-size: 0.9rem; font-weight: 600; font-family: 'Inter', sans-serif;
      cursor: pointer; transition: all 0.2s;
    }
    .nc-create-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(0,245,212,0.3); }
    .nc-create-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
    .nc-no-users { text-align: center; color: rgba(255,255,255,0.25); font-size: 0.85rem; padding: 20px; }
  `;
  document.head.appendChild(s);
}

let _overlayEl = null;

/**
 * Shows the new conversation modal.
 */
export async function showNewConversationModal(container, currentUser, onCreated) {
  _injectStyles();

  let convType = 'private';
  let selectedUsers = new Set();
  let allUsers = [];

  // Fetch all users and contacts
  try {
    const snap = await get(ref(db, 'users'));
    if (snap.exists()) {
      const data = snap.val();
      
      const contactsSnap = await get(ref(db, `users/${currentUser.uid}/contacts`));
      const contacts = contactsSnap.exists() ? contactsSnap.val() : {};

      allUsers = Object.entries(data)
        .filter(([uid, u]) => uid !== currentUser.uid && !u.deleted)
        .map(([uid, u]) => {
           if (contacts[uid]) u.customName = contacts[uid];
           return { uid, ...u };
        });
    }
  } catch (e) {
    console.error('[NewConv] Error fetching users:', e);
  }

  // Create overlay
  _overlayEl = document.createElement('div');
  _overlayEl.className = 'nc-overlay';

  const modal = document.createElement('div');
  modal.className = 'nc-modal';

  // Header
  modal.innerHTML = `
    <div class="nc-header">
      <h3 class="nc-title">Nueva conversación</h3>
      <button class="nc-close">✕</button>
    </div>
    <div class="nc-body">
      <div class="nc-toggle">
        <button class="nc-pill active" data-type="private">Privada</button>
        <button class="nc-pill" data-type="group">Grupal</button>
      </div>
      <div id="nc-group-name-wrap" style="display:none">
        <div class="nc-label">Nombre del grupo</div>
        <input class="nc-input" id="nc-group-name" placeholder="Ej: Equipo secreto..." maxlength="40">
      </div>
      <div>
        <div class="nc-label">Buscar usuarios</div>
        <input class="nc-input" id="nc-search" placeholder="Buscar...">
      </div>
      <div class="nc-user-list" id="nc-user-list"></div>
    </div>
    <div class="nc-footer">
      <button class="nc-create-btn" id="nc-create-btn" disabled>Crear conversación</button>
    </div>
  `;

  _overlayEl.appendChild(modal);
  container.appendChild(_overlayEl);

  // Elements
  const pills = modal.querySelectorAll('.nc-pill');
  const groupNameWrap = modal.querySelector('#nc-group-name-wrap');
  const groupNameInput = modal.querySelector('#nc-group-name');
  const searchInput = modal.querySelector('#nc-search');
  const userList = modal.querySelector('#nc-user-list');
  const createBtn = modal.querySelector('#nc-create-btn');
  const closeBtn = modal.querySelector('.nc-close');

  // Render user list
  function renderUsers(filter = '') {
    const filtered = allUsers.filter(u =>
      (u.customName || u.username || u.displayName || '').toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) {
      userList.innerHTML = `<div class="nc-no-users">No se encontraron usuarios</div>`;
      return;
    }

    userList.innerHTML = '';
    filtered.forEach(u => {
      const item = document.createElement('div');
      item.className = `nc-user-item${selectedUsers.has(u.uid) ? ' selected' : ''}`;

      const displayName = u.customName || u.username || u.displayName || 'Usuario';
      const avatarHtml = u.photoURL
        ? `<img class="nc-user-avatar" src="${u.photoURL}" alt="">`
        : `<div class="nc-user-avatar-letter">${displayName[0].toUpperCase()}</div>`;

      item.innerHTML = `
        ${avatarHtml}
        <div class="nc-user-name">${displayName}</div>
        <div class="nc-user-check"></div>
      `;

      item.addEventListener('click', () => {
        if (convType === 'private') {
          selectedUsers.clear();
          selectedUsers.add(u.uid);
        } else {
          if (selectedUsers.has(u.uid)) selectedUsers.delete(u.uid);
          else selectedUsers.add(u.uid);
        }
        renderUsers(searchInput.value);
        updateCreateBtn();
      });

      userList.appendChild(item);
    });
  }

  function updateCreateBtn() {
    const hasUsers = selectedUsers.size > 0;
    const hasGroupName = convType === 'private' || (groupNameInput.value.trim().length > 0);
    createBtn.disabled = !(hasUsers && hasGroupName);
  }

  // Toggle type
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      convType = pill.dataset.type;
      pills.forEach(p => p.classList.toggle('active', p === pill));
      groupNameWrap.style.display = convType === 'group' ? '' : 'none';
      if (convType === 'private' && selectedUsers.size > 1) {
        const first = [...selectedUsers][0];
        selectedUsers.clear();
        selectedUsers.add(first);
      }
      renderUsers(searchInput.value);
      updateCreateBtn();
    });
  });

  searchInput.addEventListener('input', () => renderUsers(searchInput.value));
  groupNameInput.addEventListener('input', updateCreateBtn);

  // Close
  closeBtn.addEventListener('click', hideNewConversationModal);
  _overlayEl.addEventListener('click', (e) => {
    if (e.target === _overlayEl) hideNewConversationModal();
  });

  // Create
  createBtn.addEventListener('click', async () => {
    createBtn.disabled = true;
    createBtn.textContent = 'Creando...';

    try {
      const members = {};
      members[currentUser.uid] = true;
      selectedUsers.forEach(uid => { members[uid] = true; });

      // For private chats, check if one already exists
      if (convType === 'private') {
        const otherUid = [...selectedUsers][0];
        const convsSnap = await get(ref(db, 'conversations'));
        if (convsSnap.exists()) {
          const convs = convsSnap.val();
          for (const [id, c] of Object.entries(convs)) {
            if (c.type === 'private' && c.members && c.members[currentUser.uid] && c.members[otherUid]) {
              hideNewConversationModal();
              if (onCreated) onCreated(id);
              return;
            }
          }
        }
      }

      // Create new conversation
      const convData = {
        type: convType,
        name: convType === 'group' ? groupNameInput.value.trim() : null,
        createdBy: currentUser.uid,
        createdAt: Date.now(),
        members,
        lastMessage: {
          text: 'Conversación creada',
          sender: 'Sistema',
          timestamp: Date.now(),
          type: 'system'
        }
      };

      const newRef = push(ref(db, 'conversations'));
      await set(newRef, convData);

      hideNewConversationModal();
      if (onCreated) onCreated(newRef.key);
    } catch (error) {
      console.error('[NewConv] Error creating conversation:', error);
      createBtn.disabled = false;
      createBtn.textContent = 'Crear conversación';
    }
  });

  renderUsers();
}

/**
 * Hides and removes the modal.
 */
export function hideNewConversationModal() {
  if (_overlayEl) {
    _overlayEl.style.animation = 'ncFadeIn 0.15s ease reverse';
    setTimeout(() => {
      _overlayEl?.remove();
      _overlayEl = null;
    }, 150);
  }
}
