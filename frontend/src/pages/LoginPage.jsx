import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { Droplets, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (email, password) => {
    setForm({ email, password });
  };

  return (
    <div className="min-h-screen bg-surface-secondary flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-96 bg-[#0f172a] flex-col justify-between p-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-accent rounded-sm flex items-center justify-center">
            <Droplets size={18} className="text-white" />
          </div>
          <span className="text-white font-semibold text-base">Aqua Intellect</span>
        </div>
        <div>
          <h2 className="text-white text-2xl font-semibold leading-snug">
            Industrial Water Treatment<br />Monitoring Platform
          </h2>
          <p className="text-slate-400 text-sm mt-3 leading-relaxed">
            Real-time telemetry, alarm management, and reporting for RO and UF treatment plants.
          </p>
          <div className="mt-8 space-y-3">
            {[
              'Live PLC telemetry ingestion',
              'Configurable alarm thresholds',
              'Multi-facility management',
              'Automated report generation',
            ].map((f) => (
              <div key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>
        <div className="text-slate-500 text-xs">
          © 2026 Aqua Intellect. Industrial use only.
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-7 h-7 bg-accent rounded-sm flex items-center justify-center">
              <Droplets size={15} className="text-white" />
            </div>
            <span className="text-ink font-semibold">Aqua Intellect</span>
          </div>

          <h1 className="text-xl font-semibold text-ink">Sign in</h1>
          <p className="text-ink-muted text-sm mt-1">Enter your credentials to continue</p>

          {error && (
            <div className="mt-4 flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-sm text-sm text-red-700">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="form-label" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="form-input"
                placeholder="you@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                className="form-input"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              id="btn-login"
              className="w-full btn-primary justify-center py-2.5 text-sm"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-8 border border-surface-border rounded-sm">
            <div className="px-4 py-2.5 border-b border-surface-border bg-surface-tertiary">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Demo Credentials</p>
            </div>
            <div className="divide-y divide-surface-border">
              {[
                { label: 'Admin', email: 'admin@aquaintellect.com', password: 'admin123' },
                { label: 'Supervisor', email: 'supervisor@aquaintellect.com', password: 'super123' },
                { label: 'Operator', email: 'operator@aquaintellect.com', password: 'oper123' },
                { label: 'Viewer', email: 'viewer@aquaintellect.com', password: 'view123' },
              ].map(({ label, email, password }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => fillDemo(email, password)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-surface-tertiary transition-colors"
                >
                  <span className="text-xs font-medium text-ink">{label}</span>
                  <span className="text-xs text-ink-muted font-mono">{email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
