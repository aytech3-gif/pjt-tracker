import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import LoginScreen from '../components/LoginScreen';
import AppHeader from '../components/AppHeader';
import SearchBar from '../components/SearchBar';
import ResultsList, { type ProjectResult } from '../components/ResultsList';
import DetailModal from '../components/DetailModal';
import AdminPanel from '../components/AdminPanel';

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

const fetchBuildingIntelligence = async (query: string): Promise<ProjectResult[]> => {
  const { data, error } = await supabase.functions.invoke('building-search', {
    body: { query },
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

const Index = () => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'admin'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<ProjectResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPjt, setSelectedPjt] = useState<ProjectResult | null>(null);
  const [searchHistory, setSearchHistory] = useState<SearchLog[]>([]);

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

  const handleSearch = async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed || isSearching) return;

    setIsSearching(true);
    setHasSearched(true);
    setResults([]);

    const newLog: SearchLog = { query: trimmed, time: new Date().toISOString(), user: user?.email || '' };
    const updatedHistory = [newLog, ...searchHistory].slice(0, 30);
    setSearchHistory(updatedHistory);
    localStorage.setItem(`${APP_ID}_history`, JSON.stringify(updatedHistory));

    const intelResults = await fetchBuildingIntelligence(trimmed);
    setResults(intelResults);
    setIsSearching(false);
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
        </>
      )}

      <DetailModal project={selectedPjt} onClose={() => setSelectedPjt(null)} />
    </div>
  );
};

export default Index;
