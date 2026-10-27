/**
 * ORBITPAN — FAQ CONTROLLER (QUINTA DOBRA ULTRA-OTIMIZADA)
 * 
 * Controlador de altíssima performance para o Accordion de Perguntas Frequentes
 * e integração com as navegações do Rodapé Institucional.
 * 
 * Performance:
 * - Delegação de eventos no contêiner do accordion (1 único ouvinte na lista).
 * - Zero Layout Thrashing (não lê nem grava style.height inline, usa CSS Grid).
 * - Suporte completo a acessibilidade (aria-expanded, aria-controls).
 */

(function (global) {
  'use strict';

  class OrbitFaqController {
    constructor() {
      this.section = document.getElementById('faq');
      if (!this.section) return;

      this.accordion = this.section.querySelector('.orbit-faq__accordion');
      this.footer = document.getElementById('orbit-site-footer');
      this.btnBackToDepoimentos = document.getElementById('faq-back-btn');
      this.btnScrollHint = document.getElementById('faq-scroll-to-testimonials');
      this.btnScrollToFooter = document.getElementById('faq-scroll-to-footer');
      this.btnBackToTop = document.getElementById('footer-back-to-top');
      this.footerBrandLogo = document.getElementById('footer-brand-logo');

      this.init();
    }

    init() {
      this.bindAccordion();
      this.bindNavigation();
      this.bindFooterActions();
    }

    /**
     * 1. Controle do Accordion de Alta Eficiência por Delegação
     */
    bindAccordion() {
      if (!this.accordion) return;

      this.accordion.addEventListener('click', (e) => {
        const trigger = e.target.closest('.faq-accordion-item__trigger');
        if (!trigger) return;

        e.preventDefault();
        const item = trigger.closest('.faq-accordion-item');
        if (!item) return;

        const isOpen = item.classList.contains('is-open');

        // Fecha outros itens para foco visual e legibilidade
        const allItems = this.accordion.querySelectorAll('.faq-accordion-item');
        allItems.forEach((other) => {
          if (other !== item && other.classList.contains('is-open')) {
            other.classList.remove('is-open');
            const otherBtn = other.querySelector('.faq-accordion-item__trigger');
            if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
          }
        });

        // Alterna item atual
        if (isOpen) {
          item.classList.remove('is-open');
          trigger.setAttribute('aria-expanded', 'false');
        } else {
          item.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
        }
      });
    }

    /**
     * 2. Integração de Navegação entre Dobras
     */
    bindNavigation() {
      const returnToTestimonials = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (global.sceneTransition && typeof global.sceneTransition.transitionFaqToTestimonials === 'function') {
          global.sceneTransition.transitionFaqToTestimonials();
        }
      };

      if (this.btnBackToDepoimentos) {
        this.btnBackToDepoimentos.addEventListener('click', returnToTestimonials);
      }

      if (this.btnScrollHint) {
        this.btnScrollHint.addEventListener('click', returnToTestimonials);
      }

      if (this.btnScrollToFooter && this.footer) {
        this.btnScrollToFooter.addEventListener('click', (e) => {
          e.preventDefault();
          this.footer.scrollIntoView({ behavior: 'smooth' });
        });
      }
    }

    /**
     * 3. Ações do Rodapé Institucional
     */
    bindFooterActions() {
      this.initLiveClock();

      const returnToHero = (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        if (this.section) {
          this.section.scrollTop = 0;
        }
        if (global.sceneTransition) {
          if (typeof global.sceneTransition.transitionFaqToHero === 'function') {
            global.sceneTransition.transitionFaqToHero();
          } else if (typeof global.sceneTransition.transitionTo === 'function') {
            global.sceneTransition.transitionTo('hero');
          }
        }
      };

      if (this.btnBackToTop) {
        this.btnBackToTop.addEventListener('click', returnToHero);
      }

      // Links de navegação direta para qualquer dobra da Orbitpan
      const navButtons = document.querySelectorAll('[data-footer-nav]');
      navButtons.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const target = btn.getAttribute('data-footer-nav');
          if (!target || !global.sceneTransition) return;

          if (typeof global.sceneTransition.transitionTo === 'function') {
            global.sceneTransition.transitionTo(target);
            return;
          }

          switch (target) {
            case 'hero':
              if (typeof global.sceneTransition.transitionFaqToHero === 'function') {
                global.sceneTransition.transitionFaqToHero();
              } else if (typeof global.sceneTransition.transitionToHero === 'function') {
                global.sceneTransition.transitionToHero();
              }
              break;
            case 'empresa':
              if (typeof global.sceneTransition.transitionToExplorer === 'function') {
                global.sceneTransition.transitionToExplorer();
              }
              break;
            case 'portfolio':
              if (typeof global.sceneTransition.transitionToPortfolio === 'function') {
                global.sceneTransition.transitionToPortfolio();
              }
              break;
            case 'depoimentos':
              if (typeof global.sceneTransition.transitionFaqToTestimonials === 'function') {
                global.sceneTransition.transitionFaqToTestimonials();
              }
              break;
            case 'faq':
              scrollToTop(e);
              break;
            default:
              break;
          }
        });
      });
    }

    /**
     * 4. Relógio Operacional em Tempo Real (Fuso BRT / Brasil)
     */
    initLiveClock() {
      const clockEl = document.getElementById('footer-live-clock');
      if (!clockEl) return;

      const updateClock = () => {
        try {
          const now = new Date();
          const timeStr = now.toLocaleTimeString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
          clockEl.textContent = `${timeStr} BRT`;
        } catch (err) {
          const now = new Date();
          const h = String(now.getHours()).padStart(2, '0');
          const m = String(now.getMinutes()).padStart(2, '0');
          clockEl.textContent = `${h}:${m} BRT`;
        }
      };

      updateClock();
      setInterval(updateClock, 30000);
    }
  }

  // Inicialização Automática e Exposição Global
  function initOrbitFaq() {
    global.orbitFaq = new OrbitFaqController();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOrbitFaq);
  } else {
    initOrbitFaq();
  }

})(window);
