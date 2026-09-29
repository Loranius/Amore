import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useCoupleId } from '@/features/_shared/useCoupleId';
import { canPlayGame } from './gameAccess';

/** `/game` лише для пари, для якої гру зроблено; решту — на головну (ADR-0236). */
export function GameGate({ children }: { children: ReactNode }) {
  const { coupleId, isPending } = useCoupleId();
  if (isPending) return null;
  return canPlayGame(coupleId) ? <>{children}</> : <Navigate to="/" replace />;
}
