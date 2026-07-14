// =============================================================================
// sidebar.js — Conversation list + user header (ShadowChat 2.0)
// =============================================================================

import { db, auth, ref, onValue, off, get, set } from '../firebase.js';
import { formatTimestamp } from './messages.js';
import { showAdminModal } from '../moderation/modPanel.js';

// State
let _listeners = [];
let _container = null;
let _activeConvId = null;
let _conversations = {};
let _usersCache = {};
let _callbacks = {};
let _currentUser = null;
let _searchTerm = '';

// SVGs
const ICON_BOLT = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
const ICON_PLUS = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const ICON_SEARCH = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

function _injectStyles() {
  if (document.getElementById('sc-sidebar-styles')) return;
  const s = document.createElement('style');
  s.id = 'sc-sidebar-styles';
  s.textContent = `
    .sb-header {
      display: flex; align-items: center; gap: 12px;
      padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.06);
      background: var(--chat-surface, #0d0d15);
    }
    .sb-avatar-wrap { position: relative; flex-shrink: 0; display: inline-flex; }
    .sb-online-dot { position: absolute; bottom: 2px; right: 2px; width: 10px; height: 10px; background: #00f5d4; border: 2px solid var(--chat-surface, #0d0d15); border-radius: 50%; z-index: 2; box-shadow: 0 0 5px rgba(0, 245, 212, 0.5); }
    .sb-avatar {
      width: 38px; height: 38px; border-radius: 50%; object-fit: cover;
      cursor: pointer; flex-shrink: 0; transition: transform 0.2s;
      border: 2px solid rgba(0,245,212,0.3);
    }
    .sb-avatar:hover { transform: scale(1.08); }
    .sb-avatar-placeholder {
      width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 0.9rem; color: #fff; cursor: pointer;
      background: linear-gradient(135deg, #a855f7, #6366f1);
      border: 2px solid rgba(0,245,212,0.3);
      transition: transform 0.2s;
    }
    .sb-avatar-placeholder:hover { transform: scale(1.08); }
    .sb-username {
      flex: 1; font-weight: 600; font-size: 0.95rem; color: #e2e8f0;
      font-family: 'Inter', sans-serif; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
    }
    .sb-panic-btn {
      width: 32px; height: 32px; border-radius: 8px; border: none;
      background: rgba(247,37,133,0.15); color: #f72585;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.2s; flex-shrink: 0;
    }
    .sb-panic-btn:hover { background: rgba(247,37,133,0.3); transform: scale(1.1); }
    .sb-search-wrap {
      padding: 8px 16px;
    }
    .sb-search {
      width: 100%; padding: 10px 12px 10px 36px; border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.04);
      color: #e2e8f0; font-size: 0.85rem; font-family: 'Inter', sans-serif;
      outline: none; box-sizing: border-box; transition: border-color 0.2s;
    }
    .sb-search:focus { border-color: rgba(0,245,212,0.3); }
    .sb-search-icon {
      position: absolute; left: 28px; top: 50%; transform: translateY(-50%);
      color: rgba(255,255,255,0.3); pointer-events: none;
    }
    .sb-new-btn {
      margin: 4px 16px 8px; padding: 10px; border-radius: 10px;
      border: 1px dashed rgba(0,245,212,0.25); background: transparent;
      color: #00f5d4; font-size: 0.85rem; font-family: 'Inter', sans-serif;
      font-weight: 500; cursor: pointer; display: flex; align-items: center;
      justify-content: center; gap: 8px; transition: all 0.2s;
    }
    .sb-new-btn:hover {
      background: rgba(0,245,212,0.06); border-color: rgba(0,245,212,0.4);
    }
    .sb-list {
      flex: 1; overflow-y: auto; overflow-x: hidden;
    }
    .sb-list::-webkit-scrollbar { width: 4px; }
    .sb-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
    .sb-item {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; cursor: pointer; transition: all 0.15s;
      border-left: 3px solid transparent;
    }
    .sb-item:hover { background: rgba(255,255,255,0.03); }
    .sb-item.active {
      background: var(--chat-surface-2, rgba(255,255,255,0.05));
      border-left-color: var(--chat-accent, #00f5d4);
    }
    .sb-item-avatar {
      width: 44px; height: 44px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
    }
    .sb-item-avatar-letter {
      width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 1rem; color: #fff;
      background: linear-gradient(135deg, #6366f1, #a855f7);
    }
    .sb-item-info { flex: 1; min-width: 0; }
    .sb-item-name {
      font-weight: 600; font-size: 0.9rem; color: #e2e8f0;
      font-family: 'Inter', sans-serif; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
    }
    .sb-item-preview {
      font-size: 0.78rem; color: rgba(255,255,255,0.35);
      font-family: 'Inter', sans-serif; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap; margin-top: 2px;
    }
    .sb-item-time {
      font-size: 0.7rem; color: rgba(255,255,255,0.25);
      font-family: 'Inter', sans-serif; flex-shrink: 0; align-self: flex-start;
      margin-top: 2px;
    }
    .sb-empty {
      flex: 1; display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,0.2); font-size: 0.85rem;
      font-family: 'Inter', sans-serif; padding: 32px; text-align: center;
    }
  `;
  document.head.appendChild(s);
}

