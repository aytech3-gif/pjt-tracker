import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Copy, CheckCircle,
  User, Building2, Maximize2, Info, Database, Calendar, MapPin, Pencil, Search, Loader2,
  Newspaper, ExternalLink
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { ProjectResult } from './ResultsList';

interface DetailModalProps {
  project: ProjectResult | null;
  onClose: () => void;
  onSearchDeveloper?: (developer: string) => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ project, onClose, onSearchDeveloper }) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [devSearching, setDevSearching] = useState(false);
  const [newsArticles, setNewsArticles] = useState<{ title: string; description: string; url: string }[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);

  useEffect(() => {
    if (!project) {
      setNewsArticles([]);
      return;
    }
    const fetchNews = async () => {
      setNewsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('news-search', {
          body: { query: project.name },
        });
        if (!error && data?.success) {
          setNewsArticles(data.articles || []);
        }
      } catch (e) {
        console.error('News fetch error:', e);
      } finally {
        setNewsLoading(false);
      }
    };
    fetchNews();
  }, [project]);

  if (!project) return null;

  const copyToClipboard = () => {
    const text = `[현장정보] ${project.name}\n주소: ${project.address}\n용도: ${project.purpose}\n규모: ${project.scale}\n설계: ${project.designer || '-'}\n시행: ${project.developer}\n시공: ${project.builder}\n현황: ${project.status}\n출처: LG PJT-Tracker Intelligence`;
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const handleDeveloperClick = () => {
    if (!project.developer || project.developer === '정보 없음' || project.developer === '미정' || project.developer === '확인필요') return;
    if (onSearchDeveloper) {
      setDevSearching(true);
      onSearchDeveloper(project.developer);
      onClose();
    }
  };

  const openNaverMap = () => {
    window.open(`https://map.naver.com/v5/search/${encodeURIComponent(project.address)}`, '_blank');
  };

  const openGoogleMap = () => {
    window.open(`https://www.google.com/maps/search/${encodeURIComponent(project.address)}`, '_blank');
  };

  const isClickableDeveloper = project.developer && project.developer !== '정보 없음' && project.developer !== '미정' && project.developer !== '확인필요';

  const fields = [
    { label: '시행사', value: project.developer, icon: User, clickable: isClickableDeveloper },
    { label: '시공사', value: project.builder, icon: Building2 },
    { label: '설계사', value: project.designer, icon: Pencil },
    { label: '건물규모', value: project.scale, icon: Maximize2 },
    { label: '연면적', value: project.area, icon: Info },
    { label: '주요용도', value: project.purpose, icon: Database },
    { label: '현황/일자', value: `${project.status} (${project.date || '-'})`, icon: Calendar },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex justify-end"
      >
        <div className="absolute inset-0 bg-foreground/90" />

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
    </AnimatePresence>
  );
};

export default DetailModal;
