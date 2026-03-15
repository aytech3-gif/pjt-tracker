import React from 'react';
import { MapPin, ChevronRight, Loader2, AlertCircle, Globe, Building2, Sparkles, Calendar, Database } from 'lucide-react';

export interface ProjectResult {
  id: string;
  name: string;
  address: string;
  developer: string;
  builder: string;
  designer: string;
  scale: string;
  purpose: string;
  area: string;
  status: string;
  date: string;
  source: string;
  summary?: string;
}

interface ResultsListProps {
  results: ProjectResult[];
  isSearching: boolean;
  hasSearched: boolean;
  onSelect: (item: ProjectResult) => void;
}

const formatNum = (val: string | undefined) => {
  if (!val || val === '0') return null;
  const num = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(num) ? val : num.toLocaleString();
};

const isLocalSource = (source: string) => source === 'local_db' || source === '📂 로컬 DB';

const ResultsList: React.FC<ResultsListProps> = ({ results, isSearching, hasSearched, onSelect }) => {
  if (isSearching) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="mb-4 h-6 w-6 animate-spin text-muted-foreground" />
        <p className="font-data text-xs text-muted-foreground">
          Hybrid Intelligence Search...
        </p>
      </div>
    );
  }

  if (results.length > 0) {
    return (
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {results.map((item) => {
          const isLocal = isLocalSource(item.source);
          const formattedArea = formatNum(item.area);

          return (
            <div
              key={item.id}
              onClick={() => onSelect(item)}
              className="group relative flex h-[420px] cursor-pointer flex-col justify-between overflow-hidden rounded-5xl border border-border bg-card p-8 transition-all hover:border-primary/30 hover:shadow-2xl"
            >
              {!isLocal && (
                <div className="absolute right-6 top-6 rounded-full bg-accent p-2">
                  <Sparkles size={16} className="animate-pulse text-primary" />
                </div>
              )}

              <div>
                <div className="mb-6 flex items-start justify-between">
                  <div className={`rounded-2xl p-4 ${isLocal ? 'bg-primary/10 text-primary' : 'bg-accent text-foreground'}`}>
                    {isLocal ? <Building2 size={24} /> : <Globe size={24} />}
                  </div>
                  <span className={`rounded-full px-4 py-1.5 font-display text-[9px] uppercase tracking-widest ${
                    isLocal
                      ? 'bg-secondary text-muted-foreground'
                      : 'bg-foreground text-primary-foreground shadow-md'
                  }`}>
                    {isLocal ? 'LOCAL DB' : 'LIVE SEARCH'}
                  </span>
                </div>

                <h3 className="mb-4 line-clamp-2 font-display text-xl leading-tight tracking-tighter text-foreground group-hover:text-primary">
                  {item.name}
                </h3>

                <p className="mb-8 flex items-center gap-2 font-display text-[11px] uppercase tracking-tighter text-muted-foreground">
                  <MapPin size={14} className="text-muted-foreground/50" />
                  {item.address}
                </p>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-xl border border-border bg-secondary px-3.5 py-2 font-display text-[10px] font-bold text-foreground">
                    {item.purpose || 'PROJECT'}
                  </span>
                  {formattedArea && (
                    <span className="rounded-xl border border-border bg-secondary px-3.5 py-2 font-display text-[10px] font-bold text-foreground">
                      {formattedArea} ㎡
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-8">
                <span className="flex items-center gap-2 font-display text-[10px] uppercase tracking-widest text-muted-foreground">
                  {isLocal ? <Calendar size={14} className="text-primary/50" /> : <AlertCircle size={14} className="text-muted-foreground/50" />}
                  {item.date || 'TBD'}
                </span>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary shadow-sm transition-all group-hover:bg-primary group-hover:text-primary-foreground">
                  <ChevronRight size={22} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (hasSearched) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AlertCircle className="mb-3 h-5 w-5 text-muted-foreground" />
        <p className="font-display text-sm text-foreground">
          데이터를 찾을 수 없습니다
        </p>
        <p className="mt-1 font-data text-xs text-muted-foreground">
          건물명이나 상세 주소(동/번지)를 정확히 입력해 보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-5xl border-2 border-dashed border-border bg-card py-40">
      <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-secondary">
        <Database size={40} className="text-muted-foreground/20" />
      </div>
      <div className="space-y-2 text-center">
        <p className="font-display text-sm uppercase tracking-[0.4em] text-muted-foreground">
          Integrated Hybrid Search Engine
        </p>
        <p className="font-body text-xs font-bold text-muted-foreground/60">
          Enter keywords to start real-time AI & Internal analysis
        </p>
      </div>
    </div>
  );
};

export default ResultsList;
