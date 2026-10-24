/**
 * ORBITPAN — TESTIMONIALS CONTROLLER (QUARTA DOBRA)
 * 
 * Gerencia as microinterações dos cards de depoimento (Flashlight & 3D Tilt)
 * e a interatividade do carrossel infinito (Marquee com suporte a arraste e pause).
 * 
 * Inspirado nos efeitos do projeto de referência Aura Shield e alinhado aos padrões da Orbitpan.
 */

(function (global) {
  'use strict';

  class OrbitTestimonialsController {
    constructor() {
      this.section = document.getElementById('depoimentos');
      this.marqueeContainer = document.querySelector('.orbit-marquee');
      this.marqueeTrack = document.querySelector('.orbit-marquee__track');
      this.cards = document.querySelectorAll('.orbit-testimonial-card');

      this.isDragging = false;
      this.startX = 0;
      this.currentTranslate = 0;
      this.prevTranslate = 0;
      this.animationId = null;

      this.init();
    }

    init() {
      if (!this.section) return;

      this.bindCardMicroInteractions();
      this.bindMarqueeDrag();
    }

    /**
     * Vincula as microinterações nos cards de depoimento:
     * 1. Flashlight dinâmico (--mouse-x, --mouse-y)
     * 2. 3D Tilt físico sensível à posição do cursor
     */
    bindCardMicroInteractions() {
      const isMobile = window.matchMedia('(max-width: 768px)').matches;

      this.cards.forEach((card) => {
        // Rastreamento de coordenadas para o efeito Flashlight (Spotlight)
        card.addEventListener('mousemove', (e) => {
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;

          card.style.setProperty('--mouse-x', `${x}px`);
          card.style.setProperty('--mouse-y', `${y}px`);

          // Efeito 3D Tilt Físico (apenas no Desktop)
          if (!isMobile) {
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const deltaX = (x - centerX) / centerX;
            const deltaY = (y - centerY) / centerY;

            const maxRotate = 4.5; // Graus de inclinação calibrados
            const rotateX = -deltaY * maxRotate;
            const rotateY = deltaX * maxRotate;

            card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-8px) scale(1.015)`;
          }
        });

        // Retorno elástico suave ao sair do card
        card.addEventListener('mouseleave', () => {
          card.style.transform = '';
          card.style.removeProperty('--mouse-x');
          card.style.removeProperty('--mouse-y');
        });
      });
    }

    /**
     * Suporte interativo a arrastar e soltar (Drag & Swipe) no carrossel,
     * permitindo que o usuário explore os cards manualmente com fluidez.
     */
    bindMarqueeDrag() {
      if (!this.marqueeContainer || !this.marqueeTrack) return;

      let isDown = false;
      let startX = 0;
      let startScrollLeft = 0;
      let dragged = false;

      const onPointerDown = (e) => {
        isDown = true;
        dragged = false;
        this.marqueeContainer.classList.add('is-grabbing');
        startX = (e.pageX || (e.touches && e.touches[0].pageX)) - this.marqueeContainer.offsetLeft;
        startScrollLeft = this.marqueeContainer.scrollLeft;
        this.marqueeTrack.style.animationPlayState = 'paused';
      };

      const onPointerMove = (e) => {
        if (!isDown) return;
        const x = (e.pageX || (e.touches && e.touches[0].pageX)) - this.marqueeContainer.offsetLeft;
        const walk = (x - startX) * 1.5;
        if (Math.abs(walk) > 5) {
          dragged = true;
          this.marqueeContainer.scrollLeft = startScrollLeft - walk;
        }
      };

      const onPointerUp = () => {
        if (!isDown) return;
        isDown = false;
        this.marqueeContainer.classList.remove('is-grabbing');
        this.marqueeTrack.style.animationPlayState = 'running';
      };

      this.marqueeContainer.addEventListener('mousedown', onPointerDown);
      window.addEventListener('mousemove', onPointerMove);
      window.addEventListener('mouseup', onPointerUp);

      // Touch events para mobile e tablet
      this.marqueeContainer.addEventListener('touchstart', onPointerDown, { passive: true });
      window.addEventListener('touchmove', onPointerMove, { passive: true });
      window.addEventListener('touchend', onPointerUp);
    }

    /**
     * Hook executado na transição de entrada da cena
     */
    onEnter() {
      if (this.marqueeTrack) {
        this.marqueeTrack.style.animationPlayState = 'running';
      }
    }

    /**
     * Hook executado na transição de saída da cena
     */
    onLeave() {
      if (this.marqueeTrack) {
        this.marqueeTrack.style.animationPlayState = 'paused';
      }
    }
  }

  // Inicialização e Exposição Global
  function initTestimonials() {
    global.orbitTestimonials = new OrbitTestimonialsController();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTestimonials);
  } else {
    initTestimonials();
  }

})(window);
