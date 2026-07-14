import { db, ref, set } from '../firebase.js';

const slides = [
  {
    title: "Bienvenido a ShadowChat",
    text: "Tu privacidad es lo primero. Esta aplicación está diseñada para que tus mensajes no dejen rastro.",
    icon: "🛡️"
  },
  {
    title: "Autodestrucción",
    text: "Pulsa la rueda dentada dentro de un chat para establecer el temporizador. Los mensajes se destruirán automáticamente cuando pase el tiempo.",
    icon: "⏳"
  },
  {
    title: "Respuestas Rápidas",
    text: "Desliza cualquier mensaje hacia la derecha para citarlo y responder directamente.",
    icon: "💬"
  },
  {
    title: "Limpiar Pantalla",
    text: "Si necesitas esconder la pantalla rápido, pulsa el icono del ojo tachado arriba a la derecha. Los mensajes desaparecerán de tu vista (pero no se borrarán).",
    icon: "👁️‍🗨️"
  },
  {
    title: "El Botón del Pánico",
    text: "En caso de emergencia extrema, pulsa el icono del rayo (⚡) en el menú principal. Destruirá permanentemente TODAS tus conversaciones y vaciará tu cuenta sin dejar rastro.",
    icon: "🚨"
  }
];

export function showTutorial(container, currentUser) {
  let currentSlide = 0;

  const overlay = document.createElement('div');
  overlay.className = 'sc-tutorial-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
  overlay.style.zIndex = '9999999';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';

  const modal = document.createElement('div');
  modal.style.backgroundColor = '#1a1a24';
  modal.style.padding = '30px';
  modal.style.borderRadius = '16px';
  modal.style.maxWidth = '400px';
  modal.style.width = '90%';
  modal.style.textAlign = 'center';
  modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
  modal.style.color = '#fff';
  modal.style.fontFamily = 'Inter, sans-serif';

  const iconEl = document.createElement('div');
  iconEl.style.fontSize = '4rem';
  iconEl.style.marginBottom = '20px';

  const titleEl = document.createElement('h2');
  titleEl.style.fontSize = '1.5rem';
  titleEl.style.marginBottom = '15px';
  titleEl.style.color = '#00f5d4';

  const textEl = document.createElement('p');
  textEl.style.fontSize = '1.05rem';
  textEl.style.lineHeight = '1.5';
  textEl.style.opacity = '0.9';
  textEl.style.marginBottom = '30px';

  const dotsWrap = document.createElement('div');
  dotsWrap.style.display = 'flex';
  dotsWrap.style.justifyContent = 'center';
  dotsWrap.style.gap = '8px';
  dotsWrap.style.marginBottom = '25px';

  for (let i = 0; i < slides.length; i++) {
    const dot = document.createElement('div');
    dot.style.width = '10px';
    dot.style.height = '10px';
    dot.style.borderRadius = '50%';
    dot.style.backgroundColor = 'rgba(255,255,255,0.2)';
    dot.style.transition = 'background-color 0.3s ease';
    dotsWrap.appendChild(dot);
  }

  const btnWrap = document.createElement('div');
  btnWrap.style.display = 'flex';
  btnWrap.style.justifyContent = 'space-between';

  const prevBtn = document.createElement('button');
  prevBtn.textContent = 'Atrás';
  prevBtn.style.padding = '10px 20px';
  prevBtn.style.backgroundColor = 'transparent';
  prevBtn.style.color = '#fff';
  prevBtn.style.border = '1px solid rgba(255,255,255,0.2)';
  prevBtn.style.borderRadius = '8px';
  prevBtn.style.cursor = 'pointer';
  prevBtn.style.fontFamily = 'Inter, sans-serif';

  const nextBtn = document.createElement('button');
  nextBtn.style.padding = '10px 20px';
  nextBtn.style.backgroundColor = '#00f5d4';
  nextBtn.style.color = '#000';
  nextBtn.style.border = 'none';
  nextBtn.style.borderRadius = '8px';
  nextBtn.style.fontWeight = 'bold';
  nextBtn.style.cursor = 'pointer';
  nextBtn.style.fontFamily = 'Inter, sans-serif';

  const renderSlide = () => {
    const s = slides[currentSlide];
    iconEl.textContent = s.icon;
    titleEl.textContent = s.title;
    textEl.textContent = s.text;

    prevBtn.style.visibility = currentSlide === 0 ? 'hidden' : 'visible';
    nextBtn.textContent = currentSlide === slides.length - 1 ? 'Empezar' : 'Siguiente';

    Array.from(dotsWrap.children).forEach((dot, i) => {
        dot.style.backgroundColor = i === currentSlide ? '#00f5d4' : 'rgba(255,255,255,0.2)';
    });
  };

  prevBtn.addEventListener('click', () => {
    if (currentSlide > 0) {
        currentSlide--;
        renderSlide();
    }
  });

  nextBtn.addEventListener('click', async () => {
    if (currentSlide < slides.length - 1) {
        currentSlide++;
        renderSlide();
    } else {
        // Finish tutorial
        try {
            await set(ref(db, `users/${currentUser.uid}/tutorialCompleted`), true);
        } catch(e) {
            console.error("Error saving tutorial state", e);
        }
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }, 300);
    }
  });

  btnWrap.appendChild(prevBtn);
  btnWrap.appendChild(nextBtn);

  modal.appendChild(iconEl);
  modal.appendChild(titleEl);
  modal.appendChild(textEl);
  modal.appendChild(dotsWrap);
  modal.appendChild(btnWrap);

  overlay.appendChild(modal);
  container.appendChild(overlay);

  renderSlide();
}
