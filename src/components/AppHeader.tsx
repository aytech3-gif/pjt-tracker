import React from 'react';
import { Building2, LogOut, Settings, Search } from 'lucide-react';

interface AppHeaderProps {
  isAdmin: boolean;
  activeTab: string;
  onToggleAdmin: () => void;
  onLogout: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ isAdmin, activeTab, onToggleAdmin, onLogout }) => {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary">
            <Building2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-sm tracking-tight text-foreground">
            PJT-Tracker
          </span>
        </div>

        <div className="flex items-center gap-1">
          {isAdmin && (
            <button
              onClick={onToggleAdmin}
              className={`rounded-sm p-2 transition-all ${
                activeTab === 'admin'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {activeTab === 'admin' ? <Search className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
            </button>
          )}
          <button
            onClick={onLogout}
            className="rounded-sm p-2 text-muted-foreground transition-all hover:text-primary"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
