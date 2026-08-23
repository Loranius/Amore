// ============================================================
// Прикраса, яка не приїхала, не забирає світ із собою.
// ------------------------------------------------------------
// **Виміряно на живому екрані.** Модель зграї риб
// (`/models/school_of_fish_reef.glb`) не завантажилась, і пара побачила
// не риф без риб, а НЕ РИФ ВЗАГАЛІ: помилка піднялась до
// `CrystalErrorBoundary` навколо всього артефакта, і замість світу
// лишився нейтральний фолбек «рендерер не працює».
//
// Навколо риб уже стояв `<Suspense fallback={null}>`, і це виглядало як
// захист — але Suspense ловить ОЧІКУВАННЯ, а не помилку. Модель, яка
// вантажиться, справді нічого не ламає; модель, якої немає, кидає.
//
// Риби — прикраса. Втратити їх — прикро; втратити через них риф —
// неприпустимо, бо це єдиний екран, де живе артефакт пари.
// ============================================================
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Що саме не вдалося — іде в консоль, щоб втрату було видно. */
  what: string;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class SceneDecorationBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Гучно в консоль і тихо на екрані: мовчазний провал — це те, що
    // `CLAUDE.md` забороняє, але й показувати парі поламану прикрасу
    // нема чого.
    console.error(`[Сцена] Прикраса «${this.props.what}» не завантажилась:`, error, errorInfo);
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
