import { db, ref, set } from '../firebase.js';

export function showKillSwitchModal(container, currentUser) {
  if (currentUser.email !== 'cleivsec@gmail.com') return;

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = '#000000';
  overlay.style.zIndex = '999999';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.color = '#ff3366';
  overlay.style.fontFamily = 'monospace';
  overlay.style.textAlign = 'center';

  const icon = document.createElement('div');
  icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  
  const title = document.createElement('h1');
  title.textContent = 'PROTOCOLO DE DESTRUCCIÓN';
  title.style.fontSize = '2rem';
  title.style.margin = '20px 0';
  
  const desc = document.createElement('p');
  desc.textContent = 'Estás a punto de borrar TODA la base de datos de ShadowChat (Usuarios, Conversaciones, Mensajes). Esta acción es irreversible.';
  desc.style.maxWidth = '400px';
  desc.style.lineHeight = '1.5';
  desc.style.opacity = '0.8';

  const btn = document.createElement('button');
  btn.textContent = 'INICIAR BORRADO DEFINITIVO';
  btn.style.marginTop = '40px';
  btn.style.padding = '15px 30px';
  btn.style.backgroundColor = '#ff3366';
  btn.style.color = '#fff';
  btn.style.border = 'none';
  btn.style.borderRadius = '8px';
  btn.style.fontSize = '1.2rem';
  btn.style.fontWeight = 'bold';
  btn.style.cursor = 'pointer';
  btn.style.boxShadow = '0 0 20px rgba(255, 51, 102, 0.5)';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Abortar';
  cancelBtn.style.marginTop = '20px';
  cancelBtn.style.padding = '10px 20px';
  cancelBtn.style.backgroundColor = 'transparent';
  cancelBtn.style.color = '#fff';
  cancelBtn.style.border = '1px solid rgba(255,255,255,0.2)';
  cancelBtn.style.borderRadius = '4px';
  cancelBtn.style.cursor = 'pointer';

  btn.addEventListener('click', async () => {
    const confirmation1 = prompt('Para continuar, escribe exactamente "CONFIRMAR" (en mayúsculas):');
    if (confirmation1 !== 'CONFIRMAR') {
        alert('Secuencia abortada.');
        return;
    }

    if (confirm('¿ESTÁS 100% SEGURO? NO HABRÁ MARCHA ATRÁS.')) {
        try {
            overlay.innerHTML = '<h2 style="color:#fff;font-family:monospace">Borrando datos...</h2>';
            await set(ref(db, '/'), null);
            alert('Base de datos destruida con éxito.');
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
                window.Capacitor.Plugins.App.exitApp();
            } else {
                window.location.replace('https://www.google.com');
            }
        } catch(e) {
            alert('Error al destruir: ' + e.message);
            container.removeChild(overlay);
        }
    } else {
        alert('Secuencia abortada.');
    }
  });

  cancelBtn.addEventListener('click', () => {
    container.removeChild(overlay);
  });

  overlay.appendChild(icon);
  overlay.appendChild(title);
  overlay.appendChild(desc);
  overlay.appendChild(btn);
  overlay.appendChild(cancelBtn);

  container.appendChild(overlay);
}
