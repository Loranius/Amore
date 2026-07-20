// ============================================================
// Constructor — майстер конструктора страв (порт renderCulStep/Result)
// ------------------------------------------------------------
// Стан цілком у useCulinaryConstructor. Дії результату: в улюблені,
// в покупки, інший варіант, спочатку.
// ============================================================
import { useCulinaryConstructor } from './useCulinaryConstructor';
import { useDishMutations } from './useDishes';
import { Card } from '@/components/ui/Card';

export function Constructor() {
  const c = useCulinaryConstructor();
  const { saveFavorite, toShopping } = useDishMutations();

  if (c.status === 'loading') {
    return (
      <Card className="cul-loading">
        <div className="cul-loading-emoji">👨‍🍳</div>
        <p className="cul-loading-text">Клод вигадує вам страву…</p>
        <p className="cul-step-hint">Аналізую смаки, підбираю інгредієнти з АТБ і Сільпо</p>
      </Card>
    );
  }

  if (c.status === 'error') {
    return (
      <Card className="cul-loading">
        <div className="cul-loading-emoji">😔</div>
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
    const meta = [d.cuisine, d.time_minutes ? `⏱ ${d.time_minutes} хв` : '', d.difficulty]
      .filter(Boolean)
      .join(' · ');
    return (
      <Card>
        <p className="discover-title">{d.title}</p>
        {meta && <p className="discover-meta">{meta}</p>}
        {d.description && <p className="cul-desc">{d.description}</p>}
        {d.tools && d.tools.length > 0 && <p className="cul-tools">🍳 {d.tools.join(', ')}</p>}

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

        <div className="discover-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => saveFavorite.mutate({ dish: d, answers: c.answers })}
          >
            ❤️ В улюблені
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => toShopping.mutate(d.ingredients)}
          >
            🛒 В покупки
          </button>
        </div>
        <div className="discover-actions">
          <button type="button" className="btn-secondary" onClick={c.generate}>
            🔁 Інший варіант
          </button>
          <button type="button" className="btn-secondary" onClick={c.reset}>
            ✨ Спочатку
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
          <button type="button" className="btn-secondary" onClick={c.back}>
            ‹ Назад
          </button>
        )}
        <button
          type="button"
          className="btn"
          disabled={!c.canNext}
          onClick={() => (c.isLast ? c.generate() : c.next())}
        >
          {c.isLast ? '🔮 Створити страву' : 'Далі ›'}
        </button>
      </div>
    </Card>
  );
}
