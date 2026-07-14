const introLayer = document.getElementById('intro-layer');
const chatLayer = document.getElementById('chat-layer');
const authView = document.getElementById('auth-view');
const chatView = document.getElementById('chat-view');

// ── OneSignal Init ─────────────────────────────────────────
function initNativeOneSignal() {
    if (window.plugins && window.plugins.OneSignal) {
        try {
            window.plugins.OneSignal.initialize("17d0128f-85bd-46e9-b575-e5cb865752a3");
            window.plugins.OneSignal.Notifications.requestPermission(true).then((accepted) => {
                console.log("User accepted notifications: " + accepted);
            });
        } catch (e) {
            console.error("Error initializing OneSignal:", e);
        }
    }
}

// En Capacitor 3+, window.Capacitor.isNative ya no existe, usamos getPlatform() o simplemente comprobamos si existe el plugin.
const isNativeApp = window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() !== 'web';

if (isNativeApp || (window.plugins && window.plugins.OneSignal)) {
    if (window.plugins && window.plugins.OneSignal) {
        initNativeOneSignal();
    } else {
        document.addEventListener("deviceready", initNativeOneSignal, false);
    }
} else {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    OneSignalDeferred.push(async function(OneSignal) {
      try {
          await OneSignal.init({
            appId: "17d0128f-85bd-46e9-b575-e5cb865752a3",
            safari_web_id: "web.onesignal.auto.40785b5b-169b-4884-a5e0-8aeabe17c634",
            notifyButton: {
              enable: true,
            },
          });
      } catch (e) {
          console.warn("OneSignal init:", e.message || e);
      }
    });
}

