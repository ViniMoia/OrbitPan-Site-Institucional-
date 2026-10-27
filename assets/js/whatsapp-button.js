/**
 * ORBITPAN — WHATSAPP FLOATING ACTION BUTTON CONTROLLER
 * 
 * Implementação baseada na referência Vértice Ferramental:
 * - Visibilidade condicionada: surge apenas a partir da Segunda Dobra (não aparece na Hero / 1ª dobra).
 * - Fixo no canto inferior direito sem sobrepor controles principais das dobras.
 * - Microinterações idênticas à referência:
 *   1. Animação de pulso contínuo (halo expansivo)
 *   2. Efeito wiggle (balanço) no ícone ao passar o cursor
 *   3. Tooltip "Fale Conosco" com revelação automática temporizada após surgir (1.5s delay, 4s duração)
 *   4. Revelação instantânea do tooltip ao passar o mouse ou focar
 *   5. Transição suave ao emergir e ao ocultar (caso o usuário retorne à 1ª dobra)
 */

(function (global) {
  'use strict';

  let whatsappBtn = null;
  let tooltipEl = null;
  let tooltipPromptTimer = null;
  let tooltipHideTimer = null;
  let hasShownInitialPrompt = false;

  function showWhatsAppButton() {
    if (!whatsappBtn) return;
    if (whatsappBtn.classList.contains('visible')) return;

    whatsappBtn.classList.add('visible');

    // Microinteração da referência: exibe o balão tooltip brevemente após surgir para incentivar contato
    if (!hasShownInitialPrompt) {
      hasShownInitialPrompt = true;
      if (tooltipPromptTimer) clearTimeout(tooltipPromptTimer);
      if (tooltipHideTimer) clearTimeout(tooltipHideTimer);

      tooltipPromptTimer = setTimeout(() => {
        if (tooltipEl && whatsappBtn && whatsappBtn.classList.contains('visible')) {
          tooltipEl.classList.add('active');
          tooltipHideTimer = setTimeout(() => {
            if (tooltipEl) tooltipEl.classList.remove('active');
          }, 4000);
        }
      }, 1500);
    }
  }

  function hideWhatsAppButton() {
    if (!whatsappBtn) return;
    if (!whatsappBtn.classList.contains('visible')) return;

    whatsappBtn.classList.remove('visible');

    if (tooltipEl) {
      tooltipEl.classList.remove('active');
    }
    if (tooltipPromptTimer) clearTimeout(tooltipPromptTimer);
    if (tooltipHideTimer) clearTimeout(tooltipHideTimer);
  }

  /**
   * Avalia com precisão se a página está na 2ª dobra ou além
   */
  function isBeyondFirstFold() {
    const st = global.sceneTransition || global.orbitTransitions;
    const hero = document.getElementById('orbit-hero');
    const explorer = document.getElementById('empresa');
    const portfolio = document.getElementById('portfolio');
    const manifesto = document.getElementById('manifesto');
    const testimonials = document.getElementById('depoimentos');
    const faq = document.getElementById('faq');

    // Se o Hero estiver saindo (transitando para a 2ª dobra)
    if (hero && hero.classList.contains('is-exiting')) {
      return true;
    }

    // Se a cena atual no gerenciador for declarada fora da hero
    if (st && st.currentScene && st.currentScene !== 'hero') {
      return true;
    }

    // Se qualquer seção da 2ª dobra à 5ª estiver ativa
    const isOtherActive = (
      (explorer && (explorer.classList.contains('is-active') || explorer.classList.contains('is-in-view')) && !explorer.classList.contains('is-exiting')) ||
      (portfolio && (portfolio.classList.contains('is-active') || portfolio.classList.contains('is-in-view')) && !portfolio.classList.contains('is-exiting')) ||
      (manifesto && (manifesto.classList.contains('is-active') || manifesto.classList.contains('is-in-view')) && !manifesto.classList.contains('is-exiting')) ||
      (testimonials && (testimonials.classList.contains('is-active') || testimonials.classList.contains('is-in-view')) && !testimonials.classList.contains('is-exiting')) ||
      (faq && (faq.classList.contains('is-active') || faq.classList.contains('is-in-view')) && !faq.classList.contains('is-exiting'))
    );

    if (isOtherActive) {
      return true;
    }

    return false;
  }

  function evaluateVisibility() {
    if (isBeyondFirstFold()) {
      showWhatsAppButton();
    } else {
      hideWhatsAppButton();
    }
  }

  /**
   * Conecta o observador aos métodos do SceneTransitionManager do OrbitPan
   */
  function hookSceneTransitions() {
    const st = global.sceneTransition || global.orbitTransitions;
    if (!st) return false;

    // Métodos que avançam para a 2ª dobra ou além
    const enterMethods = [
      'transitionToExplorer',
      'transitionToPortfolio',
      'transitionPortfolioToExplorer',
      'transitionPortfolioToTestimonials',
      'transitionPortfolioToStatement',
      'transitionStatementToPortfolio',
      'transitionStatementToTestimonials',
      'transitionTestimonialsToStatement',
      'transitionTestimonialsToPortfolio',
      'transitionTestimonialsToFaq',
      'transitionFaqToTestimonials'
    ];

    enterMethods.forEach(methodName => {
      if (typeof st[methodName] === 'function' && !st[methodName]._waHooked) {
        const originalMethod = st[methodName];
        st[methodName] = function () {
          showWhatsAppButton();
          return originalMethod.apply(this, arguments);
        };
        st[methodName]._waHooked = true;
      }
    });

    // Métodos que retornam à 1ª dobra (Hero)
    const exitToHeroMethods = [
      'transitionToHero',
      'transitionTestimonialsToHero',
      'transitionFaqToHero'
    ];

    exitToHeroMethods.forEach(methodName => {
      if (typeof st[methodName] === 'function' && !st[methodName]._waHooked) {
        const originalMethod = st[methodName];
        st[methodName] = function () {
          hideWhatsAppButton();
          return originalMethod.apply(this, arguments);
        };
        st[methodName]._waHooked = true;
      }
    });

    // Método universal transitionTo(targetScene)
    if (typeof st.transitionTo === 'function' && !st.transitionTo._waHooked) {
      const originalTransitionTo = st.transitionTo;
      st.transitionTo = function (targetScene) {
        let target = targetScene;
        if (target === 'empresa') target = 'explorer';
        if (target === 'depoimentos') target = 'testimonials';

        if (target === 'hero') {
          hideWhatsAppButton();
        } else {
          showWhatsAppButton();
        }
        return originalTransitionTo.apply(this, arguments);
      };
      st.transitionTo._waHooked = true;
    }

    return true;
  }

  function initWhatsAppButton() {
    whatsappBtn = document.querySelector('.whatsapp-btn');
    if (!whatsappBtn) return;

    tooltipEl = whatsappBtn.querySelector('.whatsapp-tooltip');

    // Microinterações de hover com garantia de disparo além do CSS
    whatsappBtn.addEventListener('mouseenter', () => {
      if (tooltipPromptTimer) clearTimeout(tooltipPromptTimer);
      if (tooltipHideTimer) clearTimeout(tooltipHideTimer);
      if (tooltipEl) tooltipEl.classList.add('active');
    });

    whatsappBtn.addEventListener('mouseleave', () => {
      if (tooltipEl) tooltipEl.classList.remove('active');
    });

    whatsappBtn.addEventListener('focus', () => {
      if (tooltipEl) tooltipEl.classList.add('active');
    });

    whatsappBtn.addEventListener('blur', () => {
      if (tooltipEl) tooltipEl.classList.remove('active');
    });

    // Tenta interceptar o SceneTransitionManager imediatamente ou aguarda inicialização
    if (!hookSceneTransitions()) {
      const retryInterval = setInterval(() => {
        if (hookSceneTransitions()) {
          clearInterval(retryInterval);
          evaluateVisibility();
        }
      }, 80);
      setTimeout(() => clearInterval(retryInterval), 4000);
    }

    // Observador de mutações nas seções como garantia adicional
    const sections = ['empresa', 'portfolio', 'depoimentos', 'faq', 'orbit-hero']
      .map(id => document.getElementById(id))
      .filter(Boolean);

    if (window.MutationObserver && sections.length) {
      const observer = new MutationObserver(() => {
        evaluateVisibility();
      });

      sections.forEach(sec => {
        observer.observe(sec, { attributes: true, attributeFilter: ['class', 'style'] });
      });
    }

    window.addEventListener('scroll', evaluateVisibility, { passive: true });
    window.addEventListener('resize', evaluateVisibility, { passive: true });

    // Avaliação inicial
    evaluateVisibility();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWhatsAppButton);
  } else {
    initWhatsAppButton();
  }

  global.orbitWhatsApp = {
    show: showWhatsAppButton,
    hide: hideWhatsAppButton,
    evaluate: evaluateVisibility
  };

})(window);
