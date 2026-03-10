import React from 'react';
import { MapPin, ChevronRight, Loader2, AlertCircle } from 'lucide-react';

export interface ProjectResult {
  id: string;
  name: string;
  address: string;
  developer: string;
  builder: string;
  scale: string;
  purpose: string;
  area: string;
  status: string;
  date: string;
  source: string;
}

interface ResultsListProps {
  results: ProjectResult[];
  isSearching: boolean;
  hasSearched: boolean;
  onSelect: (item: ProjectResult) => void;
}

const ResultsList: React.FC<ResultsListProps> = ({ results, isSearching, hasSearched, onSelect }) => {
  if (isSearching) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="mb-4 h-6 w-6 animate-spin text-muted-foreground" />
        <p className="font-data text-xs text-muted-foreground">
          Grounding Official Records...
        </p>
      </div>
    );
  }

  if (results.length > 0) {
    return (
      <div className="space-y-2 p-6">
        <div className="mx-auto max-w-3xl space-y-2">
          {results.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className="group w-full rounded-lg border border-border bg-card p-5 text-left transition-all hover:border-foreground"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-data text-[10px] text-muted-foreground">
                      {item.source}
                    </span>
                    <span className="rounded-sm bg-accent px-2 py-0.5 font-data text-[10px] text-foreground">
                      {item.status}
                    </span>
                  </div>
                  <h3 className="font-display text-sm text-foreground">
                    {item.name}
                  </h3>
                  <p className="mt-1 flex items-center gap-1 font-data text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{item.address}</span>
                  </p>
                </div>
                <ChevronRight className="ml-3 mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground transition-all group-hover:text-foreground" />
              </div>
            </button>
          ))}
        </div>
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

  return null;
};

export default ResultsList;
