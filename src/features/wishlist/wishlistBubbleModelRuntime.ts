import {
  AdditiveBlending,
  Box3,
  FrontSide,
  Group,
  type Material,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  type Texture,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const BUBBLE_SELECTOR = '.wishlist .wl-cloud-bubble';
const LOCAL_BUBBLE_SELECTOR = '.wl-cloud-bubble';
const CANVAS_CLASS = 'wl-cloud-bubble-model-canvas';
const MODEL_URL = `${import.meta.env.BASE_URL}assets/soap-bubble.glb`;
const MAX_DEVICE_PIXEL_RATIO = 1.5;

interface BubbleController {
  visible: boolean;
  loadToken: number;
  disposeRenderer: (() => void) | null;
}

interface TexturedMaterial extends Material {
  map?: Texture | null;
}

interface BubbleInstance {
  root: Group;
  materials: MeshBasicMaterial[];
}

const controllers = new Map<HTMLElement, BubbleController>();
let bubbleModelPromise: Promise<Group> | null = null;

function priorityOpacity(element: HTMLElement): number {
  if (element.dataset.priority === 'high') return 0.34;
  if (element.dataset.priority === 'low') return 0.24;
  return 0.29;
}

function normalizeModel(root: Group): Group {
  root.updateMatrixWorld(true);

  const bounds = new Box3().setFromObject(root);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const largestDimension = Math.max(size.x, size.y, size.z, 0.0001);

  const scale = 1.92 / largestDimension;
  root.position.copy(center).multiplyScalar(-scale);
  root.scale.setScalar(scale);
  root.rotation.set(-0.035, 0.055, -0.018);
  root.updateMatrixWorld(true);
  return root;
}

function model(): Promise<Group> {
  bubbleModelPromise ??= new GLTFLoader()
    .loadAsync(MODEL_URL)
    .then((gltf) => normalizeModel(gltf.scene));
  return bubbleModelPromise;
}

function createBubbleMaterial(source: Material, opacity: number): MeshBasicMaterial {
  const map = (source as TexturedMaterial).map ?? null;
  if (map) {
    map.colorSpace = SRGBColorSpace;
    map.needsUpdate = true;
  }

  return new MeshBasicMaterial({
    map,
    color: 0xffffff,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: false,
    side: FrontSide,
    blending: AdditiveBlending,
    toneMapped: false,
  });
}

function cloneBubbleModel(source: Group, opacity: number): BubbleInstance {
  const root = source.clone(true);
  const materials: MeshBasicMaterial[] = [];

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;

    const sourceMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    const clonedMaterials = sourceMaterials.map((material) => {
      const bubbleMaterial = createBubbleMaterial(material, opacity);
      materials.push(bubbleMaterial);
      return bubbleMaterial;
    });

    object.material = Array.isArray(object.material)
      ? clonedMaterials
      : clonedMaterials[0]!;
    object.frustumCulled = false;
  });

  return { root, materials };
}

function mountRenderer(element: HTMLElement, sourceModel: Group): () => void {
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

  const instance = cloneBubbleModel(sourceModel, priorityOpacity(element));
  scene.add(instance.root);

  const render = () => {
    const rect = element.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const opacity = priorityOpacity(element);

    instance.materials.forEach((material) => {
      material.opacity = opacity;
    });

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
    scene.remove(instance.root);
    instance.materials.forEach((material) => material.dispose());
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
    const sourceModel = await model();
    const current = controllers.get(element);
    if (
      !current
      || current.loadToken !== token
      || !current.visible
      || current.disposeRenderer
      || !element.isConnected
    ) return;

    current.disposeRenderer = mountRenderer(element, sourceModel);
  } catch (error) {
    console.error('[Wishlist] Failed to load assets/soap-bubble.glb.', error);
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
        const controller = controllers.get(element);
        if (controller?.disposeRenderer) {
          controller.disposeRenderer();
          controller.disposeRenderer = null;
          void activate(element);
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
