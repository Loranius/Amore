// ============================================================
// ArtifactFormSection — «Вигляд» об'єкта пари (ADR-0237 §7, п. 1)
// ------------------------------------------------------------
// Власник: «вигляд можна буде змінити в налаштуваннях вже зареєстрованої
// пари». Показуються форми лише того виду, який обрала пара: чужі форми
// тут — вибір, якого в пари немає.
//
// Форма — лише малюнок. Підпис під вибором каже це прямо, щоб перемикання
// не лякало: історія пари й те, що з неї виросло, лишаються тими самими.
// ============================================================
import { useState } from 'react';
import type { CrystalForm } from '@/engine/species/crystalV2/geometry';
import type { TreeForm } from '@/engine/species/treeV2/geometry';
import { useArtifactForms, useSaveArtifactForm } from '@/features/world/artifactForms';
import { useArtifactWorld } from '@/features/world/artifactWorldContext';

const CRYSTAL_LABELS: Record<CrystalForm, string> = { druse: 'Друза', stalagmite: 'Сталагміт' };
const TREE_LABELS: Record<TreeForm, string> = { oak: 'Дуб', spruce: 'Ялина', sakura: 'Сакура' };

export function ArtifactFormSection() {
  // Той вид, що зараз на головній: у пари — її обраний, у власника — той,
  // на який він перемкнув (ADR-0234). Форма стосується саме його.
  const species = useArtifactWorld().artifact;
  const forms = useArtifactForms();
  const save = useSaveArtifactForm();
  const [failed, setFailed] = useState(false);

  const report = (result: { ok: boolean }) => setFailed(!result.ok);
  const chooseCrystal = async (form: CrystalForm) => report(await save('crystal', form));
  const chooseTree = async (form: TreeForm) => report(await save('tree', form));

  return (
    <>
      <section className="settings-section" aria-labelledby="artifact-form-title">
        <div className="settings-section-title" id="artifact-form-title">Вигляд</div>
        {species === 'reef' ? (
          <p className="settings-section-desc">
            Вулкан один на всіх, зате з роками в його зграї з'являються нові риби — на п'ятий, десятий і двадцятий рік разом.
          </p>
        ) : (
          <>
            <div
              className={`settings-switch${species === 'tree' ? ' settings-switch--3' : ''}`}
              role="group"
              aria-label={species === 'tree' ? 'Вигляд дерева' : 'Вигляд кристала'}
            >
              {species === 'tree'
                ? (Object.keys(TREE_LABELS) as TreeForm[]).map((form) => (
                  <button
                    key={form}
                    type="button"
                    className={`settings-switch-btn${forms.tree === form ? ' is-on' : ''}`}
                    aria-pressed={forms.tree === form}
                    onClick={() => void chooseTree(form)}
                  >
                    {TREE_LABELS[form]}
                  </button>
                ))
                : (Object.keys(CRYSTAL_LABELS) as CrystalForm[]).map((form) => (
                  <button
                    key={form}
                    type="button"
                    className={`settings-switch-btn${forms.crystal === form ? ' is-on' : ''}`}
                    aria-pressed={forms.crystal === form}
                    onClick={() => void chooseCrystal(form)}
                  >
                    {CRYSTAL_LABELS[form]}
                  </button>
                ))}
            </div>
            <p className="settings-section-desc">Змінюється лише вигляд — усе, що виросло з вашої історії, лишається.</p>
          </>
        )}
        {failed && <p className="partner-invite-problem" role="alert">Не вдалося зберегти вигляд. Спробуй ще раз.</p>}
      </section>
      <div className="settings-divider" />
    </>
  );
}
