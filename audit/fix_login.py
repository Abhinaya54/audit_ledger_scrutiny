content = r"""import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login, signup, user } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (user) {
    navigate('/home', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (isSignup) {
        await signup(name, email, password);
      } else {
        await login(email, password);
      }
      navigate('/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#095859] to-[#074645] p-12 flex-col justify-between">
        <div>
          <h1 className="text-white text-3xl mb-2">General Ledger Scrutiny</h1>
          <p className="text-white/80 text-lg">Enterprise audit intelligence platform</p>
        </div>
        <div className="text-white/70 text-sm">
          <p>© 2024 Audit Intelligence. All rights reserved.</p>
        </div>
      <div className="flex-1 flex items-center justify-center bg-gray-50 p-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="mb-8">
              <h2 className="text-2xl text-gray-900 mb-2">{isSignup ? 'Create Account' : 'Sign In'}</h2>
              <p className="text-sm text-gray-600">{isSignup ? 'Set up your audit workspace' : 'Access your audit workspace'}</p>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              {isSignup && (
                <div>
                  <label htmlFor="name" className="block text-sm text-gray-700 mb-2">Full Name</label>
                  <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required={isSignup}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#095859] focus:border-transparent" placeholder="John Doe" />
                </div>
              )}
              <div>
                <label htmlFor="email" className="block text-sm text-gray-700 mb-2">Email Address</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#095859] focus:border-transparent" placeholder="you@company.com" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="password" className="block text-sm text-gray-700">Password</label>
                </div>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#095859] focus:border-transparent" placeholder="Enter your password" />
              </div>
              <button type="submit" disabled={isLoading}
                className="w-full px-4 py-3 bg-[#095859] text-white rounded-lg hover:bg-[#0B6B6A] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                {isLoading ? 'Please wait...' : isSignup ? 'Create Account' : 'Sign In'}
              </button>
            </form>
            <div className="mt-6 text-center">
              <button onClick={() => { setIsSignup(!isSignup); setError(''); }}
                className="text-sm text-[#095859] hover:text-[#0B6B6A]">
                {isSignup ? 'Already have an account? Sign In' : 'Create Account'}
              </button>
            </div>
        </div>
    </div>
  );
}
"""

with open('frontend/src/app/pages/Login.tsx', 'w') as f:
    f.write(content)

print('Login.tsx fixed successfully')
