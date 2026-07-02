import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { LogIn, AlertCircle } from 'lucide-react';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    const { error } = await signIn(email.trim(), password);
    if (error) setError('Sai email hoặc mật khẩu');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-gray-900">Sax Manager</h1>
          <p className="text-sm text-gray-500">Đăng nhập để quản lý cửa hàng</p>
        </div>

        {error && (
          <div className="flex gap-2 items-start p-3 bg-red-50 rounded-lg text-red-700 text-sm">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}

        <div>
          <label className="label">Email</label>
          <input className="input" type="email" autoComplete="username" value={email}
            onChange={e => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label">Mật khẩu</label>
          <input className="input" type="password" autoComplete="current-password" value={password}
            onChange={e => setPassword(e.target.value)} required />
        </div>

        <button className="btn-primary w-full justify-center" disabled={loading}>
          <LogIn size={16} /> {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  );
}
