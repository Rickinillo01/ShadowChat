const introLayer = document.getElementById('intro-layer');
const chatLayer = document.getElementById('chat-layer');
const authView = document.getElementById('auth-view');
const chatView = document.getElementById('chat-view');

// ── App State ──────────────────────────────────────────────
const state = {
    currentLayer: 'intro',
    currentUser: null,
    isTransitioning: false,
    layout: null,
    currentConvId: null
};

// ── Lazy-loaded modules ────────────────────────────────────
let authModule = null;
let chatModule = null;
let layoutModule = null;
let sidebarModule = null;
let newConvModule = null;
let profileModule = null;

async function loadAuthModule() {
    if (!authModule) authModule = await import('./auth/auth.js');
    return authModule;
}
async function loadChatModule() {
    if (!chatModule) chatModule = await import('./chat/chat.js');
    return chatModule;
}
async function loadLayoutModule() {
    if (!layoutModule) layoutModule = await import('./chat/layout.js');
    return layoutModule;
}
async function loadSidebarModule() {
    if (!sidebarModule) sidebarModule = await import('./chat/sidebar.js');
    return sidebarModule;
}
async function loadNewConvModule() {
    if (!newConvModule) newConvModule = await import('./chat/newConversation.js');
    return newConvModule;
}
async function loadProfileModule() {
    if (!profileModule) profileModule = await import('./chat/profile.js');
    return profileModule;
}

// Transition to chat layer
function transitionToChatLayer() {
    introLayer.classList.add('fade-out');
    
    setTimeout(() => {
        introLayer.style.display = 'none';
        chatLayer.style.display = '';
        chatLayer.classList.remove('hidden');
        chatLayer.classList.add('active', 'layer-enter');

        setTimeout(() => {
            chatLayer.classList.remove('layer-enter');
            state.isTransitioning = false;
            state.currentLayer = 'chat';
        }, 500);
    }, 800); // Wait for fade-out
}

// ── Initialize Chat UI (WhatsApp layout) ───────────────────
async function initChatUI(user) {
    state.currentUser = user;

    const [layout, sidebar, chat] = await Promise.all([
        loadLayoutModule(), loadSidebarModule(), loadChatModule()
    ]);

    // Apply user theme
    try {
        const { get, ref, db } = await import('./firebase.js');
        const { applyTheme } = await import('./chat/themes.js');
        const tSnap = await get(ref(db, `users/${user.uid}/theme`));
        applyTheme(tSnap.exists() ? tSnap.val() : 0);
    } catch (e) {
        console.warn('Failed to load theme:', e);
    }

    // Set up layout
    chatView.innerHTML = '';
    chatView.style.height = '100vh';
    chatView.style.height = '100dvh';
    state.layout = layout.initLayout(chatView);

    // Set up sidebar
    sidebar.initSidebar(state.layout.sidebarEl, user, {
        onSelectConversation: (convId) => openConversation(convId),
        onNewConversation: () => openNewConversation(),
        onProfile: () => openProfile(),
        onPanic: async () => {
            try {
                const { updateProfile, db, ref, set } = await import('./firebase.js');
                const fakeNames = ["Guest_9918", "Borrador_Test", "Soporte_IT", "Anon_442", "Desconocido"];
                const randomName = fakeNames[Math.floor(Math.random() * fakeNames.length)];
                const fakePhoto = "https://ui-avatars.com/api/?name=" + randomName.charAt(0) + "&background=random";

                await updateProfile(user, {
                    displayName: randomName,
                    photoURL: fakePhoto
                });

                await set(ref(db, `users/${user.uid}/username`), randomName);
                await set(ref(db, `users/${user.uid}/photoURL`), fakePhoto);

                window.location.reload();
            } catch(e) {
                console.error("Error activando modo fantasma:", e);
            }
        }
    });
}

// ── Open a conversation ────────────────────────────────────
async function openConversation(convId) {
    const chat = await loadChatModule();
    const sidebar = await loadSidebarModule();

    // Destroy previous chat if any
    chat.destroyChat();

    state.currentConvId = convId;
    sidebar.setActiveConversation(convId);

    // Clear empty state and render chat
    state.layout.chatAreaEl.innerHTML = '';
    state.layout.showChat();

    chat.initChat(state.layout.chatAreaEl, state.currentUser, convId, {
        onBack: () => {
            chat.destroyChat();
            state.layout.chatAreaEl.innerHTML = `
                <div class="sc-chat-empty">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.35"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <p style="font-size:0.95rem;font-family:Inter,sans-serif;margin:0;color:rgba(255,255,255,0.2)">Selecciona una conversación</p>
                </div>`;
            state.layout.showSidebar();
            sidebar.setActiveConversation(null);
            state.currentConvId = null;
        },
        onPanic: async () => {
            const { deleteConversation } = await import('./chat/messages.js');
            await deleteConversation(convId);
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
                window.Capacitor.Plugins.App.exitApp();
            } else {
                window.location.replace('https://www.google.com');
            }
        }
    });
}

// ── New conversation modal ─────────────────────────────────
async function openNewConversation() {
    const ncMod = await loadNewConvModule();
    ncMod.showNewConversationModal(document.body, state.currentUser, (convId) => {
        openConversation(convId);
    });
}

// ── Profile modal ──────────────────────────────────────────
async function openProfile() {
    const profMod = await loadProfileModule();
    profMod.showProfileModal(document.body, state.currentUser, (updates) => {
        if (updates.photoURL) {
            loadSidebarModule().then(sb => sb.updateUserPhoto(updates.photoURL));
        }
    });
}

// ── Auth Success ───────────────────────────────────────────
async function onAuthSuccess(user) {
    state.currentUser = user;
    authView.classList.add('hidden');
    chatView.classList.remove('hidden');
    await initChatUI(user);
}

// ── App Initialization ─────────────────────────────────────
async function init() {
    // 1. Ensure initial state
    introLayer.classList.add('active');
    introLayer.classList.remove('hidden', 'fade-out');
    introLayer.style.display = '';
    
    chatLayer.classList.add('hidden');
    chatLayer.classList.remove('active');
    chatLayer.style.display = 'none';

    // 2. Play intro animation
    setTimeout(async () => {
        try {
            const authMod = await loadAuthModule();

            authMod.checkExistingAuth(async (user) => {
                transitionToChatLayer();

                if (user) {
                    authView.classList.add('hidden');
                    chatView.classList.remove('hidden');
                    await initChatUI(user);
                } else {
                    authView.classList.remove('hidden');
                    chatView.classList.add('hidden');
                    authMod.initAuth(authView, onAuthSuccess);
                }
            });
        } catch (error) {
            console.error('[ShadowChat] Error:', error);
        }
    }, 2500); // 2.5 seconds of glitch animation
}

document.addEventListener('DOMContentLoaded', init);
