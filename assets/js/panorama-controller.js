/**
 * ORBITPAN — Interactive Panorama Background Controller
 * 
 * Implementação em conformidade estrita com a arquitetura técnica documentada em:
 * interactive-panorama-architecture.md
 * 
 * Responsabilidades:
 * - Renderização WebGL isolada via Three.js (SphereGeometry invertida).
 * - Mapeamento da câmera em resposta fluida a mousemove, toque e drag com amortecimento (Lerp).
 * - Limites angulares configuráveis de Yaw e Pitch via data-attributes.
 * - Gerenciamento de ciclo de vida com IntersectionObserver (Lazy Loop Rendering).
 * - ResizeObserver para manutenção de aspect ratio sem distorção.
 * - Respeito a prefers-reduced-motion e fallback resiliente estático.
 * - Suporte a navegação por presets de ângulo e controle de FOV.
 * - Desalocação completa de memória (GPU/VRAM) via método destroy().
 */

(function (global) {
  'use strict';

  const DEG2RAD = Math.PI / 180;
  const RAD2DEG = 180 / Math.PI;

  class PanoramaBackgroundController {
    /**
     * @param {HTMLElement} container Elemento raiz que recebe o background 3D
     * @param {Object} [options] Sobrescrita opcional de parâmetros
     */
    constructor(container, options = {}) {
      if (!container) {
        throw new Error('[PanoramaBackgroundController] Contêiner DOM não informado.');
      }

      this.container = container;
      this.options = Object.assign({}, this.readDataAttributes(), options);

      // Verificação de suporte a WebGL
      if (!this.checkWebGLSupport()) {
        console.warn('[PanoramaBackgroundController] WebGL indisponível. Aplicando fallback estático.');
        this.applyFallback();
        return;
      }

      // Verificação de acessibilidade: prefers-reduced-motion
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Estado interno de ângulos e física
      this.initialYawRad = (this.options.initialYaw || 0) * DEG2RAD;
      this.initialPitchRad = (this.options.initialPitch || 0) * DEG2RAD;

      this.yawLimitRad = (this.options.yawLimit || 10) * DEG2RAD;
      this.pitchLimitRad = (this.options.pitchLimit || 2.5) * DEG2RAD;

      this.targetYaw = this.initialYawRad;
      this.targetPitch = this.initialPitchRad;
      this.currentYaw = this.initialYawRad;
      this.currentPitch = this.initialPitchRad;

      this.baseYaw = this.initialYawRad;
      this.basePitch = this.initialPitchRad;

      this.targetFov = this.options.fov || 68;
      this.currentFov = this.targetFov;

      this.lerpFactor = this.options.lerpFactor || 0.045;
      this.isDragging = false;
      this.dragStartX = 0;
      this.dragStartY = 0;
      this.dragStartBaseYaw = 0;
      this.dragStartBasePitch = 0;
      this.hasDragged = false;

      this.isIdle = true;
      this.lastInteractionTime = performance.now();
      this.idleBreathAmplitude = 0.012; // radianos (~0.7 graus)

      // =========================================================================
      // EXPERIMENTO: Travar rotação manual da câmera (câmera fixa reagindo apenas ao mouse)
      // Para desativar/reverter completamente: altere lockCameraRotation para false
      // ou defina data-pan-lock-rotation="false" no contêiner da Hero no HTML.
      // =========================================================================
      this.lockCameraRotation = this.options.lockCameraRotation !== undefined 
        ? this.options.lockCameraRotation 
        : true;

      if (this.lockCameraRotation) {
        this.container.classList.add('camera-locked');
      }

      this.isIntersecting = true;
      this.animationFrameId = null;
      this.clock = typeof THREE !== 'undefined' ? new THREE.Clock() : null;

      // Inicialização do Pipeline Three.js
      this.initPipeline();
      this.bindEvents();
      this.initObservers();
      this.loadTexture();
      this.startLoop();
    }

    /**
     * Extrai propriedades configuradas pelo Design nos data-attributes do contêiner
     */
    readDataAttributes() {
      const ds = this.container.dataset;
      const isMobile = window.innerWidth <= 768;

      // Seleção inteligente de textura (4K desktop vs 2K mobile)
      let src = ds.panoramaSrc;
      if (!src) {
        src = isMobile 
          ? './assets/images/hangar-panorama-2k.jpg' 
          : './assets/images/hangar-panorama-4k.jpg';
      }

      return {
        src: src,
        yawLimit: ds.panYawLimit ? parseFloat(ds.panYawLimit) : 10,
        pitchLimit: ds.panPitchLimit ? parseFloat(ds.panPitchLimit) : 2.5,
        initialYaw: ds.panInitialYaw ? parseFloat(ds.panInitialYaw) : 180, // 180° aponta para o centro nobre do hangar
        initialPitch: ds.panInitialPitch ? parseFloat(ds.panInitialPitch) : -2,
        fov: ds.panFov ? parseFloat(ds.panFov) : (isMobile ? 78 : 66),
        // EXPERIMENTO: Travar rotação manual da câmera (permite apenas mouse parallax)
        lockCameraRotation: ds.panLockRotation !== undefined 
          ? ds.panLockRotation === 'true' 
          : true
      };
    }

    /**
     * Checa suporte nativo da GPU para WebGL
     */
    checkWebGLSupport() {
      if (typeof THREE === 'undefined') {
        console.error('[PanoramaBackgroundController] THREE.js não foi carregado.');
        return false;
      }
      try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && 
          (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
      } catch (e) {
        return false;
      }
    }

    /**
     * Aplica fallback gráfico de imagem estática caso WebGL não esteja disponível
     */
    applyFallback() {
      this.container.classList.add('panorama-fallback-active');
      const fallbackUrl = this.options.src || './assets/images/hangar-panorama-2k.jpg';
      this.container.style.backgroundImage = `url('${fallbackUrl}')`;
      this.container.style.backgroundPosition = 'center center';
      this.container.style.backgroundSize = 'cover';
    }

    /**
     * Inicializa a cena, câmera e renderizador WebGL
     */
    initPipeline() {
      // Wrapper absoluto sob o conteúdo com z-index isolado
      this.canvasWrapper = document.createElement('div');
      this.canvasWrapper.className = 'orbit-panorama-canvas-wrap';
      this.canvasWrapper.setAttribute('aria-hidden', 'true');
      this.canvasWrapper.style.cssText = [
        'position: absolute',
        'top: 0',
        'left: 0',
        'width: 100%',
        'height: 100%',
        'z-index: 0',
        'pointer-events: none',
        'overflow: hidden',
        'opacity: 0',
        'transition: opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1)'
      ].join(';');

      // Insere como primeiro filho para garantir ordem de empilhamento natural
      this.container.insertBefore(this.canvasWrapper, this.container.firstChild);

      const width = this.container.clientWidth || window.innerWidth;
      const height = this.container.clientHeight || window.innerHeight;

      // Cena Three.js
      this.scene = new THREE.Scene();

      // Câmera de Perspectiva no centro da esfera (0, 0, 0)
      this.camera = new THREE.PerspectiveCamera(this.targetFov, width / height, 0.1, 1500);
      this.camera.position.set(0, 0, 0);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.initialYawRad;
      this.camera.rotation.x = this.initialPitchRad;

      // Renderer WebGL com alta precisão e alpha
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(width, height, false);
      this.renderer.outputEncoding = THREE.sRGBEncoding || 3001;

      this.canvas = this.renderer.domElement;
      this.canvas.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: block;';
      this.canvasWrapper.appendChild(this.canvas);

      // Geometria Esférica Equiretangular: Raio 500, subdivisões generosas para suavidade
      this.sphereGeometry = new THREE.SphereGeometry(500, 64, 40);
      // Mapeamento interno: inverte a escala em X para pintar a face interna perfeitamente
      this.sphereGeometry.scale(-1, 1, 1);

      // Material inicial limpo com cor neutra escura antes do carregamento da textura
      this.sphereMaterial = new THREE.MeshBasicMaterial({
        color: 0x07090e,
        transparent: false
      });

      this.sphereMesh = new THREE.Mesh(this.sphereGeometry, this.sphereMaterial);
      this.scene.add(this.sphereMesh);
    }

    /**
     * Carrega a textura equiretangular com TextureLoader
     */
    loadTexture() {
      const textureLoader = new THREE.TextureLoader();
      
      textureLoader.load(
        this.options.src,
        (texture) => {
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.generateMipmaps = false;
          texture.format = THREE.RGBAFormat;

          this.sphereMaterial.map = texture;
          this.sphereMaterial.color.setHex(0xffffff);
          this.sphereMaterial.needsUpdate = true;

          // Revelação cinematográfica com transição suave
          requestAnimationFrame(() => {
            if (this.canvasWrapper) {
              this.canvasWrapper.style.opacity = '1';
            }
            this.container.classList.add('panorama-ready');
            this.container.dispatchEvent(new CustomEvent('orbit:panorama-ready', {
              bubbles: true,
              detail: { controller: this }
            }));
          });
        },
        undefined,
        (error) => {
          console.error('[PanoramaBackgroundController] Erro ao carregar panorama principal:', error);
          // Tentativa de carregar versão fallback 2K caso 4K falhe
          if (!this.options.src.includes('-2k')) {
            console.warn('[PanoramaBackgroundController] Tentando fallback para 2K...');
            this.options.src = './assets/images/hangar-panorama-2k.jpg';
            this.loadTexture();
          } else {
            this.applyFallback();
          }
        }
      );
    }

    /**
     * Registra listeners de interação com mouse, toque, drag e resize
     */
    bindEvents() {
      this.onPointerMove = this.handlePointerMove.bind(this);
      this.onPointerDown = this.handlePointerDown.bind(this);
      this.onPointerUp = this.handlePointerUp.bind(this);
      this.onMouseLeave = this.handleMouseLeave.bind(this);
      this.onContextLost = this.handleContextLost.bind(this);
      this.onContextRestored = this.handleContextRestored.bind(this);

      // Escuta movimentação global para parallax suave
      window.addEventListener('pointermove', this.onPointerMove, { passive: true });
      this.container.addEventListener('pointerdown', this.onPointerDown, { passive: true });
      window.addEventListener('pointerup', this.onPointerUp, { passive: true });
      this.container.addEventListener('pointerleave', this.onMouseLeave, { passive: true });

      // Suporte a WebGL Context Loss
      this.canvas.addEventListener('webglcontextlost', this.onContextLost, false);
      this.canvas.addEventListener('webglcontextrestored', this.onContextRestored, false);

      // Ouvir preferências de redução de movimento em tempo real
      const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      motionQuery.addEventListener('change', (e) => {
        this.reducedMotion = e.matches;
        if (this.reducedMotion) {
          this.targetYaw = this.initialYawRad;
          this.targetPitch = this.initialPitchRad;
        }
      });
    }

    /**
     * Manipula movimento do ponteiro (Mouse Parallax)
     */
    handlePointerMove(e) {
      if (this.reducedMotion) return;

      this.lastInteractionTime = performance.now();
      this.isIdle = false;

      if (this.isDragging) {
        // Modo Drag: o usuário está ativamente arrastando o panorama
        const deltaX = e.clientX - this.dragStartX;
        const deltaY = e.clientY - this.dragStartY;

        // Fator de sensibilidade angular (proporcional à tela)
        const sensitivity = 0.0032;
        this.baseYaw = this.dragStartBaseYaw + deltaX * sensitivity;
        const maxDragPitch = 12 * DEG2RAD;
        this.basePitch = Math.max(
          -maxDragPitch,
          Math.min(maxDragPitch, this.dragStartBasePitch + deltaY * sensitivity)
        );

        this.targetYaw = this.baseYaw;
        this.targetPitch = this.basePitch;
        this.hasDragged = true;
        return;
      }

      // Parallax sutil de cursor quando não está arrastando
      const rect = this.container.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;

      // Coordenadas normalizadas [-1, 1] relativas à viewport
      const nx = (clientX / window.innerWidth) * 2 - 1;
      const ny = (clientY / window.innerHeight) * 2 - 1;

      // Mapeamento angular seguro com limites suaves e cinematográficos
      const parallaxYaw = -nx * this.yawLimitRad;
      const parallaxPitch = -ny * this.pitchLimitRad;

      this.targetYaw = this.baseYaw + parallaxYaw;
      this.targetPitch = this.basePitch + parallaxPitch;

      // Dispara evento com orientação atual para alimentar a bússola/microinteração na UI
      this.emitOrientationUpdate();
    }

    /**
     * Início de clique/toque para exploração manual
     */
    handlePointerDown(e) {
      // Quando travada, a rotação manual é bloqueada (preserva apenas a reação ao mouse)
      if (this.reducedMotion || this.lockCameraRotation) return;
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.dragStartBaseYaw = this.baseYaw;
      this.dragStartBasePitch = this.basePitch;
      this.container.classList.add('is-panning');
    }

    /**
     * Finalização de clique/toque
     */
    handlePointerUp() {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.container.classList.remove('is-panning');
    }

    /**
     * Retorno suave quando o cursor sai da janela/área
     */
    handleMouseLeave() {
      if (this.reducedMotion || this.isDragging) return;
      // Retorna gentilmente para a base yaw/pitch configurada
      this.targetYaw = this.baseYaw;
      this.targetPitch = this.basePitch;
      this.isIdle = true;
    }

    /**
     * Notifica a interface sobre a rotação atual para sincronizar o indicador de bússola
     */
    emitOrientationUpdate() {
      const headingDeg = Math.round((this.currentYaw * RAD2DEG) % 360);
      const normalizedHeading = headingDeg < 0 ? headingDeg + 360 : headingDeg;
      
      this.container.dispatchEvent(new CustomEvent('orbit:panorama-rotate', {
        detail: {
          yawDeg: normalizedHeading,
          pitchDeg: Math.round(this.currentPitch * RAD2DEG),
          fov: this.currentFov
        }
      }));
    }

    /**
     * Configura IntersectionObserver (Lazy Loop) e ResizeObserver
     */
    initObservers() {
      // 1. IntersectionObserver: Pausa o render loop fora da viewport
      if ('IntersectionObserver' in window) {
        this.intersectionObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              this.isIntersecting = entry.isIntersecting;
              if (this.isIntersecting && !this.animationFrameId) {
                this.startLoop();
              }
            });
          },
          { threshold: 0.05 }
        );
        this.intersectionObserver.observe(this.container);
      }

      // 2. ResizeObserver: Atualiza aspect ratio da câmera sem deformar esferas
      if ('ResizeObserver' in window) {
        this.resizeObserver = new ResizeObserver(() => {
          this.handleResize();
        });
        this.resizeObserver.observe(this.container);
      } else {
        window.addEventListener('resize', () => this.handleResize(), { passive: true });
      }
    }

    /**
     * Recalcula matriz de projeção em redimensionamento
     */
    handleResize() {
      if (!this.renderer || !this.camera || !this.container) return;

      const width = this.container.clientWidth || window.innerWidth;
      const height = this.container.clientHeight || window.innerHeight;

      if (width === 0 || height === 0) return;

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height, false);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    }

    /**
     * Loop principal de animação com Lerp dampening
     */
    startLoop() {
      const render = () => {
        // Pausa imediata se a seção não estiver visível na tela
        if (!this.isIntersecting) {
          this.animationFrameId = null;
          return;
        }

        const now = performance.now();

        // Respiração ambiente sutil quando o usuário fica inativo por > 2.5s
        if (!this.reducedMotion && (now - this.lastInteractionTime > 2500) && !this.isDragging) {
          const t = now * 0.0006;
          const ambientYawOffset = Math.sin(t) * this.idleBreathAmplitude;
          const ambientPitchOffset = Math.cos(t * 0.8) * (this.idleBreathAmplitude * 0.5);
          this.targetYaw = this.baseYaw + ambientYawOffset;
          this.targetPitch = this.basePitch + ambientPitchOffset;
        }

        // Amortecimento suave por interpolação linear (Lerp)
        if (!this.reducedMotion) {
          this.currentYaw += (this.targetYaw - this.currentYaw) * this.lerpFactor;
          this.currentPitch += (this.targetPitch - this.currentPitch) * this.lerpFactor;
          this.currentFov += (this.targetFov - this.currentFov) * this.lerpFactor;
        } else {
          this.currentYaw = this.targetYaw;
          this.currentPitch = this.targetPitch;
          this.currentFov = this.targetFov;
        }

        // Atualização da Câmera
        this.camera.rotation.y = this.currentYaw;
        this.camera.rotation.x = this.currentPitch;

        if (Math.abs(this.camera.fov - this.currentFov) > 0.05) {
          this.camera.fov = this.currentFov;
          this.camera.updateProjectionMatrix();
        }

        // Renderização do quadro
        this.renderer.render(this.scene, this.camera);

        // Dispara evento sutil de rotação para atualizar bússola
        if (Math.abs(this.targetYaw - this.currentYaw) > 0.0005) {
          this.emitOrientationUpdate();
        }

        this.animationFrameId = requestAnimationFrame(render);
      };

      this.animationFrameId = requestAnimationFrame(render);
    }

    /**
     * Permite transição suave da câmera para um ângulo de interesse pré-definido
     * @param {number} yawDeg Ângulo horizontal em graus
     * @param {number} pitchDeg Ângulo vertical em graus
     * @param {number} [fov] Campo de visão desejado
     */
    setPreset(yawDeg, pitchDeg = -2, fov = null) {
      this.baseYaw = yawDeg * DEG2RAD;
      this.basePitch = pitchDeg * DEG2RAD;
      this.targetYaw = this.baseYaw;
      this.targetPitch = this.basePitch;
      if (fov) {
        this.targetFov = fov;
      }
      this.lastInteractionTime = performance.now();
    }

    /**
     * Ajusta o zoom do campo de visão (FOV)
     * @param {number} fov Valor em graus (ex: 50 mais próximo, 80 mais aberto)
     */
    setZoom(fov) {
      this.targetFov = Math.max(45, Math.min(85, fov));
    }

    /**
     * Recupera os ângulos atuais da câmera em graus
     */
    getAngles() {
      return {
        yaw: Math.round(this.currentYaw * RAD2DEG),
        pitch: Math.round(this.currentPitch * RAD2DEG),
        fov: Math.round(this.currentFov)
      };
    }

    /**
     * Tratamento de perda de contexto WebGL
     */
    handleContextLost(e) {
      e.preventDefault();
      console.warn('[PanoramaBackgroundController] WebGL Context Lost.');
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    }

    /**
     * Tratamento de restauração de contexto WebGL
     */
    handleContextRestored() {
      console.info('[PanoramaBackgroundController] WebGL Context Restored.');
      this.initPipeline();
      this.loadTexture();
      this.startLoop();
    }

    /**
     * EXPERIMENTO: Alterna ou define o travamento de rotação manual da câmera
     * Uso dinâmico no console:
     * window.heroPanoramaController.setCameraLock(false) // destrava rotação 360° (reverte 100%)
     * window.heroPanoramaController.setCameraLock(true)  // trava rotação na posição inicial
     */
    setCameraLock(locked) {
      this.lockCameraRotation = typeof locked === 'boolean' ? locked : !this.lockCameraRotation;
      if (this.lockCameraRotation) {
        this.container.classList.add('camera-locked');
        this.isDragging = false;
        this.container.classList.remove('is-panning');
        this.baseYaw = this.initialYawRad;
        this.basePitch = this.initialPitchRad;
        this.targetYaw = this.baseYaw;
        this.targetPitch = this.basePitch;
      } else {
        this.container.classList.remove('camera-locked');
      }
      return this.lockCameraRotation;
    }

    /**
     * Destruição completa de instâncias e liberação estrita de recursos GPU
     */
    destroy() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }

      window.removeEventListener('pointermove', this.onPointerMove);
      this.container.removeEventListener('pointerdown', this.onPointerDown);
      window.removeEventListener('pointerup', this.onPointerUp);
      this.container.removeEventListener('pointerleave', this.onMouseLeave);

      if (this.intersectionObserver) {
        this.intersectionObserver.disconnect();
      }
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      }

      // Desalocação Three.js
      if (this.sphereGeometry) {
        this.sphereGeometry.dispose();
      }
      if (this.sphereMaterial) {
        if (this.sphereMaterial.map) {
          this.sphereMaterial.map.dispose();
        }
        this.sphereMaterial.dispose();
      }
      if (this.renderer) {
        this.renderer.dispose();
        if (this.renderer.domElement && this.renderer.domElement.parentNode) {
          this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }
      }
      if (this.canvasWrapper && this.canvasWrapper.parentNode) {
        this.canvasWrapper.parentNode.removeChild(this.canvasWrapper);
      }

      this.scene = null;
      this.camera = null;
      this.renderer = null;
    }
  }

  // Exportação global
  global.PanoramaBackgroundController = PanoramaBackgroundController;

})(typeof window !== 'undefined' ? window : this);
