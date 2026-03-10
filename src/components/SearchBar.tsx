import React from 'react';
import { Search, Loader2 } from 'lucide-react';

interface SearchBarProps {
  query: string;
  onQueryChange: (val: string) => void;
  onSearch: () => void;
  isSearching: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ query, onQueryChange, onSearch, isSearching }) => {
  return (
    <div className="sticky top-[57px] z-20 border-b border-border bg-card px-6 py-4">
      <div className="mx-auto max-w-3xl">
        <div className="relative flex items-center">
          <Search className="absolute left-4 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="건물명, 주소, 프로젝트명 검색..."
            className="w-full rounded-lg border border-border bg-background py-3 pl-11 pr-24 font-data text-sm text-foreground outline-none transition-all focus:border-foreground"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          />
          <button
            onClick={onSearch}
            disabled={isSearching}
            className="absolute right-2 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="font-display text-[10px]">조회</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchBar;
