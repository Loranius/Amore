import { useEffect } from 'react';

type BubbleBody = {
  element: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
  radius: number;
  mass: number;
  dragging: boolean;
};

type PointerSample = {
  x: number;
  y: number;
  time: number;
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
  samples: PointerSample[];
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

const MAX_SPEED = 42;
const MAX_SUBSTEPS = 5;
const WALL_RESTITUTION = 0.89;
const WALL_TANGENT_RETENTION = 0.995;
const COLLISION_RESTITUTION = 0.94;
const DRAG_COLLISION_RESTITUTION = 0.08;
const POSITION_CORRECTION = 0.86;
const POSITION_SLOP = 0.12;

const AIR_DAMPING_PER_FRAME = 0.996;
const ROLLING_RESISTANCE_PER_FRAME = 0.018;
const REDUCED_MOTION_DAMPING_PER_FRAME = 0.86;
const REDUCED_MOTION_RESISTANCE_PER_FRAME = 0.11;
const SLEEP_SPEED = 0.035;
const MOVING_CLASS_SPEED = 0.12;

const THROW_SPEED_MULTIPLIER = 1.16;
const THROW_SAMPLE_WINDOW_MS = 110;
const THROW_IDLE_CUTOFF_MS = 145;
const MAX_POINTER_SAMPLES = 12;

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

function inverseMass(body: BubbleBody): number {
  return body.dragging ? 0 : 1 / Math.max(body.mass, 0.0001);
}

function recordPointerSample(state: PointerDrag, x: number, y: number, time: number): void {
  state.lastX = x;
  state.lastY = y;
  state.lastTime = time;
  state.samples.push({ x, y, time });

  const oldestAllowed = time - THROW_SAMPLE_WINDOW_MS * 1.5;
  while (state.samples.length > 2 && state.samples[0]!.time < oldestAllowed) {
    state.samples.shift();
  }
  if (state.samples.length > MAX_POINTER_SAMPLES) {
    state.samples.splice(0, state.samples.length - MAX_POINTER_SAMPLES);
  }
}

function estimateLaunchVelocity(state: PointerDrag, now: number): { vx: number; vy: number } {
  const recent = state.samples.filter((sample) => now - sample.time <= THROW_SAMPLE_WINDOW_MS);
  const first = recent[0];
  const last = recent.at(-1);
  const idleTime = Math.max(0, now - state.lastTime);
  const idleFactor = clamp(1 - idleTime / THROW_IDLE_CUTOFF_MS, 0, 1);

  if (!first || !last || last.time - first.time < 8) {
    return {
      vx: state.body.vx * idleFactor,
      vy: state.body.vy * idleFactor,
    };
  }

  const elapsed = last.time - first.time;
  const sampledVx = ((last.x - first.x) / elapsed) * FRAME_MS;
  const sampledVy = ((last.y - first.y) / elapsed) * FRAME_MS;

  return {
    vx: (state.body.vx * 0.3 + sampledVx * 0.7) * THROW_SPEED_MULTIPLIER * idleFactor,
    vy: (state.body.vy * 0.3 + sampledVy * 0.7) * THROW_SPEED_MULTIPLIER * idleFactor,
  };
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
      body.dragging || Math.hypot(body.vx, body.vy) > MOVING_CLASS_SPEED,
    );
  };

  const renderAll = () => {
    bodies.forEach(renderBody);
  };

  const clampBodyToBoard = (body: BubbleBody, bounce: boolean) => {
    const gutter = Math.min(10, body.radius * 0.075);
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
      if (bounce && body.vx < 0) {
        body.vx = Math.abs(body.vx) * WALL_RESTITUTION;
        body.vy *= WALL_TANGENT_RETENTION;
      }
    } else if (body.x > maxX) {
      body.x = maxX;
      if (bounce && body.vx > 0) {
        body.vx = -Math.abs(body.vx) * WALL_RESTITUTION;
        body.vy *= WALL_TANGENT_RETENTION;
      }
    }

    if (body.y < minY) {
      body.y = minY;
      if (bounce && body.vy < 0) {
        body.vy = Math.abs(body.vy) * WALL_RESTITUTION;
        body.vx *= WALL_TANGENT_RETENTION;
      }
    } else if (body.y > maxY) {
      body.y = maxY;
      if (bounce && body.vy > 0) {
        body.vy = -Math.abs(body.vy) * WALL_RESTITUTION;
        body.vx *= WALL_TANGENT_RETENTION;
      }
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
          const inverseMassA = inverseMass(a);
          const inverseMassB = inverseMass(b);
          const inverseMassSum = inverseMassA + inverseMassB;

          if (inverseMassSum <= 0) continue;

          const correction = Math.max(overlap - POSITION_SLOP, 0)
            * POSITION_CORRECTION
            / inverseMassSum;
          a.x -= nx * correction * inverseMassA;
          a.y -= ny * correction * inverseMassA;
          b.x += nx * correction * inverseMassB;
          b.y += ny * correction * inverseMassB;

          const relativeVx = b.vx - a.vx;
          const relativeVy = b.vy - a.vy;
          const velocityAlongNormal = relativeVx * nx + relativeVy * ny;

          if (velocityAlongNormal < -0.001) {
            const restitution = a.dragging || b.dragging
              ? DRAG_COLLISION_RESTITUTION
              : COLLISION_RESTITUTION;
            const impulse = (-(1 + restitution) * velocityAlongNormal) / inverseMassSum;
            const impulseX = impulse * nx;
            const impulseY = impulse * ny;

            a.vx -= impulseX * inverseMassA;
            a.vy -= impulseY * inverseMassA;
            b.vx += impulseX * inverseMassB;
            b.vy += impulseY * inverseMassB;
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
      body.mass = Math.pow(Math.max(body.radius, 1), 1.35);
      clampBodyToBoard(body, false);
    });

    resolveCollisions(2);
    renderAll();
  };

  const queueMeasure = () => {
    if (measureFrameId) return;
    measureFrameId = window.requestAnimationFrame(measureBodies);
  };

  const hasKineticMotion = () => {
    for (const body of bodies.values()) {
      if (body.dragging || Math.hypot(body.vx, body.vy) > SLEEP_SPEED) {
        return true;
      }
    }
    return false;
  };

  const applyRollingResistance = (body: BubbleBody, delta: number) => {
    if (body.dragging) return;

    const damping = Math.pow(
      reducedMotion ? REDUCED_MOTION_DAMPING_PER_FRAME : AIR_DAMPING_PER_FRAME,
      delta,
    );
    body.vx *= damping;
    body.vy *= damping;

    const speed = Math.hypot(body.vx, body.vy);
    if (speed <= SLEEP_SPEED) {
      body.vx = 0;
      body.vy = 0;
      return;
    }

    const resistance = (
      reducedMotion ? REDUCED_MOTION_RESISTANCE_PER_FRAME : ROLLING_RESISTANCE_PER_FRAME
    ) * delta;
    const nextSpeed = Math.max(0, speed - resistance);

    if (nextSpeed <= SLEEP_SPEED) {
      body.vx = 0;
      body.vy = 0;
      return;
    }

    const ratio = nextSpeed / speed;
    body.vx *= ratio;
    body.vy *= ratio;
  };

  const tick = (now: number) => {
    frameId = 0;
    const delta = clamp((now - lastFrameTime) / FRAME_MS, 0.35, 2.2);
    lastFrameTime = now;

    let maximumSpeed = 0;
    let smallestRadius = Number.POSITIVE_INFINITY;
    bodies.forEach((body) => {
      if (!body.dragging) maximumSpeed = Math.max(maximumSpeed, Math.hypot(body.vx, body.vy));
      if (body.radius > 0) smallestRadius = Math.min(smallestRadius, body.radius);
    });

    const safeRadius = Number.isFinite(smallestRadius) ? smallestRadius : 32;
    const substeps = clamp(
      Math.ceil((maximumSpeed * delta) / Math.max(10, safeRadius * 0.42)),
      1,
      MAX_SUBSTEPS,
    );
    const stepDelta = delta / substeps;

    for (let step = 0; step < substeps; step += 1) {
      bodies.forEach((body) => {
        if (body.dragging) return;
        body.x += body.vx * stepDelta;
        body.y += body.vy * stepDelta;
        clampBodyToBoard(body, true);
      });
      resolveCollisions(2);
    }

    bodies.forEach((body) => applyRollingResistance(body, delta));
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
      const releaseTime = performance.now();
      current.body.dragging = false;
      current.body.element.classList.remove('wl-cloud-item--dragging');
      board.removeAttribute('data-physics-active');
      suppressTarget = current.body.element;
      suppressClickUntil = releaseTime + 420;

      if (cancelled || reducedMotion) {
        current.body.vx = 0;
        current.body.vy = 0;
      } else {
        const launch = estimateLaunchVelocity(current, releaseTime);
        current.body.vx = launch.vx;
        current.body.vy = launch.vy;
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

    const now = performance.now();
    const state: PointerDrag = {
      pointerId: event.pointerId,
      body,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: now,
      offsetX: 0,
      offsetY: 0,
      active: false,
      holdTimer: null,
      samples: [{ x: event.clientX, y: event.clientY, time: now }],
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
    const previousTime = state.lastTime;
    const elapsed = Math.max(5, now - previousTime);
    recordPointerSample(state, event.clientX, event.clientY, now);

    if (!state.active) {
      const distance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY);
      if (distance >= DRAG_DISTANCE_PX) activatePointer(state);
    }

    if (!state.active) return;
    event.preventDefault();

    const instantVx = ((event.clientX - previousX) / elapsed) * FRAME_MS;
    const instantVy = ((event.clientY - previousY) / elapsed) * FRAME_MS;
    state.body.vx = state.body.vx * 0.18 + instantVx * 0.82;
    state.body.vy = state.body.vy * 0.18 + instantVy * 0.82;
    limitVelocity(state.body);

    state.body.x = event.clientX - state.offsetX - state.body.baseX;
    state.body.y = event.clientY - state.offsetY - state.body.baseY;
    clampBodyToBoard(state.body, false);
    resolveCollisions(4);
    renderAll();
    ensureAnimation();
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!pointer || event.pointerId !== pointer.pointerId) return;
    const releaseDistance = Math.hypot(
      event.clientX - pointer.lastX,
      event.clientY - pointer.lastY,
    );
    if (releaseDistance > 0.5) {
      recordPointerSample(pointer, event.clientX, event.clientY, performance.now());
    }
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
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        baseX: 0,
        baseY: 0,
        radius: 0,
        mass: 1,
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
