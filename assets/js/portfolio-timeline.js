/**
 * ORBITPAN — PORTFOLIO TIMELINE CONTROLLER (ULTRA-OPTIMIZED)
 * 
 * Implementação de altíssimo desempenho para a 3ª dobra (Linha do Tempo de Portfólio 3D).
 * 
 * Pilares de Performance:
 * 1. Zero Layout Thrashing: Dimensões de cards cacheadas no mouseenter; zero getBoundingClientRect no scroll.
 * 2. Animação no Compositor: Progresso da linha via transform: scaleY e translate3d.
 * 3. IntersectionObserver Nativo: Detecção de entrada dos cards sem custo de renderização.
 * 4. Zero Dependência Pesada: Roda em 60 FPS estáveis mesmo em dispositivos modestos.
 */

(function (global) {
  'use strict';

  class PortfolioTimelineController {
    constructor() {
      this.section = document.getElementById('portfolio');
      if (!this.section) return;

      this.outer = this.section.querySelector('.portfolio-timeline__outer');
      this.body = this.section.querySelector('.portfolio-timeline__body');
      this.progressBar = this.section.querySelector('.timeline-v-progress');
      this.spark = this.section.querySelector('.timeline-spark');
      this.cards = Array.from(this.section.querySelectorAll('.portfolio-card-3d'));
      this.items = Array.from(this.section.querySelectorAll('.timeline-item-wrapper'));

      this.isTicking = false;
      this.activeCardData = new WeakMap();
      this.observer = null;

      this.init();
    }

    init() {
      this.setupObserver();
      this.setupScrollSync();
      this.setup3DTilt();
    }

    /**
     * 1. Detecção Eficiente de Cards em Visão via IntersectionObserver
     * Não consome CPU na thread principal durante o scroll.
     */
    setupObserver() {
      if (!('IntersectionObserver' in window)) {
        // Fallback simplificado caso navegador muito antigo
        this.items.forEach(item => item.classList.add('is-in-view', 'is-active'));
        return;
      }

      const observerOptions = {
        root: this.section, // Container com overflow-y: auto
        rootMargin: '0px 0px -10% 0px',
        threshold: [0.15, 0.45]
      };

      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const item = entry.target;
          if (entry.isIntersecting) {
            item.classList.add('is-in-view');
            if (entry.intersectionRatio >= 0.3) {
              item.classList.add('is-active');
            }
          } else {
            if (entry.boundingClientRect.top > (window.innerHeight || document.documentElement.clientHeight)) {
              item.classList.remove('is-active');
            }
          }
        });
      }, observerOptions);

      this.items.forEach(item => this.observer.observe(item));
    }

    /**
     * 2. Sincronização da Linha de Progresso e Centelha (Spark) via RAF
     * Utiliza transform: scaleY e translate3d (propriedades puras do Compositor)
     */
    setupScrollSync() {
      if (!this.progressBar || !this.body) return;

      let cachedBodyHeight = 0;
      let cachedBodyTop = 0;

      const updateDimensions = () => {
        if (!this.body) return;
        cachedBodyHeight = this.body.offsetHeight;
        cachedBodyTop = this.body.offsetTop;
      };

      // Medição inicial e em resize (nunca dentro do scroll!)
      updateDimensions();
      window.addEventListener('resize', updateDimensions, { passive: true });

      const onScroll = () => {
        if (!this.isTicking) {
          requestAnimationFrame(() => {
            const scrollTop = this.section.scrollTop;
            const viewportH = this.section.clientHeight;

            // Ponto focal da centelha: ~45% da altura da tela
            const scrollFocus = scrollTop + (viewportH * 0.45);
            const relativeOffset = scrollFocus - cachedBodyTop;

            let progress = 0;
            if (cachedBodyHeight > 0) {
              progress = Math.min(1, Math.max(0, relativeOffset / cachedBodyHeight));
            }

            // Atualiza barra via scaleY (0 reflow, 0 repaint)
            this.progressBar.style.transform = `scaleY(${progress})`;

            // Atualiza centelha via translate3d
            if (this.spark) {
              const sparkY = progress * cachedBodyHeight;
              this.spark.style.transform = `translate3d(-50%, ${sparkY}px, 0)`;
              this.spark.style.opacity = progress > 0.01 && progress < 0.99 ? '1' : progress >= 0.99 ? '0.6' : '0';
            }

            this.isTicking = false;
          });
          this.isTicking = true;
        }
      };

      this.section.addEventListener('scroll', onScroll, { passive: true });
    }

    /**
     * 3. Efeito 3D Tilt e Flashlight nos Cards Ultra-Otimizado
     * O bounding box é lido estritamente no mouseenter (1x por hover).
     * O mousemove executa apenas matemática leve em RAF.
     */
    setup3DTilt() {
      const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      if (isTouch) return; // Dispositivos touch não executam tilt de mouse

      this.cards.forEach(card => {
        let isMoving = false;

        card.addEventListener('mouseenter', () => {
          // Cache do retângulo no momento que o mouse entra (evita layout thrashing!)
          const rect = card.getBoundingClientRect();
          this.activeCardData.set(card, {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            centerX: rect.width / 2,
            centerY: rect.height / 2
          });
        }, { passive: true });

        card.addEventListener('mousemove', (e) => {
          const data = this.activeCardData.get(card);
          if (!data) return;

          const localX = e.clientX - data.left;
          const localY = e.clientY - data.top;

          if (!isMoving) {
            requestAnimationFrame(() => {
              // Posiciona lanterna radial (flashlight)
              card.style.setProperty('--mouse-x', `${localX}px`);
              card.style.setProperty('--mouse-y', `${localY}px`);

              // Calcula inclinação 3D sutil (máximo 6.5 graus)
              const maxTilt = 6.5;
              const rotateX = ((localY - data.centerY) / data.centerY) * -maxTilt;
              const rotateY = ((localX - data.centerX) / data.centerX) * maxTilt;

              card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translate3d(0, -4px, 0)`;

              isMoving = false;
            });
            isMoving = true;
          }
        }, { passive: true });

        card.addEventListener('mouseleave', () => {
          requestAnimationFrame(() => {
            card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translate3d(0, 0, 0)';
            card.style.setProperty('--mouse-x', '-999px');
            card.style.setProperty('--mouse-y', '-999px');
          });
        }, { passive: true });
      });
    }

    /**
     * Atualização manual quando a cena se torna ativa
     */
    refresh() {
      this.items.forEach((item, index) => {
        if (index === 0) {
          item.classList.add('is-in-view', 'is-active');
        }
      });
    }
  }

  // Inicialização Automática e Exposição Global Segura
  function initPortfolioTimeline() {
    global.portfolioTimeline = new PortfolioTimelineController();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPortfolioTimeline);
  } else {
    initPortfolioTimeline();
  }

})(window);
