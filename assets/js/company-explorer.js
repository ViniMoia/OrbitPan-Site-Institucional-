/**
 * ORBITPAN — SEGUNDA DOBRA: EXPLORADOR IMERSIVO 360° DA EMPRESA
 * 
 * Arquitetura baseada no padrão de Linha Guia Horizontal ("Parcourir les lieux")
 * da referência École Émile Cohl (Three.js + Lerp + Sincronização 3D/DOM)
 * com física de cursor e giroscópio equivalente à Hero Section.
 * 
 * Características:
 * 1. Movimento dinâmico do cursor (Parallax Mouse Tracking): ao mover o mouse
 *    sobre a seção, a câmera responde organicamente com amortecimento Lerp,
 *    trazendo profundidade física à cena panorâmica.
 * 2. Travamento de exploração vertical: o usuário não pode arrastar verticalmente
 *    para virar de cabeça para baixo; a navegação permanece centrada no horizonte (Y: 50%).
 * 3. Respiração ambiente orgânica (Idle Ambient Breathing) quando inativo por > 2.2s.
 * 4. Microinteração magnética sobre o indicador circular da linha guia.
 * 5. Exploração 360° livre no eixo X (Yaw) com arrasto fluido (drag) e setas de navegação.
 * 6. Waypoints dos 4 capítulos projetados matematicamente na linha horizontal.
 * 7. Giroscópio nativo (DeviceOrientationEvent) para mobile e tablets.
 */

