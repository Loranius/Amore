// ============================================================
// Constructor — майстер конструктора страв (порт renderCulStep/Result)
// ------------------------------------------------------------
// Стан цілком у useCulinaryConstructor. Дії результату: в улюблені,
// в покупки, інший варіант, спочатку.
// ============================================================
import { ChevronLeftIcon, ChevronRightIcon, RefreshIcon } from '@/components/icons/UiIcon';
import { CartIcon, ClockIcon, HeartIcon, PotIcon } from '@/components/icons/NavIcon';
import { SparkIcon } from '@/components/icons/EventIcon';
import { useCulinaryConstructor } from './useCulinaryConstructor';
import { useDishMutations } from './useDishes';
import { Card } from '@/components/ui/Card';

export function Constructor() {
  const c = useCulinaryConstructor();
  const { saveFavorite, toShopping } = useDishMutations();

  if (c.status === 'loading') {
    return (
      <Card className="cul-loading">
        <div className="cul-loading-emoji" aria-hidden="true"><PotIcon size={30} /></div>
        <p className="cul-loading-text">Клод вигадує вам страву…</p>
        <p className="cul-step-hint">Аналізую смаки, підбираю інгредієнти з АТБ і Сільпо</p>
      </Card>
    );
  }

  if (c.status === 'error') {
    return (
      <Card className="cul-loading">
        <div className="cul-loading-emoji cul-loading-emoji--sad" aria-hidden="true"><PotIcon size={30} /></div>
        <p className="cul-loading-text">Не вийшло приготувати ідею</p>
        <p className="cul-step-hint">{c.error ?? 'Спробуй ще раз за хвилину'}</p>
        <button type="button" className="btn" onClick={c.generate}>
          Спробувати ще
        </button>
      </Card>
    );
  }

  if (c.status === 'result' && c.dish) {
    const d = c.dish;
    const meta = [d.cuisine, d.time_minutes ? `${d.time_minutes} хв` : '', d.difficulty]
      .filter(Boolean)
      .join(' · ');
    return (
      <Card>
        <p className="discover-title">{d.title}</p>
        {meta && (
          <p className="discover-meta">
            {d.time_minutes ? <ClockIcon size={14} /> : null}
            <span>{meta}</span>
          </p>
        )}
        {d.description && <p className="cul-desc">{d.description}</p>}
        {d.tools && d.tools.length > 0 && (
          <p className="cul-tools">
            <PotIcon size={15} />
            <span>{d.tools.join(', ')}</span>
          </p>
        )}

        <p className="rcp-view-subtitle">
          Інгредієнти {d.servings ? `(на ${d.servings} порції)` : ''}
        </p>
        <div className="rcp-view-ings">
          {d.ingredients.map((i, idx) => (
            <div key={idx} className="rcp-view-ing">
              <span className="rcp-view-ing-name">{i.name}</span>
              <span className="rcp-view-ing-dots" />
              <span className="rcp-view-ing-amount">{[i.amount, i.unit].filter(Boolean).join(' ')}</span>
            </div>
          ))}
        </div>

        <p className="rcp-view-subtitle">Приготування</p>
        <ol className="rcp-view-steps">
          {(d.steps ?? []).map((s, idx) => (
            <li key={idx}>{s}</li>
          ))}
        </ol>

        {/* `.btn btn-ghost` замість `.btn-secondary`: той самий словник
            тихої дії, що й у решті порталу (ADR-0048). */}
        <div className="discover-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => saveFavorite.mutate({ dish: d, answers: c.answers })}
          >
            <HeartIcon size={16} />
            <span>В улюблені</span>
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => toShopping.mutate(d.ingredients)}
          >
            <CartIcon size={16} />
            <span>В покупки</span>
          </button>
        </div>
        <div className="discover-actions">
          <button type="button" className="btn btn-ghost" onClick={c.generate}>
            <RefreshIcon size={16} />
            <span>Інший варіант</span>
          </button>
          <button type="button" className="btn btn-ghost" onClick={c.reset}>
            <SparkIcon size={16} />
            <span>Спочатку</span>
          </button>
        </div>
      </Card>
    );
  }

  // status === 'wizard'
  const step = c.current;
  return (
    <Card>
      <div className="cul-progress">
        {c.steps.map((_, i) => (
          <span key={i} className={`cul-progress-dot${i <= c.step ? ' filled' : ''}`} />
        ))}
      </div>
      <p className="cul-step-title">{step.title}</p>
      <p className="cul-step-hint">{step.hint}</p>

      <div className="cul-chips">
        {step.options.map((o) => (
          <button
            key={o}
            type="button"
            className={`cul-chip${c.chosen.includes(o) ? ' active' : ''}`}
            onClick={() => c.select(o)}
          >
            {o}
          </button>
        ))}
      </div>

      <div className="cul-nav">
        {c.step > 0 && (
          <button type="button" className="btn btn-ghost" onClick={c.back}>
            <ChevronLeftIcon size={16} />
            <span>Назад</span>
          </button>
        )}
        <button
          type="button"
          className="btn"
          disabled={!c.canNext}
          onClick={() => (c.isLast ? c.generate() : c.next())}
        >
          {c.isLast ? (
            <>
              <SparkIcon size={16} />
              <span>Створити страву</span>
            </>
          ) : (
            <>
              <span>Далі</span>
              <ChevronRightIcon size={16} />
            </>
          )}
        </button>
      </div>
    </Card>
  );
}
