import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  maxWidth = 'max-w-lg',
}: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="absolute inset-0 bg-navy/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Cerrar ventana"
      />
      <div
        className={`relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl ${maxWidth}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-base font-bold text-navy">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-surface hover:text-navy"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
