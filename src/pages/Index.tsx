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

const safeJsonParse = (str: string) => {
  try {
    const jsonMatch = str.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch {
    return null;
  }
};

const fetchBuildingIntelligence = async (query: string): Promise<ProjectResult[]> => {
  const apiKey = API_KEY_GEMINI;

  const callIntelligence = async (retries = 3, delay = 1000): Promise<any[]> => {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `당신은 대한민국 건축물 및 건설 프로젝트 정보 전문가입니다. 
                입력된 키워드: "${query}"에 대해 [국토교통부 건축물대장 기본개요] 정보를 기반으로 실시간 검색을 수행하세요.
                
                검색 및 추출 항목 (중요):
                1. bldNm (건물명칭), platPlc (대지위치/주소)
                2. archArea (건축면적), totArea (연면적)
                3. strctCdNm (구조명칭), mainPurpsCdNm (주용도명칭)
                4. grndFlrCnt (지상층수), ugndFlrCnt (지하층수)
                5. pmsDay (허가일), stcnsDay (착공일), useAprvDay (사용승인일)
                6. 시행사(건축주), 시공사(건설사), 설계사 정보
                
                결과 형식: 반드시 아래 키를 가진 JSON 배열로 반환하세요.
                [{"name": "...", "address": "...", "developer": "...", "builder": "...", "scale": "지상n층/지하n층", "purpose": "...", "area": "연면적 n.n m²", "status": "착공/준공/예정", "date": "YYYY-MM-DD"}]
                검색 결과가 없으면 빈 배열 []을 반환하세요.`
              }]
            }],
            tools: [{ google_search: {} }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        }
      );

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const result = await response.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      return safeJsonParse(rawText) || [];
    } catch {
      if (retries > 0) {
        await new Promise((r) => setTimeout(r, delay));
        return callIntelligence(retries - 1, delay * 2);
      }
      return [];
    }
  };

  const data = await callIntelligence();
  return data.map((item: any, idx: number) => ({
    ...item,
    id: `pjt-${idx}-${Date.now()}`,
    source: '🏛️ 건축물대장 Grounding',
  }));
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
