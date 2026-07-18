// ============================================================
// FreeLimitCard — вільний ліміт (порт renderFreeLimit/paintFreeLimit)
// ------------------------------------------------------------
// Слайдер пропонує суму; партнер бачить панель підтвердження. Позиція
// слайдера не «стрибає» під пальцем при realtime-оновленні (draggingRef).
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { useCurrentUser } from '@/providers/AuthProvider';
import { fmtMoney, useFreeLimit, useFreeLimitMutations } from './useBudget';

const SLIDER_MIN = 0;
const SLIDER_MAX = 20000;
const SLIDER_STEP = 100;

export function FreeLimitCard() {
  const me = useCurrentUser();
  const { data: fl } = useFreeLimit();
  const { propose, confirm, reject } = useFreeLimitMutations();

  const limit = fl?.limit_value ?? 0;
  const proposalValue = fl?.proposal_value ?? null;
  const proposedBy = fl?.proposed_by ?? null;

  const [sliderVal, setSliderVal] = useState(limit || 2000);
  const dragging = useRef(false);

  // Синхронізуємо слайдер з лімітом — але не поки користувач його тягне.
  useEffect(() => {
    if (!dragging.current) setSliderVal(limit || 2000);
  }, [limit]);

  // Пропозиція від ПАРТНЕРА (не від мене) → показуємо панель.
  const incoming = proposalValue !== null && proposedBy !== me.name ? proposalValue : null;

  return (
    <div className="fin-card">
      <div className="fin-card-hdr">
        <span className="fin-card-title">💳 Вільний ліміт</span>
        <span className="fin-limit-current">{limit > 0 ? fmtMoney(limit) : 'не встановлено'}</span>
      </div>
      <p className="fin-hint">Сума, яку кожен може витратити без узгодження.</p>

      <div className="fin-slider-display">{fmtMoney(sliderVal)}</div>
      <input
        id="free-limit-slider"
        name="freeLimit"
        type="range"
        className="fin-slider"
        min={SLIDER_MIN}
        max={SLIDER_MAX}
        step={SLIDER_STEP}
        value={sliderVal}
        onPointerDown={() => (dragging.current = true)}
        onPointerUp={() => (dragging.current = false)}
        onChange={(e) => setSliderVal(Number(e.target.value))}
      />
      <button
        type="button"
        className="btn fin-propose-btn"
        onClick={() => propose.mutate(sliderVal)}
        disabled={propose.isPending}
      >
        Запропонувати {fmtMoney(sliderVal)}
      </button>

      {proposalValue !== null && proposedBy === me.name && (
        <p className="fin-hint fin-await">⏳ Очікуємо відповідь партнера на {fmtMoney(proposalValue)}</p>
      )}

      {incoming !== null && (
        <div className="fin-proposal-panel visible">
          <p className="fin-proposal-text">
            {proposedBy} пропонує: {fmtMoney(incoming)}
          </p>
          <div className="fin-proposal-actions">
            <button type="button" className="btn" onClick={() => confirm.mutate(incoming)}>
              ✓ Погодитись
            </button>
            <button type="button" className="btn-secondary" onClick={() => reject.mutate()}>
              ✕ Відхилити
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
