// ============================================================
// CrystalErrorBoundary — заглушка, яка знає, ЧОМУ впала сцена
// ------------------------------------------------------------
// Межа ловить будь-яку помилку 3D-сцени, щоб замість білого екрана пара
// побачила пояснення. Але саме пояснення досі було одне на всі причини —
// «WebGL недоступний», — і на телефоні власника воно збрехало: WebGL
// працював, а 404 повернула модель руїни (`sceneFailure.ts`).
//
// Тому `fallback` тепер функція від помилки, а не готовий вузол: межа
// знає, що сталось, і мусить це передати далі, а не з'їсти.
// ============================================================
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  fallback: (error: Error) => ReactNode;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class CrystalErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Crystal 3D scene failed, showing renderer fallback:', error, errorInfo);
  }

  override render() {
    const { error } = this.state;
    return error === null ? this.props.children : this.props.fallback(error);
  }
}
