/**
 * ShadowChat Security Module
 * Anti-screenshot, Anti-recording, and anti-copy measures.
 */

(function() {
    try {
    // 1. Prevent text selection and context menu
    document.addEventListener('contextmenu', e => e.preventDefault());
    
    const style = document.createElement('style');
    style.innerHTML = `
        body, html {
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
            -webkit-touch-callout: none;
            -webkit-user-drag: none;
            -webkit-tap-highlight-color: transparent;
        }
        
        #security-curtain {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: #000;
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ff003c;
            font-family: monospace;
            font-size: 1.2rem;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.1s;
        }
        
        #security-curtain.active {
            opacity: 1;
            pointer-events: all;
        }
    `;
    document.head.appendChild(style);

    const curtain = document.createElement('div');
    curtain.id = 'security-curtain';
    curtain.innerHTML = '🛡️ Contenido Protegido';
    document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(curtain);
    });

    // 2. Hide content when app goes to background (App Switcher / Screen Recording)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            curtain.classList.add('active');
        } else {
            // Slight delay when coming back
            setTimeout(() => {
                curtain.classList.remove('active');
            }, 300);
        }
    });

    window.addEventListener('pagehide', () => {
        curtain.classList.add('active');
    });

    // 3. Prevent Print Screen (Windows)
    window.addEventListener('keyup', (e) => {
        if (e.key === 'PrintScreen') {
            curtain.classList.add('active');
            navigator.clipboard.writeText(''); // Clear clipboard
            setTimeout(() => {
                curtain.classList.remove('active');
            }, 2000);
        }
    });

    // Detect DevTools / keyboard shortcuts for screenshots
    window.addEventListener('keydown', (e) => {
        if (
            e.key === 'PrintScreen' || 
            (e.metaKey && e.shiftKey && (e.key === 's' || e.key === 'S' || e.key === '3' || e.key === '4' || e.key === '5')) ||
            (e.ctrlKey && e.shiftKey && (e.key === 's' || e.key === 'S'))
        ) {
            curtain.classList.add('active');
            try { navigator.clipboard.writeText(''); } catch(e){}
            setTimeout(() => {
                curtain.classList.remove('active');
            }, 2000);
        }
    });

    // Additional blur on blur event (when window loses focus)
    window.addEventListener('blur', () => {
        curtain.classList.add('active');
    });

    window.addEventListener('focus', () => {
        setTimeout(() => {
            curtain.classList.remove('active');
        }, 150);
    });
    } catch(err) { alert('SECURITY ERROR: ' + err.message); }
})();