(function (global) {
  'use strict';

  const DEG2RAD = Math.PI / 180;
  const RAD2DEG = 180 / Math.PI;

  class CompanyExplorerController {
    constructor() {
      this.section = document.querySelector('#empresa');
      if (!this.section) return;

      this.canvasWrap = document.querySelector('#orbit-company-canvas-wrap');
      this.canvas = document.querySelector('#webgl-company-panorama');
      this.anchorEl = document.querySelector('#explorer-anchor');
      this.titleWrapEl = document.querySelector('.orbit-explorer__title-wrap');
      this.cursorEl = document.querySelector('#explorer-cursor');
      this.timelineEl = document.querySelector('#explorer-timeline');
      this.counterEl = document.querySelector('#explorer-counter');
      this.locationTitleEl = document.querySelector('#explorer-location-name');

      this.prevBtn = document.querySelector('#explorer-nav-prev');
      this.nextBtn = document.querySelector('#explorer-nav-next');
      this.waypointElements = Array.from(document.querySelectorAll('.orbit-card-waypoint'));

      // Estado de Orientação e Física Giroscópica (Baseado na arquitetura da Hero)
      this.baseLon = 0;              // Ângulo base absoluto de longitude (Yaw em graus)
      this.currentLon = 0;           // Longitude atual interpolada (Lerp)
      this.targetLon = 0;            // Alvo total = baseLon + parallaxLon
      
      this.parallaxLon = 0;          // Deslocamento horizontal induzido pelo cursor (em graus)
      this.targetParallaxLon = 0;    // Alvo de parallax horizontal
      this.parallaxPitch = 0;        // Micro-deslocamento vertical elástico (em graus)
      this.targetParallaxPitch = 0;  // Alvo de micro-pitch
      this.currentPitch = 0;         // Pitch atual interpolado

      this.isDragging = false;
      this.startX = 0;
      this.lastVelocity = 0;
      this.isIntersecting = false;
      this.hasInteracted = false;
      this.lastInteractionTime = performance.now();

      // Configurações dos Capítulos / Waypoints (graus ao longo do 360°)
      // Em 0°, nenhum ponto obstrui a tela inicialmente, mantendo o enquadramento limpo
      this.waypoints = [
        { id: 1, angle: 70, title: 'Quem Somos' },
        { id: 2, angle: 140, title: 'Experiência' },
        { id: 3, angle: 210, title: 'Diferencial' },
        { id: 4, angle: 280, title: 'Sustentabilidade' }
      ];
      this.currentChapterIndex = -1;

      // Pipeline Three.js
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.sphereMesh = null;
      this.animFrameId = null;

      this.init();
    }

    init() {
      this.setupThree();
      this.bindDragEvents();
      this.bindNavEvents();
      this.setupGyroscope();
      this.setupIntersectionObserver();
      this.resetToCenter();
    }

    setupThree() {
      if (typeof THREE === 'undefined') {
        console.error('[CompanyExplorer] Three.js não está carregado.');
        return;
      }

      const width = this.canvasWrap.clientWidth || window.innerWidth;
      const height = this.canvasWrap.clientHeight || window.innerHeight;

      // 1. Cena e Câmera
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000);
      this.camera.position.set(0, 0, 0);
      this.camera.lookAt(500, 0, 0); // Foco inicial direto em +X (longitude 0°)

      // 2. Renderer
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // 3. Esfera Equirretangular Invertida (Escala X: -1 para visão interna)
      const geometry = new THREE.SphereGeometry(500, 64, 40);
      geometry.scale(-1, 1, 1);

      // 4. Carregamento de Textura 4K Otimizada
      const textureLoader = new THREE.TextureLoader();
      const textureSrc = './assets/images/company-panorama-4k.jpg';

      textureLoader.load(
        textureSrc,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.generateMipmaps = false;

          const material = new THREE.MeshBasicMaterial({ map: texture });
          this.sphereMesh = new THREE.Mesh(geometry, material);
          this.scene.add(this.sphereMesh);

          this.renderOnce();
        },
        undefined,
        (err) => {
          console.warn('[CompanyExplorer] Falha ao carregar textura 4K:', err);
        }
      );

      // 5. Redimensionamento Responsivo
      window.addEventListener('resize', () => this.onResize(), { passive: true });
    }

    onResize() {
      if (!this.renderer || !this.camera || !this.canvasWrap) return;
      const width = this.canvasWrap.clientWidth || window.innerWidth;
      const height = this.canvasWrap.clientHeight || window.innerHeight;

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
      this.renderOnce();
    }

    bindDragEvents() {
      const target = this.section;

      const onPointerDown = (e) => {
        // Ignora cliques diretos em botões de navegação e links
        if (e.target.closest('.orbit-nav-btn') || e.target.closest('a')) return;

        this.isDragging = true;
        this.startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        this.section.classList.add('is-dragging');
        this.hasInteracted = true;
        this.lastInteractionTime = performance.now();

        if (this.cursorEl) {
          this.cursorEl.style.transform = 'scale(1.22)';
        }
      };

      const onPointerMove = (e) => {
        const currentX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        const currentY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
        this.lastInteractionTime = performance.now();

        if (this.isDragging) {
          // Modo Drag Ativo: translada a rotação base em 360°
          const deltaX = currentX - this.startX;
          this.startX = currentX;

          const sensitivity = 0.18;
          this.baseLon -= deltaX * sensitivity;
          this.section.classList.add('is-rotating');
        } else {
          // MODO PARALLAX DE CURSOR (Física idêntica à Hero):
          // A imagem responde fluidamente ao movimento do ponteiro pela tela
          const rect = this.section.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            const nx = (currentX / window.innerWidth) * 2 - 1; // [-1, 1]
            const ny = Math.max(-1, Math.min(1, ((currentY - rect.top) / rect.height) * 2 - 1)); // [-1, 1]

            // Parallax horizontal dinâmico (amplitude de ~9.5 graus)
            this.targetParallaxLon = -nx * 9.5;
            // Micro-flexão vertical elástica (amplitude de ~1.8 graus para volume óptico sem deslocar o horizonte)
            this.targetParallaxPitch = -ny * 1.8;

            // Microinteração magnética sobre o botão/cursor circular da linha guia
            if (this.cursorEl) {
              const cursorRect = this.cursorEl.getBoundingClientRect();
              const cX = cursorRect.left + cursorRect.width / 2;
              const cY = cursorRect.top + cursorRect.height / 2;
              const dist = Math.hypot(currentX - cX, currentY - cY);
              if (dist < 110) {
                const pullX = ((currentX - cX) / 110) * 8;
                const pullY = ((currentY - cY) / 110) * 4;
                this.cursorEl.style.transform = `translate(${pullX}px, ${pullY}px) scale(1.15)`;
              } else {
                this.cursorEl.style.transform = '';
              }
            }
          }
        }
      };

      const onPointerUp = () => {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.section.classList.remove('is-dragging');

        if (this.cursorEl) {
          this.cursorEl.style.transform = '';
        }

        setTimeout(() => {
          if (!this.isDragging && Math.abs(this.lastVelocity) < 0.05) {
            this.section.classList.remove('is-rotating');
          }
        }, 300);
      };

      const onPointerLeave = () => {
        if (!this.isDragging) {
          this.targetParallaxLon = 0;
          this.targetParallaxPitch = 0;
          if (this.cursorEl) this.cursorEl.style.transform = '';
        }
      };

      // Mouse e Pointer
      target.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
      target.addEventListener('pointerleave', onPointerLeave);

      // Suporte a Roda do Mouse / Trackpad (Shift ou horizontal)
      target.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          this.baseLon += e.deltaX * 0.12;
          this.section.classList.add('is-rotating');
          this.hasInteracted = true;
          this.lastInteractionTime = performance.now();
          e.preventDefault();
        }
      }, { passive: false });

      // Clique no cursor central avança para o primeiro waypoint
      if (this.cursorEl) {
        this.cursorEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.goToChapter(1);
        });
      }
    }

    bindNavEvents() {
      if (this.nextBtn) {
        this.nextBtn.addEventListener('click', () => {
          this.nextChapter();
        });
      }

      if (this.prevBtn) {
        this.prevBtn.addEventListener('click', () => {
          this.prevChapter();
        });
      }

      // Clique direto em qualquer nó da linha guia
      this.waypointElements.forEach((el, index) => {
        const dot = el.querySelector('.orbit-card-waypoint__dot');
        if (dot) {
          dot.addEventListener('click', (e) => {
            e.stopPropagation();
            this.goToChapter(index + 1);
          });
        }
      });

      // Atalhos de teclado (Setas Esquerda e Direita quando a seção estiver visível)
      window.addEventListener('keydown', (e) => {
        if (!this.isIntersecting) return;
        if (e.key === 'ArrowRight') {
          this.nextChapter();
        } else if (e.key === 'ArrowLeft') {
          this.prevChapter();
        }
      });
    }

    /**
     * Reseta imediatamente o estado da câmera e da interface para o centro exato (0°),
     * sem waypoints ativos na tela (garantindo que o card "Quem Somos" não seja exibido).
     */
    resetToCenter() {
      this.baseLon = 0;
      this.currentLon = 0;
      this.targetLon = 0;
      this.parallaxLon = 0;
      this.targetParallaxLon = 0;
      this.parallaxPitch = 0;
      this.targetParallaxPitch = 0;
      this.currentPitch = 0;
      this.currentChapterIndex = -1;
      this.lastInteractionTime = performance.now();

      if (this.section) {
        this.section.classList.remove('is-rotating');
      }

      this.waypointElements.forEach((el) => {
        el.style.display = 'none';
        el.classList.remove('is-active');
      });

      if (this.counterEl) {
        this.counterEl.textContent = `01 / 0${this.waypoints.length}`;
      }

      if (this.camera) {
        this.camera.lookAt(500, 0, 0);
      }
      this.renderOnce();
    }

    /**
     * Anima suavemente a câmera de volta para a visão central (0°),
     * fechando os cards de waypoints.
     */
    goToCenter() {
      this.currentChapterIndex = -1;
      this.lastInteractionTime = performance.now();

      const currentNorm = ((this.baseLon % 360) + 360) % 360;
      let diff = 0 - currentNorm;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;

      this.baseLon += diff;
      if (this.section) {
        this.section.classList.add('is-rotating');
      }

      this.waypointElements.forEach((el) => {
        el.classList.remove('is-active');
      });

      if (this.counterEl) {
        this.counterEl.textContent = `01 / 0${this.waypoints.length}`;
      }
    }

    nextChapter() {
      const currentNorm = ((this.currentLon % 360) + 360) % 360;
      if (this.currentChapterIndex === -1 || currentNorm < 45 || currentNorm > 315) {
        this.goToChapter(1);
        return;
      }
      const nextIndex = (this.currentChapterIndex + 1) % this.waypoints.length;
      this.goToChapter(nextIndex + 1);
    }

    prevChapter() {
      const currentNorm = ((this.currentLon % 360) + 360) % 360;
      if (this.currentChapterIndex === -1 || currentNorm < 35 || currentNorm > 325) {
        this.goToChapter(4);
        return;
      }
      if (this.currentChapterIndex === 0) {
        this.goToCenter();
        return;
      }
      const prevIndex = (this.currentChapterIndex - 1 + this.waypoints.length) % this.waypoints.length;
      this.goToChapter(prevIndex + 1);
    }

    /**
     * Avança para o próximo ponto (Centro -> 1 -> 2 -> 3 -> 4) pelo scroll do mouse.
     * Retorna `true` se avançou internamente na 2ª dobra,
     * ou `false` se já estiver no último ponto (Ponto 4) e deve seguir para a terceira dobra.
     */
    scrollNextPoint() {
      const currentNorm = ((this.currentLon % 360) + 360) % 360;
      // Se estiver na visão central (em torno de 0° ou índice -1), o primeiro scroll avança para o Ponto 1 (Quem Somos)
      if (this.currentChapterIndex === -1 || currentNorm < 45 || currentNorm > 315) {
        this.goToChapter(1);
        return true;
      }
      // Se estiver nos Pontos 1, 2 ou 3 (índices 0, 1, 2), avança para o próximo ponto (2, 3, 4)
      if (this.currentChapterIndex < this.waypoints.length - 1) {
        this.goToChapter(this.currentChapterIndex + 2);
        return true;
      }
      // Já está no Ponto 4 (índice 3): retorna false para transitar para a 3ª dobra (Portfólio)
      return false;
    }

    /**
     * Retorna para o ponto anterior (4 -> 3 -> 2 -> 1 -> Centro) pelo scroll do mouse.
     * Retorna `true` se recuou internamente na 2ª dobra,
     * ou `false` se já estiver na visão central e deve retornar para a Hero.
     */
    scrollPrevPoint() {
      const currentNorm = ((this.currentLon % 360) + 360) % 360;
      // Se já estiver na visão central (em torno de 0° ou índice -1), retorna false para voltar à Hero
      if (this.currentChapterIndex === -1 || currentNorm < 35 || currentNorm > 325) {
        return false;
      }

      // Se estiver nos Pontos 2, 3 ou 4 (índices 1, 2, 3), recua para o ponto anterior (3, 2, 1)
      if (this.currentChapterIndex > 0) {
        this.goToChapter(this.currentChapterIndex);
        return true;
      }

      // Se estiver no Ponto 1 (índice 0, ~70°), recua suavemente para a visão central (0°)
      if (this.currentChapterIndex === 0) {
        this.goToCenter();
        return true;
      }

      return false;
    }

    goToChapter(chapterNumber) {
      const index = chapterNumber - 1;
      if (index < 0 || index >= this.waypoints.length) return;

      const wp = this.waypoints[index];
      this.currentChapterIndex = index;
      this.lastInteractionTime = performance.now();

      // Encontra a rotação mais curta para o ângulo do waypoint
      const currentNorm = ((this.baseLon % 360) + 360) % 360;
      let diff = wp.angle - currentNorm;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;

      this.baseLon += diff;
      this.section.classList.add('is-rotating');
      this.updateChapterUI(index);
    }

    updateChapterUI(index) {
      if (this.counterEl) {
        this.counterEl.textContent = `0${index + 1} / 0${this.waypoints.length}`;
      }
      if (this.locationTitleEl && this.waypoints[index]) {
        this.locationTitleEl.textContent = this.waypoints[index].title;
      }
    }

    setupGyroscope() {
      const handleOrientation = (e) => {
        if (this.isDragging || !this.isIntersecting) return;
        if (e.gamma === null && e.beta === null) return;

        this.lastInteractionTime = performance.now();

        // Mapeamento de inclinação do smartphone para rotação do panorama
        if (typeof e.gamma === 'number') {
          const clampedGamma = Math.max(-40, Math.min(40, e.gamma));
          this.targetParallaxLon = -clampedGamma * 0.45;
        }

        if (typeof e.beta === 'number') {
          const deltaBeta = Math.max(-25, Math.min(25, e.beta - 45));
          this.targetParallaxPitch = -deltaBeta * 0.08;
        }
      };

      if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', handleOrientation, { passive: true });
      }

      // Permissão iOS no clique do cursor
      if (this.cursorEl && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        this.cursorEl.addEventListener('click', () => {
          DeviceOrientationEvent.requestPermission()
            .then(state => {
              if (state === 'granted') {
                window.addEventListener('deviceorientation', handleOrientation, { passive: true });
              }
            })
            .catch(() => {});
        }, { once: true });
      }
    }

    setupIntersectionObserver() {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && this.section.classList.contains('is-active')) {
            this.isIntersecting = true;
            this.section.classList.add('is-in-view');
            this.startLoop();
          } else if (!this.section.classList.contains('is-active')) {
            this.isIntersecting = false;
            this.stopLoop();
          }
        });
      }, { threshold: 0.05 });

      observer.observe(this.section);
    }

    startLoop() {
      if (this.animFrameId) return;
      const animate = () => {
        this.update();
        this.animFrameId = requestAnimationFrame(animate);
      };
      this.animFrameId = requestAnimationFrame(animate);
    }

    stopLoop() {
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
    }

    update() {
      const now = performance.now();

      // 1. Respiração ambiente cinematográfica (quando inativo por > 2.2s, exatamente como na Hero)
      let ambientYaw = 0;
      let ambientPitch = 0;
      if (!this.isDragging && (now - this.lastInteractionTime > 2200)) {
        const t = now * 0.0007;
        ambientYaw = Math.sin(t) * 0.75;
        ambientPitch = Math.cos(t * 0.8) * 0.35;
      }

      // 2. Interpolação suave (Lerp) dos offsets de Parallax do Cursor
      const parallaxLerp = 0.06;
      this.parallaxLon += (this.targetParallaxLon + ambientYaw - this.parallaxLon) * parallaxLerp;
      this.parallaxPitch += (this.targetParallaxPitch + ambientPitch - this.parallaxPitch) * parallaxLerp;

      // Alvo total de longitude = ângulo base + parallax do cursor
      this.targetLon = this.baseLon + this.parallaxLon;

      // 3. Interpolação Linear (Lerp) para inércia da câmera
      const lonLerp = this.isDragging ? 0.16 : 0.075;
      this.currentLon += (this.targetLon - this.currentLon) * lonLerp;
      this.lastVelocity = this.targetLon - this.currentLon;

      // Micro-pitch elástico interpolado (mantém a estabilidade no horizonte)
      this.currentPitch += (this.parallaxPitch - this.currentPitch) * parallaxLerp;

      // 4. Atualização da Câmera Three.js com vetor esférico sincronizado
      const phi = (90 - this.currentPitch) * DEG2RAD;
      const theta = this.currentLon * DEG2RAD;

      const lookX = 500 * Math.sin(phi) * Math.cos(theta);
      const lookY = 500 * Math.cos(phi);
      const lookZ = 500 * Math.sin(phi) * Math.sin(theta);

      this.camera.lookAt(lookX, lookY, lookZ);

      // 5. Renderização WebGL
      this.renderer.render(this.scene, this.camera);

      // 6. Sincronia de Parallax da UI na Linha
      if (this.anchorEl) {
        // Efeito elástico na ancoragem inicial baseado na velocidade do giro
        const elasticOffset = -this.lastVelocity * 3.5;
        this.anchorEl.style.transform = `translate(${elasticOffset}px, -50%)`;
      }

      // 7. Projeção e Posicionamento dos Waypoints ao longo da linha 360°
      this.updateWaypoints(this.currentLon);
    }

    updateWaypoints(currentLonDeg) {
      if (!this.camera) return;

      const width = window.innerWidth;
      const halfWidth = width / 2;

      let closestIndex = -1;
      let minDistance = 9999;

      this.waypoints.forEach((wp, index) => {
        const el = this.waypointElements[index];
        if (!el) return;

        // Ponto 3D na esfera exatamente no plano Y = 0 (sobre a linha central)
        const rad = wp.angle * DEG2RAD;
        const targetVector = new THREE.Vector3(
          500 * Math.cos(rad),
          0,
          500 * Math.sin(rad)
        );

        const camDir = new THREE.Vector3();
        this.camera.getWorldDirection(camDir);

        const dirToPoint = targetVector.clone().normalize();
        const dot = camDir.dot(dirToPoint);

        // O ponto só está no campo de visão se estiver estritamente à frente da câmera (dot > 0.42)
        const isFacing = dot > 0.42;

        if (isFacing) {
          const projected = targetVector.clone().project(this.camera);
          const screenX = (projected.x * 0.5 + 0.5) * width;

          if (screenX >= -100 && screenX <= width + 100) {
            el.style.display = 'block';
            el.style.left = `${screenX}px`;

            // Proximidade do centro da tela para ativação
            const distFromCenter = Math.abs(screenX - halfWidth);
            if (distFromCenter < halfWidth * 0.35) {
              el.classList.add('is-active');
              if (distFromCenter < minDistance) {
                minDistance = distFromCenter;
                closestIndex = index;
              }
            } else {
              el.classList.remove('is-active');
            }
          } else {
            el.style.display = 'none';
            el.classList.remove('is-active');
          }
        } else {
          el.style.display = 'none';
          el.classList.remove('is-active');
        }
      });

      // Atualiza o contador com o capítulo em evidência
      if (closestIndex !== -1) {
        if (closestIndex !== this.currentChapterIndex) {
          this.currentChapterIndex = closestIndex;
          this.updateChapterUI(closestIndex);
        }
      } else {
        const currentNorm = ((this.currentLon % 360) + 360) % 360;
        if (currentNorm < 35 || currentNorm > 325) {
          this.currentChapterIndex = -1;
        }
      }
    }

    renderOnce() {
      if (this.renderer && this.scene && this.camera) {
        const phi = (90 - this.currentPitch) * DEG2RAD;
        const theta = this.currentLon * DEG2RAD;
        this.camera.lookAt(500 * Math.sin(phi) * Math.cos(theta), 500 * Math.cos(phi), 500 * Math.sin(phi) * Math.sin(theta));
        this.renderer.render(this.scene, this.camera);
      }
    }
  }

  // Inicialização no DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      global.companyExplorer = new CompanyExplorerController();
    });
  } else {
    global.companyExplorer = new CompanyExplorerController();
  }

})(window);
