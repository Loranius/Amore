import { useEffect, useRef } from 'react';
import type { WorldMotionMode } from './sceneDirector';

// ============================================================
// What the interface is asking of the world right now (§27).
// ------------------------------------------------------------
// Returned through a ref rather than state on purpose. This is read once per
// frame inside the render loop; making it state would re-render the whole
// scene subtree every time the couple scrolls a list, which is precisely the
// cost §43 asks us not to pay for something the camera reads and the DOM does
// not.
// ============================================================

/** How long after the last touch, scroll or keystroke the world settles again. */
const INTERACTION_LINGER_MS = 1500;

type RequestedMode = Exclude<WorldMotionMode, 'navigation'>;

/**
 * Live motion mode, as a ref the render loop can read.
 *
 * Priority is fixed and not a preference: reduced motion is an accessibility
 * setting and outranks everything; an open modal means the world is behind a
 * sheet and has no business moving; interaction means a finger or a keyboard is
 * busy. Only when none of those hold is the world idle.
 */
export function useWorldMotionMode(): { current: RequestedMode } {
  const mode = useRef<RequestedMode>('idle');
  const reduced = useRef(false);
  const modal = useRef(false);
  const lastInteraction = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const resolve = () => {
      if (reduced.current) mode.current = 'reduced';
      else if (modal.current) mode.current = 'modal';
      else if (performance.now() - lastInteraction.current < INTERACTION_LINGER_MS) {
        mode.current = 'interaction';
      } else mode.current = 'idle';
    };

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onQuery = () => { reduced.current = query.matches; resolve(); };
    onQuery();
    query.addEventListener('change', onQuery);

    // Every sheet in this app already marks itself `aria-modal="true"` — that
    // is the accessible contract for "the rest of the page is inert", so it is
    // also the honest signal for "the world is not being looked at". Watching
    // the DOM rather than adding a provider means a module cannot forget to
    // report itself.
    //
    // The presence of the attribute is not enough, and that was measured, not
    // guessed: `MoreMenu` stays mounted the whole session and only marks its
    // overlay `aria-hidden` when closed. Querying the attribute alone put the
    // live portal in `modal` mode permanently, and the world never moved on
    // its own at all. So a sheet counts as open only when it is actually
    // exposed — which is the same contract, read properly.
    const readModal = () => {
      const open = Array.from(document.querySelectorAll('[aria-modal="true"]'))
        .some((sheet) => sheet.closest('[aria-hidden="true"]') === null
          && sheet.getClientRects().length > 0);
      if (open !== modal.current) { modal.current = open; resolve(); }
    };
    readModal();
    const observer = new MutationObserver(readModal);
    observer.observe(document.body, { childList: true, subtree: true });

    const touched = () => {
      lastInteraction.current = performance.now();
      resolve();
    };
    const events: readonly (keyof WindowEventMap)[] = [
      'scroll', 'wheel', 'keydown', 'pointerdown', 'touchmove',
    ];
    for (const event of events) {
      window.addEventListener(event, touched, { passive: true, capture: true });
    }

    // The linger has to expire on its own: the last scroll event is also the
    // last event, so nothing else would ever put the world back to idle.
    const tick = window.setInterval(resolve, 250);

    return () => {
      query.removeEventListener('change', onQuery);
      observer.disconnect();
      for (const event of events) {
        window.removeEventListener(event, touched, { capture: true });
      }
      window.clearInterval(tick);
    };
  }, []);

  return mode;
}
