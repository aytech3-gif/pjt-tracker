import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, LogOut } from 'lucide-react';

interface AppHeaderProps {
  isAdmin: boolean;
  activeTab: string;
  userEmail: string;
  onTabChange: (tab: 'search' | 'admin') => void;
  onLogout: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ isAdmin, activeTab, userEmail, onTabChange, onLogout }) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/80 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-8">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
            <Layout size={20} />
          </div>
          <h1 className="font-display text-xl tracking-tighter text-foreground">
            PJT TRACKER <span className="ml-1 text-primary">v3.2</span>
          </h1>
        </div>

        {isAdmin && (
          <nav className="flex gap-1 rounded-2xl bg-secondary p-1.5">
            {(['search', 'admin'] as const).map((t) => (
              <button
                key={t}
                onClick={() => onTabChange(t)}
                className={`rounded-xl px-8 py-2.5 font-display text-[10px] uppercase tracking-widest transition-all ${
                  activeTab === t
                    ? 'bg-card text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <p className="font-display text-[9px] uppercase tracking-widest text-muted-foreground">LGE User</p>
            <p className="font-body text-xs font-bold text-foreground">{userEmail}</p>
          </div>
          <button
            onClick={onLogout}
            className="rounded-xl bg-secondary p-3 text-muted-foreground transition-colors hover:text-primary"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
