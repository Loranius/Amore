import {
  type BufferGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  WebGLRenderer,
} from 'three';
import {
  createWishlistBubbleGeometry,
  WISHLIST_BUBBLE_TEXTURE_URL,
} from './wishlistBubbleModelData';

const BUBBLE_SELECTOR = '.wishlist .wl-cloud-bubble';
const LOCAL_BUBBLE_SELECTOR = '.wl-cloud-bubble';
const CANVAS_CLASS = 'wl-cloud-bubble-model-canvas';
const MAX_DEVICE_PIXEL_RATIO = 1.5;

interface BubbleController {
  visible: boolean;
  loadToken: number;
  disposeRenderer: (() => void) | null;
}

const controllers = new Map<HTMLElement, BubbleController>();
let bubbleGeometry: BufferGeometry | null = null;
let bubbleTexturePromise: Promise<Texture> | null = null;

function geometry(): BufferGeometry {
  if (!bubbleGeometry) bubbleGeometry = createWishlistBubbleGeometry();
  return bubbleGeometry;
}

function texture(): Promise<Texture> {
  bubbleTexturePromise ??= new Promise((resolve, reject) => {
    new TextureLoader().load(
      WISHLIST_BUBBLE_TEXTURE_URL,
      (loadedTexture) => {
        loadedTexture.colorSpace = SRGBColorSpace;
        loadedTexture.flipY = false;
        loadedTexture.needsUpdate = true;
        resolve(loadedTexture);
      },
      undefined,
      reject,
    );
  });
  return bubbleTexturePromise;
}

function priorityOpacity(element: HTMLElement): number {
  if (element.dataset.priority === 'high') return 0.34;
  if (element.dataset.priority === 'low') return 0.24;
  return 0.29;
}

function mountRenderer(element: HTMLElement, bubbleTexture: Texture): () => void {
  const canvas = document.createElement('canvas');
  canvas.className = CANVAS_CLASS;
  canvas.setAttribute('aria-hidden', 'true');
  element.prepend(canvas);

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
      premultipliedAlpha: false,
    });
  } catch (error) {
    canvas.remove();
    console.info('[Wishlist] WebGL is unavailable; showing the gift without a bubble shell.', error);
    return () => undefined;
  }

  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO));
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const camera = new OrthographicCamera(-1.04, 1.04, 1.04, -1.04, 0.1, 10);
  camera.position.set(0, 0, 3);

  const material = new MeshBasicMaterial({
    map: bubbleTexture,
    transparent: true,
    opacity: priorityOpacity(element),
    depthWrite: false,
    depthTest: false,
    side: DoubleSide,
  });
  const shell = new Mesh(geometry(), material);
  shell.scale.setScalar(0.995);
  shell.rotation.set(-0.035, 0.055, -0.018);
  scene.add(shell);

  const render = () => {
    const rect = element.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    material.opacity = priorityOpacity(element);
    renderer.setSize(width, height, false);
    renderer.render(scene, camera);
  };

  const resizeObserver = typeof ResizeObserver === 'undefined'
    ? null
    : new ResizeObserver(render);
  resizeObserver?.observe(element);
  window.addEventListener('resize', render, { passive: true });
  render();

  return () => {
    resizeObserver?.disconnect();
    window.removeEventListener('resize', render);
    scene.remove(shell);
    material.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  };
}

async function activate(element: HTMLElement): Promise<void> {
  const controller = controllers.get(element);
  if (!controller || !controller.visible || controller.disposeRenderer) return;

  const token = ++controller.loadToken;
  try {
    const bubbleTexture = await texture();
    const current = controllers.get(element);
    if (
      !current
      || current.loadToken !== token
      || !current.visible
      || current.disposeRenderer
      || !element.isConnected
    ) return;

    current.disposeRenderer = mountRenderer(element, bubbleTexture);
  } catch (error) {
    console.error('[Wishlist] Failed to load the uploaded soap-bubble texture.', error);
  }
}

function deactivate(element: HTMLElement): void {
  const controller = controllers.get(element);
  if (!controller) return;
  controller.loadToken += 1;
  controller.disposeRenderer?.();
  controller.disposeRenderer = null;
}

function bubblesWithin(node: Node): HTMLElement[] {
  if (!(node instanceof Element)) return [];
  const matches: HTMLElement[] = [];
  if (node.matches(LOCAL_BUBBLE_SELECTOR)) matches.push(node as HTMLElement);
  node.querySelectorAll<HTMLElement>(LOCAL_BUBBLE_SELECTOR).forEach((element) => matches.push(element));
  return matches;
}

function startBubbleRuntime(): void {
  document.querySelectorAll<HTMLCanvasElement>(`.${CANVAS_CLASS}`).forEach((canvas) => canvas.remove());

  const intersectionObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const element = entry.target as HTMLElement;
            const controller = controllers.get(element);
            if (!controller) continue;
            controller.visible = entry.isIntersecting;
            if (entry.isIntersecting) void activate(element);
            else deactivate(element);
          }
        },
        { rootMargin: '180px' },
      )
    : null;

  const observe = (element: HTMLElement) => {
    if (controllers.has(element) || !element.closest('.wishlist')) return;
    const visible = intersectionObserver === null;
    controllers.set(element, { visible, loadToken: 0, disposeRenderer: null });
    if (intersectionObserver) intersectionObserver.observe(element);
    else void activate(element);
  };

  const remove = (element: HTMLElement) => {
    intersectionObserver?.unobserve(element);
    deactivate(element);
    controllers.delete(element);
  };

  document.querySelectorAll<HTMLElement>(BUBBLE_SELECTOR).forEach(observe);

  const mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        const element = mutation.target as HTMLElement;
        if (controllers.has(element)) {
          const controller = controllers.get(element);
          if (controller?.disposeRenderer) {
            controller.disposeRenderer();
            controller.disposeRenderer = null;
            void activate(element);
          }
        }
        continue;
      }

      mutation.addedNodes.forEach((node) => bubblesWithin(node).forEach(observe));
      mutation.removedNodes.forEach((node) => bubblesWithin(node).forEach(remove));
    }
  });
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-priority'],
  });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const runtimeWindow = window as Window & { __amoreWishlistBubbleModelStarted?: boolean };
  if (!runtimeWindow.__amoreWishlistBubbleModelStarted) {
    runtimeWindow.__amoreWishlistBubbleModelStarted = true;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startBubbleRuntime, { once: true });
    } else {
      startBubbleRuntime();
    }
  }
}
