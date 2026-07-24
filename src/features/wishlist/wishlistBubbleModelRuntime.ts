import {
  AdditiveBlending,
  type BufferGeometry,
  DoubleSide,
  Mesh,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from 'three';
import { createWishlistBubbleGeometry } from './wishlistBubbleModelData';

const BUBBLE_SELECTOR = '.wishlist .wl-cloud-bubble';
const LOCAL_BUBBLE_SELECTOR = '.wl-cloud-bubble';
const MAX_DEVICE_PIXEL_RATIO = 1.35;

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDirection;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDirection = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uOpacity;

  varying vec3 vNormal;
  varying vec3 vViewDirection;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDirection = normalize(vViewDirection);
    float facing = clamp(dot(normal, viewDirection), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 2.15);
    float edge = pow(1.0 - facing, 5.0);

    vec3 lightDirection = normalize(vec3(-0.48, 0.72, 0.5));
    float highlight = pow(max(dot(normal, lightDirection), 0.0), 18.0);
    float lowerReflection = pow(max(-normal.y, 0.0), 5.0) * 0.16;

    float phase = fresnel * 8.2 + normal.x * 2.1 + normal.y * 3.15;
    vec3 spectrum = 0.5 + 0.5 * cos(phase + vec3(0.0, 2.094, 4.188));
    vec3 pastel = mix(vec3(0.98, 0.92, 1.0), spectrum, 0.46);
    vec3 colour = mix(vec3(1.0), pastel, 0.72);
    colour += highlight * vec3(0.22, 0.19, 0.24);
    colour += lowerReflection * vec3(0.26, 0.42, 0.5);

    float alpha = (
      0.022
      + fresnel * 0.48
      + edge * 0.16
      + highlight * 0.15
      + lowerReflection
    ) * uOpacity;

    gl_FragColor = vec4(colour, clamp(alpha, 0.0, 0.68));
  }
`;

interface BubbleController {
  visible: boolean;
  disposeRenderer: (() => void) | null;
}

let bubbleGeometry: BufferGeometry | null = null;
const controllers = new Map<HTMLElement, BubbleController>();

function geometry(): BufferGeometry {
  bubbleGeometry ??= createWishlistBubbleGeometry();
  return bubbleGeometry;
}

function priorityOpacity(element: HTMLElement): number {
  if (element.dataset.priority === 'high') return 1;
  if (element.dataset.priority === 'low') return 0.72;
  return 0.88;
}

function mountRenderer(element: HTMLElement): () => void {
  const canvas = document.createElement('canvas');
  canvas.className = 'wl-cloud-bubble-model-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  element.prepend(canvas);

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
      premultipliedAlpha: true,
    });
  } catch (error) {
    canvas.remove();
    console.info('[Wishlist] WebGL unavailable; CSS bubble fallback remains active.', error);
    return () => undefined;
  }

  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO));

  const scene = new Scene();
  const camera = new PerspectiveCamera(36, 1, 0.1, 10);
  camera.position.set(0, 0, 2.05);

  const opacityUniform = { value: priorityOpacity(element) };
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uOpacity: opacityUniform,
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  });

  const shell = new Mesh(geometry(), material);
  shell.scale.setScalar(1.08);
  shell.rotation.set(-0.035, 0.045, -0.018);
  scene.add(shell);

  const render = () => {
    const rect = element.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    opacityUniform.value = priorityOpacity(element);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
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

function activate(element: HTMLElement): void {
  const controller = controllers.get(element);
  if (!controller || controller.disposeRenderer || !controller.visible) return;
  controller.disposeRenderer = mountRenderer(element);
}

function deactivate(element: HTMLElement): void {
  const controller = controllers.get(element);
  if (!controller) return;
  controller.visible = false;
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
  const intersectionObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const element = entry.target as HTMLElement;
            const controller = controllers.get(element);
            if (!controller) continue;
            controller.visible = entry.isIntersecting;
            if (entry.isIntersecting) activate(element);
            else deactivate(element);
          }
        },
        { rootMargin: '220px' },
      )
    : null;

  const observe = (element: HTMLElement) => {
    if (controllers.has(element) || !element.closest('.wishlist')) return;
    controllers.set(element, {
      visible: intersectionObserver === null,
      disposeRenderer: null,
    });
    if (intersectionObserver) intersectionObserver.observe(element);
    else activate(element);
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
          activate(element);
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
  const runtimeWindow = window as Window & {
    __amoreWishlistBubbleModelStarted?: boolean;
  };

  if (!runtimeWindow.__amoreWishlistBubbleModelStarted) {
    runtimeWindow.__amoreWishlistBubbleModelStarted = true;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startBubbleRuntime, { once: true });
    } else {
      startBubbleRuntime();
    }
  }
}
