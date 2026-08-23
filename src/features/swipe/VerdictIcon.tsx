// Значок вердикту — один набір, один `currentColor`, одна товщина лінії.
import { CheckIcon, CloseIcon, PlayIcon } from '@/components/icons/UiIcon';
import { ClockIcon } from '@/components/icons/NavIcon';
import type { SwipeVerdictIcon } from './swipeDirections';

export function VerdictIcon({ name, size = 22 }: { name: SwipeVerdictIcon; size?: number }) {
  if (name === 'clock') return <ClockIcon size={size} />;
  if (name === 'close') return <CloseIcon size={size} />;
  if (name === 'check') return <CheckIcon size={size} />;
  return <PlayIcon size={size} />;
}
