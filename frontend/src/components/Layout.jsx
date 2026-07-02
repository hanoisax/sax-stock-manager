import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingCart, Users,
  PackagePlus, BarChart2, Menu, X, Music2, ClipboardCheck, LogOut,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../lib/auth';

const navItems = [
  { to: '/',           label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/products',   label: 'Sản phẩm',   icon: Package },
  { to: '/orders',     label: 'Bán hàng',   icon: ShoppingCart },
  { to: '/imports',    label: 'Nhập kho',   icon: PackagePlus },
  { to: '/stocktakes', label: 'Kiểm kho',   icon: ClipboardCheck },
  { to: '/customers',  label: 'Khách hàng', icon: Users },
  { to: '/reports',    label: 'Báo cáo',    icon: BarChart2 },
];

const NAV_LINK_BASE = 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors';
const NAV_ACTIVE    = 'bg-primary-700 text-white';
const NAV_INACTIVE  = 'text-gray-600 hover:bg-gray-100 hover:text-gray-900';

// Mobile bottom-nav shows only 5 items; "Báo cáo" moves to menu
const bottomItems = navItems.slice(0, 5);

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-56 min-h-screen bg-white border-r border-gray-200 fixed left-0 top-0">
        <div className="flex items-center gap-2 px-4 h-16 border-b border-gray-100">
          <Music2 size={22} className="text-primary-700" />
          <span className="font-bold text-gray-900 text-base leading-tight">Hanoi Sax</span>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `${NAV_LINK_BASE} ${isActive ? NAV_ACTIVE : NAV_INACTIVE}`}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-2 py-3 border-t border-gray-100">
          <button onClick={signOut}
            className={`${NAV_LINK_BASE} ${NAV_INACTIVE} w-full`} title={user?.email}>
            <LogOut size={18} /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* ── Mobile top header ── */}
      <header className="md:hidden flex items-center justify-between px-4 h-14 bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Music2 size={20} className="text-primary-700" />
          <span className="font-bold text-gray-900">Hanoi Sax</span>
        </div>
        <button className="btn-ghost p-2 rounded-lg" onClick={() => setSidebarOpen(true)}>
          <Menu size={20} />
        </button>
      </header>

      {/* ── Mobile slide-over menu ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Music2 size={20} className="text-primary-700" />
                <span className="font-bold text-gray-900">Hanoi Sax</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 px-2 py-4 space-y-0.5">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => `${NAV_LINK_BASE} ${isActive ? NAV_ACTIVE : NAV_INACTIVE}`}
                >
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="px-2 py-3 border-t border-gray-100">
              <button onClick={() => { setSidebarOpen(false); signOut(); }}
                className={`${NAV_LINK_BASE} ${NAV_INACTIVE} w-full`}>
                <LogOut size={18} /> Đăng xuất
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 md:ml-56 pb-20 md:pb-0 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 py-5 md:px-6 md:py-6">
          {children}
        </div>
      </main>

      {/* ── Mobile bottom navigation ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 flex">
        {bottomItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors ${
                isActive ? 'text-primary-700' : 'text-gray-500'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
