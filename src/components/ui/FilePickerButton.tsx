// ============================================================
// FilePickerButton — стилізована кнопка-обгортка над <input type="file">
// ------------------------------------------------------------
// Той самий "label + прихований file input" код був продубльований
// у WishFormModal/AddPinModal/PinModal/PhotoDayModal (лише className
// і accept різнились). HEIC-нормалізація тут НЕ робиться — кожен
// виклик сам вирішує, чи потрібне прев'ю (onPick(file) віддає сирий
// File; де треба — далі йде normalizeToPreview з lib/images.ts).
// ============================================================
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function FilePickerButton({
  id,
  className = 'btn-secondary',
  accept = 'image/*,.heic,.heif',
  disabled = false,
  children,
  onPick,
}: {
  id: string;
  /** Клас обгортки-label — кожна фіча стилізує по-своєму (btn-secondary,
      pcal-upload-btn/pcal-replace-btn тощо), тому дефолт лише розумний, не єдиний. */
  className?: string;
  /** MIME/extension filter для нативного file picker. */
  accept?: string;
  /** Блокує відкриття picker під час upload/save та позначає control для assistive tech. */
  disabled?: boolean;
  children: ReactNode;
  onPick: (file: File) => void;
}) {
  return (
    <label
      className={cn(className, disabled && 'is-disabled')}
      aria-disabled={disabled}
      onClick={(event) => {
        if (disabled) event.preventDefault();
      }}
    >
      {children}
      <input
        id={id}
        name={id}
        type="file"
        accept={accept}
        disabled={disabled}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = '';
        }}
      />
    </label>
  );
}
