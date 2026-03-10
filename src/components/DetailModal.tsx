import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Copy, CheckCircle,
  User, Building2, Maximize2, Info, Database, Calendar, MapPin, Pencil, Search, Loader2,
  Newspaper, ExternalLink
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

const DetailModal: React.FC<DetailModalProps> = ({ project, onClose, onSearchDeveloper }) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (project) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [project, onClose]);

  // 뉴스 fetch with AbortController (메모리 누수 방지)
  useEffect(() => {
    if (!project) {
      setNewsArticles([]);
      setNewsLoading(false);
      return;
    }

    const abortController = new AbortController();
    let isCancelled = false;

    const fetchNews = async () => {
      setNewsLoading(true);
      setNewsArticles([]);
      try {
        const { data, error } = await supabase.functions.invoke('news-search', {
          body: { query: project.name },
        });

        if (isCancelled) return;

        if (!error && data?.success && Array.isArray(data.articles)) {
          // URL이 유효한 기사만 필터링
          const validArticles = data.articles.filter(
            (a: NewsArticle) => a.title && a.url && a.url.startsWith('http')
          );
          setNewsArticles(validArticles);
        } else {
          setNewsArticles([]);
        }
      } catch (e) {
        if (!isCancelled) {
          console.error('News fetch error:', e);
          setNewsArticles([]);
        }
      } finally {
        if (!isCancelled) {
          setNewsLoading(false);
        }
      }
    };

    fetchNews();

    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [project?.id]);

  const copyToClipboard = useCallback(() => {
    if (!project) return;
    const text = `[현장정보] ${project.name}\n주소: ${project.address}\n용도: ${project.purpose}\n규모: ${project.scale}\n설계: ${project.designer || '-'}\n시행: ${project.developer}\n시공: ${project.builder}\n현황: ${project.status}\n출처: LG PJT-Tracker Intelligence`;
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  }, [project]);

  const handleDeveloperClick = useCallback(() => {
    if (!project) return;
    const dev = project.developer;
    if (!dev || dev === '정보 없음' || dev === '미정' || dev === '확인필요') return;
    if (onSearchDeveloper) {
      onSearchDeveloper(dev);
      onClose();
    }
  }, [project, onSearchDeveloper, onClose]);

  const openNaverMap = useCallback(() => {
    if (!project) return;
    window.open(`https://map.naver.com/v5/search/${encodeURIComponent(project.address)}`, '_blank', 'noopener,noreferrer');
  }, [project]);

  const openGoogleMap = useCallback(() => {
    if (!project) return;
    window.open(`https://www.google.com/maps/search/${encodeURIComponent(project.address)}`, '_blank', 'noopener,noreferrer');
  }, [project]);

  const isOpen = project !== null;

  const isClickableDeveloper = project?.developer && project.developer !== '정보 없음' && project.developer !== '미정' && project.developer !== '확인필요';

  const fields = project
    ? [
        { label: '시행사', value: project.developer, icon: User, clickable: isClickableDeveloper },
        { label: '시공사', value: project.builder, icon: Building2 },
        { label: '설계사', value: project.designer, icon: Pencil },
        { label: '건물규모', value: project.scale, icon: Maximize2 },
        { label: '연면적', value: project.area, icon: Info },
        { label: '주요용도', value: project.purpose, icon: Database },
        { label: '현황/일자', value: `${project.status} (${project.date || '-'})`, icon: Calendar },
      ]
    : [];

  return (
    <AnimatePresence>
      {isOpen && project && (
        <motion.div
          key="detail-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex justify-end"
        >
          {/* 배경 클릭으로 닫기 */}
          <div
            className="absolute inset-0 bg-foreground/90"
            onClick={onClose}
            role="button"
            tabIndex={-1}
            aria-label="모달 닫기"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="relative w-[85vw] max-w-2xl overflow-y-auto bg-card custom-scrollbar"
          >
            <div className="p-8">
              {/* Header */}
              <div className="mb-8 flex items-start justify-between">
                <div>
                  <span className="font-data text-[10px] text-muted-foreground">
                    {project.purpose}
                  </span>
                  <h2 className="mt-1 font-display text-lg text-foreground">
                    {project.name}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-sm bg-accent p-2 text-muted-foreground transition-all hover:text-primary"
                  aria-label="닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Address with Map Links */}
              <div className="mb-6 rounded-lg border border-border p-4">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      대지위치
                    </p>
                    <p className="mt-1 font-data text-sm text-foreground">
                      {project.address}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2 pl-7">
                  <button
                    onClick={openNaverMap}
                    className="flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 font-data text-[10px] text-muted-foreground transition-all hover:border-foreground hover:text-foreground"
                  >
                    <MapPin className="h-3 w-3" />
                    네이버지도
                  </button>
                  <button
                    onClick={openGoogleMap}
                    className="flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 font-data text-[10px] text-muted-foreground transition-all hover:border-foreground hover:text-foreground"
                  >
                    <MapPin className="h-3 w-3" />
                    구글지도
                  </button>
                </div>
              </div>

              {/* Data Fields */}
              <div className="space-y-0 divide-y divide-border">
                {fields.map((f, i) => (
                  <motion.div
                    key={f.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.075, duration: 0.3 }}
                    className="flex items-start gap-3 py-4"
                  >
                    <div className="flex items-center gap-2 pt-0.5">
                      <f.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="w-16 font-body text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {f.label}
                      </span>
                    </div>
                    {f.clickable ? (
                      <button
                        onClick={handleDeveloperClick}
                        className="group flex items-center gap-1.5 font-data text-sm text-primary underline underline-offset-2 transition-all hover:text-primary/80"
                      >
                        {f.value || '정보 없음'}
                        <Search className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                      </button>
                    ) : (
                      <p className="font-data text-sm text-foreground">
                        {f.value || '정보 없음'}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Summary */}
              {project.summary && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.3 }}
                  className="mt-6 rounded-lg border border-border bg-accent/50 p-4"
                >
                  <p className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    프로젝트 요약
                  </p>
                  <p className="font-body text-sm text-foreground leading-relaxed">
                    {project.summary}
                  </p>
                </motion.div>
              )}

              {/* Related News */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.3 }}
                className="mt-6"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Newspaper className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    관련 뉴스
                  </p>
                </div>
                {newsLoading ? (
                  <div className="flex items-center gap-2 py-4">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <span className="font-data text-xs text-muted-foreground">뉴스 검색 중...</span>
                  </div>
                ) : newsArticles.length > 0 ? (
                  <div className="grid gap-2">
                    {newsArticles.map((article, idx) => (
                      <a
                        key={`${article.url}-${idx}`}
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-lg border border-border bg-accent/30 p-3.5 transition-all hover:border-foreground hover:bg-accent/60"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-display text-xs text-foreground line-clamp-2 group-hover:underline">
                              {article.title}
                            </p>
                            {article.description && (
                              <p className="mt-1 font-data text-[10px] text-muted-foreground line-clamp-2">
                                {article.description}
                              </p>
                            )}
                          </div>
                          <ExternalLink className="mt-0.5 h-3 w-3 flex-shrink-0 text-muted-foreground group-hover:text-foreground" />
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="font-data text-xs text-muted-foreground py-2">관련 뉴스가 없습니다.</p>
                )}
              </motion.div>

              {/* Actions */}
              <div className="mt-8 flex gap-2">
                <button
                  onClick={copyToClipboard}
                  className="flex flex-1 items-center justify-center gap-2 rounded-sm bg-foreground py-3 font-display text-xs uppercase tracking-widest text-card transition-all hover:opacity-90 active:scale-[0.98]"
                >
                  {copySuccess ? (
                    <CheckCircle className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copySuccess ? 'COPIED' : '정보 전체 복사'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DetailModal;
