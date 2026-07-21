// ============================================================
// CrystalErrorBoundary — фолбек на SVG-кристал при падінні 3D-сцени
// ------------------------------------------------------------
// Three.js/WebGL — новий, ще не перевірений локально стек (немає npm у
// середовищі розробки). Якщо ініціалізація впаде на будь-якому пристрої —
// показуємо дітям-фолбеку (SVG Crystal) замість білого екрана.
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
    console.error('Crystal 3D scene failed, falling back to SVG:', error, errorInfo);
  }

  override render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
