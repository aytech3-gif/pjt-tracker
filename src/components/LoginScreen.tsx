import React, { useState } from 'react';
import { Layout } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (user: { email: string; loginAt: string }) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin({ email, loginAt: new Date().toISOString() });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-4xl bg-card p-12 shadow-2xl ring-1 ring-border">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-xl">
            <Layout size={40} />
          </div>
          <h1 className="font-display text-3xl uppercase tracking-tighter text-foreground">
            LGE PJT V3.2
          </h1>
          <p className="mt-2 font-display text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            프로젝트 통합 검색 시스템
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="email"
            required
            className="w-full rounded-2xl border-2 border-secondary bg-secondary px-6 py-4 font-body font-bold text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary"
            placeholder="LGE 이메일 주소 입력"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            type="submit"
            className="w-full rounded-2xl bg-foreground py-5 font-display text-sm uppercase tracking-widest text-primary-foreground shadow-lg transition-all hover:bg-primary active:scale-95"
          >
            로그인
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
