/**
 * ORBITPAN — RETÍCULO AERONÁUTICO / CUSTOM CURSOR CONTROLLER
 * 
 * Implementação de Cursor de Alta Fidelidade com Microinterações Cinemáticas:
 * - Ponto Central: Rastreamento direto de coordenadas sem latência.
 * - Anel Orbital: Movimentação orgânica suavizada via LERP a 60/120fps.
 * - Microinterações reativas:
 *   - Expansão de lente (32px -> 58px) em links, botões e elementos interativos.
 *   - Feedback tátil de clique (compressão para 24px no mousedown).
 *   - Modo de exploração 360° no canvas WebGL (anel rotativo / grab).
 * - Totalmente reversível e autodesativável em telas touch.
 */

(function (global) {
  'use strict';

  // Desativa em celulares, tablets ou dispositivos sem ponteiro preciso
  if (typeof window !== 'undefined' && window.matchMedia) {
    const isTouch = window.matchMedia('(hover: none) or (pointer: coarse)').matches;
    if (isTouch) return;
  }

  let dotEl = null;
  let ringEl = null;
  let isEnabled = true;
  let isVisible = false;

  // Coordenadas alvo (mouse real)
  let mouseX = -100;
  let mouseY = -100;

  // Coordenadas interpoladas (anel orbital)
  let ringX = -100;
  let ringY = -100;

  let animFrameId = null;

  // Fator de suavização cinemática (LERP)
  const LERP_FACTOR = 0.20;

  // Seletores para disparo de microinteração de Hover
  const HOVER_SELECTORS = [
    'a',
    'button',
    '[role="button"]',
    'input[type="submit"]',
    'input[type="button"]',
    '.orbit-btn-cta',
    '.orbit-header__action',
    '.orbit-card-waypoint',
    '.portfolio-card-3d',
    '.portfolio-timeline__card',
    '.orbit-testimonial-card',
    '.orbit-testimonials__card',
    '.orbit-testimonials__arrow',
    '.orbit-faq-accordion__header',
    '.faq-accordion-item__header',
    '.whatsapp-btn',
    '.orbit-footer-circle-btn',
    '.orbit-footer-nav-item',
    '.orbit-explorer__cursor',
    '[data-cursor="hover"]'
  ].join(', ');

  const TEXT_SELECTORS = 'input[type="text"], input[type="email"], textarea';

  function createCursorDOM() {
    if (dotEl && ringEl) return;

    dotEl = document.createElement('div');
    dotEl.className = 'orbit-cursor-dot';
    dotEl.setAttribute('aria-hidden', 'true');

    ringEl = document.createElement('div');
    ringEl.className = 'orbit-cursor-ring';
    ringEl.setAttribute('aria-hidden', 'true');

    document.body.appendChild(dotEl);
    document.body.appendChild(ringEl);
  }

  function renderLoop() {
    if (!isEnabled) return;

    // Interpolação Linear para o Anel Orbital
    ringX += (mouseX - ringX) * LERP_FACTOR;
    ringY += (mouseY - ringY) * LERP_FACTOR;

    // Atualização de transformações de hardware GPU
    if (dotEl) {
      dotEl.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
    }

    if (ringEl) {
      ringEl.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
    }

    animFrameId = requestAnimationFrame(renderLoop);
  }

  function handleMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (!isVisible) {
      isVisible = true;
      if (dotEl) dotEl.classList.add('is-visible');
      if (ringEl) ringEl.classList.add('is-visible');
    }

    // Avaliação de microinteração do alvo sob o cursor
    const target = e.target;
    if (!target || !ringEl || !dotEl) return;

    // 1. Hover interativo em botões e links
    const isInteractive = target.closest(HOVER_SELECTORS);
    if (isInteractive) {
      ringEl.classList.add('is-hover');
      dotEl.classList.add('is-hover');
      ringEl.classList.remove('is-grab', 'is-text');
      dotEl.classList.remove('is-text');
      return;
    } else {
      ringEl.classList.remove('is-hover');
      dotEl.classList.remove('is-hover');
    }

    // 2. Campo de texto
    const isText = target.closest(TEXT_SELECTORS);
    if (isText) {
      ringEl.classList.add('is-text');
      dotEl.classList.add('is-text');
      ringEl.classList.remove('is-grab');
      return;
    } else {
      ringEl.classList.remove('is-text');
      dotEl.classList.remove('is-text');
    }

    // 3. Exploração WebGL / Canvas Panorâmico / Carrossel de Depoimentos
    const isDraggable = target.tagName === 'CANVAS' || target.closest('.orbit-explorer__canvas-wrap') || target.closest('.orbit-hero') || target.closest('.orbit-marquee');
    if (isDraggable) {
      ringEl.classList.add('is-grab');
    } else {
      ringEl.classList.remove('is-grab');
    }
  }

  function handleMouseDown() {
    if (ringEl) ringEl.classList.add('is-down');
    if (dotEl) dotEl.classList.add('is-down');
    if (ringEl && ringEl.classList.contains('is-grab')) {
      ringEl.classList.add('is-grabbing');
    }
  }

  function handleMouseUp() {
    if (ringEl) ringEl.classList.remove('is-down', 'is-grabbing');
    if (dotEl) dotEl.classList.remove('is-down');
  }

  function handleMouseLeave() {
    isVisible = false;
    if (dotEl) dotEl.classList.remove('is-visible', 'is-hover', 'is-down');
    if (ringEl) ringEl.classList.remove('is-visible', 'is-hover', 'is-down', 'is-grabbing');
  }

  function handleMouseEnter() {
    isVisible = true;
    if (dotEl) dotEl.classList.add('is-visible');
    if (ringEl) ringEl.classList.add('is-visible');
  }

  function enable() {
    if (!isEnabled) {
      isEnabled = true;
      document.documentElement.classList.add('orbit-custom-cursor-active');
      if (dotEl) dotEl.style.display = '';
      if (ringEl) ringEl.style.display = '';
      renderLoop();
    }
  }

  function disable() {
    isEnabled = false;
    document.documentElement.classList.remove('orbit-custom-cursor-active');
    if (dotEl) dotEl.style.display = 'none';
    if (ringEl) ringEl.style.display = 'none';
    if (animFrameId) cancelAnimationFrame(animFrameId);
  }

  function destroy() {
    disable();
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mousedown', handleMouseDown);
    window.removeEventListener('mouseup', handleMouseUp);
    document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
    document.documentElement.removeEventListener('mouseenter', handleMouseEnter);

    if (dotEl && dotEl.parentNode) dotEl.parentNode.removeChild(dotEl);
    if (ringEl && ringEl.parentNode) ringEl.parentNode.removeChild(ringEl);
    dotEl = null;
    ringEl = null;
  }

  function init() {
    createCursorDOM();
    document.documentElement.classList.add('orbit-custom-cursor-active');

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown, { passive: true });
    window.addEventListener('mouseup', handleMouseUp, { passive: true });
    document.documentElement.addEventListener('mouseleave', handleMouseLeave, { passive: true });
    document.documentElement.addEventListener('mouseenter', handleMouseEnter, { passive: true });

    renderLoop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // API Global para controle, testes e reversão instantânea
  global.orbitCursor = {
    enable: enable,
    disable: disable,
    toggle: function (force) {
      const state = typeof force === 'boolean' ? force : !isEnabled;
      if (state) enable();
      else disable();
      return state;
    },
    destroy: destroy
  };

})(window);
