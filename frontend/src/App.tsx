import { useEffect, useState } from 'react';
import LoginScreen from './components/auth/LoginScreen';
import AppShell from './components/layout/AppShell';

const AUTH_USER_KEY = 'audit_auth_user_v1';

function App() {
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(AUTH_USER_KEY);
    if (saved) {
      setUserName(saved);
    }
  }, []);

  const handleLogin = (name: string) => {
    localStorage.setItem(AUTH_USER_KEY, name);
    setUserName(name);
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_USER_KEY);
    setUserName(null);
  };

  if (!userName) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <AppShell currentUser={userName} onLogout={handleLogout} />;
}

export default App;
