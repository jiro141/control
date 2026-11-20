import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  FileText,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings as SettingsIcon,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { describeError } from '../lib/errors';
import { formatDate, todayISO } from '../lib/format';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  elevated?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard, end: true },
  { to: '/facturas', label: 'Facturas', icon: FileText },
  { to: '/facturas/nueva', label: 'Nueva', icon: Plus, elevated: true },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/ajustes', label: 'Ajustes', icon: SettingsIcon },
];

export function AppShell() {
  const { user, signOut, isAdmin } = useAuth();
  const { settings } = useSettings();
  const { notify } = useToast();
  const navigate = useNavigate();
  const navItems = NAV_ITEMS.filter((item) => isAdmin || !item.elevated);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (cause) {
      notify(describeError(cause), 'error');
    }
  };

  return (
    <div className="min-h-full bg-surface">
      <aside className="safe-top print-hidden fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-navy text-white lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <img
            src="/assets/logo.png"
            alt="Logotipo"
            className="h-11 w-11 rounded-full bg-white/10 object-cover"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">Control de Ventas</p>
            <p className="truncate text-xs text-sky-200">
              {settings?.business_name ?? 'Madera para minería'}
            </p>
          </div>
        </div>

        <nav aria-label="Navegación principal" className="mt-2 flex-1 space-y-1 overflow-y-auto px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                    item.elevated
                      ? 'mt-3 bg-accent text-white hover:bg-accent-hover'
                      : isActive
                        ? 'bg-white/10 text-white'
                        : 'text-sky-100/80 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.elevated ? 'Nueva factura' : item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-5 py-4">
          <p className="truncate text-xs text-sky-200">{user?.email}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="app-shell-content lg:pl-64">
        <header className="safe-top print-hidden sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur">
          <div className="safe-inline flex h-14 items-center justify-between gap-3 lg:px-8">
            <div className="flex min-w-0 items-center gap-2 lg:hidden">
              <img
                src="/assets/logo.png"
                alt="Logotipo"
                className="h-8 w-8 shrink-0 rounded-full"
              />
              <span className="truncate text-sm font-bold text-navy">
                Control de Ventas
              </span>
            </div>
            <div className="hidden min-w-0 lg:block">
              <p className="truncate text-sm font-semibold text-navy">
                {settings?.business_name ?? 'Control de Ventas'}
              </p>
              <p className="text-xs text-slate-500">{formatDate(todayISO())}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden max-w-[220px] truncate text-xs text-slate-500 sm:block">
                {user?.email}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-ghost btn-sm icon-button"
                aria-label="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>
        </header>

        <main className="app-main safe-inline mx-auto w-full min-w-0 max-w-6xl py-5 lg:px-8 lg:pb-10">
          <Outlet />
        </main>
      </div>

      {createPortal(
        <nav
          aria-label="Navegación principal"
          className="app-mobile-nav safe-bottom print-hidden fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white lg:hidden"
        >
          <div className={`app-mobile-nav-items grid ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'}`}>
            {navItems.map((item) => {
              const Icon = item.icon;
              if (item.elevated) {
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    aria-label="Nueva factura"
                    className="relative flex min-w-0 items-end justify-center pb-1.5"
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={`absolute bottom-5 left-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full text-white shadow-lg ring-4 ring-white transition-colors sm:h-14 sm:w-14 ${
                            isActive ? 'bg-accent-hover' : 'bg-accent'
                          }`}
                        >
                          <Plus aria-hidden="true" className="h-7 w-7" />
                        </span>
                        <span className="text-[10px] font-semibold text-navy">Nueva</span>
                      </>
                    )}
                  </NavLink>
                );
              }

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className="flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold"
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`h-5 w-5 ${
                          isActive ? 'text-accent' : 'text-slate-500'
                        }`}
                      />
                      <span className={isActive ? 'text-navy' : 'text-slate-500'}>
                        {item.label}
                      </span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>,
        document.body,
      )}
    </div>
  );
}
