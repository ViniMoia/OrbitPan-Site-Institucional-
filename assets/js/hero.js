/**
 * ORBITPAN — HERO INTERACTION COORDINATOR
 * Gerencia as microinterações, bússola em tempo real e presets de navegação.
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const heroSection = document.getElementById('orbit-hero');
    if (!heroSection) return;

    // 1. Inicializa o Controller Panorâmico Three.js
    let panoramaController = null;
    try {
      panoramaController = new PanoramaBackgroundController(heroSection);
      window.heroPanoramaController = panoramaController;
    } catch (err) {
      console.error('[Orbitpan] Falha na inicialização do panorama:', err);
      heroSection.classList.add('panorama-ready', 'panorama-fallback-active');
    }

    // Timer de segurança para revelar o layout caso o evento de textura atrase
    setTimeout(() => {
      if (!heroSection.classList.contains('panorama-ready')) {
        heroSection.classList.add('panorama-ready');
      }
    }, 1200);

    // 2. Elementos da Interface
    const compassDial = document.getElementById('orbit-compass-dial');
    const compassHeading = document.getElementById('orbit-compass-heading');
    const ctaButton = document.getElementById('orbit-cta-button');

    // 3. Atualização da Bússola em Tempo Real via Evento do Panorama
    heroSection.addEventListener('orbit:panorama-rotate', (e) => {
      const { yawDeg } = e.detail;
      if (compassDial) {
        // Rotação inversa do dial para apontar o norte relativo
        compassDial.style.transform = `rotate(${360 - yawDeg}deg)`;
      }
      if (compassHeading) {
        compassHeading.textContent = `HDG ${yawDeg.toString().padStart(3, '0')}°`;
      }
    });

    // 6. Efeito Magnético Sutil no Botão CTA (Desktop Apenas)
    if (window.matchMedia('(pointer: fine)').matches && ctaButton) {
      ctaButton.addEventListener('mousemove', (e) => {
        const rect = ctaButton.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        ctaButton.style.transform = `translate(${x * 0.18}px, ${y * 0.18}px) translateY(-2px)`;
      });

      ctaButton.addEventListener('mouseleave', () => {
        ctaButton.style.transform = '';
      });
    }
  });
})();
