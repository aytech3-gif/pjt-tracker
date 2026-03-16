import React from 'react';
import { MapPin, ChevronRight, Loader2, AlertCircle, Globe, Building2, Sparkles, Calendar, Database, ShieldCheck, Zap } from 'lucide-react';

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
  ownerBizNo?: string;
  startDate?: string;
  completionDate?: string;
  builderStatus?: string;
  matchRate?: number;
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

const isLocalSource = (source: string) => source === 'local_db' || source.includes('로컬') || source.includes('📂');

const LocalCard: React.FC<{ item: ProjectResult; onSelect: (item: ProjectResult) => void }> = ({ item, onSelect }) => {
  const formattedArea = formatNum(item.area);
  return (
    <div
      onClick={() => onSelect(item)}
      className="group relative cursor-pointer overflow-hidden rounded-3xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-6 transition-all hover:border-green-400 hover:shadow-xl dark:border-green-800 dark:from-green-950/30 dark:to-emerald-950/20"
    >
      {/* Verified badge */}
      <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-green-600 px-3 py-1 shadow-md">
        <ShieldCheck size={12} className="text-white" />
        <span className="font-display text-[8px] font-bold uppercase tracking-wider text-white">확정</span>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600 text-white shadow-md">
          <Building2 size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-bold leading-tight text-foreground group-hover:text-green-700 dark:group-hover:text-green-400">
            {item.name}
          </h3>
        </div>
      </div>

      <p className="mb-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <MapPin size={12} className="shrink-0 text-green-500" />
        <span className="truncate">{item.address}</span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {item.purpose && (
          <span className="rounded-lg bg-green-100 px-2.5 py-1 font-display text-[9px] font-bold text-green-700 dark:bg-green-900/40 dark:text-green-300">
            {item.purpose}
          </span>
        )}
        {formattedArea && (
          <span className="rounded-lg bg-white/80 px-2.5 py-1 font-display text-[9px] font-bold text-foreground dark:bg-green-900/20">
            {formattedArea} ㎡
          </span>
        )}
        {item.date && (
          <span className="flex items-center gap-1 rounded-lg bg-white/80 px-2.5 py-1 font-display text-[9px] text-muted-foreground dark:bg-green-900/20">
            <Calendar size={10} /> {item.date}
          </span>
        )}
      </div>

      <div className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-xl bg-green-600/10 transition-all group-hover:bg-green-600 group-hover:text-white">
        <ChevronRight size={16} />
      </div>
    </div>
  );
};

const AICard: React.FC<{ item: ProjectResult; onSelect: (item: ProjectResult) => void }> = ({ item, onSelect }) => {
  const formattedArea = formatNum(item.area);
  return (
    <div
      onClick={() => onSelect(item)}
      className="group relative flex h-[420px] cursor-pointer flex-col justify-between overflow-hidden rounded-5xl border border-border bg-card p-8 transition-all hover:border-primary/30 hover:shadow-2xl"
    >
      <div className="absolute right-6 top-6 rounded-full bg-accent p-2">
        <Sparkles size={16} className="animate-pulse text-primary" />
      </div>

      <div>
        <div className="mb-6 flex items-start justify-between">
          <div className="rounded-2xl bg-accent p-4 text-foreground">
            <Globe size={24} />
          </div>
          <span className="rounded-full bg-amber-50 px-4 py-1.5 font-display text-[9px] uppercase tracking-widest text-amber-600 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-800">
            ⚡ AI 참고용
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
          <AlertCircle size={14} className="text-muted-foreground/50" />
          {item.date || 'TBD'}
        </span>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary shadow-sm transition-all group-hover:bg-primary group-hover:text-primary-foreground">
          <ChevronRight size={22} />
        </div>
      </div>
    </div>
  );
};

const ResultsList: React.FC<ResultsListProps> = ({ results, isSearching, hasSearched, onSelect }) => {
  if (isSearching) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="mb-4 h-6 w-6 animate-spin text-muted-foreground" />
        <p className="font-data text-xs text-muted-foreground">Hybrid Intelligence Search...</p>
      </div>
    );
  }

  if (results.length > 0) {
    const localResults = results.filter(r => isLocalSource(r.source));
    const aiResults = results.filter(r => !isLocalSource(r.source));

    return (
      <div className="space-y-10">
        {/* 내부 DB 섹션 */}
        {localResults.length > 0 && (
          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-600 text-white">
                <ShieldCheck size={14} />
              </div>
              <h2 className="font-display text-sm uppercase tracking-widest text-foreground">
                내부 DB 확정 데이터
              </h2>
              <span className="rounded-full bg-green-100 px-3 py-0.5 font-data text-[10px] font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                {localResults.length}건
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {localResults.map((item) => (
                <LocalCard key={item.id} item={item} onSelect={onSelect} />
              ))}
            </div>
          </section>
        )}

        {/* AI 검색 섹션 */}
        {aiResults.length > 0 && (
          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-white">
                <Zap size={14} />
              </div>
              <h2 className="font-display text-sm uppercase tracking-widest text-foreground">
                AI 웹 검색 참고
              </h2>
              <span className="rounded-full bg-amber-100 px-3 py-0.5 font-data text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {aiResults.length}건
              </span>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {aiResults.map((item) => (
                <AICard key={item.id} item={item} onSelect={onSelect} />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  if (hasSearched) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AlertCircle className="mb-3 h-5 w-5 text-muted-foreground" />
        <p className="font-display text-sm text-foreground">데이터를 찾을 수 없습니다</p>
        <p className="mt-1 font-data text-xs text-muted-foreground">건물명이나 상세 주소(동/번지)를 정확히 입력해 보세요.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-5xl border-2 border-dashed border-border bg-card py-40">
      <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-secondary">
        <Database size={40} className="text-muted-foreground/20" />
      </div>
      <div className="space-y-2 text-center">
        <p className="font-display text-sm uppercase tracking-[0.4em] text-muted-foreground">Integrated Hybrid Search Engine</p>
        <p className="font-body text-xs font-bold text-muted-foreground/60">Enter keywords to start real-time AI & Internal analysis</p>
      </div>
    </div>
  );
};

export default ResultsList;