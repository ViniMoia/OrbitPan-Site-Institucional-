/**
 * ============================================================================
 * ORBITPAN — CARROSSEL INFINITO DE LOGOS: PROJETOS & TRAJETÓRIA (OPÇÃO 2)
 * Módulo de Controle Interativo, Acessibilidade e Suporte a Drag/Touch
 * ============================================================================
 */
(function initPortfolioMarquee() {
  'use strict';

  function setup() {
    const rail = document.querySelector('.pf-marquee-rail');
    const track = document.querySelector('.pf-marquee-track');

    if (!rail || !track) return;

    let isDown = false;

    // Pausar animação no hover / foco
    rail.addEventListener('mouseenter', () => {
      track.style.animationPlayState = 'paused';
    });

    rail.addEventListener('mouseleave', () => {
      if (!isDown) {
        track.style.animationPlayState = 'running';
      }
    });

    // Acessibilidade por teclado: pausar quando logos receberem foco
    rail.addEventListener('focusin', () => {
      track.style.animationPlayState = 'paused';
    });

    rail.addEventListener('focusout', () => {
      track.style.animationPlayState = 'running';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
