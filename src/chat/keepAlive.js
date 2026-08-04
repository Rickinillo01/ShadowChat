// =============================================================================
// keepAlive.js — iOS Silent Audio & WakeLock Bypass (ShadowChat)
// Previene que iOS/Safari suspenda o cierre la PWA en segundo plano.
// =============================================================================

let keepAliveAudio = null;
let wakeLock = null;
let isEnabled = false;

// Audio WAV silencioso en Base64
const SILENT_WAV = 'data:audio/wav;base64,UklGRi4AAABXQVZFRm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoAAAAKAAAAAAAAAAAAAAA=';

export function initKeepAlive(user) {
  const savedState = localStorage.getItem(`sc_keepalive_${user.uid}`) === 'true';
  if (savedState) {
    startKeepAlive();
  }
}

export function startKeepAlive() {
  if (isEnabled && keepAliveAudio) return;
  isEnabled = true;

  try {
    if (!keepAliveAudio) {
      keepAliveAudio = document.createElement('audio');
      keepAliveAudio.src = SILENT_WAV;
      keepAliveAudio.loop = true;
      keepAliveAudio.setAttribute('playsinline', '');
      keepAliveAudio.style.display = 'none';
      document.body.appendChild(keepAliveAudio);
    }

    // Intentar reproducir inmediatamente
    keepAliveAudio.play().catch(e => {
      console.warn("[KeepAlive] Autoplay bloqueado por iOS. Esperando interacción táctil...");
    });

    // En iOS es habitual necesitar un toque para habilitar el audio de fondo
    const resumeAudio = () => {
      if (isEnabled && keepAliveAudio && keepAliveAudio.paused) {
        keepAliveAudio.play().then(() => {
          console.log("🟢 [KeepAlive] Audio silencioso en segundo plano activo.");
        }).catch(() => {});
      }
    };
    window.addEventListener('touchstart', resumeAudio, { passive: true });
    window.addEventListener('click', resumeAudio, { passive: true });
    window.addEventListener('keydown', resumeAudio, { passive: true });

    // Intentar activar Screen Wake Lock si es soportado (evita que la pantalla se apague si está abierta)
    if ('wakeLock' in navigator && !wakeLock) {
      navigator.wakeLock.request('screen').then(lock => {
        wakeLock = lock;
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }).catch(() => {});
    }

    // Configurar MediaSession para que iOS reconozca el proceso en segundo plano como reproductor activo
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Conexión permanente (Anti-cierre iOS)',
        artist: 'ShadowChat',
        album: 'Segundo Plano Activo'
      });
      try {
        navigator.mediaSession.setActionHandler('play', () => { if (keepAliveAudio) keepAliveAudio.play(); });
        navigator.mediaSession.setActionHandler('pause', () => { /* Bloqueamos la pausa para mantener la conexión */ });
      } catch (err) {}
    }

    // Temporizador periódico de seguridad para reactivar audio si iOS lo pauso por cambiar de red
    if (!window._keepAliveTimer) {
      window._keepAliveTimer = setInterval(() => {
        if (isEnabled && keepAliveAudio && keepAliveAudio.paused) {
          keepAliveAudio.play().catch(() => {});
        }
        if (isEnabled && 'wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') {
          navigator.wakeLock.request('screen').then(l => wakeLock = l).catch(()=>{});
        }
      }, 8000);
    }

    console.log("🟢 [KeepAlive] Bypass activado.");
  } catch (err) {
    console.error("Error al iniciar Keep-Alive:", err);
  }
}

export function stopKeepAlive() {
  isEnabled = false;
  if (keepAliveAudio) {
    keepAliveAudio.pause();
    keepAliveAudio.remove();
    keepAliveAudio = null;
  }
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
  if (window._keepAliveTimer) {
    clearInterval(window._keepAliveTimer);
    window._keepAliveTimer = null;
  }
  console.log("🔴 [KeepAlive] Bypass desactivado.");
}

export function getKeepAliveState(uid) {
  return localStorage.getItem(`sc_keepalive_${uid}`) === 'true';
}

export function setKeepAliveState(uid, enable) {
  localStorage.setItem(`sc_keepalive_${uid}`, enable ? 'true' : 'false');
  if (enable) {
    startKeepAlive();
  } else {
    stopKeepAlive();
  }
}