// ── App State ──────────────────────────────────────────────
export const state = {
    currentLayer: 'intro',
    currentUser: null,
    isTransitioning: false,
    layout: null,
    currentConvId: null,
    userData: null
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
    if (!chatModule) chatModule = await import('./chat/chat.js?v=7');
    return chatModule;
}
async function loadLayoutModule() {
    if (!layoutModule) layoutModule = await import('./chat/layout.js?v=3');
    return layoutModule;
}
async function loadSidebarModule() {
    if (!sidebarModule) sidebarModule = await import('./chat/sidebar.js?v=3');
    return sidebarModule;
}
async function loadNewConvModule() {
    if (!newConvModule) newConvModule = await import('./chat/newConversation.js?v=3');
    return newConvModule;
}
async function loadProfileModule() {
    if (!profileModule) profileModule = await import('./chat/profile.js?v=3');
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
async function initChatUI(user, hideSidebar = false) {
    state.currentUser = user;

    // Bind OneSignal to Firebase UID
    if ((isNativeApp || (window.plugins && window.plugins.OneSignal)) && window.plugins && window.plugins.OneSignal) {
        window.plugins.OneSignal.login(user.uid);
    } else if (window.OneSignalDeferred) {
        window.OneSignalDeferred.push(function(OneSignal) {
            OneSignal.login(user.uid);
        });
    }

    const [layout, sidebar, chat] = await Promise.all([
        loadLayoutModule(), loadSidebarModule(), loadChatModule()
    ]);

    // Apply user theme
    try {
        const { get, ref, db, onValue } = await import('./firebase.js');
        
        // Listen to user profile changes
        onValue(ref(db, `users/${user.uid}`), (snap) => {
           if(snap.exists()) state.userData = snap.val();
        });

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

    if (hideSidebar) {
        state.layout.sidebarEl.style.display = 'none';
        state.layout.chatAreaEl.style.width = '100%';
        state.layout.chatAreaEl.style.flex = '1';
    }

    // Set up sidebar
    sidebar.initSidebar(state.layout.sidebarEl, user, {
        onSelectConversation: (convId) => openConversation(convId),
        onNewConversation: () => openNewConversation(),
        onProfile: () => openProfile(),
        onPanic: async () => {
            try {
                const { get, db, ref, set } = await import('./firebase.js');
                const { deleteConversation } = await import('./chat/messages.js');
                
                // Wipe all conversations where user is a member
                const snap = await get(ref(db, 'conversations'));
                if (snap.exists()) {
                    const convs = snap.val();
                    const promises = [];
                    for (const [id, conv] of Object.entries(convs)) {
                        if (conv.members && conv.members[user.uid]) {
                            promises.push(deleteConversation(id));
                        }
                    }
                    await Promise.all(promises);
                }
                
                // Wipe contacts and theme
                await set(ref(db, `users/${user.uid}/contacts`), null);
                await set(ref(db, `users/${user.uid}/theme`), null);

                // Exit App or Redirect
                if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
                    window.Capacitor.Plugins.App.exitApp();
                } else {
                    window.location.replace('https://www.google.com');
                }
            } catch(e) {
                console.error("Error en Wipe Out:", e);
            }
        }
    });

    // Check tutorial state
    try {
        const { get, db, ref } = await import('./firebase.js');
        const tutSnap = await get(ref(db, `users/${user.uid}/tutorialCompleted`));
        if (!tutSnap.exists() || tutSnap.val() !== true) {
            const { showTutorial } = await import('./chat/tutorial.js');
            showTutorial(document.body, user);
        }
    } catch(e) {
        console.warn("Error checking tutorial state:", e);
    }
}

// ── History API Back Button Handling ───────────────────────
history.replaceState({ view: 'sidebar' }, "Sidebar", "");

window.addEventListener('popstate', (e) => {
    const modals = document.querySelectorAll('.nc-overlay, .pf-overlay, .sc-tutorial-overlay');
    if (modals.length > 0) {
        history.pushState(e.state || { view: 'sidebar' }, document.title, window.location.href);
        const lastModal = modals[modals.length - 1];
        lastModal.click();
        if (lastModal.parentNode) lastModal.remove();
        return;
    }

    if (!e.state || e.state.view !== 'conversation') {
        if (typeof window._internalCloseChat === 'function' && state.currentConvId) {
            window._internalCloseChat();
        }
    }
});

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

    // Push state for hardware back button
    history.pushState({ view: 'conversation' }, "Chat", "");

    window._internalCloseChat = () => {
        chat.destroyChat();
        state.layout.chatAreaEl.innerHTML = `
            <div class="sc-chat-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.35"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <p style="font-size:0.95rem;font-family:Inter,sans-serif;margin:0;color:rgba(255,255,255,0.2)">Selecciona una conversación</p>
            </div>`;
        state.layout.showSidebar();
        sidebar.setActiveConversation(null);
        state.currentConvId = null;
    };

    chat.initChat(state.layout.chatAreaEl, state.currentUser, convId, {
        onBack: () => history.back(),
        onPanic: async () => {
            const { deleteConversation } = await import('./chat/messages.js');
            await deleteConversation(convId);
            history.back();
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

    try {
        const { ref, update, onDisconnect, serverTimestamp, db } = await import('./firebase.js');
        const userRef = ref(db, `users/${user.uid}`);
        
        // 1. Set offline status on disconnect
        onDisconnect(userRef).update({ 
            online: false, 
            lastSeen: serverTimestamp() 
        });

        // 2. Set online status now
        await update(userRef, { 
            online: true, 
            lastSeen: serverTimestamp() 
        });
    } catch(e) {
        console.warn("Presence init failed:", e);
    }

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

                // Check for ?invite=XYZ
                const urlParams = new URLSearchParams(window.location.search);
                const inviteId = urlParams.get('invite');

                if (inviteId && !user) {
                    authView.classList.add('hidden');
                    chatView.classList.remove('hidden');
                    try {
                        const { auth, ref, set, db } = await import('./firebase.js');
                        const { signInAnonymously, updateProfile } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js');
                        const userCred = await signInAnonymously(auth);
                        user = userCred.user;
                        
                        if (!user.displayName) {
                            const randomId = Math.floor(Math.random() * 9000) + 1000;
                            await updateProfile(user, {
                                displayName: "Invitado_" + randomId,
                                photoURL: "https://ui-avatars.com/api/?name=I&background=random"
                            });
                        }
                        
                        
                        // Register anonymous user in DB
                        await set(ref(db, `users/${user.uid}`), {
                            username: user.displayName || "Invitado",
                            photoURL: user.photoURL || "",
                            email: "anon@shadowchat.app",
                            online: true,
                            lastSeen: Date.now()
                        });
                        
                        // Add to conversation
                        await set(ref(db, `conversations/${inviteId}/members/${user.uid}`), true);
                        
                        state.currentUser = user;
                        await initChatUI(user, true); // We'll add a flag to hide sidebar
                        openConversation(inviteId);
                        return;
                    } catch (e) {
                        alert("Error al entrar como invitado. Asegúrate de que el administrador habilitó 'Anónimo' en Firebase.\n\n" + e.message);
                        window.location.href = window.location.pathname; // strip invite
                        return;
                    }
                }

                if (user) {
                    authView.classList.add('hidden');
                    chatView.classList.remove('hidden');
                    
                    if (inviteId) {
                        try {
                            const { ref, set, db } = await import('./firebase.js');
                            await set(ref(db, `conversations/${inviteId}/members/${user.uid}`), true);
                            await initChatUI(user);
                            openConversation(inviteId);
                            // Clear URL without reload
                            window.history.replaceState({}, document.title, window.location.pathname);
                        } catch(e) {
                            console.error(e);
                            await initChatUI(user);
                        }
                    } else {
                        await initChatUI(user);
                    }
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

// ── Decoy Screen (Feature 1) ───────────────────────────────
let decoyActive = false;
const decoyLayer = document.createElement('div');
decoyLayer.id = 'decoy-layer';
decoyLayer.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:#fff; z-index:99999; display:none; flex-direction:column; color:#000; font-family:sans-serif; overflow-y:auto;';
decoyLayer.innerHTML = `
  <div style="background:#eaecf0; padding:10px 16px; border-bottom:1px solid #a2a9b1; display:flex; align-items:center; gap:10px;">
    <div style="width:30px; height:30px; background:#ccc; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:serif; font-weight:bold; color:#fff;">W</div>
    <span style="font-size:20px; font-family:serif;">Wikipedia</span>
  </div>
  <div style="padding:20px;">
    <h1 style="font-family:serif; border-bottom:1px solid #a2a9b1; margin-top:0; padding-bottom:5px;">Historia de la Agricultura</h1>
    <p style="line-height:1.6;">La historia de la agricultura abarca la domesticación de plantas y animales y el desarrollo y la difusión de técnicas para criarlos productivamente. En sus fases iniciales, la agricultura se desarrolló de manera independiente en diferentes partes del mundo e incluyó una amplia gama de taxones. Al menos once regiones separadas del Viejo y Nuevo Mundo participaron como centros de origen independientes.</p>
    <p style="line-height:1.6;">La agricultura permitió a la humanidad producir alimentos a una escala mucho mayor que la caza y la recolección, lo que a su vez facilitó el desarrollo de la civilización humana.</p>
    <h2 style="font-family:serif; border-bottom:1px solid #a2a9b1; margin-top:20px; padding-bottom:5px;">Orígenes</h2>
    <p style="line-height:1.6;">Los cazadores-recolectores utilizaban el fuego para alterar la vegetación, de tal modo que se favorecía el crecimiento de ciertas plantas frente a otras.</p>
  </div>
`;
document.body.appendChild(decoyLayer);

function toggleDecoy() {
  decoyActive = !decoyActive;
  decoyLayer.style.display = decoyActive ? 'flex' : 'none';
}

// Exit on mobile (Long press)
let decoyTouchTimer = null;
decoyLayer.addEventListener('touchstart', (e) => {
  decoyTouchTimer = setTimeout(() => {
    if (decoyActive) toggleDecoy();
  }, 2000);
});
decoyLayer.addEventListener('touchend', () => clearTimeout(decoyTouchTimer));
decoyLayer.addEventListener('touchmove', () => clearTimeout(decoyTouchTimer));

// X 3 times logic (Desktop)
let xPresses = 0;
let xPressTimer = null;
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'x') {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
    
    xPresses++;
    clearTimeout(xPressTimer);
    if (xPresses >= 3) {
      toggleDecoy();
      xPresses = 0;
    } else {
      xPressTimer = setTimeout(() => { xPresses = 0; }, 600);
    }
  }
});

// Shake logic (Mobile)
let lastX, lastY, lastZ;
let lastUpdate = 0;
const SHAKE_THRESHOLD = 3000; // Adjusted for better devicemotion

if (typeof window.DeviceMotionEvent !== 'undefined') {
  window.addEventListener('devicemotion', (e) => {
    const acc = e.accelerationIncludingGravity;
    if (!acc) return;
    const curTime = Date.now();
    if ((curTime - lastUpdate) > 100) {
      const diffTime = (curTime - lastUpdate);
      lastUpdate = curTime;
      const x = acc.x || 0;
      const y = acc.y || 0;
      const z = acc.z || 0;
      
      if (lastX !== undefined) {
          const speed = Math.abs(x + y + z - lastX - lastY - lastZ) / diffTime * 10000;
          if (speed > SHAKE_THRESHOLD && !decoyActive) {
            toggleDecoy();
          }
      }
      lastX = x;
      lastY = y;
      lastZ = z;
    }
  });
}
