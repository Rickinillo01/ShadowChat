// =============================================================================
// layout.js — WhatsApp-like responsive layout for ShadowChat 2.0
// =============================================================================

const ICON_CHAT = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.35"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

let _resizeHandler = null;

function _injectStyles() {
  if (document.getElementById('sc-layout-styles')) return;
  const style = document.createElement('style');
  style.id = 'sc-layout-styles';
  style.textContent = `
    .sc-layout {
      display: flex;
      width: 100%;
      height: 100vh;
      height: 100dvh;
      overflow: hidden;
      background: var(--chat-bg, #0a0a0f);
      position: relative;
    }
    .sc-sidebar {
      width: 380px;
      flex-shrink: 0;
      background: var(--chat-surface, #0d0d15);
      border-right: 1px solid rgba(255,255,255,0.06);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
    }
    .sc-chat-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: var(--chat-bg, #0a0a0f);
      position: relative;
      overflow: hidden;
      transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
    }
    .sc-chat-empty {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: rgba(255,255,255,0.2);
      gap: 16px;
      user-select: none;
    }
    .sc-chat-empty p {
      font-size: 0.95rem;
      font-family: 'Inter', 'Segoe UI', sans-serif;
      margin: 0;
    }

    @media (max-width: 768px) {
      .sc-sidebar {
        width: 100%;
        position: absolute;
        top: 0; left: 0; bottom: 0;
        z-index: 2;
      }
      .sc-chat-area {
        width: 100%;
        position: absolute;
        top: 0; left: 0; bottom: 0;
        z-index: 1;
      }
      .sc-sidebar.sc-hidden {
        transform: translateX(-100%);
      }
      .sc-chat-area.sc-hidden {
        transform: translateX(100%);
      }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Initializes the WhatsApp-like layout.
 * @param {HTMLElement} container
 * @returns {{ sidebarEl, chatAreaEl, showSidebar, showChat, showBoth }}
 */
export function initLayout(container) {
  _injectStyles();

  container.innerHTML = '';

  const layout = document.createElement('div');
  layout.className = 'sc-layout';

  const sidebar = document.createElement('div');
  sidebar.className = 'sc-sidebar';

  const chatArea = document.createElement('div');
  chatArea.className = 'sc-chat-area';

  // Empty state
  chatArea.innerHTML = `
    <div class="sc-chat-empty">
      ${ICON_CHAT}
      <p>Selecciona una conversación para empezar</p>
    </div>
  `;

  layout.appendChild(sidebar);
  layout.appendChild(chatArea);
  container.appendChild(layout);

  const isMobile = () => window.innerWidth <= 768;

  function showSidebar() {
    if (isMobile()) {
      sidebar.classList.remove('sc-hidden');
      chatArea.classList.add('sc-hidden');
    }
  }

  function showChat() {
    if (isMobile()) {
      sidebar.classList.add('sc-hidden');
      chatArea.classList.remove('sc-hidden');
    }
  }

  function showBoth() {
    sidebar.classList.remove('sc-hidden');
    chatArea.classList.remove('sc-hidden');
  }

  // Initial state
  if (isMobile()) {
    sidebar.classList.remove('sc-hidden');
    chatArea.classList.add('sc-hidden');
  }

  // Handle resize
  _resizeHandler = () => {
    if (!isMobile()) {
      showBoth();
    }
  };
  window.addEventListener('resize', _resizeHandler);

  return { sidebarEl: sidebar, chatAreaEl: chatArea, showSidebar, showChat, showBoth };
}

/**
 * Cleans up layout event listeners.
 */
export function destroyLayout() {
  if (_resizeHandler) {
    window.removeEventListener('resize', _resizeHandler);
    _resizeHandler = null;
  }
}