/**
 * Fetches user data by UID (with cache).
 */
async function _fetchUser(uid) {
  if (_usersCache[uid]) return _usersCache[uid];
  try {
    const snap = await get(ref(db, `users/${uid}`));
    if (snap.exists()) {
      const udata = snap.val();
      
      if (!udata.deleted && udata.deadManSwitch && udata.deadManSwitch > 0) {
        const lastSeen = udata.lastSeen || udata.createdAt || 0;
        const daysPassed = (Date.now() - lastSeen) / (1000 * 60 * 60 * 24);
        if (daysPassed > udata.deadManSwitch) {
          console.warn(`[Dead Man Switch] Sweeping user ${uid} (Inactive for ${daysPassed.toFixed(1)} days)`);
          udata.deleted = true;
          udata.username = 'Usuario Eliminado';
          udata.photoURL = null;
          udata.email = 'borrado@shadowchat';
          
          import('../firebase.js').then(({ update }) => {
            update(ref(db, `users/${uid}`), { 
              deleted: true, 
              username: 'Usuario Eliminado', 
              photoURL: null, 
              email: 'borrado@shadowchat' 
            }).catch(()=>{});
          });
        }
      }
      
      _usersCache[uid] = udata;
      return _usersCache[uid];
    }
  } catch (e) {}
  return null;
}

let _contactsCache = {};
async function _getContactName(uid) {
  if (_contactsCache[uid] !== undefined) return _contactsCache[uid];
  try {
    const snap = await get(ref(db, `users/${_currentUser.uid}/contacts/${uid}`));
    _contactsCache[uid] = snap.exists() ? snap.val() : null;
    return _contactsCache[uid];
  } catch (e) {
    return null;
  }
}

/**
 * Gets display name for a conversation.
 */
async function _getConvDisplayName(conv, convId) {
  if (conv.type === 'group') return conv.name || 'Grupo';
  // Private: find the other user
  const members = Object.keys(conv.members || {});
  const otherUid = members.find(uid => uid !== _currentUser.uid) || members[0];
  const customName = await _getContactName(otherUid);
  if (customName) return customName;
  const user = await _fetchUser(otherUid);
  return user?.username || user?.displayName || 'Usuario';
}

/**
 * Gets avatar info for a conversation.
 */
async function _getConvAvatar(conv) {
  if (conv.type === 'group') {
    return { type: 'letter', value: (conv.name || 'G')[0].toUpperCase() };
  }
  const members = Object.keys(conv.members || {});
  const otherUid = members.find(uid => uid !== _currentUser.uid) || members[0];
  const user = await _fetchUser(otherUid);
  const isOnline = user?.online || false;
  if (user?.photoURL) return { type: 'url', value: user.photoURL, online: isOnline };
  const name = user?.username || 'U';
  return { type: 'letter', value: name[0].toUpperCase(), online: isOnline };
}

/**
 * Renders the conversation list.
 */
