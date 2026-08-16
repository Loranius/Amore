import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useArtifactWorld } from '@/features/world/artifactWorldContext';
import {
  EVOLUTION_SANDBOX_DAYS_PER_YEAR,
  EVOLUTION_SANDBOX_MAX_RELATIONSHIP_DAYS,
  useEvolutionSandbox,
  type EvolutionSandboxArtifact,
  type EvolutionSandboxValues,
} from './evolutionSandbox';
import './evolutionConstructor.css';

const ARTIFACT_LABEL: Record<EvolutionSandboxArtifact, string> = {
  crystal: 'Кристал',
  tree: 'Дерево',
  reef: 'Риф',
};

const CONTROL_DEFINITIONS: readonly {
  key: Exclude<keyof EvolutionSandboxValues, 'relationshipDays'>;
  label: string;
  hint: string;
  max: number;
  step: number;
  artifacts: readonly EvolutionSandboxArtifact[];
}[] = [
  {
    key: 'calendarEvents',
    label: 'Важливі події',
    hint: 'Календар / події, які потрапляють в Evolution Engine',
    max: 120,
    step: 1,
    artifacts: ['crystal', 'tree', 'reef'],
  },
  {
    key: 'completedPlans',
    label: 'Виконані плани',
    hint: 'Завершені плани пари',
    max: 180,
    step: 1,
    artifacts: ['crystal', 'tree', 'reef'],
  },
  {
    key: 'fulfilledWishes',
    label: 'Виконані бажання',
    hint: 'Вішлист — виконані бажання',
    max: 240,
    step: 1,
    artifacts: ['crystal', 'tree', 'reef'],
  },
  {
    key: 'visitedPlaces',
    label: 'Відвідані місця',
    hint: 'Позначені як відвідані місця на мапі',
    max: 240,
    step: 1,
    artifacts: ['crystal', 'tree', 'reef'],
  },
  {
    key: 'memories',
    label: 'Фото / спогади',
    hint: 'Кількість записів у модулі спогадів',
    max: 1_000,
    step: 1,
    artifacts: ['crystal', 'tree', 'reef'],
  },
  {
    key: 'finishedMedia',
    label: 'Переглянуте медіа',
    hint: 'Фільми / серіали зі статусом «переглянуто»',
    max: 500,
    step: 1,
    artifacts: ['crystal', 'tree', 'reef'],
  },
  {
    key: 'sharedDaysOff',
    label: 'Спільні вихідні',
    hint: 'Дні, коли обидва партнери мали вихідний',
    max: 1_500,
    step: 1,
    artifacts: ['crystal', 'reef'],
  },
];

function RangeControl({
  label,
  hint,
  value,
  min = 0,
  max,
  step,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min?: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="evolution-constructor__control">
      <span className="evolution-constructor__control-head">
        <span>
          <strong>{label}</strong>
          <small>{hint}</small>
        </span>
        <output>{value.toLocaleString('uk-UA')}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function EvolutionConstructor() {
  const me = useCurrentUser();
  const { pathname } = useLocation();
  const { artifact } = useArtifactWorld();
  const sandbox = useEvolutionSandbox();
  const [open, setOpen] = useState(false);

  const artifactKey = artifact as EvolutionSandboxArtifact;
  const isDima = me.name === 'Діма';
  const visible = isDima && pathname === '/';
  const years = Math.min(
    50,
    Math.round((sandbox.values.relationshipDays / EVOLUTION_SANDBOX_DAYS_PER_YEAR) * 10) / 10,
  );
  const wholeYears = Math.min(50, Math.round(years));
  const controls = useMemo(
    () => CONTROL_DEFINITIONS.filter((control) => control.artifacts.includes(artifactKey)),
    [artifactKey],
  );

  useEffect(() => {
    if (!visible) setOpen(false);
  }, [visible]);

  useEffect(() => {
    if (open && !sandbox.enabled) sandbox.prepare(artifactKey);
  }, [artifactKey, open, sandbox]);

  if (!visible) return null;

  const openConstructor = () => {
    sandbox.prepare(artifactKey);
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className={`evolution-constructor-fab${sandbox.enabled ? ' is-active' : ''}`}
        onClick={openConstructor}
        aria-label="Відкрити конструктор еволюції"
        aria-expanded={open}
      >
        <span />
        <span />
        <span />
      </button>

      {open && (
        <section
          className="evolution-constructor"
          role="dialog"
          aria-modal="false"
          aria-label="Конструктор еволюції"
        >
          <header className="evolution-constructor__header">
            <div>
              <p>Конструктор еволюції</p>
              <h2>{ARTIFACT_LABEL[artifactKey]}</h2>
            </div>
            <button
              type="button"
              className="evolution-constructor__close"
              onClick={() => setOpen(false)}
              aria-label="Закрити конструктор"
            >
              ×
            </button>
          </header>

          <div className={`evolution-constructor__mode${sandbox.enabled ? ' is-active' : ''}`}>
            <span>{sandbox.enabled ? 'Sandbox активний' : 'Реальні дані'}</span>
            <small>
              {sandbox.enabled
                ? 'Зміни існують тільки в цій сесії та не записуються в базу.'
                : 'Перший рух повзунка увімкне тимчасову симуляцію.'}
            </small>
          </div>

          <div className="evolution-constructor__scroll">
            <div className="evolution-constructor__section">
              <div className="evolution-constructor__section-title">
                <span>Час разом</span>
                <strong>{years.toLocaleString('uk-UA')} р.</strong>
              </div>

              <RangeControl
                label="Днів разом"
                hint="Точний вік стосунків для Growth / Evolution Engine"
                value={sandbox.values.relationshipDays}
                max={EVOLUTION_SANDBOX_MAX_RELATIONSHIP_DAYS}
                step={1}
                onChange={(value) => sandbox.setValue('relationshipDays', value)}
              />

              <RangeControl
                label="Років разом"
                hint="Макро-повзунок 0–50 років; синхронізує загальну кількість днів"
                value={wholeYears}
                max={50}
                step={1}
                onChange={sandbox.setRelationshipYears}
              />
            </div>

            <div className="evolution-constructor__section">
              <div className="evolution-constructor__section-title">
                <span>Модулі, що впливають</span>
                <strong>{controls.length}</strong>
              </div>

              {controls.map((control) => (
                <RangeControl
                  key={control.key}
                  label={control.label}
                  hint={control.hint}
                  value={sandbox.values[control.key]}
                  max={control.key === 'sharedDaysOff'
                    ? Math.min(control.max, Math.max(0, sandbox.values.relationshipDays + 1))
                    : control.max}
                  step={control.step}
                  onChange={(value) => sandbox.setValue(control.key, value)}
                />
              ))}
            </div>
          </div>

          <footer className="evolution-constructor__footer">
            <button
              type="button"
              className="evolution-constructor__reset"
              onClick={() => sandbox.reset(artifactKey)}
              disabled={!sandbox.enabled}
            >
              Повернути реальні дані
            </button>
            <button
              type="button"
              className="evolution-constructor__done"
              onClick={() => setOpen(false)}
            >
              Готово
            </button>
          </footer>
        </section>
      )}
    </>
  );
}
