import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import LoginScreen from '../components/LoginScreen';
import AppHeader from '../components/AppHeader';
import SearchBar from '../components/SearchBar';
import ResultsList, { type ProjectResult } from '../components/ResultsList';
import DetailModal from '../components/DetailModal';
import AdminPanel from '../components/AdminPanel';

import { Mail, Loader2 } from 'lucide-react';

const APP_ID = 'lge-pjt-tracker-v1';
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

  const headers = ['프로젝트명', '주소', '시행사', '시공사', '설계사', '규모', '용도', '연면적', '현황', '일자', '출처'];
  const rows = results.map(r => [
    r.name, r.address, r.developer, r.builder, r.designer || '', r.scale, r.purpose, r.area, r.status, r.date, r.source
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

  useEffect(() => {
    const savedUser = localStorage.getItem(`${APP_ID}_session`);
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem(`${APP_ID}_session`);
      }
    }
    const savedHistory = localStorage.getItem(`${APP_ID}_history`);
    if (savedHistory) setSearchHistory(JSON.parse(savedHistory));
  }, []);

  const isAdmin = useMemo(() => user?.email === ADMIN_EMAIL, [user]);

  const handleLogin = (u: UserSession) => {
    setUser(u);
    localStorage.setItem(`${APP_ID}_session`, JSON.stringify(u));
  };

  const handleLogout = () => {
    localStorage.removeItem(`${APP_ID}_session`);
    setUser(null);
  };

  const performSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || isSearching) return;

    setSearchQuery(trimmed);
    setIsSearching(true);
    setHasSearched(true);
    setResults([]);

    const newLog: SearchLog = { query: trimmed, time: new Date().toISOString(), user: user?.email || '' };
    const updatedHistory = [newLog, ...searchHistory].slice(0, 30);
    setSearchHistory(updatedHistory);
    localStorage.setItem(`${APP_ID}_history`, JSON.stringify(updatedHistory));

    const intelResults = await fetchBuildingIntelligence(trimmed, user?.email || '');
    setResults(intelResults);
    setIsSearching(false);
  };

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

      if (error) {
        console.error('Email send error:', error);
        toast.error('이메일 전송에 실패했습니다.');
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success(`${data.count}건의 누적 결과가 ${user.email}로 전송되었습니다.`);
    } catch (e) {
      console.error('Email error:', e);
      toast.error('이메일 전송 중 오류가 발생했습니다.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        isAdmin={isAdmin}
        activeTab={activeTab}
        onToggleAdmin={() => setActiveTab(activeTab === 'admin' ? 'search' : 'admin')}
        onLogout={handleLogout}
      />

      {activeTab === 'admin' ? (
        <AdminPanel searchHistory={searchHistory} />
      ) : (
        <>
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
                className="flex items-center gap-2 rounded-sm border border-border px-5 py-2.5 font-data text-xs text-muted-foreground transition-all hover:border-foreground hover:text-foreground"
              >
                📊 검색결과 Excel 다운로드
              </button>
              <button
                onClick={handleSendEmail}
                disabled={isSendingEmail}
                className="flex items-center gap-2 rounded-sm border border-primary/30 bg-primary/5 px-5 py-2.5 font-data text-xs text-primary transition-all hover:bg-primary/10 disabled:opacity-50"
              >
                {isSendingEmail ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Mail className="h-3.5 w-3.5" />
                )}
                {isSendingEmail ? '전송 중...' : `누적 검색결과 이메일 전송 (${user.email})`}
              </button>
            </div>
          )}
        </>
      )}

      <DetailModal
        project={selectedPjt}
        onClose={() => setSelectedPjt(null)}
        onSearchDeveloper={handleSearchDeveloper}
      />
    </div>
  );
};

export default Index;
