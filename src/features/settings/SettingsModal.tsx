// ============================================================
// SettingsModal — профіль, історія, тема, вихід
// ------------------------------------------------------------
// Тепер це передусім ПРОФІЛЬ: ім'я, фото й дата народження людини —
// тобто те, чим портал її називає й показує скрізь (ADR-0180).
//
// **ЩО ЗВІДСИ ПІШЛО, і чому це не втрата.**
//
// *Розміри* стали окремим модулем «Заміри» в «Ще» (ADR-0179):
// налаштування відкривають, щоб щось ЗМІНИТИ, а заміри — щоб
// ПОДИВИТИСЬ, здебільшого стоячи в магазині.
//
// *Менеджер фото полароїда* прибраний на прохання власника. Разом із ним
// пішла єдина дорога, якою в бакет `family_photos` потрапляли НОВІ фото;
// вже завантажені лишились і далі годують грань «Фотографії» кристала
// (`useHome.ts::usePhotoPool`). Це названо тут, а не сховано: сигнал
// рушія тепер стоїть на місці, доки завантаження не з'явиться десь інде.
// ============================================================
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ModalClose } from '@/components/ui/ModalClose';
import { useAuth } from '@/providers/AuthProvider';
import { useConfirm } from '@/providers/ConfirmProvider';
import { MoonIcon, SunIcon } from '@/components/icons/UiIcon';
import { useTheme } from '@/providers/ThemeProvider';
import { ProfileSection } from '@/features/profile/ProfileSection';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { logout } = useAuth();
  const confirmDialog = useConfirm();

  const confirmLogout = async () => {
    if (await confirmDialog('Вийти з порталу? Щоб повернутись, знадобиться PIN.')) logout();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-sheet settings-modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Налаштування"
      >
        <ModalClose onClose={onClose} />
        <h2 className="modal-title">Налаштування</h2>

        {/*
          * Рядка «Профіль: Діма» тут більше немає: нижче стоїть сам
          * профіль із іменем у полі вводу, тож підпис угорі повторював би
          * те, що вже видно, і — після перейменування — суперечив би
          * йому, бо брав ім'я-ключ.
          */}
        <ProfileSection />

        <div className="settings-divider" />

        {/*
          * Вхід у заповнення історії.
          *
          * Не в доці й не в «Ще»: це не модуль, а робота, яку роблять
          * кілька разів за життя порталу. Але й не захована — пара, яка
          * разом давно, інакше ніколи не дізнається, що її минулі роки
          * можна підняти з порожньої стелі.
          */}
        <section className="settings-section">
          <div className="settings-section-title">Наша історія</div>
          <Link className="btn btn-ghost settings-history" to="/start" onClick={onClose}>
            Заповнити минулі роки
          </Link>
        </section>

        <div className="settings-divider" />

        <ThemeSection />

        {/*
          * «Вийти» тиха, і це не боязкість.
          *
          * Була `btn btn-danger` на всю ширину — найгучніше на екрані,
          * гучніше за будь-яке «Зберегти» в порталі. Вихід не є ані
          * головною дією налаштувань, ані частою; він просто мусить
          * бути знайденим. І він тепер питає: пароль у порталі — PIN, і
          * випадковий тап коштує повторного входу вдвох.
          *
          * «Закрити» звідси пішла: хрестик угорі робить те саме
          * (ADR-0051), а дві кнопки з одним значенням — це вибір, якого
          * немає.
          */}
        <div className="modal-actions settings-actions">
          <button type="button" className="btn btn-ghost settings-logout" onClick={() => void confirmLogout()}>
            Вийти з порталу
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ТЕМА
// ============================================================

/**
 * Вибір теми.
 *
 * Сегмент, а не перемикач: тем рівно дві й обидві мають імена, тож
 * показати обидві чесніше, ніж ховати одну за станом тумблера. Той самий
 * вибір намальований на обох аркушах референсу.
 */
function ThemeSection() {
  const { theme, setTheme } = useTheme();
  return (
    <section className="settings-section">
      <div className="settings-section-title">Тема</div>
      <div className="settings-switch" role="group" aria-label="Тема порталу">
        <button
          type="button"
          className={`settings-switch-btn${theme === 'light' ? ' is-on' : ''}`}
          aria-pressed={theme === 'light'}
          onClick={() => setTheme('light')}
        >
          <SunIcon size={18} />
          Світла
        </button>
        <button
          type="button"
          className={`settings-switch-btn${theme === 'dark' ? ' is-on' : ''}`}
          aria-pressed={theme === 'dark'}
          onClick={() => setTheme('dark')}
        >
          <MoonIcon size={18} />
          Темна
        </button>
      </div>
    </section>
  );
}
