/**
 * ORBITPAN — SCENE TRANSITION COORDINATOR
 * 
 * Implementação estrita da transição cinematográfica por Blur & Zoom Óptico
 * inspirada no projeto de referência École Émile Cohl (Visite Virtuelle).
 * 
 * Gerencia a alternância entre as três dobras imersivas da Orbitpan:
 * 1. Hero Section (Experiência Interativa 360° do Hangar)
 * 2. Segunda Dobra (Apresentação Imersiva 360° da Empresa)
 * 3. Terceira Dobra (Galeria 3D Imersiva / Portfólio de Alta Fidelidade)
 * 
 * Regras:
 * - O scroll da página é travado para controle editorial estrito.
 * - Cada transição intercala desfoque óptico profundo (blur 34-38px) e zoom,
 *   emergindo até a nitidez total.
 * - Pausa automática dos loops WebGL na cena inativa para máxima economia de GPU.
 */

(function (global) {
  'use strict';

  class SceneTransitionManager {
    constructor() {
      this.heroSection = document.getElementById('orbit-hero');
      this.explorerSection = document.getElementById('empresa');
      this.portfolioSection = document.getElementById('portfolio');
      this.testimonialsSection = document.getElementById('depoimentos');
      this.faqSection = document.getElementById('faq');

      this.ctaButton = document.getElementById('orbit-cta-button');
      this.backButton = document.getElementById('orbit-back-to-hero');
      this.explorerLogo = document.getElementById('explorer-brand-logo');

      this.portfolioButton = document.getElementById('explorer-portfolio-btn');
      this.portfolioBackButton = document.getElementById('portfolio-back-btn');
      this.portfolioLogo = document.getElementById('portfolio-brand-logo');

      // [EXPERIMENTO REVERSÍVEL: DOBRA DE MANIFESTO & PROPÓSITO]
      this.manifestoSection = document.getElementById('manifesto');
      this.statementBackButton = document.getElementById('statement-back-btn');
      this.statementLogo = document.getElementById('statement-brand-logo');
      this.statementNextButton = document.getElementById('statement-next-btn');

      this.testimonialsButton = document.getElementById('portfolio-testimonials-btn');
      this.testimonialsBackButton = document.getElementById('testimonials-back-btn');
      this.testimonialsLogo = document.getElementById('testimonials-brand-logo');
      this.testimonialsScrollCue = document.getElementById('testimonials-scroll-to-faq');

      this.faqBackButton = document.getElementById('faq-back-btn');
      this.faqLogo = document.getElementById('faq-brand-logo');
      this.faqScrollHint = document.getElementById('faq-scroll-to-testimonials');

      this.currentScene = 'hero'; // 'hero' | 'explorer' | 'portfolio' | 'testimonials' | 'faq'
      this.isTransitioning = false;
      this.lastTransitionTime = 0;
      this.lastPointScrollTime = 0;

      this.init();
    }

    init() {
      this.blockVerticalScroll();
      this.bindTriggers();
      this.updateHeaderNav(this.currentScene);
      this.checkInitialHash();
    }

    /**
     * Gerencia a navegação entre todas as dobras através do scroll (roda do mouse, trackpad, toque e teclado).
     * Mantém os efeitos visuais cinematográficos de Blur & Zoom Óptico entre cada uma das dobras:
     * - Dobra 1 (Hero) <-> Dobra 2 (Empresa)
     * - Dobra 2 (Empresa - 4 Pontos de Navegação) <-> Dobra 3 (Portfólio)
     * - Dobra 3 (Portfólio) <-> Dobra 4 (Depoimentos)
     * - Dobra 4 (Depoimentos) <-> Dobra 5 (FAQ & Rodapé)
     */
    blockVerticalScroll() {
      const handleWheel = (e) => {
        const now = performance.now();
        if (this.isTransitioning) {
          e.preventDefault();
          return;
        }

        // Cenário 1: Na Quinta Dobra (FAQ & Rodapé)
        // Permite scroll nativo dentro da lista de FAQ e até o rodapé institucional.
        // Apenas quando estiver no topo absoluto do FAQ, o scroll para cima retorna para a 4ª dobra.
        if (this.currentScene === 'faq') {
          const faqSection = this.faqSection || document.getElementById('faq');
          const listWrapper = document.querySelector('.orbit-faq__list-wrapper');
          const isOverList = e.target && e.target.closest && e.target.closest('.orbit-faq__list-wrapper');

          // Scroll para cima no topo absoluto do FAQ -> Retorna para a 4ª dobra (Depoimentos)
          if (e.deltaY < -20) {
            const isFaqAtTop = !faqSection || faqSection.scrollTop <= 5;
            const isListAtTop = !listWrapper || listWrapper.scrollTop <= 5;
            if (isFaqAtTop && isListAtTop && (now - this.lastTransitionTime >= 1650)) {
              e.preventDefault();
              this.transitionFaqToTestimonials();
              return;
            }
          }

          // Se estiver rolando dentro da lista de FAQ com overflow ativo
          if (isOverList && listWrapper && listWrapper.scrollHeight > listWrapper.clientHeight) {
            const atListBottom = (listWrapper.scrollTop + listWrapper.clientHeight >= listWrapper.scrollHeight - 5);
            if (e.deltaY > 0 && atListBottom) {
              // Permite transbordar para a rolagem da página até o rodapé
              return;
            }
            return;
          }

          // Permite rolagem vertical livre na 5ª dobra para revelar o rodapé institucional
          return;
        }

        // Cenário 2: Na Terceira Dobra (Portfólio Timeline)
        // Permite scroll dentro dos 6 cards da timeline.
        // Apenas no topo absoluto, scroll para cima volta para a 2ª dobra (Empresa).
        // No final absoluto, scroll para baixo avança para a 4ª dobra (Depoimentos).
        if (this.currentScene === 'portfolio') {
          const portfolioSection = this.portfolioSection || document.getElementById('portfolio');
          if (portfolioSection) {
            if (e.deltaY < -20) {
              const isAtTop = portfolioSection.scrollTop <= 5;
              if (isAtTop && (now - this.lastTransitionTime >= 1650)) {
                e.preventDefault();
                this.transitionPortfolioToExplorer();
                return;
              }
            } else if (e.deltaY > 20) {
              const isAtBottom = (portfolioSection.scrollTop + portfolioSection.clientHeight >= portfolioSection.scrollHeight - 25);
              if (isAtBottom && (now - this.lastTransitionTime >= 1650)) {
                e.preventDefault();
                if (this.manifestoSection || document.getElementById('manifesto')) {
                  this.transitionPortfolioToStatement();
                } else {
                  this.transitionPortfolioToTestimonials();
                }
                return;
              }
            }
            // Permite rolagem interna livre nos 6 cards da timeline
            return;
          }
        }

        // Se o gesto foi predominantemente horizontal, não intercepta (permite rotação 360 na 2ª dobra ou arrasto do carrossel na 4ª)
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          return;
        }

        // Trava qualquer rolagem nativa vertical da página fora das dobras com scroll interno (3ª e 5ª dobras)
        e.preventDefault();

        // Se ainda estiver no período de proteção pós-transição entre dobras, ignora eventos residuais de inércia
        if (now - this.lastTransitionTime < 1650) {
          return;
        }

        const delta = e.deltaY;
        const threshold = 20;

        // Dobra 1: Hero Section -> Dobra 2 (Empresa)
        if (this.currentScene === 'hero') {
          if (delta > threshold) {
            this.transitionToExplorer();
          }
          return;
        }

        // Dobra 2: Empresa (Explorer) <-> Dobra 1 (Hero) ou Dobra 3 (Portfólio)
        // Navega sequencialmente pelos 4 pontos antes de transitar para a 3ª dobra
        if (this.currentScene === 'explorer') {
          if (now - (this.lastPointScrollTime || 0) < 500) {
            return;
          }

          if (delta > threshold) {
            const hasMorePoints = global.companyExplorer && typeof global.companyExplorer.scrollNextPoint === 'function'
              ? global.companyExplorer.scrollNextPoint()
              : false;

            if (hasMorePoints) {
              this.lastPointScrollTime = now;
            } else {
              this.transitionToPortfolio();
            }
          } else if (delta < -threshold) {
            const hasPrevPoints = global.companyExplorer && typeof global.companyExplorer.scrollPrevPoint === 'function'
              ? global.companyExplorer.scrollPrevPoint()
              : false;

            if (hasPrevPoints) {
              this.lastPointScrollTime = now;
            } else {
              this.transitionToHero();
            }
          }
          return;
        }

        // Dobra 3 já possui tratamento nativo com fronteiras acima.

        // Cenário 3: Na Dobra de Manifesto & Propósito (Experimento)
        if (this.currentScene === 'statement') {
          if (delta > threshold) {
            this.transitionStatementToTestimonials();
          } else if (delta < -threshold) {
            this.transitionStatementToPortfolio();
          }
          return;
        }

        // Dobra 4: Depoimentos <-> Dobra 3 (Portfólio/Manifesto) ou Dobra 5 (FAQ)
        if (this.currentScene === 'testimonials') {
          if (delta > threshold) {
            this.transitionTestimonialsToFaq();
          } else if (delta < -threshold) {
            if (this.manifestoSection || document.getElementById('manifesto')) {
              this.transitionTestimonialsToStatement();
            } else {
              this.transitionTestimonialsToPortfolio();
            }
          }
          return;
        }
      };

      window.addEventListener('wheel', handleWheel, { passive: false, capture: true });

      // Suporte a swipe de toque (Mobile e Tablet)
      let touchStartY = 0;
      let touchStartX = 0;

      window.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length > 0) {
          touchStartY = e.touches[0].clientY;
          touchStartX = e.touches[0].clientX;
        }
      }, { passive: true });

      window.addEventListener('touchend', (e) => {
        if (this.isTransitioning || !e.changedTouches || e.changedTouches.length === 0) return;
        const now = performance.now();
        if (now - this.lastTransitionTime < 1650) return;

        const touchEndY = e.changedTouches[0].clientY;
        const touchEndX = e.changedTouches[0].clientX;
        const deltaY = touchStartY - touchEndY; // deltaY > 0 significa arrastou para cima (rolagem para baixo)
        const deltaX = touchStartX - touchEndX;

        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 40) {
          if (deltaY > 0) {
            // Scroll para baixo: avança para a próxima dobra ou ponto
            if (this.currentScene === 'hero') {
              this.transitionToExplorer();
            } else if (this.currentScene === 'explorer') {
              if (now - (this.lastPointScrollTime || 0) < 500) return;
              const hasMorePoints = global.companyExplorer && typeof global.companyExplorer.scrollNextPoint === 'function'
                ? global.companyExplorer.scrollNextPoint()
                : false;
              if (hasMorePoints) {
                this.lastPointScrollTime = now;
              } else {
                this.transitionToPortfolio();
              }
            } else if (this.currentScene === 'portfolio') {
              if (this.manifestoSection || document.getElementById('manifesto')) {
                this.transitionPortfolioToStatement();
              } else {
                this.transitionPortfolioToTestimonials();
              }
            } else if (this.currentScene === 'statement') {
              this.transitionStatementToTestimonials();
            } else if (this.currentScene === 'testimonials') {
              this.transitionTestimonialsToFaq();
            }
          } else {
            // Scroll para cima (deltaY < 0): retorna para a dobra ou ponto anterior
            if (this.currentScene === 'faq') {
              const faqSection = this.faqSection || document.getElementById('faq');
              const listWrapper = document.querySelector('.orbit-faq__list-wrapper');
              const isFaqAtTop = !faqSection || faqSection.scrollTop <= 5;
              const isListAtTop = !listWrapper || listWrapper.scrollTop <= 5;
              if (isFaqAtTop && isListAtTop) {
                this.transitionFaqToTestimonials();
              }
            } else if (this.currentScene === 'testimonials') {
              if (this.manifestoSection || document.getElementById('manifesto')) {
                this.transitionTestimonialsToStatement();
              } else {
                this.transitionTestimonialsToPortfolio();
              }
            } else if (this.currentScene === 'statement') {
              this.transitionStatementToPortfolio();
            } else if (this.currentScene === 'portfolio') {
              this.transitionPortfolioToExplorer();
            } else if (this.currentScene === 'explorer') {
              if (now - (this.lastPointScrollTime || 0) < 500) return;
              const hasPrevPoints = global.companyExplorer && typeof global.companyExplorer.scrollPrevPoint === 'function'
                ? global.companyExplorer.scrollPrevPoint()
                : false;
              if (hasPrevPoints) {
                this.lastPointScrollTime = now;
              } else {
                this.transitionToHero();
              }
            }
          }
        }
      }, { passive: true });

      // Suporte ao teclado (ArrowDown, PageDown para avançar / ArrowUp, PageUp para recuar)
      window.addEventListener('keydown', (e) => {
        const blockedKeys = ['Space', 'PageUp', 'PageDown', 'Home', 'End'];
        if (blockedKeys.includes(e.code) && !e.target.matches('input, textarea')) {
          e.preventDefault();
        }

        if (this.isTransitioning) return;
        const now = performance.now();
        if (now - this.lastTransitionTime < 1650) return;

        if (e.code === 'ArrowDown' || e.code === 'PageDown') {
          if (this.currentScene === 'hero') {
            this.transitionToExplorer();
          } else if (this.currentScene === 'explorer') {
            if (now - (this.lastPointScrollTime || 0) < 500) return;
            const hasMorePoints = global.companyExplorer && typeof global.companyExplorer.scrollNextPoint === 'function'
              ? global.companyExplorer.scrollNextPoint()
              : false;
            if (hasMorePoints) {
              this.lastPointScrollTime = now;
            } else {
              this.transitionToPortfolio();
            }
          } else if (this.currentScene === 'portfolio') {
            if (this.manifestoSection || document.getElementById('manifesto')) {
              this.transitionPortfolioToStatement();
            } else {
              this.transitionPortfolioToTestimonials();
            }
          } else if (this.currentScene === 'statement') {
            this.transitionStatementToTestimonials();
          } else if (this.currentScene === 'testimonials') {
            this.transitionTestimonialsToFaq();
          }
        } else if (e.code === 'ArrowUp' || e.code === 'PageUp') {
          if (this.currentScene === 'faq') {
            const faqSection = this.faqSection || document.getElementById('faq');
            const listWrapper = document.querySelector('.orbit-faq__list-wrapper');
            const isFaqAtTop = !faqSection || faqSection.scrollTop <= 5;
            const isListAtTop = !listWrapper || listWrapper.scrollTop <= 5;
            if (isFaqAtTop && isListAtTop) {
              this.transitionFaqToTestimonials();
            }
          } else if (this.currentScene === 'testimonials') {
            if (this.manifestoSection || document.getElementById('manifesto')) {
              this.transitionTestimonialsToStatement();
            } else {
              this.transitionTestimonialsToPortfolio();
            }
          } else if (this.currentScene === 'statement') {
            this.transitionStatementToPortfolio();
          } else if (this.currentScene === 'portfolio') {
            this.transitionPortfolioToExplorer();
          } else if (this.currentScene === 'explorer') {
            if (now - (this.lastPointScrollTime || 0) < 500) return;
            const hasPrevPoints = global.companyExplorer && typeof global.companyExplorer.scrollPrevPoint === 'function'
              ? global.companyExplorer.scrollPrevPoint()
              : false;
            if (hasPrevPoints) {
              this.lastPointScrollTime = now;
            } else {
              this.transitionToHero();
            }
          }
        }
      });
    }

    bindTriggers() {
      // 1. Hero -> Segunda Dobra ("INICIAR TOUR VIRTUAL")
      if (this.ctaButton) {
        this.ctaButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.transitionToExplorer();
        });
      }

      // 2. Segunda Dobra -> Hero ("Vista do Hangar" ou Logotipo)
      if (this.backButton) {
        this.backButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.transitionToHero();
        });
      }

      if (this.explorerLogo) {
        this.explorerLogo.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.transitionToHero();
        });
      }

      // 3. Segunda Dobra -> Terceira Dobra ("Portifólio")
      if (this.portfolioButton) {
        this.portfolioButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.transitionToPortfolio();
        });
      }

      // 4. Terceira Dobra -> Segunda Dobra ("Voltar à Empresa" ou Logotipo)
      if (this.portfolioBackButton) {
        this.portfolioBackButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.transitionPortfolioToExplorer();
        });
      }

      if (this.portfolioLogo) {
        this.portfolioLogo.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.transitionPortfolioToExplorer();
        });
      }

      // 5. Terceira Dobra -> Quarta Dobra / Manifesto
      if (this.testimonialsButton) {
        this.testimonialsButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (this.manifestoSection || document.getElementById('manifesto')) {
            this.transitionPortfolioToStatement();
          } else {
            this.transitionPortfolioToTestimonials();
          }
        });
      }

      // [EXPERIMENTO REVERSÍVEL: GATILHOS DA DOBRA DE MANIFESTO & PROPÓSITO]
      if (this.statementBackButton) {
        this.statementBackButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.transitionStatementToPortfolio();
        });
      }

      if (this.statementLogo) {
        this.statementLogo.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.transitionStatementToHero();
        });
      }

      if (this.statementNextButton) {
        this.statementNextButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.transitionStatementToTestimonials();
        });
      }

      // 6. Quarta Dobra -> Terceira Dobra / Manifesto
      if (this.testimonialsBackButton) {
        this.testimonialsBackButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (this.manifestoSection || document.getElementById('manifesto')) {
            this.transitionTestimonialsToStatement();
          } else {
            this.transitionTestimonialsToPortfolio();
          }
        });
      }

      // 7. Quarta Dobra -> Início (Logotipo Orbitpan na quarta dobra)
      if (this.testimonialsLogo) {
        this.testimonialsLogo.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.transitionTestimonialsToHero();
        });
      }

      // 8. Quarta Dobra -> Quinta Dobra (Indicador / Botão de Scroll para o FAQ)
      if (this.testimonialsScrollCue) {
        this.testimonialsScrollCue.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.transitionTestimonialsToFaq();
        });
      }

      // 9. Quinta Dobra -> Quarta Dobra ("Depoimentos" ou Scroll Hint de retorno)
      if (this.faqBackButton) {
        this.faqBackButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.transitionFaqToTestimonials();
        });
      }

      if (this.faqScrollHint) {
        this.faqScrollHint.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.transitionFaqToTestimonials();
        });
      }

      // 10. Quinta Dobra -> Início (Logotipo Orbitpan no FAQ)
      if (this.faqLogo) {
        this.faqLogo.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.transitionFaqToHero();
        });
      }

      // 11. [EXPERIMENTO REVERSÍVEL: NAVEGAÇÃO SUPERIOR NO HEADER]
      const navButtons = document.querySelectorAll('.orbit-header-nav__item[data-nav-scene]');
      navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const target = btn.getAttribute('data-nav-scene');
          if (target && typeof this.transitionTo === 'function') {
            this.transitionTo(target);
          }
        });
      });
    }

    /**
     * Sincroniza dinamicamente o estado ativo (.is-active) dos itens de navegação do header em todas as dobras
     */
    updateHeaderNav(targetScene) {
      let activeScene = targetScene;
      if (activeScene === 'statement' || activeScene === 'proposito') activeScene = 'manifesto';
      else if (activeScene === 'testimonials') activeScene = 'depoimentos';
      else if (activeScene === 'contato') activeScene = 'faq';
      else if (activeScene === 'trabalhos' || activeScene === 'projetos') activeScene = 'portfolio';
      else if (activeScene === 'explorer') activeScene = 'empresa';

      const navItems = document.querySelectorAll('.orbit-header-nav__item[data-nav-scene]');
      navItems.forEach(item => {
        const itemScene = item.getAttribute('data-nav-scene');
        if (itemScene === activeScene) {
          item.classList.add('is-active');
        } else {
          item.classList.remove('is-active');
        }
      });
    }

    /**
     * Sincroniza a cena ativa inicial e subsequente com o hash da URL (#portfolio, #manifesto, #depoimentos, #faq)
     */
    checkInitialHash() {
      const handleHash = () => {
        let hash = (window.location.hash || '').replace('#', '').trim().toLowerCase();
        if (!hash) return;
        if (hash === 'proposito' || hash === 'manifesto') hash = 'statement';
        else if (hash === 'depoimentos') hash = 'testimonials';
        else if (hash === 'contato') hash = 'faq';
        else if (hash === 'trabalhos' || hash === 'projetos') hash = 'portfolio';
        else if (hash === 'empresa') hash = 'explorer';

        if (['hero', 'explorer', 'portfolio', 'statement', 'testimonials', 'faq'].includes(hash)) {
          setTimeout(() => {
            if (this.currentScene !== hash && typeof this.transitionTo === 'function') {
              this.transitionTo(hash);
            }
          }, 350);
        }
      };

      if (document.readyState === 'complete') {
        handleHash();
      } else {
        window.addEventListener('load', handleHash, { once: true });
      }
      window.addEventListener('hashchange', handleHash);
    }

    /**
     * Transição Hero -> Segunda Dobra (Blur Out da Hero, Blur In da Empresa)
     */
    transitionToExplorer() {
      if (this.isTransitioning || this.currentScene === 'explorer') return;
      this.isTransitioning = true;
      this.lastTransitionTime = performance.now();
      document.body.classList.add('is-transitioning');

      // 1. Efeito imersivo na câmera da Hero: zoom óptico enquanto desfoca
      if (window.heroPanoramaController) {
        window.heroPanoramaController.setZoom(50);
      }

      // 2. Ativa o fade e desfoque óptico de saída na Hero
      this.heroSection.classList.add('is-exiting');

      // 3. Prepara a Segunda Dobra para emergir do Blur
      if (this.explorerSection) {
        this.explorerSection.style.visibility = 'visible';
        this.explorerSection.style.zIndex = '20';

        // Garante que o loop Three.js da empresa esteja rodando na imagem central inicial (0°)
        if (global.companyExplorer) {
          global.companyExplorer.isIntersecting = true;
          global.companyExplorer.startLoop();
          if (typeof global.companyExplorer.resetToCenter === 'function') {
            global.companyExplorer.resetToCenter();
          } else {
            global.companyExplorer.goToChapter(1);
          }
          global.companyExplorer.onResize();
        }

        requestAnimationFrame(() => {
          this.explorerSection.classList.remove('is-exiting');
          this.explorerSection.classList.add('is-active', 'is-in-view');
        });
      }

      // 4. Finalização da transição (após 1550ms)
      setTimeout(() => {
        this.currentScene = 'explorer';
        this.isTransitioning = false;
        document.body.classList.remove('is-transitioning');

        // Pausa renderização da Hero para economizar GPU
        this.heroSection.style.visibility = 'hidden';
        if (window.heroPanoramaController) {
          window.heroPanoramaController.isIntersecting = false;
        }
      }, 1550);
    }

    /**
     * Transição Segunda Dobra -> Hero (Retorno ao Hangar)
     */
    transitionToHero() {
      if (this.isTransitioning || this.currentScene === 'hero') return;
      this.isTransitioning = true;
      this.lastTransitionTime = performance.now();
      document.body.classList.add('is-transitioning');

      // 1. Segunda Dobra inicia saída em Blur
      this.explorerSection.classList.remove('is-active');
      this.explorerSection.classList.add('is-exiting');

      // 2. Hero Section é reativada e ressurge do Blur
      this.heroSection.style.visibility = 'visible';
      this.heroSection.style.zIndex = '20';

      if (window.heroPanoramaController) {
        window.heroPanoramaController.isIntersecting = true;
        window.heroPanoramaController.startLoop();
        window.heroPanoramaController.handleResize();
      }

      requestAnimationFrame(() => {
        this.heroSection.classList.remove('is-exiting');
        if (window.heroPanoramaController) {
          window.heroPanoramaController.setZoom(66);
        }
      });

      // 3. Finalização do Retorno
      setTimeout(() => {
        this.currentScene = 'hero';
        this.isTransitioning = false;
        document.body.classList.remove('is-transitioning');

        // Pausa loop da segunda dobra
        this.explorerSection.style.visibility = 'hidden';
        this.explorerSection.style.zIndex = '5';
        this.explorerSection.classList.remove('is-exiting', 'is-in-view');
        if (global.companyExplorer) {
          global.companyExplorer.stopLoop();
        }
      }, 1550);
    }

    /**
     * Transição Segunda Dobra -> Terceira Dobra (Blur Out da Empresa, Blur In do Portfólio)
     */
    transitionToPortfolio() {
      if (this.isTransitioning || this.currentScene === 'portfolio') return;
      this.isTransitioning = true;
      this.lastTransitionTime = performance.now();
      document.body.classList.add('is-transitioning');

      // 1. Segunda Dobra desvanece em Blur óptico
      if (this.explorerSection) {
        this.explorerSection.classList.remove('is-active');
        this.explorerSection.classList.add('is-exiting');
      }

      // 2. Terceira Dobra (Portfólio) prepara para emergir do Blur
      if (this.portfolioSection) {
        this.portfolioSection.style.visibility = 'visible';
        this.portfolioSection.style.zIndex = '25';

        this.portfolioSection.scrollTop = 0;

        // Atualiza e sincroniza os cards da Linha do Tempo
        if (global.portfolioTimeline && typeof global.portfolioTimeline.refresh === 'function') {
          global.portfolioTimeline.refresh();
        }

        requestAnimationFrame(() => {
          this.updateHeaderNav('portfolio');
          this.portfolioSection.classList.remove('is-exiting');
          this.portfolioSection.classList.add('is-active', 'is-in-view');
        });
      }

      // 3. Conclusão da Transição
      setTimeout(() => {
        this.currentScene = 'portfolio';
        this.isTransitioning = false;
        document.body.classList.remove('is-transitioning');

        // Desativa renderização da Segunda Dobra para foco de 100% da GPU na galeria
        if (this.explorerSection) {
          this.explorerSection.style.visibility = 'hidden';
          if (global.companyExplorer) {
            global.companyExplorer.stopLoop();
          }
        }
      }, 1550);
    }

    /**
     * Transição Terceira Dobra -> Segunda Dobra (Retorno do Portfólio para a Empresa)
     */
    transitionPortfolioToExplorer() {
      if (this.isTransitioning || this.currentScene === 'explorer') return;
      this.isTransitioning = true;
      this.lastTransitionTime = performance.now();
      document.body.classList.add('is-transitioning');

      // 1. Terceira Dobra inicia saída em Blur
      if (this.portfolioSection) {
        this.portfolioSection.classList.remove('is-active');
        this.portfolioSection.classList.add('is-exiting');
      }

      // 2. Segunda Dobra reaparece do Blur
      if (this.explorerSection) {
        this.explorerSection.style.visibility = 'visible';
        this.explorerSection.style.zIndex = '20';

        if (global.companyExplorer) {
          global.companyExplorer.isIntersecting = true;
          global.companyExplorer.startLoop();
          global.companyExplorer.goToChapter(4);
          global.companyExplorer.onResize();
        }

        requestAnimationFrame(() => {
          this.updateHeaderNav('explorer');
          this.explorerSection.classList.remove('is-exiting');
          this.explorerSection.classList.add('is-active', 'is-in-view');
        });
      }

      // 3. Conclusão do Retorno
      setTimeout(() => {
        this.currentScene = 'explorer';
        this.isTransitioning = false;
        document.body.classList.remove('is-transitioning');

        // Pausa loop da Galeria 3D
        if (this.portfolioSection) {
          this.portfolioSection.style.visibility = 'hidden';
          this.portfolioSection.style.zIndex = '5';
          this.portfolioSection.classList.remove('is-exiting', 'is-in-view');
          if (global.portfolioGallery) {
            global.portfolioGallery.isActive = false;
            global.portfolioGallery.stopLoop();
          }
        }
      }, 1550);
    }

    /**
     * Transição Terceira Dobra -> Quarta Dobra (Blur Out do Portfólio, Blur In de Depoimentos)
     */
    transitionPortfolioToTestimonials() {
      if (this.isTransitioning || this.currentScene === 'testimonials') return;
      this.isTransitioning = true;
      this.lastTransitionTime = performance.now();
      document.body.classList.add('is-transitioning');

      // 1. Portfólio inicia saída em Blur
      if (this.portfolioSection) {
        this.portfolioSection.classList.remove('is-active');
        this.portfolioSection.classList.add('is-exiting');
      }

      // 2. Quarta Dobra (Depoimentos) prepara para emergir do Blur
      if (this.testimonialsSection) {
        this.testimonialsSection.style.visibility = 'visible';
        this.testimonialsSection.style.zIndex = '30';

        if (global.orbitTestimonials && typeof global.orbitTestimonials.onEnter === 'function') {
          global.orbitTestimonials.onEnter();
        }

        requestAnimationFrame(() => {
          this.updateHeaderNav('testimonials');
          this.testimonialsSection.classList.remove('is-exiting');
          this.testimonialsSection.classList.add('is-active', 'is-in-view');
        });
      }

      // 3. Conclusão da Transição
      setTimeout(() => {
        this.currentScene = 'testimonials';
        this.isTransitioning = false;
        document.body.classList.remove('is-transitioning');

        // Desativa renderização da Galeria 3D para economizar GPU
        if (this.portfolioSection) {
          this.portfolioSection.style.visibility = 'hidden';
          if (global.portfolioGallery) {
            global.portfolioGallery.isActive = false;
            global.portfolioGallery.stopLoop();
          }
        }
      }, 1550);
    }

    /**
     * [EXPERIMENTO REVERSÍVEL]
     * Transição Terceira Dobra -> Dobra de Manifesto (Blur Out do Portfólio, Blur In do Manifesto)
     */
    transitionPortfolioToStatement() {
      if (this.isTransitioning || this.currentScene === 'statement') return;
      this.manifestoSection = this.manifestoSection || document.getElementById('manifesto');
      if (!this.manifestoSection) {
        this.transitionPortfolioToTestimonials();
        return;
      }

      this.isTransitioning = true;
      this.lastTransitionTime = performance.now();
      document.body.classList.add('is-transitioning');

      // 1. Portfólio inicia saída em Blur
      if (this.portfolioSection) {
        this.portfolioSection.classList.remove('is-active');
        this.portfolioSection.classList.add('is-exiting');
      }

      // 2. Dobra de Manifesto prepara para emergir do Blur
      this.manifestoSection.style.visibility = 'visible';
      this.manifestoSection.style.zIndex = '30';

      requestAnimationFrame(() => {
        this.updateHeaderNav('statement');
        this.manifestoSection.classList.remove('is-exiting');
        this.manifestoSection.classList.add('is-active', 'is-in-view');
      });

      // 3. Conclusão da Transição
      setTimeout(() => {
        this.currentScene = 'statement';
        this.isTransitioning = false;
        document.body.classList.remove('is-transitioning');

        // Desativa renderização da Galeria 3D para economizar GPU
        if (this.portfolioSection) {
          this.portfolioSection.style.visibility = 'hidden';
          if (global.portfolioGallery) {
            global.portfolioGallery.isActive = false;
            global.portfolioGallery.stopLoop();
          }
        }
      }, 1550);
    }

    /**
     * [EXPERIMENTO REVERSÍVEL]
     * Transição Dobra de Manifesto -> Terceira Dobra (Retorno do Manifesto para o Portfólio)
     */
    transitionStatementToPortfolio() {
      if (this.isTransitioning || this.currentScene === 'portfolio') return;
      this.isTransitioning = true;
      this.lastTransitionTime = performance.now();
      document.body.classList.add('is-transitioning');

      // 1. Manifesto inicia saída em Blur
      this.manifestoSection = this.manifestoSection || document.getElementById('manifesto');
      if (this.manifestoSection) {
        this.manifestoSection.classList.remove('is-active');
        this.manifestoSection.classList.add('is-exiting');
      }

      // 2. Terceira Dobra (Portfólio) reaparece do Blur
      if (this.portfolioSection) {
        this.portfolioSection.style.visibility = 'visible';
        this.portfolioSection.style.zIndex = '25';

        if (global.portfolioGallery) {
          global.portfolioGallery.isActive = true;
          global.portfolioGallery.startLoop();
          global.portfolioGallery.handleResize();
        }

        requestAnimationFrame(() => {
          this.updateHeaderNav('portfolio');
          this.portfolioSection.classList.remove('is-exiting');
          this.portfolioSection.classList.add('is-active', 'is-in-view');
        });
      }

      // 3. Conclusão do Retorno
      setTimeout(() => {
        this.currentScene = 'portfolio';
        this.isTransitioning = false;
        document.body.classList.remove('is-transitioning');

        if (this.manifestoSection) {
          this.manifestoSection.style.visibility = 'hidden';
          this.manifestoSection.style.zIndex = '5';
          this.manifestoSection.classList.remove('is-exiting', 'is-in-view');
        }
      }, 1550);
    }

    /**
     * [EXPERIMENTO REVERSÍVEL]
     * Transição Dobra de Manifesto -> Quarta Dobra (Avanço do Manifesto para Depoimentos)
     */
    transitionStatementToTestimonials() {
      if (this.isTransitioning || this.currentScene === 'testimonials') return;
      this.isTransitioning = true;
      this.lastTransitionTime = performance.now();
      document.body.classList.add('is-transitioning');

      // 1. Manifesto inicia saída em Blur
      this.manifestoSection = this.manifestoSection || document.getElementById('manifesto');
      if (this.manifestoSection) {
        this.manifestoSection.classList.remove('is-active');
        this.manifestoSection.classList.add('is-exiting');
      }

      // 2. Quarta Dobra (Depoimentos) prepara para emergir do Blur
      if (this.testimonialsSection) {
        this.testimonialsSection.style.visibility = 'visible';
        this.testimonialsSection.style.zIndex = '30';

        if (global.orbitTestimonials && typeof global.orbitTestimonials.onEnter === 'function') {
          global.orbitTestimonials.onEnter();
        }

        requestAnimationFrame(() => {
          this.updateHeaderNav('testimonials');
          this.testimonialsSection.classList.remove('is-exiting');
          this.testimonialsSection.classList.add('is-active', 'is-in-view');
        });
      }

      // 3. Conclusão da Transição
      setTimeout(() => {
        this.currentScene = 'testimonials';
        this.isTransitioning = false;
        document.body.classList.remove('is-transitioning');

        if (this.manifestoSection) {
          this.manifestoSection.style.visibility = 'hidden';
          this.manifestoSection.style.zIndex = '5';
          this.manifestoSection.classList.remove('is-exiting', 'is-in-view');
        }
      }, 1550);
    }

    /**
     * [EXPERIMENTO REVERSÍVEL]
     * Transição Quarta Dobra -> Dobra de Manifesto (Retorno de Depoimentos para o Manifesto)
     */
    transitionTestimonialsToStatement() {
      if (this.isTransitioning || this.currentScene === 'statement') return;
      this.manifestoSection = this.manifestoSection || document.getElementById('manifesto');
      if (!this.manifestoSection) {
        this.transitionTestimonialsToPortfolio();
        return;
      }

      this.isTransitioning = true;
      this.lastTransitionTime = performance.now();
      document.body.classList.add('is-transitioning');

      // 1. Quarta Dobra inicia saída em Blur
      if (this.testimonialsSection) {
        this.testimonialsSection.classList.remove('is-active');
        this.testimonialsSection.classList.add('is-exiting');
        if (global.orbitTestimonials && typeof global.orbitTestimonials.onLeave === 'function') {
          global.orbitTestimonials.onLeave();
        }
      }

      // 2. Manifesto reaparece do Blur
      this.manifestoSection.style.visibility = 'visible';
      this.manifestoSection.style.zIndex = '30';

      requestAnimationFrame(() => {
        this.updateHeaderNav('statement');
        this.manifestoSection.classList.remove('is-exiting');
        this.manifestoSection.classList.add('is-active', 'is-in-view');
      });

      // 3. Conclusão do Retorno
      setTimeout(() => {
        this.currentScene = 'statement';
        this.isTransitioning = false;
        document.body.classList.remove('is-transitioning');

        if (this.testimonialsSection) {
          this.testimonialsSection.style.visibility = 'hidden';
          this.testimonialsSection.style.zIndex = '5';
          this.testimonialsSection.classList.remove('is-exiting', 'is-in-view');
        }
      }, 1550);
    }

    /**
     * [EXPERIMENTO REVERSÍVEL]
     * Transição Dobra de Manifesto -> Hero (Retorno direto ao Hangar pelo Logotipo)
     */
    transitionStatementToHero() {
      if (this.isTransitioning || this.currentScene === 'hero') return;
      this.isTransitioning = true;
      this.lastTransitionTime = performance.now();
      document.body.classList.add('is-transitioning');

      this.manifestoSection = this.manifestoSection || document.getElementById('manifesto');
      if (this.manifestoSection) {
        this.manifestoSection.classList.remove('is-active');
        this.manifestoSection.classList.add('is-exiting');
      }

      this.heroSection.style.visibility = 'visible';
      this.heroSection.style.zIndex = '20';

      if (window.heroPanoramaController) {
        window.heroPanoramaController.isIntersecting = true;
        window.heroPanoramaController.startLoop();
        window.heroPanoramaController.handleResize();
      }

      requestAnimationFrame(() => {
        this.updateHeaderNav('hero');
        this.heroSection.classList.remove('is-exiting');
        if (window.heroPanoramaController) {
          window.heroPanoramaController.setZoom(66);
        }
      });

      setTimeout(() => {
        this.currentScene = 'hero';
        this.isTransitioning = false;
        document.body.classList.remove('is-transitioning');

        if (this.manifestoSection) {
          this.manifestoSection.style.visibility = 'hidden';
          this.manifestoSection.style.zIndex = '5';
          this.manifestoSection.classList.remove('is-exiting', 'is-in-view');
        }
      }, 1550);
    }

    /**
     * Transição Quarta Dobra -> Terceira Dobra (Retorno de Depoimentos para o Portfólio)
     */
    transitionTestimonialsToPortfolio() {
      if (this.isTransitioning || this.currentScene === 'portfolio') return;
      this.isTransitioning = true;
      this.lastTransitionTime = performance.now();
      document.body.classList.add('is-transitioning');

      // 1. Quarta Dobra inicia saída em Blur
      if (this.testimonialsSection) {
        this.testimonialsSection.classList.remove('is-active');
        this.testimonialsSection.classList.add('is-exiting');
        if (global.orbitTestimonials && typeof global.orbitTestimonials.onLeave === 'function') {
          global.orbitTestimonials.onLeave();
        }
      }

      // 2. Terceira Dobra (Portfólio) reaparece do Blur
      if (this.portfolioSection) {
        this.portfolioSection.style.visibility = 'visible';
        this.portfolioSection.style.zIndex = '25';

        if (global.portfolioGallery) {
          global.portfolioGallery.isActive = true;
          global.portfolioGallery.startLoop();
          global.portfolioGallery.handleResize();
        }

        requestAnimationFrame(() => {
          this.updateHeaderNav('portfolio');
          this.portfolioSection.classList.remove('is-exiting');
          this.portfolioSection.classList.add('is-active', 'is-in-view');
        });
      }

      // 3. Conclusão do Retorno
      setTimeout(() => {
        this.currentScene = 'portfolio';
        this.isTransitioning = false;
        document.body.classList.remove('is-transitioning');

        if (this.testimonialsSection) {
          this.testimonialsSection.style.visibility = 'hidden';
          this.testimonialsSection.style.zIndex = '5';
          this.testimonialsSection.classList.remove('is-exiting', 'is-in-view');
        }
      }, 1550);
    }

    /**
     * Transição Quarta Dobra -> Hero (Retorno direto ao Hangar pelo Logotipo)
     */
    transitionTestimonialsToHero() {
      if (this.isTransitioning || this.currentScene === 'hero') return;
      this.isTransitioning = true;
      this.lastTransitionTime = performance.now();
      document.body.classList.add('is-transitioning');

      if (this.testimonialsSection) {
        this.testimonialsSection.classList.remove('is-active');
        this.testimonialsSection.classList.add('is-exiting');
        if (global.orbitTestimonials && typeof global.orbitTestimonials.onLeave === 'function') {
          global.orbitTestimonials.onLeave();
        }
      }

      this.heroSection.style.visibility = 'visible';
      this.heroSection.style.zIndex = '20';

      if (window.heroPanoramaController) {
        window.heroPanoramaController.isIntersecting = true;
        window.heroPanoramaController.startLoop();
        window.heroPanoramaController.handleResize();
      }

      requestAnimationFrame(() => {
        this.updateHeaderNav('hero');
        this.heroSection.classList.remove('is-exiting');
        if (window.heroPanoramaController) {
          window.heroPanoramaController.setZoom(66);
        }
      });

      setTimeout(() => {
        this.currentScene = 'hero';
        this.isTransitioning = false;
        document.body.classList.remove('is-transitioning');

        if (this.testimonialsSection) {
          this.testimonialsSection.style.visibility = 'hidden';
          this.testimonialsSection.style.zIndex = '5';
          this.testimonialsSection.classList.remove('is-exiting', 'is-in-view');
        }
      }, 1550);
    }

    /**
     * Transição Quarta Dobra -> Quinta Dobra (Blur Out de Depoimentos, Blur In de FAQ)
     */
    transitionTestimonialsToFaq() {
      if (this.isTransitioning || this.currentScene === 'faq') return;
      this.isTransitioning = true;
      this.lastTransitionTime = performance.now();
      document.body.classList.add('is-transitioning');

      // 1. Quarta Dobra inicia saída em Blur
      if (this.testimonialsSection) {
        this.testimonialsSection.classList.remove('is-active');
        this.testimonialsSection.classList.add('is-exiting');
        if (global.orbitTestimonials && typeof global.orbitTestimonials.onLeave === 'function') {
          global.orbitTestimonials.onLeave();
        }
      }

      // 2. Quinta Dobra (FAQ) prepara para emergir do Blur
      if (this.faqSection) {
        this.faqSection.style.visibility = 'visible';
        this.faqSection.style.zIndex = '35';
        this.faqSection.scrollTop = 0;

        if (global.orbitFaq && typeof global.orbitFaq.onEnter === 'function') {
          global.orbitFaq.onEnter();
        }

        requestAnimationFrame(() => {
          this.updateHeaderNav('faq');
          this.faqSection.classList.remove('is-exiting');
          this.faqSection.classList.add('is-active', 'is-in-view');
        });
      }

      // 3. Conclusão da Transição
      setTimeout(() => {
        this.currentScene = 'faq';
        this.isTransitioning = false;
        document.body.classList.remove('is-transitioning');

        if (this.testimonialsSection) {
          this.testimonialsSection.style.visibility = 'hidden';
          this.testimonialsSection.style.zIndex = '5';
          this.testimonialsSection.classList.remove('is-exiting', 'is-in-view');
        }
      }, 1550);
    }

    /**
     * Transição Quinta Dobra -> Quarta Dobra (Retorno do FAQ para Depoimentos)
     */
    transitionFaqToTestimonials() {
      if (this.isTransitioning || this.currentScene === 'testimonials') return;
      this.isTransitioning = true;
      this.lastTransitionTime = performance.now();
      document.body.classList.add('is-transitioning');

      // 1. Quinta Dobra inicia saída em Blur
      if (this.faqSection) {
        this.faqSection.classList.remove('is-active');
        this.faqSection.classList.add('is-exiting');
        if (global.orbitFaq && typeof global.orbitFaq.onLeave === 'function') {
          global.orbitFaq.onLeave();
        }
      }

      // 2. Quarta Dobra (Depoimentos) ressurge do Blur
      if (this.testimonialsSection) {
        this.testimonialsSection.style.visibility = 'visible';
        this.testimonialsSection.style.zIndex = '30';

        if (global.orbitTestimonials && typeof global.orbitTestimonials.onEnter === 'function') {
          global.orbitTestimonials.onEnter();
        }

        requestAnimationFrame(() => {
          this.updateHeaderNav('testimonials');
          this.testimonialsSection.classList.remove('is-exiting');
          this.testimonialsSection.classList.add('is-active', 'is-in-view');
        });
      }

      // 3. Conclusão do Retorno
      setTimeout(() => {
        this.currentScene = 'testimonials';
        this.isTransitioning = false;
        document.body.classList.remove('is-transitioning');

        if (this.faqSection) {
          this.faqSection.style.visibility = 'hidden';
          this.faqSection.style.zIndex = '5';
          this.faqSection.classList.remove('is-exiting', 'is-in-view');
        }
      }, 1550);
    }

    /**
     * Transição Quinta Dobra -> Hero (Retorno direto ao Hangar pelo Logotipo)
     */
    transitionFaqToHero() {
      if (this.isTransitioning || this.currentScene === 'hero') return;
      this.isTransitioning = true;
      this.lastTransitionTime = performance.now();
      document.body.classList.add('is-transitioning');

      if (this.faqSection) {
        this.faqSection.classList.remove('is-active');
        this.faqSection.classList.add('is-exiting');
      }

      this.heroSection.style.visibility = 'visible';
      this.heroSection.style.zIndex = '20';

      if (window.heroPanoramaController) {
        window.heroPanoramaController.isIntersecting = true;
        window.heroPanoramaController.startLoop();
        window.heroPanoramaController.handleResize();
      }

      requestAnimationFrame(() => {
        this.updateHeaderNav('hero');
        this.heroSection.classList.remove('is-exiting');
        if (window.heroPanoramaController) {
          window.heroPanoramaController.setZoom(66);
        }
      });

      setTimeout(() => {
        this.currentScene = 'hero';
        this.isTransitioning = false;
        document.body.classList.remove('is-transitioning');

        if (this.faqSection) {
          this.faqSection.style.visibility = 'hidden';
          this.faqSection.style.zIndex = '5';
          this.faqSection.classList.remove('is-exiting', 'is-in-view');
        }
      }, 1550);
    }

    /**
     * Navegação direta e irrestrita entre qualquer uma das 5 dobras
     * @param {string} targetScene 'hero' | 'empresa' | 'portfolio' | 'depoimentos' | 'faq'
     */
    transitionTo(targetScene) {
      if (this.isTransitioning) return;
      let target = targetScene;
      if (target === 'empresa') target = 'explorer';
      if (target === 'manifesto' || target === 'proposito') target = 'statement';
      if (target === 'depoimentos') target = 'testimonials';
      if (target === 'contato') target = 'faq';
      if (target === 'trabalhos' || target === 'projetos') target = 'portfolio';

      if (this.currentScene === target) {
        if (target === 'faq' && this.faqSection) {
          this.faqSection.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
      }

      if (this.currentScene === 'faq' && target === 'hero') {
        this.transitionFaqToHero();
        return;
      }
      if (this.currentScene === 'faq' && target === 'testimonials') {
        this.transitionFaqToTestimonials();
        return;
      }
      if (this.currentScene === 'testimonials' && target === 'faq') {
        this.transitionTestimonialsToFaq();
        return;
      }

      // Transição cinematográfica universal com Blur óptico profundo
      this.isTransitioning = true;
      this.lastTransitionTime = performance.now();
      document.body.classList.add('is-transitioning');

      const sceneMap = {
        hero: { el: this.heroSection, z: 20 },
        explorer: { el: this.explorerSection, z: 20 },
        portfolio: { el: this.portfolioSection, z: 25 },
        statement: { el: this.manifestoSection || document.getElementById('manifesto'), z: 30 },
        testimonials: { el: this.testimonialsSection, z: 30 },
        faq: { el: this.faqSection, z: 35 }
      };

      const current = sceneMap[this.currentScene];
      const next = sceneMap[target];
      if (!next || !next.el) {
        this.isTransitioning = false;
        document.body.classList.remove('is-transitioning');
        return;
      }

      // 1. Saída da cena atual
      if (current && current.el) {
        current.el.classList.remove('is-active');
        current.el.classList.add('is-exiting');

        if (this.currentScene === 'testimonials' && global.orbitTestimonials && typeof global.orbitTestimonials.onLeave === 'function') {
          global.orbitTestimonials.onLeave();
        }
        if (this.currentScene === 'faq' && global.orbitFaq && typeof global.orbitFaq.onLeave === 'function') {
          global.orbitFaq.onLeave();
        }
      }

      // 2. Entrada da nova cena
      next.el.style.visibility = 'visible';
      next.el.style.zIndex = String(next.z + 5);

      if (target === 'hero' && window.heroPanoramaController) {
        window.heroPanoramaController.isIntersecting = true;
        window.heroPanoramaController.startLoop();
        window.heroPanoramaController.handleResize();
      } else if (target === 'explorer' && global.companyExplorer) {
        global.companyExplorer.isIntersecting = true;
        global.companyExplorer.startLoop();
        if (typeof global.companyExplorer.resetToCenter === 'function') {
          global.companyExplorer.resetToCenter();
        } else {
          global.companyExplorer.goToChapter(1);
        }
        global.companyExplorer.onResize();
      } else if (target === 'portfolio' && global.portfolioGallery) {
        global.portfolioGallery.isActive = true;
        global.portfolioGallery.startLoop();
        global.portfolioGallery.handleResize();
      } else if (target === 'testimonials' && global.orbitTestimonials && typeof global.orbitTestimonials.onEnter === 'function') {
        global.orbitTestimonials.onEnter();
      } else if (target === 'faq') {
        if (this.faqSection) this.faqSection.scrollTop = 0;
        if (global.orbitFaq && typeof global.orbitFaq.onEnter === 'function') {
          global.orbitFaq.onEnter();
        }
      }

      requestAnimationFrame(() => {
        this.updateHeaderNav(target);
        next.el.classList.remove('is-exiting');
        next.el.classList.add('is-active', 'is-in-view');
        if (target === 'hero' && window.heroPanoramaController) {
          window.heroPanoramaController.setZoom(66);
        }
      });

      // 3. Conclusão da transição
      setTimeout(() => {
        const prevScene = this.currentScene;
        this.currentScene = target;
        this.isTransitioning = false;
        document.body.classList.remove('is-transitioning');

        if (window.history && window.history.replaceState) {
          let hashName = target;
          if (target === 'statement') hashName = 'manifesto';
          else if (target === 'testimonials') hashName = 'depoimentos';
          else if (target === 'faq') hashName = 'faq';
          else if (target === 'portfolio') hashName = 'portfolio';
          else if (target === 'explorer') hashName = 'empresa';
          else if (target === 'hero') hashName = '';
          const newUrl = hashName ? '#' + hashName : window.location.pathname;
          window.history.replaceState(null, '', newUrl);
        }

        if (current && current.el) {
          current.el.style.visibility = 'hidden';
          current.el.style.zIndex = '5';
          current.el.classList.remove('is-exiting', 'is-in-view');

          if (prevScene === 'hero' && window.heroPanoramaController) {
            window.heroPanoramaController.isIntersecting = false;
            window.heroPanoramaController.stopLoop();
          } else if (prevScene === 'explorer' && global.companyExplorer) {
            global.companyExplorer.stopLoop();
          } else if (prevScene === 'portfolio' && global.portfolioGallery) {
            global.portfolioGallery.isActive = false;
            global.portfolioGallery.stopLoop();
          }
        }
      }, 1550);
    }
  }

  // Inicialização do Coordenador de Cenas
  function initSceneTransition() {
    global.sceneTransition = new SceneTransitionManager();
    global.orbitTransitions = global.sceneTransition;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSceneTransition);
  } else {
    initSceneTransition();
  }

})(window);
