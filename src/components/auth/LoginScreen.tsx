import React, { useState } from 'react';
import { Building2, Loader2, Mail, Lock, User } from 'lucide-react';
import { signIn, signUp } from '../../lib/api/auth';

export function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
      } else {
        if (!fullName.trim()) throw new Error('Vui lòng nhập họ tên.');
        await signUp(email.trim(), password, fullName.trim());
      }
      // onAuthChange trong App sẽ tự chuyển vào ứng dụng.
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-surface-container-low p-4">
      <div className="w-full max-w-md bg-surface border border-outline-variant rounded-2xl shadow-xl p-8">
        {/* Brand */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-3">
            <Building2 size={30} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">CDE CIC</h1>
          <p className="text-[13px] text-on-surface-variant font-medium mt-1 text-center">
            Môi trường Dữ liệu chung — Nền tảng BIM
          </p>
        </div>

        {/* Mode tabs */}
        <div className="flex bg-surface-container rounded-lg p-1 mb-6 border border-outline-variant/60">
          <button
            onClick={() => { setMode('login'); setError(null); }}
            className={`flex-1 py-2 rounded-md text-[13px] font-bold transition-colors ${mode === 'login' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'}`}
          >
            Đăng nhập
          </button>
          <button
            onClick={() => { setMode('signup'); setError(null); }}
            className={`flex-1 py-2 rounded-md text-[13px] font-bold transition-colors ${mode === 'signup' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'}`}
          >
            Tạo tài khoản
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <Field icon={<User size={16} />} label="Họ và tên">
              <input
                type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="w-full bg-transparent outline-none text-sm text-on-surface placeholder:text-outline"
              />
            </Field>
          )}
          <Field icon={<Mail size={16} />} label="Email">
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="email@congty.vn"
              className="w-full bg-transparent outline-none text-sm text-on-surface placeholder:text-outline"
            />
          </Field>
          <Field icon={<Lock size={16} />} label="Mật khẩu">
            <input
              type="password" required value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Tối thiểu 6 ký tự" minLength={6}
              className="w-full bg-transparent outline-none text-sm text-on-surface placeholder:text-outline"
            />
          </Field>

          {error && (
            <div className="text-[12px] text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2 font-medium">
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full bg-primary text-on-primary font-bold text-sm py-2.5 rounded-xl hover:bg-primary/95 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </button>
        </form>

        <p className="text-[11px] text-outline text-center mt-6 leading-relaxed">
          Phiên bản pilot. Dữ liệu lưu trên Supabase, chưa đạt chuẩn QCVN 12 —
          không nhập dữ liệu mật.
        </p>
      </div>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-bold text-outline uppercase tracking-wider">{label}</label>
      <div className="mt-1 flex items-center gap-2 bg-surface-container border border-outline-variant/60 rounded-xl px-3 py-2.5 focus-within:border-primary transition-colors">
        <span className="text-outline">{icon}</span>
        {children}
      </div>
    </div>
  );
}
