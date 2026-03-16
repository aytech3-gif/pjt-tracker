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
    <div className="mx-auto max-w-4xl">
      <div className="relative">
        <input
          type="text"
          className="w-full rounded-2xl border border-border bg-card py-4 pl-10 pr-4 font-body text-sm font-bold shadow-2xl outline-none transition-all placeholder:text-muted-foreground/30 focus:border-primary focus:ring-4 focus:ring-primary/5 sm:rounded-4xl sm:py-8 sm:pl-14 sm:pr-44 sm:text-xl"
          placeholder="현장명, 지번, 재개발 키워드..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/30 sm:left-7" size={20} />
        <button
          onClick={onSearch}
          disabled={isSearching}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-6 py-3 font-display text-xs uppercase tracking-widest text-primary-foreground transition-all hover:bg-primary active:scale-95 disabled:opacity-50 sm:absolute sm:right-4 sm:top-1/2 sm:mt-0 sm:w-auto sm:-translate-y-1/2 sm:rounded-3xl sm:px-10 sm:py-4 sm:text-sm sm:gap-3"
        >
          {isSearching ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <>
              <Sparkles size={18} />
              AI Intelligence
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default SearchBar;
