import { useEffect, useState } from 'react';
import LoginScreen from './components/auth/LoginScreen';
import AppShell from './components/layout/AppShell';
import { login, me, signup } from './api/authApi';
import type { AuthUser } from './types/auth';

const AUTH_TOKEN_KEY = 'audit_auth_token_v1';
const AUTH_USER_KEY = 'audit_auth_user_v1';

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      const cachedUser = localStorage.getItem(AUTH_USER_KEY);

      if (!token) {
        setCheckingSession(false);
        return;
      }

      if (cachedUser) {
        try {
          setUser(JSON.parse(cachedUser) as AuthUser);
        } catch {
          localStorage.removeItem(AUTH_USER_KEY);
        }
      }

      try {
        const profile = await me(token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(profile));
        setUser(profile);
      } catch {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        setUser(null);
      } finally {
        setCheckingSession(false);
      }
    };

    void bootstrap();
  }, []);

  const handleSignup = async (name: string, email: string, password: string) => {
    const result = await signup({ name, email, password });
    localStorage.setItem(AUTH_TOKEN_KEY, result.access_token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(result.user));
    setUser(result.user);
  };

  const handleLogin = async (email: string, password: string) => {
    const result = await login({ email, password });
    localStorage.setItem(AUTH_TOKEN_KEY, result.access_token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(result.user));
    setUser(result.user);
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    setUser(null);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#0F766E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} onSignup={handleSignup} />;
  }

  return <AppShell currentUser={user.name} onLogout={handleLogout} />;
}

export default App;
