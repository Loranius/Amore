// ============================================================
// FreeLimitCard — вільний ліміт
// ------------------------------------------------------------
// 0 ₴ є валідним лімітом. Підтвердження/відхилення надсилає на сервер
// точний snapshot пропозиції, тому застарілий екран не затре нову суму.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { useCurrentUser } from '@/providers/AuthProvider';
import { Card } from '@/components/ui/Card';
import { fmtMoney, useFreeLimit, useFreeLimitMutations } from './useBudget';

const SLIDER_MIN = 0;
const SLIDER_MAX = 20000;
const SLIDER_STEP = 100;

export function FreeLimitCard() {
  const me = useCurrentUser();
  const { data: fl } = useFreeLimit();
  const { propose, confirm, reject } = useFreeLimitMutations();

  const limit = Number(fl?.limit_value ?? 0);
  const proposalValue = fl?.proposal_value === null || fl?.proposal_value === undefined
    ? null
    : Number(fl.proposal_value);
  const proposedBy = fl?.proposed_by ?? null;

  const [sliderVal, setSliderVal] = useState(limit);
  const dragging = useRef(false);

  // Синхронізуємо слайдер з лімітом — але не поки користувач його тягне.
  useEffect(() => {
    if (!dragging.current) setSliderVal(limit);
  }, [limit]);

  const incoming = proposalValue !== null && proposedBy && proposedBy !== me.name
    ? { value: proposalValue, proposedBy }
    : null;

  const stopDragging = () => {
    dragging.current = false;
  };

  return (
    <Card className="fin-card">
      <div className="fin-card-hdr">
        <span className="fin-card-title">💳 Вільний ліміт</span>
        <span className="fin-limit-current">{fmtMoney(limit)}</span>
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
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onBlur={stopDragging}
        onChange={(e) => setSliderVal(Number(e.target.value))}
      />
      <button
        type="button"
        className="btn fin-propose-btn"
        onClick={() => propose.mutate(sliderVal)}
        disabled={propose.isPending}
      >
        {propose.isPending ? 'Надсилаємо…' : `Запропонувати ${fmtMoney(sliderVal)}`}
      </button>

      {proposalValue !== null && proposedBy === me.name && (
        <p className="fin-hint fin-await">⏳ Очікуємо відповідь партнера на {fmtMoney(proposalValue)}</p>
      )}

      {incoming && (
        <div className="fin-proposal-panel visible">
          <p className="fin-proposal-text">
            {incoming.proposedBy} пропонує: {fmtMoney(incoming.value)}
          </p>
          <div className="fin-proposal-actions">
            <button
              type="button"
              className="btn"
              onClick={() => confirm.mutate(incoming)}
              disabled={confirm.isPending || reject.isPending}
            >
              ✓ Погодитись
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => reject.mutate(incoming)}
              disabled={confirm.isPending || reject.isPending}
            >
              ✕ Відхилити
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
