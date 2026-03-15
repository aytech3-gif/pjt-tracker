import React from 'react';
import { Search, Loader2, Sparkles } from 'lucide-react';

interface SearchBarProps {
  query: string;
  onQueryChange: (val: string) => void;
  onSearch: () => void;
  isSearching: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ query, onQueryChange, onSearch, isSearching }) => {
  return (
    <div className="relative mx-auto max-w-4xl">
      <input
        type="text"
        className="w-full rounded-4xl border border-border bg-card py-8 pl-14 pr-44 font-body text-xl font-bold shadow-2xl outline-none transition-all placeholder:text-muted-foreground/30 focus:border-primary focus:ring-4 focus:ring-primary/5"
        placeholder="현장명, 지번, 또는 광범위한 지역 재개발 키워드..."
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSearch()}
      />
      <Search className="absolute left-7 top-1/2 -translate-y-1/2 text-muted-foreground/30" size={28} />
      <button
        onClick={onSearch}
        disabled={isSearching}
        className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-3 rounded-3xl bg-foreground px-10 py-4 font-display text-sm uppercase tracking-widest text-primary-foreground transition-all hover:bg-primary active:scale-95 disabled:opacity-50"
      >
        {isSearching ? (
          <Loader2 className="animate-spin" size={20} />
        ) : (
          <>
            <Sparkles size={20} />
            AI Intelligence
          </>
        )}
      </button>
    </div>
  );
};

export default SearchBar;
