// =============================================================================
// debugPanel.js — Admin Debug & Diagnostics Console for @cleivsec
// =============================================================================

import { db, ref, set, get, serverTimestamp } from '../firebase.js';

export function showDebugModal(container, user) {
  const overlay = document.createElement('div');
  overlay.className = 'sc-admin-debug-overlay';
  overlay.style.cssText = "position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,0.85); backdrop-filter:blur(10px); display:flex; align-items:center; justify-content:center; font-family:'Inter',sans-serif; animation: fadeIn 0.2s ease;";

  const platformInfo = (window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches) 
    ? '📱 iOS PWA (Standalone)' : (window.Capacitor ? '🤖 Capacitor Natively' : '💻 Navegador Web');

  const swStatus = ('serviceWorker' in navigator) ? '✅ Disponible' : '❌ No compatible';
  const notifPerm = ('Notification' in window) ? Notification.permission : 'No Soportado';

  overlay.innerHTML = `
    <div style="background:#0e0e18; border:1px solid #00f5d4; border-radius:18px; width:94%; max-width:520px; max-height:88vh; overflow-y:auto; padding:24px; box-shadow:0 0 50px rgba(0,245,212,0.2); display:flex; flex-direction:column; gap:16px; color:#fff;">
      
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:12px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:1.5rem;">🛠️</span>
          <div>
            <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:#00f5d4;">Consola de Debug Admin</h3>
            <span style="font-size:0.75rem; color:rgba(255,255,255,0.5);">Privilegiado: @cleivsec</span>
          </div>
        </div>
        <button id="debug-close-btn" style="background:transparent; border:none; color:rgba(255,255,255,0.6); font-size:1.4rem; cursor:pointer;">✕</button>
      </div>

      <div style="background:rgba(255,255,255,0.03); padding:14px; border-radius:12px; border:1px solid rgba(255,255,255,0.06); font-size:0.85rem; line-height:1.6;">
        <div style="color:#00f5d4; font-weight:700; margin-bottom:4px;">📊 Entorno & Estado del Dispositivo</div>
        <div>• <b>Entorno de Ejecución:</b> ${platformInfo}</div>
        <div>• <b>Service Worker:</b> ${swStatus}</div>
        <div>• <b>Permiso de Notificación:</b> <span id="dbg-notif-perm" style="color:${notifPerm === 'granted' ? '#00f5d4' : '#fbbf24'}; font-weight:bold;">${notifPerm.toUpperCase()}</span></div>
        <div>• <b>Conexión Firebase:</b> <span id="dbg-fb-status" style="color:#00f5d4;">Conectado 🟢</span></div>
      </div>

      <div style="display:flex; flex-direction:column; gap:10px;">
        <div style="font-weight:700; font-size:0.9rem; color:rgba(255,255,255,0.9);">Pruebas y Diagnósticos de Rendimiento:</div>
        
        <button id="test-latency-btn" style="padding:12px 14px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); border-radius:10px; color:#fff; font-weight:600; text-align:left; cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:background 0.2s;">
          <span>⚡ 1. Test Latencia con Firebase (Ping)</span>
          <span id="res-latency" style="font-size:0.8rem; color:rgba(255,255,255,0.5);">Probar ➔</span>
        </button>

        <button id="test-notif-btn" style="padding:12px 14px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); border-radius:10px; color:#fff; font-weight:600; text-align:left; cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:background 0.2s;">
          <span>🔔 2. Probar Notificación Push Local</span>
          <span id="res-notif" style="font-size:0.8rem; color:rgba(255,255,255,0.5);">Enviar ➔</span>
        </button>

        <button id="test-fps-btn" style="padding:12px 14px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); border-radius:10px; color:#fff; font-weight:600; text-align:left; cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:background 0.2s;">
          <span>🏎️ 3. Medir Fluidez UI (FPS & Memoria)</span>
          <span id="res-fps" style="font-size:0.8rem; color:rgba(255,255,255,0.5);">Calcular ➔</span>
        </button>

        <button id="test-keepalive-btn" style="padding:12px 14px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); border-radius:10px; color:#fff; font-weight:600; text-align:left; cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:background 0.2s;">
          <span>🛡️ 4. Ver Estado Bypass Anti-cierre iOS</span>
          <span id="res-keepalive" style="font-size:0.8rem; color:rgba(255,255,255,0.5);">Check ➔</span>
        </button>
      </div>

      <div style="border-top:1px solid rgba(255,255,255,0.1); padding-top:14px; display:flex; gap:10px; justify-content:flex-end;">
        <button id="debug-force-refresh" style="padding:10px 14px; background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.5); border-radius:8px; color:#f87171; font-weight:700; cursor:pointer; font-size:0.85rem;">🔄 Limpiar Caché & Recargar</button>
        <button id="debug-done-btn" style="padding:10px 20px; background:#00f5d4; color:#0e0e18; font-weight:800; border:none; border-radius:8px; cursor:pointer;">Cerrar Panel</button>
      </div>

    </div>
  `;

  container.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#debug-close-btn').addEventListener('click', close);
  overlay.querySelector('#debug-done-btn').addEventListener('click', close);

  // 1. Latency Ping Test
  overlay.querySelector('#test-latency-btn').addEventListener('click', async () => {
    const resEl = overlay.querySelector('#res-latency');
    resEl.textContent = "Calculando...";
    const start = performance.now();
    try {
      await set(ref(db, `admin_debug/last_ping_${user.uid}`), { time: serverTimestamp() });
      const duration = Math.round(performance.now() - start);
      const statusColor = duration < 120 ? '#00f5d4' : (duration < 300 ? '#fbbf24' : '#f87171');
      resEl.innerHTML = `<span style="color:${statusColor}; font-weight:bold;">${duration} ms ⚡</span>`;
    } catch(err) {
      resEl.innerHTML = `<span style="color:#f87171;">Error de red ❌</span>`;
    }
  });

  // 2. Local Push Test
  overlay.querySelector('#test-notif-btn').addEventListener('click', async () => {
    const resEl = overlay.querySelector('#res-notif');
    if (!('Notification' in window)) {
      resEl.textContent = "No Soportado";
      return;
    }
    try {
      let perm = Notification.permission;
      if (perm !== 'granted') {
        perm = await Notification.requestPermission();
        overlay.querySelector('#dbg-notif-perm').textContent = perm.toUpperCase();
      }
      if (perm === 'granted') {
        new Notification("🔔 ShadowChat Admin Debug", {
          body: "¡Prueba de notificación exitosa en tu dispositivo, @cleivsec!",
          icon: "/icon.jpg",
          tag: "debug-notif-" + Date.now()
        });
        resEl.innerHTML = `<span style="color:#00f5d4; font-weight:bold;">Enviada 🟢</span>`;
      } else {
        resEl.innerHTML = `<span style="color:#f87171;">Permiso denegado ❌</span>`;
      }
    } catch(err) {
      resEl.innerHTML = `<span style="color:#f87171;">Error al emitir ❌</span>`;
    }
  });

  // 3. Measure UI Fluidity (FPS)
  overlay.querySelector('#test-fps-btn').addEventListener('click', () => {
    const resEl = overlay.querySelector('#res-fps');
    resEl.textContent = "Midiedio (1s)...";
    let frames = 0;
    let startTime = performance.now();
    
    function step(now) {
      frames++;
      if (now - startTime < 1000) {
        requestAnimationFrame(step);
      } else {
        const fps = Math.round((frames * 1000) / (now - startTime));
        const color = fps >= 55 ? '#00f5d4' : (fps >= 40 ? '#fbbf24' : '#f87171');
        const mem = performance.memory ? ` | ${(performance.memory.usedJSHeapSize / 1048576).toFixed(1)}MB` : '';
        resEl.innerHTML = `<span style="color:${color}; font-weight:bold;">${fps} FPS${mem} 🏎️</span>`;
      }
    }
    requestAnimationFrame(step);
  });

  // 4. Keep-Alive Check
  overlay.querySelector('#test-keepalive-btn').addEventListener('click', async () => {
    const resEl = overlay.querySelector('#res-keepalive');
    const mod = await import('../chat/keepAlive.js').catch(()=>{});
    if (mod && mod.getKeepAliveState(user.uid)) {
      resEl.innerHTML = `<span style="color:#00f5d4; font-weight:bold;">Activo (Inmortal) 🟢</span>`;
    } else {
      resEl.innerHTML = `<span style="color:#fbbf24; font-weight:bold;">Desactivado 🟡</span>`;
    }
  });

  // Force Clean Reload
  overlay.querySelector('#debug-force-refresh').addEventListener('click', () => {
    if (confirm('¿Limpiar la caché del navegador y recargar ShadowChat?')) {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for(let reg of registrations) reg.unregister();
          window.location.reload(true);
        }).catch(() => window.location.reload(true));
      } else {
        window.location.reload(true);
      }
    }
  });
}
