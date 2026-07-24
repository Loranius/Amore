import { useEffect } from 'react';

type BubbleBody = {
  element: HTMLElement;
  button: HTMLButtonElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
  radius: number;
  dragging: boolean;
};

type PointerDrag = {
  pointerId: number;
  body: BubbleBody;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  lastTime: number;
  offsetX: number;
  offsetY: number;
  active: boolean;
  holdTimer: number | null;
};

type BoardBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

const HOLD_DELAY_MS = 165;
const DRAG_DISTANCE_PX = 7;
const FRAME_MS = 1000 / 60;
const MAX_SPEED = 26;
const WALL_RESTITUTION = 0.76;
const COLLISION_RESTITUTION = 0.82;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parsePixels(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function limitVelocity(body: BubbleBody): void {
  const speed = Math.hypot(body.vx, body.vy);
  if (speed <= MAX_SPEED || speed === 0) return;
  const ratio = MAX_SPEED / speed;
  body.vx *= ratio;
  body.vy *= ratio;
}

function mountBubblePhysics(board: HTMLElement): () => void {
  const bodies = new Map<HTMLElement, BubbleBody>();
  let bounds: BoardBounds = { left: 0, right: 0, top: 0, bottom: 0 };
  let pointer: PointerDrag | null = null;
  let frameId = 0;
  let measureFrameId = 0;
  let lastFrameTime = performance.now();
  let suppressTarget: HTMLElement | null = null;
  let suppressClickUntil = 0;
  let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderBody = (body: BubbleBody) => {
    body.element.style.setProperty('--wl-physics-x', `${body.x.toFixed(2)}px`);
    body.element.style.setProperty('--wl-physics-y', `${body.y.toFixed(2)}px`);
    body.element.classList.toggle(
      'wl-cloud-item--moving',
      body.dragging || Math.hypot(body.vx, body.vy) > 0.18,
    );
  };

  const renderAll = () => {
    bodies.forEach(renderBody);
  };

  const clampBodyToBoard = (body: BubbleBody, bounce: boolean) => {
    const gutter = Math.min(14, body.radius * 0.1);
    let minX = bounds.left + body.radius + gutter - body.baseX;
    let maxX = bounds.right - body.radius - gutter - body.baseX;
    let minY = bounds.top + body.radius + gutter - body.baseY;
    let maxY = bounds.bottom - body.radius - gutter - body.baseY;

    if (minX > maxX) {
      const middle = (minX + maxX) / 2;
      minX = middle;
      maxX = middle;
    }
    if (minY > maxY) {
      const middle = (minY + maxY) / 2;
      minY = middle;
      maxY = middle;
    }

    if (body.x < minX) {
      body.x = minX;
      if (bounce && body.vx < 0) body.vx = Math.abs(body.vx) * WALL_RESTITUTION;
    } else if (body.x > maxX) {
      body.x = maxX;
      if (bounce && body.vx > 0) body.vx = -Math.abs(body.vx) * WALL_RESTITUTION;
    }

    if (body.y < minY) {
      body.y = minY;
      if (bounce && body.vy < 0) body.vy = Math.abs(body.vy) * WALL_RESTITUTION;
    } else if (body.y > maxY) {
      body.y = maxY;
      if (bounce && body.vy > 0) body.vy = -Math.abs(body.vy) * WALL_RESTITUTION;
    }
  };

  const resolveCollisions = (passes = 2) => {
    const list = [...bodies.values()];

    for (let pass = 0; pass < passes; pass += 1) {
      for (let i = 0; i < list.length; i += 1) {
        const a = list[i];
        if (!a || a.radius <= 0) continue;

        for (let j = i + 1; j < list.length; j += 1) {
          const b = list[j];
          if (!b || b.radius <= 0) continue;

          const ax = a.baseX + a.x;
          const ay = a.baseY + a.y;
          const bx = b.baseX + b.x;
          const by = b.baseY + b.y;
          let dx = bx - ax;
          let dy = by - ay;
          let distance = Math.hypot(dx, dy);
          const minimumDistance = a.radius + b.radius;

          if (distance >= minimumDistance) continue;

          if (distance < 0.001) {
            const angle = ((i + 1) * 1.73 + (j + 1) * 0.91) % (Math.PI * 2);
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            distance = 1;
          }

          const nx = dx / distance;
          const ny = dy / distance;
          const overlap = minimumDistance - distance;

          if (a.dragging && !b.dragging) {
            b.x += nx * overlap;
            b.y += ny * overlap;
            const impact = Math.max(0, a.vx * nx + a.vy * ny);
            const push = impact * 0.78 + overlap * 0.09 + 0.55;
            b.vx += nx * push + a.vx * 0.2;
            b.vy += ny * push + a.vy * 0.2;
            limitVelocity(b);
            clampBodyToBoard(b, true);
            continue;
          }

          if (b.dragging && !a.dragging) {
            a.x -= nx * overlap;
            a.y -= ny * overlap;
            const impact = Math.max(0, -(b.vx * nx + b.vy * ny));
            const push = impact * 0.78 + overlap * 0.09 + 0.55;
            a.vx -= nx * push - b.vx * 0.2;
            a.vy -= ny * push - b.vy * 0.2;
            limitVelocity(a);
            clampBodyToBoard(a, true);
            continue;
          }

          if (a.dragging && b.dragging) continue;

          const correction = overlap / 2;
          a.x -= nx * correction;
          a.y -= ny * correction;
          b.x += nx * correction;
          b.y += ny * correction;

          const relativeVelocity = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (relativeVelocity < 0) {
            const impulse = (-(1 + COLLISION_RESTITUTION) * relativeVelocity) / 2;
            a.vx -= impulse * nx;
            a.vy -= impulse * ny;
            b.vx += impulse * nx;
            b.vy += impulse * ny;
          }

          limitVelocity(a);
          limitVelocity(b);
          clampBodyToBoard(a, true);
          clampBodyToBoard(b, true);
        }
      }
    }
  };

  const measureBodies = () => {
    measureFrameId = 0;
    const boardRect = board.getBoundingClientRect();
    const styles = window.getComputedStyle(board);
    bounds = {
      left: boardRect.left + parsePixels(styles.paddingLeft),
      right: boardRect.right - parsePixels(styles.paddingRight),
      top: boardRect.top + parsePixels(styles.paddingTop),
      bottom: boardRect.bottom - parsePixels(styles.paddingBottom),
    };

    bodies.forEach((body) => {
      const rect = body.element.getBoundingClientRect();
      body.baseX = rect.left + rect.width / 2 - body.x;
      body.baseY = rect.top + rect.height / 2 - body.y;
      body.radius = Math.min(rect.width, rect.height) * 0.47;
      clampBodyToBoard(body, false);
    });

    resolveCollisions(1);
    renderAll();
  };

  const queueMeasure = () => {
    if (measureFrameId) return;
    measureFrameId = window.requestAnimationFrame(measureBodies);
  };

  const hasKineticMotion = () => {
    for (const body of bodies.values()) {
      if (body.dragging || Math.abs(body.vx) > 0.035 || Math.abs(body.vy) > 0.035) {
        return true;
      }
    }
    return false;
  };

  const tick = (now: number) => {
    frameId = 0;
    const delta = clamp((now - lastFrameTime) / FRAME_MS, 0.35, 2.2);
    lastFrameTime = now;
    const friction = Math.pow(reducedMotion ? 0.82 : 0.955, delta);

    bodies.forEach((body) => {
      if (body.dragging) return;

      body.x += body.vx * delta;
      body.y += body.vy * delta;
      body.vx *= friction;
      body.vy *= friction;

      if (Math.abs(body.vx) < 0.025) body.vx = 0;
      if (Math.abs(body.vy) < 0.025) body.vy = 0;
      clampBodyToBoard(body, true);
    });

    resolveCollisions(2);
    renderAll();

    if (hasKineticMotion()) {
      frameId = window.requestAnimationFrame(tick);
    }
  };

  const ensureAnimation = () => {
    if (frameId) return;
    lastFrameTime = performance.now();
    frameId = window.requestAnimationFrame(tick);
  };

  const endPointer = (cancelled = false) => {
    const current = pointer;
    if (!current) return;

    if (current.holdTimer !== null) window.clearTimeout(current.holdTimer);
    current.body.element.classList.remove('wl-cloud-item--pressed');

    if (current.active) {
      current.body.dragging = false;
      current.body.element.classList.remove('wl-cloud-item--dragging');
      board.removeAttribute('data-physics-active');
      suppressTarget = current.body.element;
      suppressClickUntil = performance.now() + 420;

      if (cancelled || reducedMotion) {
        current.body.vx = 0;
        current.body.vy = 0;
      } else {
        limitVelocity(current.body);
      }
      ensureAnimation();
    }

    pointer = null;
  };

  const activatePointer = (state: PointerDrag) => {
    if (pointer !== state || state.active || !state.body.element.isConnected) return;
    measureBodies();
    state.active = true;
    state.body.dragging = true;
    state.body.vx = 0;
    state.body.vy = 0;
    state.offsetX = state.lastX - (state.body.baseX + state.body.x);
    state.offsetY = state.lastY - (state.body.baseY + state.body.y);
    state.body.element.classList.remove('wl-cloud-item--pressed');
    state.body.element.classList.add('wl-cloud-item--dragging');
    board.setAttribute('data-physics-active', 'true');
    ensureAnimation();
  };

  const onPointerDown = (event: PointerEvent) => {
    if (pointer || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (!(event.target instanceof Element)) return;

    const button = event.target.closest<HTMLButtonElement>('.wl-cloud-bubble');
    const item = event.target.closest<HTMLElement>('.wl-cloud-item');
    if (!button || !item || item.parentElement !== board || button.disabled) return;

    const body = bodies.get(item);
    if (!body) return;
    measureBodies();

    const state: PointerDrag = {
      pointerId: event.pointerId,
      body,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: performance.now(),
      offsetX: 0,
      offsetY: 0,
      active: false,
      holdTimer: null,
    };

    item.classList.add('wl-cloud-item--pressed');
    state.holdTimer = window.setTimeout(() => activatePointer(state), HOLD_DELAY_MS);
    pointer = state;
  };

  const onPointerMove = (event: PointerEvent) => {
    const state = pointer;
    if (!state || event.pointerId !== state.pointerId) return;

    const now = performance.now();
    const previousX = state.lastX;
    const previousY = state.lastY;
    const elapsed = Math.max(5, now - state.lastTime);
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    state.lastTime = now;

    if (!state.active) {
      const distance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY);
      if (distance >= DRAG_DISTANCE_PX) activatePointer(state);
    }

    if (!state.active) return;
    event.preventDefault();

    const instantVx = ((event.clientX - previousX) / elapsed) * FRAME_MS;
    const instantVy = ((event.clientY - previousY) / elapsed) * FRAME_MS;
    state.body.vx = state.body.vx * 0.28 + instantVx * 0.72;
    state.body.vy = state.body.vy * 0.28 + instantVy * 0.72;
    limitVelocity(state.body);

    state.body.x = event.clientX - state.offsetX - state.body.baseX;
    state.body.y = event.clientY - state.offsetY - state.body.baseY;
    clampBodyToBoard(state.body, false);
    resolveCollisions(3);
    renderAll();
    ensureAnimation();
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!pointer || event.pointerId !== pointer.pointerId) return;
    endPointer(false);
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (!pointer || event.pointerId !== pointer.pointerId) return;
    endPointer(true);
  };

  const onClickCapture = (event: MouseEvent) => {
    if (
      performance.now() <= suppressClickUntil
      && suppressTarget
      && event.target instanceof Node
      && suppressTarget.contains(event.target)
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  const onContextMenu = (event: MouseEvent) => {
    if (event.target instanceof Element && event.target.closest('.wl-cloud-bubble')) {
      event.preventDefault();
    }
  };

  const resizeObserver = typeof ResizeObserver === 'undefined'
    ? null
    : new ResizeObserver(queueMeasure);

  const refreshBodies = () => {
    const items = [...board.children].filter(
      (child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains('wl-cloud-item'),
    );
    const activeElements = new Set(items);

    bodies.forEach((body, element) => {
      if (activeElements.has(element)) return;
      if (pointer?.body === body) endPointer(true);
      body.element.classList.remove(
        'wl-cloud-item--pressed',
        'wl-cloud-item--dragging',
        'wl-cloud-item--moving',
      );
      body.element.style.removeProperty('--wl-physics-x');
      body.element.style.removeProperty('--wl-physics-y');
      bodies.delete(element);
    });

    items.forEach((element) => {
      if (bodies.has(element)) return;
      const button = element.querySelector<HTMLButtonElement>('.wl-cloud-bubble');
      if (!button) return;
      bodies.set(element, {
        element,
        button,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        baseX: 0,
        baseY: 0,
        radius: 0,
        dragging: false,
      });
    });

    resizeObserver?.disconnect();
    resizeObserver?.observe(board);
    bodies.forEach((body) => resizeObserver?.observe(body.element));
    queueMeasure();
  };

  const mutationObserver = new MutationObserver(refreshBodies);
  mutationObserver.observe(board, { childList: true });

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onMotionPreferenceChange = (event: MediaQueryListEvent) => {
    reducedMotion = event.matches;
  };
  motionQuery.addEventListener?.('change', onMotionPreferenceChange);

  board.addEventListener('pointerdown', onPointerDown);
  board.addEventListener('click', onClickCapture, true);
  board.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);
  window.addEventListener('resize', queueMeasure, { passive: true });
  refreshBodies();

  return () => {
    endPointer(true);
    mutationObserver.disconnect();
    resizeObserver?.disconnect();
    motionQuery.removeEventListener?.('change', onMotionPreferenceChange);
    board.removeEventListener('pointerdown', onPointerDown);
    board.removeEventListener('click', onClickCapture, true);
    board.removeEventListener('contextmenu', onContextMenu);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
    window.removeEventListener('resize', queueMeasure);
    if (frameId) window.cancelAnimationFrame(frameId);
    if (measureFrameId) window.cancelAnimationFrame(measureFrameId);
    board.removeAttribute('data-physics-active');
    bodies.forEach((body) => {
      body.element.classList.remove(
        'wl-cloud-item--pressed',
        'wl-cloud-item--dragging',
        'wl-cloud-item--moving',
      );
      body.element.style.removeProperty('--wl-physics-x');
      body.element.style.removeProperty('--wl-physics-y');
    });
  };
}

export function WishlistBubblePhysics() {
  useEffect(() => {
    let mountedBoard: HTMLElement | null = null;
    let cleanupBoard: (() => void) | null = null;

    const attachToCurrentBoard = () => {
      const nextBoard = document.querySelector<HTMLElement>('.wishlist .wishlist-grid');
      if (nextBoard === mountedBoard) return;
      cleanupBoard?.();
      mountedBoard = nextBoard;
      cleanupBoard = nextBoard ? mountBubblePhysics(nextBoard) : null;
    };

    attachToCurrentBoard();
    const wishlistRoot = document.querySelector<HTMLElement>('.wishlist');
    const observer = new MutationObserver(attachToCurrentBoard);
    observer.observe(wishlistRoot ?? document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cleanupBoard?.();
    };
  }, []);

  return null;
}
