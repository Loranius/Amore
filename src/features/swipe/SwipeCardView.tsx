// ============================================================
// SwipeCardView — картка на framer-motion (заміна pointer-events swipe.js)
// ------------------------------------------------------------
// Драг через framer-motion замість ручних touch/mouse-обробників.
// Напрям визначається за офсетом/швидкістю; логіка та пороги — як у
// старому attachTouch (вертикаль домінує над горизонталлю; тап без
// руху → деталі). up=Подивились · down=Пропустити · left=В планах ·
// right=Дивимось.
// ============================================================
import { useState } from 'react';
import { motion, useMotionValue, useTransform, animate, type PanInfo } from 'framer-motion';
import type { SwipeCard, SwipeDirection } from '@/types';

const OFFSET_T = 80; // поріг зриву (px), як старий T
const VELOCITY_T = 500; // або достатня швидкість флику

interface SwipeCardViewProps {
  card: SwipeCard;
  /** true лише для верхньої (інтерактивної) картки. */
  active: boolean;
  /** Позиція від верху (0 = верхня) — для масштабу/зсуву в стеку. */
  depth: number;
  onSwipe: (card: SwipeCard, dir: SwipeDirection) => void;
  onTap: (card: SwipeCard) => void;
}

export function SwipeCardView({ card, active, depth, onSwipe, onTap }: SwipeCardViewProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [leaving, setLeaving] = useState(false);

  // Оберт залежить від горизонтального зсуву (лише коли горизонталь домінує).
  const rotate = useTransform<number, number>([x, y], ([lx, ly]) =>
    Math.abs(ly) > Math.abs(lx) ? 0 : lx * 0.06,
  );

  // Прозорості оверлеїв за напрямом (0..0.6).
  const upO = useTransform(y, [-150, -40], [0.6, 0]);
  const downO = useTransform(y, [40, 150], [0, 0.6]);
  const leftO = useTransform(x, [-150, -40], [0.6, 0]);
  const rightO = useTransform(x, [40, 150], [0, 0.6]);

  const flyOut = (dir: SwipeDirection) => {
    setLeaving(true);
    const target =
      dir === 'up'
        ? { x: 0, y: -window.innerHeight }
        : dir === 'down'
          ? { x: 0, y: window.innerHeight }
          : dir === 'left'
            ? { x: -window.innerWidth, y: 0 }
            : { x: window.innerWidth, y: 0 };
    animate(x, target.x, { duration: 0.35 });
    animate(y, target.y, { duration: 0.35 }).then(() => onSwipe(card, dir));
  };

  const onDragEnd = (_e: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    const horiz = Math.abs(offset.x) > Math.abs(offset.y);
    let dir: SwipeDirection | null = null;
    if (horiz) {
      if (offset.x < -OFFSET_T || velocity.x < -VELOCITY_T) dir = 'left';
      else if (offset.x > OFFSET_T || velocity.x > VELOCITY_T) dir = 'right';
    } else {
      if (offset.y < -OFFSET_T || velocity.y < -VELOCITY_T) dir = 'up';
      else if (offset.y > OFFSET_T || velocity.y > VELOCITY_T) dir = 'down';
    }
    if (dir) flyOut(dir);
    else {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
      animate(y, 0, { type: 'spring', stiffness: 400, damping: 30 });
    }
  };

  // Картки за верхньою — злегка зменшені й зсунуті вниз.
  const stackStyle =
    depth === 0
      ? {}
      : { scale: 1 - depth * 0.05, y: depth * 10, transition: 'transform 0.3s ease' };

  return (
    <motion.div
      className="swipe-card"
      style={{ x, y, rotate, zIndex: 10 - depth, ...(active ? {} : stackStyle) }}
      drag={active && !leaving}
      dragSnapToOrigin={false}
      dragElastic={0.6}
      onDragEnd={active ? onDragEnd : undefined}
      onClick={() => {
        // Клік без перетягування (x≈0) → деталі.
        if (active && Math.abs(x.get()) < 6 && Math.abs(y.get()) < 6) onTap(card);
      }}
    >
      {card.poster_path ? (
        <img className="swipe-poster" src={card.poster_path} alt="" loading="lazy" draggable={false} />
      ) : (
        <div className="swipe-poster-placeholder">🎬</div>
      )}
      <div className="swipe-card-gradient" />
      <div className="swipe-card-info">
        <p className="swipe-card-title">{card.title}</p>
        <div className="swipe-card-meta">
          {card.year && <span>{card.year}</span>}
          {card.rating && <span>★ {card.rating}</span>}
        </div>
      </div>

      {active && (
        <>
          <motion.div className="swipe-overlay swipe-overlay-up" style={{ opacity: upO }}>
            ✅ Подивились
          </motion.div>
          <motion.div className="swipe-overlay swipe-overlay-down" style={{ opacity: downO }}>
            ✕ Пропустити
          </motion.div>
          <motion.div className="swipe-overlay swipe-overlay-left" style={{ opacity: leftO }}>
            🕐 В планах
          </motion.div>
          <motion.div className="swipe-overlay swipe-overlay-right" style={{ opacity: rightO }}>
            ▶ Дивимось
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
