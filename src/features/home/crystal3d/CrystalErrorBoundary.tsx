// ============================================================
// CrystalErrorBoundary — нейтральний фолбек при падінні 3D-сцени
// ------------------------------------------------------------
// Three.js/WebGL — новий, ще не перевірений локально стек (немає npm у
// середовищі розробки). Якщо ініціалізація впаде на будь-якому пристрої —
// показуємо переданий стан помилки замість білого екрана.
// ============================================================
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  fallback: ReactNode;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class CrystalErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Crystal 3D scene failed, showing renderer fallback:', error, errorInfo);
  }

  override render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
