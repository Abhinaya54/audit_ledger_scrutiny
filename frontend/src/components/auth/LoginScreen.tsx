import { useMemo, useState } from 'react';

interface LoginScreenProps {
  onLogin: (name: string) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => name.trim().length >= 2 && password.length >= 4, [name, password]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      setError('Enter a valid name and password.');
      return;
    }
    setError(null);
    onLogin(name.trim());
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,#99f6e4_0,#d1fae5_30%,#f8fafc_75%)] px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 bg-white rounded-3xl shadow-2xl border border-teal-100 overflow-hidden">
        <section className="p-10 bg-[#0F766E] text-white relative overflow-hidden">
          <div className="absolute -top-16 -right-10 w-48 h-48 rounded-full bg-[#14B8A6]/35 blur-2xl" />
          <div className="absolute -bottom-20 -left-16 w-56 h-56 rounded-full bg-[#115E59]/50 blur-3xl" />

          <p className="text-xs tracking-[0.22em] uppercase text-teal-200/85 mb-6">Secure Workspace</p>
          <h1 className="text-3xl font-black leading-tight">Ledger Scrutiny Control Center</h1>
          <p className="mt-4 text-teal-100/90 text-sm leading-relaxed max-w-sm">
            Sign in to review anomalies, manage clients, and run Tally-compatible audit ingestion in one place.
          </p>

          <div className="mt-10 space-y-4 text-sm">
            {[
              'Client-level audit workspaces',
              'AI + rule-based anomaly detection',
              'Tally-ready ingestion pipeline',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="p-8 sm:p-10">
          <div className="max-w-sm mx-auto w-full">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-teal-700/70">Login</p>
            <h2 className="text-2xl font-black text-slate-900 mt-2">Welcome back</h2>
            <p className="text-sm text-slate-500 mt-2">Use any username/password for this workspace login gate.</p>

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Analyst Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Abhin"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 4 characters"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-600"
                />
              </div>

              {error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-xl bg-[#0F766E] hover:bg-[#115E59] transition-colors text-white font-bold py-2.5"
              >
                Sign In
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
