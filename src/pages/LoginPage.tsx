import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { describeError } from '../lib/errors';
import { Spinner } from '../components/Spinner';

interface LocationState {
  from?: { pathname?: string; search?: string; hash?: string };
}

export function LoginPage() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTarget = (location.state as LocationState | null)?.from;
  const from = redirectTarget?.pathname
    ? `${redirectTarget.pathname}${redirectTarget.search ?? ''}${redirectTarget.hash ?? ''}`
    : '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (session) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-navy lg:flex lg:flex-col">
        <img
          src="/assets/header-banner.png"
          alt="Venta de todo tipo de madera para minería"
          className="w-full"
        />
        <div className="flex flex-1 flex-col justify-center gap-5 px-12 py-10 text-white">
          <img
            src="/assets/logo.png"
            alt="Logotipo"
            className="h-16 w-16 rounded-full ring-4 ring-white/10"
          />
          <div>
            <h1 className="text-2xl font-extrabold">Control de Ventas</h1>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-sky-100/90">
              Administra facturas, clientes, pagos y saldos de la venta de todo
              tipo de madera para minería.
            </p>
          </div>
          <ul className="mt-2 space-y-2 text-sm text-sky-100/80">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sky" />
              Acceso privado con correo y contraseña
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sky" />
              Facturas en PDF y Excel listas para enviar
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sky" />
              Control de abonos y saldos en tiempo real
            </li>
          </ul>
        </div>
      </aside>

      <div className="safe-top safe-bottom flex min-h-screen flex-col supports-[height:100dvh]:min-h-dvh">
        <div className="lg:hidden">
          <img
            src="/assets/header-banner.png"
            alt="Venta de todo tipo de madera para minería"
            className="block w-full"
          />
        </div>

        <div className="safe-inline flex flex-1 items-center justify-center py-8 sm:px-6">
          <div className="w-full max-w-md">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <img
                src="/assets/logo.png"
                alt="Logotipo"
                className="h-12 w-12 rounded-full"
              />
              <div>
                <h1 className="text-lg font-extrabold text-navy">Control de Ventas</h1>
                <p className="text-xs text-slate-500">Madera para minería</p>
              </div>
            </div>

            <div className="card p-6 sm:p-8">
              <h2 className="text-xl font-extrabold text-navy">Iniciar sesión</h2>
              <p className="mt-1 text-sm text-slate-500">
                Acceso exclusivo para personal autorizado.
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="label" htmlFor="login-email">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="input pl-9"
                      placeholder="correo@ejemplo.com"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="login-password">
                    Contraseña
                  </label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="input pl-9 pr-14"
                      placeholder="Tu contraseña"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="icon-button absolute right-1 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-lg p-1.5 text-slate-500 transition-colors hover:text-navy"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {error ? (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={loading}
                >
                  {loading ? <Spinner className="h-4 w-4" /> : null}
                  Iniciar sesión
                </button>
              </form>

              <p className="mt-5 text-center text-xs leading-relaxed text-slate-500">
                El primer usuario se crea desde Supabase: Authentication → Users.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