async function _renderList(listEl) {
  const convArr = Object.entries(_conversations)
    .filter(([_, c]) => c.members && c.members[_currentUser.uid])
    .sort(([, a], [, b]) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));

  // Filter by search
  const filtered = [];
  for (const [id, conv] of convArr) {
    const name = await _getConvDisplayName(conv, id);
    if (_searchTerm && !name.toLowerCase().includes(_searchTerm.toLowerCase())) continue;
    filtered.push({ id, conv, name });
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="sb-empty">No hay conversaciones${_searchTerm ? ' que coincidan' : ''}</div>`;
    return;
  }

  listEl.innerHTML = '';
  for (const { id, conv, name } of filtered) {
    const avatar = await _getConvAvatar(conv);
    const item = document.createElement('div');
    item.className = `sb-item${_activeConvId === id ? ' active' : ''}`;
    item.dataset.convId = id;

    const avatarHtml = avatar.type === 'url'
      ? `<img class="sb-item-avatar" src="${avatar.value}" alt="">`
      : `<div class="sb-item-avatar-letter">${avatar.value}</div>`;

    const avatarWrap = `
      <div class="sb-avatar-wrap">
        ${avatarHtml}
        ${avatar.online ? `<div class="sb-online-dot"></div>` : ''}
      </div>
    `;

    const preview = conv.lastMessage?.text || 'Sin mensajes';
    const time = conv.lastMessage?.timestamp ? formatTimestamp(conv.lastMessage.timestamp) : '';

    item.innerHTML = `
      ${avatarWrap}
      <div class="sb-item-info">
        <div class="sb-item-name">${name}</div>
        <div class="sb-item-preview">${preview.length > 35 ? preview.slice(0, 35) + '…' : preview}</div>
      </div>
      <div class="sb-item-time">${time}</div>
    `;

    item.addEventListener('click', () => {
      _activeConvId = id;
      _renderList(listEl);
      if (_callbacks.onSelectConversation) _callbacks.onSelectConversation(id);
    });

    listEl.appendChild(item);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Initializes the sidebar.
 */
export function initSidebar(sidebarEl, currentUser, callbacks) {
  _injectStyles();
  _container = sidebarEl;
  _currentUser = currentUser;
  _callbacks = callbacks;
  _conversations = {};
  _activeConvId = null;

  // Build header
  const header = document.createElement('div');
  header.className = 'sb-header';

  const avatarHtml = currentUser.photoURL
    ? `<img class="sb-avatar" id="sb-user-avatar" src="${currentUser.photoURL}" alt="">`
    : `<div class="sb-avatar-placeholder" id="sb-user-avatar">${(currentUser.displayName || 'U')[0].toUpperCase()}</div>`;

  const avatarWrap = `
    <div class="sb-avatar-wrap">
      ${avatarHtml}
      <div class="sb-online-dot"></div>
    </div>
  `;

  let adminBtnHtml = '';
  if (currentUser.email === 'cleivsec@gmail.com') {
    adminBtnHtml = `<button class="sb-panic-btn" id="sb-admin-btn" title="Panel Admin" style="color:#00f5d4; margin-right:4px;">🛡️</button>`;
  }

  header.innerHTML = `
    ${avatarWrap}
    <div class="sb-username">${currentUser.displayName || 'Usuario'}</div>
    ${adminBtnHtml}
    <button class="sb-panic-btn" title="Invitar Anónimo (1h)" id="sb-invite-btn" style="color:#00f5d4; margin-right:4px;">⏳</button>
    <button class="sb-panic-btn" title="Pánico">${ICON_BOLT}</button>
  `;

  const inviteBtn = header.querySelector('#sb-invite-btn');
  if (inviteBtn) {
    inviteBtn.addEventListener('click', async () => {
      try {
        const inviteId = "inv_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
        const inviteUrl = window.location.origin + window.location.pathname + "?invite=" + inviteId;
        
        // Copy to clipboard FIRST (must happen immediately after click on mobile)
        try {
          await navigator.clipboard.writeText(inviteUrl);
        } catch(e) {
          // Fallback if clipboard API fails
          const textArea = document.createElement("textarea");
          textArea.value = inviteUrl;
          textArea.style.position = "fixed";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
        
        // Then save to DB
        await set(ref(db, `conversations/${inviteId}`), {
          type: 'private',
          members: { [currentUser.uid]: true },
          expiresAt: expiresAt,
          createdAt: Date.now()
        });

        alert("Enlace copiado. Compártelo para iniciar un chat anónimo de 60 minutos:\n\n" + inviteUrl);
      } catch (err) {
        alert("Error al generar enlace: " + err.message);
      }
    });
  }

  header.querySelector('#sb-user-avatar').addEventListener('click', () => {
    if (callbacks.onProfile) callbacks.onProfile();
  });

  const adminBtn = header.querySelector('#sb-admin-btn');
  if (adminBtn) {
    adminBtn.addEventListener('click', () => {
      try {
        showAdminModal(document.body, currentUser);
      } catch (err) {
        alert("Error al abrir el panel de admin: " + err.message);
      }
    });
  }

  header.querySelector('.sb-panic-btn[title="Pánico"]').addEventListener('click', () => {
    if (callbacks.onPanic) callbacks.onPanic();
  });

  // Search
  const searchWrap = document.createElement('div');
  searchWrap.className = 'sb-search-wrap';
  searchWrap.style.position = 'relative';
  searchWrap.innerHTML = `
    <span class="sb-search-icon">${ICON_SEARCH}</span>
    <input class="sb-search" placeholder="Buscar conversación..." type="text">
  `;

  const searchInput = searchWrap.querySelector('.sb-search');
  searchInput.addEventListener('input', () => {
    if (searchInput.value.toLowerCase() === 'borrar' && _currentUser.email === 'cleivsec@gmail.com') {
      searchInput.value = '';
      import('../moderation/killswitch.js').then(m => m.showKillSwitchModal(document.body, _currentUser));
      return;
    }
    _searchTerm = searchInput.value;
    _renderList(listEl);
  });

  // New conversation button
  const newBtn = document.createElement('button');
  newBtn.className = 'sb-new-btn';
  newBtn.innerHTML = `${ICON_PLUS} Nueva conversación`;
  newBtn.addEventListener('click', () => {
    if (callbacks.onNewConversation) callbacks.onNewConversation();
  });

  // Conversation list
  const listEl = document.createElement('div');
  listEl.className = 'sb-list';

  sidebarEl.innerHTML = '';
  sidebarEl.appendChild(header);
  sidebarEl.appendChild(searchWrap);
  sidebarEl.appendChild(newBtn);
  sidebarEl.appendChild(listEl);

  // Listen to conversations
  const convsRef = ref(db, 'conversations');
  const unsub = onValue(convsRef, (snapshot) => {
    _conversations = snapshot.val() || {};
    _renderList(listEl);
  });
  _listeners.push({ ref: convsRef, type: 'value' });

  return { listEl };
}

/**
 * Destroys sidebar and removes listeners.
 */
export function destroySidebar() {
  _listeners.forEach(l => off(l.ref, l.type));
  _listeners = [];
  _conversations = {};
  _usersCache = {};
  if (_container) _container.innerHTML = '';
}

/**
 * Updates the user avatar in the sidebar header.
 */
export function updateUserPhoto(photoURL) {
  const el = document.getElementById('sb-user-avatar');
  if (!el) return;
  if (photoURL) {
    if (el.tagName === 'IMG') {
      el.src = photoURL;
    } else {
      const img = document.createElement('img');
      img.className = 'sb-avatar';
      img.id = 'sb-user-avatar';
      img.src = photoURL;
      img.addEventListener('click', () => {
        if (_callbacks && _callbacks.onProfile) _callbacks.onProfile();
      });
      el.replaceWith(img);
    }
  }
}

/**
 * Sets the active conversation highlight.
 */
export function setActiveConversation(convId) {
  _activeConvId = convId;
  const items = document.querySelectorAll('.sb-item');
  items.forEach(item => {
    item.classList.toggle('active', item.dataset.convId === convId);
  });
}
