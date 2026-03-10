import React, { useState } from 'react';
import { Building2 } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (user: { email: string; loginAt: string }) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('otp');
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin({ email, loginAt: new Date().toISOString() });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="bg-card rounded-lg border border-border p-10">
          {/* Logo */}
          <div className="mb-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="font-display text-xl tracking-tight text-foreground">
              PJT-TRACKER
            </h1>
            <p className="mt-1 font-data text-xs text-muted-foreground">
              LG B2B Intelligence Portal
            </p>
          </div>

          {/* Forms */}
          {step === 'email' ? (
            <form onSubmit={handleEmailSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block font-body text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="email@example.com"
                  required
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 font-data text-sm text-foreground outline-none transition-all focus:border-foreground"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:opacity-90 active:scale-95 mx-auto"
              >
                <span className="font-display text-xs">→</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block font-body text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Verification Code
                </label>
                <input
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-center font-data text-2xl tracking-[0.5em] text-foreground outline-none transition-all focus:border-foreground"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-sm bg-foreground py-3 font-display text-xs uppercase tracking-widest text-card transition-all hover:opacity-90 active:scale-[0.98]"
              >
                로그인
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
