import React from 'react';
import { Activity } from 'lucide-react';

interface SearchLog {
  query: string;
  time: string;
  user: string;
}

interface AdminPanelProps {
  searchHistory: SearchLog[];
}

const AdminPanel: React.FC<AdminPanelProps> = ({ searchHistory }) => {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h2 className="mb-4 font-display text-sm text-foreground">Activity Logs</h2>
      <div className="rounded-lg border border-border bg-card">
        <div className="custom-scrollbar max-h-[70vh] overflow-y-auto">
          {searchHistory.length > 0 ? (
            searchHistory.map((log, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between border-b border-border px-5 py-3 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <Activity className="h-3 w-3 text-muted-foreground" />
                  <span className="font-data text-xs text-foreground">
                    "{log.query}"
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-data text-[10px] text-muted-foreground">
                    {log.user}
                  </span>
                  <span className="font-data text-[10px] text-muted-foreground">
                    {new Date(log.time).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="p-8 text-center font-data text-xs text-muted-foreground">
              검색 이력이 없습니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
