import { Loader2 } from 'lucide-react';

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />;
}

export function FullScreenLoader({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
      <img
        src="/assets/logo.png"
        alt="Logotipo"
        className="h-16 w-16 rounded-full shadow-card"
      />
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
        <Spinner className="h-4 w-4" />
        <span>{label}</span>
      </div>
    </div>
  );
}
