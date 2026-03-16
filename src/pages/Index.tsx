import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Loader2 } from 'lucide-react';
import LoginScreen from '../components/LoginScreen';
import AppHeader from '../components/AppHeader';
import SearchBar from '../components/SearchBar';
import ResultsList, { type ProjectResult } from '../components/ResultsList';
import DetailModal from '../components/DetailModal';
import AdminPanel from '../components/AdminPanel';
import { type LocalDBItem, loadLocalDB, saveLocalDB, buildSearchIndex, searchLocalDB } from '@/lib/local-db';

const APP_ID = 'lge-pjt-tracker-v3';
const ADMIN_EMAIL = 'jh5.park@lge.com';

interface UserSession {
  email: string;
  loginAt: string;
}

interface SearchLog {
  query: string;
  time: string;
  user: string;
}

const fetchBuildingIntelligence = async (query: string, userEmail: string): Promise<ProjectResult[]> => {
  const { data, error } = await supabase.functions.invoke('building-search', {
    body: { query, userEmail },
  });
  if (error) {
    console.error('Edge function error:', error);
    toast.error('검색 중 오류가 발생했습니다.');
    return [];
  }
  if (data?.error) {
    toast.error(data.error);
    return [];
  }
  return data?.results || [];
};

const downloadExcel = (results: ProjectResult[], query: string) => {
  if (results.length === 0) return;
  const headers = ['프로젝트명', '주소', '시행사', '시공사', '설계사', '규모', '용도', '연면적', '현황', '허가일', '착공일', '준공일', '사업자번호', '시공사선정', '출처'];
  const rows = results.map(r => [
    r.name, r.address, r.developer, r.builder, r.designer || '', r.scale, r.purpose, r.area, r.status, r.date,
    r.startDate || '', r.completionDate || '', r.ownerBizNo || '', r.builderStatus || '', r.source,
  ]);
  const csvContent = '\uFEFF' + [headers, ...rows].map(row =>
    row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PJT-Tracker_${query}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('Excel(CSV) 파일이 다운로드되었습니다.');
};

/** Normalize key for deduplication — strips whitespace, special chars */
const normalizeDedup = (name: string, address: string) =>
  `${name}_${address}`.toLowerCase().normalize('NFKC').replace(/[\s\-·,.()]/g, '');

const Index = () => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'admin'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<ProjectResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPjt, setSelectedPjt] = useState<ProjectResult | null>(null);
  const [searchHistory, setSearchHistory] = useState<SearchLog[]>([]);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [localDB, setLocalDB] = useState<LocalDBItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const savedUser = localStorage.getItem(`${APP_ID}_session`);
      if (savedUser) {
        try {
          if (!cancelled) setUser(JSON.parse(savedUser));
        } catch {
          localStorage.removeItem(`${APP_ID}_session`);
        }
      }

      const savedHistory = localStorage.getItem(`${APP_ID}_history`);
      if (savedHistory) {
        try {
          if (!cancelled) setSearchHistory(JSON.parse(savedHistory));
        } catch {
          localStorage.removeItem(`${APP_ID}_history`);
        }
      }

      const loaded = await loadLocalDB();
      if (!cancelled) setLocalDB(loaded);
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const indexedData = useMemo(() => buildSearchIndex(localDB), [localDB]);
  const isAdmin = useMemo(() => user?.email === ADMIN_EMAIL, [user]);
  const searchHistoryRef = useRef(searchHistory);
  searchHistoryRef.current = searchHistory;
  const isSearchingRef = useRef(false);

  const handleLogin = (u: UserSession) => {
    setUser(u);
    localStorage.setItem(`${APP_ID}_session`, JSON.stringify(u));
  };

  const handleLogout = () => {
    localStorage.removeItem(`${APP_ID}_session`);
    setUser(null);
  };

  const handleReset = () => {
    setSearchQuery('');
    setResults([]);
    setHasSearched(false);
    setSelectedPjt(null);
  };

  const handleDataUpload = async (data: LocalDBItem[]) => {
    setLocalDB(data);
    await saveLocalDB(data);
  };

  const performSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || isSearchingRef.current) return;

    isSearchingRef.current = true;
    setSearchQuery(trimmed);
    setIsSearching(true);
    setHasSearched(true);
    setResults([]);

    // Log history using ref to avoid stale closure
    const newLog: SearchLog = { query: trimmed, time: new Date().toISOString(), user: user?.email || '' };
    const updatedHistory = [newLog, ...searchHistoryRef.current].slice(0, 30);
    setSearchHistory(updatedHistory);
    localStorage.setItem(`${APP_ID}_history`, JSON.stringify(updatedHistory));

    // 1. Local DB search (instant) — show immediately
    const localResults = searchLocalDB(indexedData, trimmed);
    if (localResults.length > 0) {
      setResults(localResults);
    }

    // 2. Edge function search (async) — append when ready
    const edgeResults = await fetchBuildingIntelligence(trimmed, user?.email || '');

    // Merge: local DB first (trusted), then AI (reference) with fuzzy dedup
    const seen = new Set<string>();
    const merged: ProjectResult[] = [];

    for (const item of localResults) {
      const key = normalizeDedup(item.name, item.address);
      seen.add(key);
      merged.push(item);
    }
    for (const item of edgeResults) {
      const key = normalizeDedup(item.name, item.address);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }

    setResults(merged);
    setIsSearching(false);
    isSearchingRef.current = false;

    if (merged.length === 0) {
      toast.info('검색된 프로젝트가 없습니다.');
    } else if (localResults.length > 0 && edgeResults.length > 0) {
      toast.success(`내부 DB ${localResults.length}건 (확정) + AI ${edgeResults.length}건 (참고)`);
    } else if (localResults.length > 0 && edgeResults.length === 0) {
      toast.success(`내부 DB에서 ${localResults.length}건 확인됨 (100% 신뢰)`);
    } else if (localResults.length === 0 && edgeResults.length > 0) {
      toast.info('내부 DB에는 없으나, AI 검색 결과를 참고용으로 가져왔습니다.');
    }
  }, [user, indexedData]);

  const handleSearch = () => performSearch(searchQuery);

  const handleSearchDeveloper = (developer: string) => {
    toast.info(`"${developer}" 시행사 프로젝트를 검색합니다...`);
    performSearch(`${developer} 시행 프로젝트`);
  };

  const handleSendEmail = async () => {
    if (!user?.email || isSendingEmail) return;
    setIsSendingEmail(true);
    toast.info('누적 검색결과를 이메일로 전송 중...');
    try {
      const { data, error } = await supabase.functions.invoke('send-results-email', {
        body: { userEmail: user.email },
      });
      if (error) { toast.error('이메일 전송에 실패했습니다.'); return; }
      if (data?.error) { toast.error(data.error); return; }
      toast.success(`${data.count}건의 누적 결과가 ${user.email}로 전송되었습니다.`);
    } catch {
      toast.error('이메일 전송 중 오류가 발생했습니다.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-background font-body text-foreground selection:bg-primary/10 selection:text-primary">
      <AppHeader
        isAdmin={isAdmin}
        activeTab={activeTab}
        userEmail={user.email}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
        onReset={handleReset}
      />

      <main className="mx-auto max-w-7xl p-8 lg:p-12">
        {activeTab === 'admin' ? (
          <AdminPanel
            searchHistory={searchHistory}
            onDataUpload={handleDataUpload}
            localDbCount={localDB.length}
          />
        ) : (
          <div className="space-y-12">
            <SearchBar
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onSearch={handleSearch}
              isSearching={isSearching}
            />

            <ResultsList
              results={results}
              isSearching={isSearching}
              hasSearched={hasSearched}
              onSelect={setSelectedPjt}
            />

            {results.length > 0 && (
              <div className="flex flex-col items-center gap-3 pb-8">
                <button
                  onClick={() => downloadExcel(results, searchQuery)}
                  className="flex items-center gap-2 rounded-2xl border border-border bg-card px-6 py-3 font-data text-xs text-muted-foreground transition-all hover:border-foreground hover:text-foreground"
                >
                  📊 검색결과 Excel 다운로드
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={isSendingEmail}
                  className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-6 py-3 font-data text-xs text-primary transition-all hover:bg-primary/10 disabled:opacity-50"
                >
                  {isSendingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                  {isSendingEmail ? '전송 중...' : `누적 검색결과 이메일 전송 (${user.email})`}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <DetailModal
        project={selectedPjt}
        onClose={() => setSelectedPjt(null)}
        onSearchDeveloper={handleSearchDeveloper}
      />
    </div>
  );
};

export default Index;
