/**
 * ORBITPAN — EXPLORATION PROGRESS CONTROLLER
 * 
 * Barra ultra-otimizada posicionada acima do header para indicar a porcentagem
 * da exploração do site (0% a 100%) em tempo real.
 * 
 * Pilares de Otimização:
 * 1. Zero Layout Reflow: Atualização via transform: scaleX() acelerado via GPU no Compositor.
 * 2. Throttle em RAF: Executa apenas nos frames de renderização do display (60/120Hz).
 * 3. Listeners Passivos: Sem bloqueio do scroll nativo ou das animações 3D WebGL.
 * 4. Totalmente Reversível: Sem interferência no código das dobras.
 */

(function (global) {
  'use strict';

  let barEl = null;
  let fillEl = null;
  let badgeEl = null;
  let textEl = null;

  let currentPercent = 0;
  let targetPercent = 0;
  let isTicking = false;
  let badgeHideTimeout = null;

  function createProgressDOM() {
    barEl = document.getElementById('orbit-exploration-bar');
    if (barEl) {
      fillEl = barEl.querySelector('#orbit-progress-fill');
      badgeEl = barEl.querySelector('#orbit-progress-badge');
      textEl = barEl.querySelector('#orbit-progress-text');
      return;
    }

    barEl = document.createElement('div');
    barEl.id = 'orbit-exploration-bar';
    barEl.className = 'orbit-exploration-bar';
    barEl.setAttribute('role', 'progressbar');
    barEl.setAttribute('aria-label', 'Progresso da Exploração do Site');
    barEl.setAttribute('aria-valuenow', '0');
    barEl.setAttribute('aria-valuemin', '0');
    barEl.setAttribute('aria-valuemax', '100');

    barEl.innerHTML = `
      <div class="orbit-exploration-bar__track">
        <div class="orbit-exploration-bar__fill" id="orbit-progress-fill">
          <span class="orbit-exploration-bar__spark" aria-hidden="true"></span>
        </div>
      </div>
      <div class="orbit-exploration-bar__badge" id="orbit-progress-badge" aria-hidden="true">
        <span class="orbit-exploration-bar__dot"></span>
        <span class="orbit-exploration-bar__value" id="orbit-progress-text">0%</span>
      </div>
    `;

    document.body.prepend(barEl);

    fillEl = barEl.querySelector('#orbit-progress-fill');
    badgeEl = barEl.querySelector('#orbit-progress-badge');
    textEl = barEl.querySelector('#orbit-progress-text');
  }

  function render() {
    // Interpolação suave para suavidade pura
    currentPercent += (targetPercent - currentPercent) * 0.25;

    if (Math.abs(targetPercent - currentPercent) < 0.1) {
      currentPercent = targetPercent;
    }

    const scale = Math.max(0, Math.min(1, currentPercent / 100));

    if (fillEl) {
      fillEl.style.transform = `scaleX(${scale.toFixed(4)})`;
    }

    if (textEl) {
      textEl.textContent = `${Math.round(currentPercent)}%`;
    }

    if (barEl) {
      barEl.setAttribute('aria-valuenow', String(Math.round(currentPercent)));
    }

    // Exibe temporariamente o badge numérico no topo
    if (badgeEl && currentPercent > 1) {
      badgeEl.classList.add('is-visible');
      if (badgeHideTimeout) clearTimeout(badgeHideTimeout);
      badgeHideTimeout = setTimeout(() => {
        if (badgeEl) badgeEl.classList.remove('is-visible');
      }, 2400);
    }

    if (currentPercent !== targetPercent) {
      requestAnimationFrame(render);
    } else {
      isTicking = false;
    }
  }

  function applyProgress(percent) {
    targetPercent = Math.max(0, Math.min(100, percent));
    if (!isTicking) {
      isTicking = true;
      requestAnimationFrame(render);
    }
  }

  /**
   * Calcula o percentual total de exploração baseado na cena atual e sub-scrolls
   */
  function calculateProgress() {
    const st = global.sceneTransition || global.orbitTransitions;
    let scene = st && st.currentScene ? st.currentScene : 'hero';

    // 1. Dobra 1: Hero (0% a 10%)
    if (scene === 'hero') {
      applyProgress(4);
      return;
    }

    // 2. Dobra 2: Empresa (10% a 35%)
    if (scene === 'explorer') {
      let subRatio = 0;
      if (global.companyExplorer) {
        const chapter = global.companyExplorer.currentChapter || 1;
        subRatio = Math.max(0, Math.min(1, (chapter - 1) / 3));
      }
      const progress = 10 + (subRatio * 25);
      applyProgress(progress);
      return;
    }

    // 3. Dobra 3: Portfólio (35% a 62%)
    if (scene === 'portfolio') {
      const portfolioSec = document.getElementById('portfolio');
      let scrollRatio = 0;
      if (portfolioSec && portfolioSec.scrollHeight > portfolioSec.clientHeight) {
        scrollRatio = portfolioSec.scrollTop / (portfolioSec.scrollHeight - portfolioSec.clientHeight);
      }
      const hasManifesto = !!document.getElementById('manifesto');
      const maxRange = hasManifesto ? 25 : 30;
      const progress = 35 + (Math.max(0, Math.min(1, scrollRatio)) * maxRange);
      applyProgress(progress);
      return;
    }

    // [EXPERIMENTO REVERSÍVEL] Dobra de Manifesto & Propósito (62% a 74%)
    if (scene === 'statement' || scene === 'manifesto') {
      applyProgress(68);
      return;
    }

    // 4. Dobra 4: Depoimentos (74% a 82%)
    if (scene === 'testimonials') {
      applyProgress(78);
      return;
    }

    // 5. Dobra 5: FAQ & Rodapé (80% a 100%)
    if (scene === 'faq') {
      const faqSec = document.getElementById('faq');
      let scrollRatio = 0;
      if (faqSec && faqSec.scrollHeight > faqSec.clientHeight) {
        scrollRatio = faqSec.scrollTop / (faqSec.scrollHeight - faqSec.clientHeight);
      }
      const progress = 80 + (Math.max(0, Math.min(1, scrollRatio)) * 20);
      applyProgress(progress);
      return;
    }
  }

  function bindEvents() {
    const onScroll = () => {
      calculateProgress();
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    // Escuta rolagem interna das dobras com overflow vertical
    const portfolioSec = document.getElementById('portfolio');
    if (portfolioSec) {
      portfolioSec.addEventListener('scroll', onScroll, { passive: true });
    }

    const faqSec = document.getElementById('faq');
    if (faqSec) {
      faqSec.addEventListener('scroll', onScroll, { passive: true });
    }

    // Intercepta métodos do Coordenador de Cenas
    const st = global.sceneTransition || global.orbitTransitions;
    if (st) {
      const allMethods = [
        'transitionToExplorer',
        'transitionToHero',
        'transitionToPortfolio',
        'transitionPortfolioToExplorer',
        'transitionPortfolioToTestimonials',
        'transitionPortfolioToStatement',
        'transitionStatementToPortfolio',
        'transitionStatementToTestimonials',
        'transitionTestimonialsToStatement',
        'transitionStatementToHero',
        'transitionTestimonialsToPortfolio',
        'transitionTestimonialsToHero',
        'transitionTestimonialsToFaq',
        'transitionFaqToTestimonials',
        'transitionFaqToHero',
        'transitionTo'
      ];

      allMethods.forEach(name => {
        if (typeof st[name] === 'function' && !st[name]._progressHooked) {
          const original = st[name];
          st[name] = function () {
            const res = original.apply(this, arguments);
            setTimeout(calculateProgress, 50);
            setTimeout(calculateProgress, 800);
            setTimeout(calculateProgress, 1600);
            return res;
          };
          st[name]._progressHooked = true;
        }
      });
    }

    // Observa mutações de classe nas seções
    const sections = ['orbit-hero', 'empresa', 'portfolio', 'depoimentos', 'faq']
      .map(id => document.getElementById(id))
      .filter(Boolean);

    if (window.MutationObserver && sections.length) {
      const observer = new MutationObserver(() => {
        calculateProgress();
      });

      sections.forEach(sec => {
        observer.observe(sec, { attributes: true, attributeFilter: ['class', 'style'] });
      });
    }
  }

  function init() {
    createProgressDOM();
    bindEvents();
    calculateProgress();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // API Global para controle e validação
  global.orbitExploration = {
    update: calculateProgress,
    set: applyProgress,
    get: () => currentPercent
  };

})(window);
