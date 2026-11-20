import { Database, KeyRound, RefreshCw, Server, Terminal } from 'lucide-react';

export function SetupScreen() {
  return (
    <div className="min-h-screen bg-surface">
      <img
        src="/assets/header-banner.png"
        alt="Venta de todo tipo de madera para minería"
        className="block w-full"
      />
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div className="card p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <img
              src="/assets/logo.png"
              alt="Logotipo"
              className="h-14 w-14 rounded-full"
            />
            <div>
              <h1 className="text-lg font-extrabold text-navy sm:text-xl">
                Configura tu conexión con Supabase
              </h1>
              <p className="text-sm text-slate-500">
                Faltan las variables de entorno de la aplicación.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-5 text-sm text-slate-600">
            <section className="flex gap-3">
              <Server className="mt-0.5 h-5 w-5 shrink-0 text-sky" />
              <div>
                <p className="font-semibold text-navy">1. Crea el proyecto en Supabase</p>
                <p className="mt-1">
                  Entra a supabase.com, crea un proyecto y espera a que termine la
                  preparación de la base de datos.
                </p>
              </div>
            </section>

            <section className="flex gap-3">
              <Database className="mt-0.5 h-5 w-5 shrink-0 text-sky" />
              <div>
                <p className="font-semibold text-navy">2. Ejecuta el esquema</p>
                <p className="mt-1">
                  Abre el SQL Editor del proyecto y ejecuta el contenido completo de{' '}
                  <code className="rounded bg-surface px-1.5 py-0.5 text-xs font-semibold text-navy">
                    supabase/schema.sql
                  </code>
                  .
                </p>
              </div>
            </section>

            <section className="flex gap-3">
              <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-sky" />
              <div>
                <p className="font-semibold text-navy">3. Crea el usuario administrador</p>
                <p className="mt-1">
                  En Authentication → Users, crea el primer usuario con correo y
                  contraseña y marca la opción de confirmación automática.
                </p>
              </div>
            </section>

            <section className="flex gap-3">
              <Terminal className="mt-0.5 h-5 w-5 shrink-0 text-sky" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-navy">4. Configura el archivo .env</p>
                <p className="mt-1">
                  Copia el archivo <code>.env.example</code> como <code>.env</code> en la
                  raíz del proyecto y completa los valores con la URL y la clave anónima
                  del proyecto (Settings → API).
                </p>
                <pre className="mt-2 overflow-x-auto rounded-xl bg-navy px-4 py-3 text-xs text-sky-100">
{`VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anonima-publica`}
                </pre>
              </div>
            </section>

            <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
              <p className="font-semibold">Importante</p>
              <p className="mt-1">
                Después de crear o modificar el archivo <code>.env</code>, detén y
                vuelve a iniciar el servidor de desarrollo para que Vite lea las
                variables.
              </p>
            </section>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn btn-primary"
            >
              <RefreshCw className="h-4 w-4" />
              Recargar aplicación
            </button>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost"
            >
              Abrir Supabase
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
