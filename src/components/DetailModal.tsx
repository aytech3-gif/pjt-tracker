import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Copy, CheckCircle, ExternalLink,
  User, Building2, Maximize2, Info, Database, Calendar, MapPin
} from 'lucide-react';
import type { ProjectResult } from './ResultsList';

interface DetailModalProps {
  project: ProjectResult | null;
  onClose: () => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ project, onClose }) => {
  const [copySuccess, setCopySuccess] = useState(false);

  if (!project) return null;

  const copyToClipboard = () => {
    const text = `[현장정보] ${project.name}\n주소: ${project.address}\n용도: ${project.purpose}\n규모: ${project.scale}\n시행: ${project.developer}\n시공: ${project.builder}\n현황: ${project.status}\n출처: LG PJT-Tracker Intelligence`;
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const fields = [
    { label: '시행사', value: project.developer, icon: User },
    { label: '시공사', value: project.builder, icon: Building2 },
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
        {/* Overlay — does NOT dismiss */}
        <div className="absolute inset-0 bg-foreground/90" />

        {/* Panel */}
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

            {/* Address */}
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-border p-4">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div>
                <p className="font-body text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  대지위치
                </p>
                <p className="mt-1 font-data text-sm text-foreground">
                  {project.address}
                </p>
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
                  <p className="font-data text-sm text-foreground">
                    {f.value || '정보 없음'}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Summary */}
            {(project as any).summary && (
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
                  {(project as any).summary}
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
              <button
                onClick={() =>
                  window.open(
                    `https://map.kakao.com/?q=${encodeURIComponent(project.address)}`,
                    '_blank'
                  )
                }
                className="flex h-11 w-11 items-center justify-center rounded-sm bg-accent text-foreground transition-all hover:bg-primary hover:text-primary-foreground"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DetailModal;
