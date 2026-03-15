import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut, Copy, CheckCircle, Globe, Building2, MapPin, Calendar, Layers,
  Newspaper, ExternalLink, TrendingUp, Loader2, Search
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { ProjectResult } from './ResultsList';

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  date?: string;
}

interface DetailModalProps {
  project: ProjectResult | null;
  onClose: () => void;
  onSearchDeveloper?: (developer: string) => void;
}

const isAISource = (source: string) => !source.includes('로컬') && !source.includes('공공데이터');

const DetailModal: React.FC<DetailModalProps> = ({ project, onClose, onSearchDeveloper }) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (project) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [project, onClose]);

  useEffect(() => {
    if (!project) { setNewsArticles([]); setNewsLoading(false); return; }
    let cancelled = false;
    const fetchNews = async () => {
      setNewsLoading(true);
      setNewsArticles([]);
      try {
        const { data, error } = await supabase.functions.invoke('news-search', { body: { query: project.name } });
        if (cancelled) return;
        if (!error && data?.success && Array.isArray(data.articles)) {
          setNewsArticles(data.articles.filter((a: NewsArticle) => a.title));
        }
      } catch { /* ignore */ } finally { if (!cancelled) setNewsLoading(false); }
    };
    fetchNews();
    return () => { cancelled = true; };
  }, [project?.id]);

  const copyToClipboard = useCallback(() => {
    if (!project) return;
    const text = `[현장정보] ${project.name}\n주소: ${project.address}\n용도: ${project.purpose}\n규모: ${project.scale}\n설계: ${project.designer || '-'}\n시행: ${project.developer}\n시공: ${project.builder}\n현황: ${project.status}\n출처: LG PJT-Tracker Intelligence`;
    navigator.clipboard.writeText(text).then(() => { setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); });
  }, [project]);

  const handleDeveloperClick = useCallback(() => {
    if (!project?.developer || ['정보 없음', '미정', '확인필요'].includes(project.developer)) return;
    onSearchDeveloper?.(project.developer);
    onClose();
  }, [project, onSearchDeveloper, onClose]);

  if (!project) return null;
  const isAI = isAISource(project.source);
  const isClickableDev = project.developer && !['정보 없음', '미정', '확인필요'].includes(project.developer);

  return (
    <AnimatePresence>
      <motion.div
        key="detail-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 backdrop-blur-md p-4"
      >
        <div className="absolute inset-0" onClick={onClose} role="button" tabIndex={-1} aria-label="모달 닫기" />

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="scrollbar-hide relative max-h-[95vh] w-full max-w-6xl overflow-y-auto rounded-5xl bg-card shadow-2xl"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/90 p-10 backdrop-blur-md">
            <div className="flex items-center gap-6">
              <div className={`flex h-16 w-16 items-center justify-center rounded-2xl text-primary-foreground shadow-lg ${isAI ? 'bg-foreground' : 'bg-primary'}`}>
                {isAI ? <Globe size={30} /> : <Building2 size={30} />}
              </div>
              <div>
                <p className="mb-1 font-display text-[10px] uppercase tracking-widest text-muted-foreground">
                  {isAI ? 'AI Web Search Result' : 'Internal / Public Record'}
                </p>
                <h2 className="font-display text-2xl text-foreground">{project.name}</h2>
              </div>
            </div>
            <button onClick={onClose} className="rounded-full p-4 transition-all hover:bg-secondary">
              <LogOut className="rotate-90 text-muted-foreground" size={32} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-10 p-10 lg:grid-cols-12">
            {/* Main content */}
            <div className="space-y-10 lg:col-span-8">
              {/* Spec cards */}
              <div className="grid grid-cols-3 gap-6">
                {[
                  { label: '규모', val: project.scale || '확인중', icon: <Layers size={14} /> },
                  { label: '연면적', val: project.area || '확인중', icon: <MapPin size={14} /> },
                  { label: '기준일자', val: project.date || '-', icon: <Calendar size={14} /> },
                ].map((s, i) => (
                  <div key={i} className="rounded-3xl border border-border bg-secondary p-6">
                    <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                      {s.icon}
                      <span className="font-display text-[9px] uppercase tracking-tighter">{s.label}</span>
                    </div>
                    <p className="font-display text-lg text-foreground">{s.val}</p>
                  </div>
                ))}
              </div>

              {/* Address — click to open Naver Map */}
              <a
                href={`https://map.naver.com/v5/search/${encodeURIComponent(project.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between rounded-4xl bg-foreground p-8 text-primary-foreground transition-all hover:ring-2 hover:ring-primary"
              >
                <div>
                  <p className="mb-3 font-display text-[9px] uppercase tracking-widest opacity-40">Project Location · 클릭하면 네이버지도</p>
                  <p className="font-display text-2xl leading-snug group-hover:underline">{project.address}</p>
                </div>
                <ExternalLink size={20} className="flex-shrink-0 opacity-40 transition-opacity group-hover:opacity-100" />
              </a>

              {/* Stakeholders & Summary */}
              <div className="grid grid-cols-2 gap-8">
                <section className="space-y-4">
                  <h4 className="px-2 font-display text-[10px] uppercase tracking-widest text-muted-foreground">Stakeholders</h4>
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                      <p className="mb-1 font-body text-[8px] font-bold uppercase text-muted-foreground">건축주/시행사</p>
                      {isClickableDev ? (
                        <button onClick={handleDeveloperClick} className="group flex items-center gap-1.5 font-body font-bold text-primary underline underline-offset-2">
                          {project.developer}
                          <Search className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                        </button>
                      ) : (
                        <p className="truncate font-body font-bold text-foreground">{project.developer || '미등록'}</p>
                      )}
                    </div>
                    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                      <p className="mb-1 font-body text-[8px] font-bold uppercase text-muted-foreground">시공사</p>
                      <p className="truncate font-body font-bold text-foreground">{project.builder || '확인불가'}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                      <p className="mb-1 font-body text-[8px] font-bold uppercase text-muted-foreground">설계사</p>
                      <p className="truncate font-body font-bold text-foreground">{project.designer || '확인불가'}</p>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h4 className="px-2 font-display text-[10px] uppercase tracking-widest text-muted-foreground">AI Summary & News</h4>
                  {project.summary && (
                    <div className="rounded-2xl border border-border bg-secondary p-5">
                      <p className="mb-2 flex items-center gap-1 font-body text-[8px] font-bold uppercase text-muted-foreground">
                        <Newspaper size={10} /> Project Summary
                      </p>
                      <p className="line-clamp-5 font-body text-sm font-bold italic leading-relaxed text-foreground">{project.summary}</p>
                    </div>
                  )}
                  {/* News */}
                  {newsLoading ? (
                    <div className="flex items-center gap-2 py-4">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      <span className="font-data text-xs text-muted-foreground">뉴스 검색 중...</span>
                    </div>
                  ) : newsArticles.length > 0 ? (
                    <div className="grid gap-2">
                      {newsArticles.map((article, idx) => {
                        const linkUrl = article.url?.startsWith('http') ? article.url : `https://www.google.com/search?q=${encodeURIComponent(article.title)}&tbm=nws`;
                        return (
                          <a key={idx} href={linkUrl} target="_blank" rel="noopener noreferrer" className="group rounded-2xl border border-border bg-card p-3.5 transition-all hover:border-foreground">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-2 font-display text-xs text-foreground group-hover:underline">{article.title}</p>
                                {article.date && <span className="mt-1 block font-data text-[10px] text-primary">{article.date}</span>}
                              </div>
                              <ExternalLink className="mt-0.5 h-3 w-3 flex-shrink-0 text-muted-foreground" />
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="py-2 font-data text-xs text-muted-foreground">관련 뉴스가 없습니다.</p>
                  )}
                </section>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6 lg:col-span-4">
              <div className={`rounded-4xl p-8 text-primary-foreground shadow-xl ${isAI ? 'bg-gradient-to-br from-foreground to-foreground/80' : 'bg-gradient-to-br from-foreground to-foreground/90'}`}>
                <h4 className="mb-6 flex items-center gap-2 font-display text-[10px] uppercase tracking-widest text-primary">
                  <TrendingUp size={16} /> LGE Sales Strategy
                </h4>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <p className="font-body text-xs font-bold leading-relaxed text-primary-foreground/80">
                      {isAI ? '웹 검색 기반 전략: 재개발 초기 단계라면 건축심의 및 설계사 선정 시점에 맞춘 선제적 제안이 필요합니다.' : '데이터 기반 전략: 인허가 완료 현장이므로 시공사 선정 및 설비 발주 단계에 밀착 영업하십시오.'}
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <p className="font-body text-xs font-bold leading-relaxed text-primary-foreground/80">
                      {project.purpose} 용도에 최적화된 Chillers 및 시스템 에어컨 패키지를 구성하여 통합 제안하십시오.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-4xl border border-border bg-secondary p-8">
                <h4 className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">Detail Summary</h4>
                <div className="space-y-2">
                  <p className="flex justify-between font-body text-xs font-bold"><span>용도</span> <span className="text-foreground">{project.purpose || '확인불가'}</span></p>
                  <p className="flex justify-between font-body text-xs font-bold"><span>현황</span> <span className="text-foreground">{project.status || '확인불가'}</span></p>
                  <p className="flex justify-between font-body text-xs font-bold"><span>출처</span> <span className="text-foreground">{project.source}</span></p>
                </div>
              </div>

              {/* Copy */}
              <button
                onClick={copyToClipboard}
                className="flex w-full items-center justify-center gap-3 rounded-3xl bg-primary py-6 font-display text-xs uppercase tracking-widest text-primary-foreground shadow-xl transition-all hover:bg-foreground active:scale-95"
              >
                {copySuccess ? <CheckCircle size={18} /> : <Copy size={18} />}
                {copySuccess ? 'COPIED' : '정보 전체 복사'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DetailModal;
