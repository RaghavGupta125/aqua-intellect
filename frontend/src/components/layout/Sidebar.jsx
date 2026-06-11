import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import {
  LayoutDashboard,
  Building2,
  BellRing,
  LogOut,
  Droplets,
  Settings,
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/facilities', label: 'Facilities', icon: Building2 },
  { to: '/alarms', label: 'Alarms', icon: BellRing },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleLabel = {
    admin: 'Administrator',
    supervisor: 'Supervisor',
    operator: 'Operator',
    viewer: 'Viewer',
  }[user?.role] || user?.role;

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-[#0f172a] flex flex-col z-40 select-none">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/10">
        <div className="w-7 h-7 bg-accent rounded-sm flex items-center justify-center flex-shrink-0">
          <Droplets size={16} className="text-white" />
        </div>
        <div>
          <div className="text-white text-sm font-semibold leading-tight">Aqua Intellect</div>
          <div className="text-slate-400 text-xs leading-tight">v1.0 MVP</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider px-2 mb-2">
          Navigation
        </div>
        {navItems.map(({ to, label, icon: Icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-2 py-2 rounded-sm text-sm transition-colors',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              )
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User info */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="w-7 h-7 rounded-sm bg-slate-700 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-semibold">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs font-medium truncate">{user?.name}</div>
            <div className="text-slate-400 text-xs truncate">{roleLabel}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-2 py-1.5 mt-1 text-slate-400 hover:text-white hover:bg-white/5 rounded-sm text-xs transition-colors"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
