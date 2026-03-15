import React from 'react';
import { Activity, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface SearchLog {
  query: string;
  time: string;
  user: string;
}

interface LocalDBItem {
  [key: string]: string;
}

interface AdminPanelProps {
  searchHistory: SearchLog[];
  onDataUpload: (data: LocalDBItem[]) => void;
  localDbCount: number;
}

const parseCSV = (text: string): LocalDBItem[] => {
  const rows = text.split(/\r?\n/);
  if (rows.length === 0) return [];
  const headers = parseCSVRow(rows[0]);
  return rows.slice(1).filter(row => row.trim()).map(row => {
    const values = parseCSVRow(row);
    const obj: LocalDBItem = {};
    headers.forEach((header, i) => {
      obj[header] = (values[i] || '').trim();
    });
    return obj;
  });
};

const parseCSVRow = (row: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (inQuotes) {
      if (ch === '"' && row[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
};

const AdminPanel: React.FC<AdminPanelProps> = ({ searchHistory, onDataUpload, localDbCount }) => {
  const readFileWithEncoding = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Try UTF-8 first
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        // If garbled (contains replacement chars or mojibake patterns), retry with EUC-KR
        if (text && (text.includes('�') || /[\uFFFD]/.test(text) || /^[^\x00-\x7F]{2,}[,\r\n]/.test(text) === false && /[\x80-\xFF]/.test(text.slice(0, 200)))) {
          const readerKR = new FileReader();
          readerKR.onload = (ev2) => resolve(ev2.target?.result as string);
          readerKR.onerror = reject;
          readerKR.readAsText(file, 'euc-kr');
        } else {
          resolve(text);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileWithEncoding(file);
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        toast.error('데이터를 파싱할 수 없습니다. 파일 형식을 확인하세요.');
        return;
      }
      // Validate: check if expected columns exist
      const sample = parsed[0];
      const expectedCols = ['건물명', '시도', '주용도'];
      const foundCols = expectedCols.filter(c => c in sample);
      if (foundCols.length === 0) {
        toast.warning('컬럼명이 인식되지 않습니다. 인코딩 문제일 수 있습니다.');
      }
      onDataUpload(parsed);
      toast.success(`로컬 DB에 ${parsed.length.toLocaleString()}건의 기준 데이터를 동기화했습니다. (${foundCols.length}/${expectedCols.length} 컬럼 확인)`);
    } catch {
      toast.error('CSV 처리 실패');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-12 py-12">
      {/* CSV Upload */}
      <div className="rounded-5xl border border-border bg-card p-20 text-center shadow-2xl transition-all">
        <div className="mx-auto mb-10 inline-flex rounded-4xl bg-primary/10 p-10 text-primary shadow-xl transition-transform hover:scale-110">
          <Upload size={56} />
        </div>
        <h2 className="mb-6 font-display text-3xl tracking-tighter text-foreground">
          Database Migration Center
        </h2>
        <p className="mx-auto mb-4 max-w-md font-display text-xs uppercase leading-relaxed tracking-[0.2em] text-muted-foreground">
          LG전자 세일즈 자산을 보호하기 위해 최신 인허가 소스 데이터를 업로드하십시오.
          <br />(CSV 형식만 지원됩니다)
        </p>
        {localDbCount > 0 && (
          <p className="mb-8 font-data text-sm font-bold text-primary">
            현재 로컬 DB: {localDbCount.toLocaleString()}건
          </p>
        )}
        <label className="inline-flex cursor-pointer items-center gap-8 rounded-3xl bg-foreground px-16 py-6 font-display text-sm uppercase tracking-widest text-primary-foreground shadow-2xl transition-all hover:bg-primary active:scale-95">
          Select Master CSV Source
          <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
        </label>
      </div>

      {/* Search History */}
      <div>
        <h2 className="mb-4 font-display text-sm text-foreground">Activity Logs</h2>
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className="custom-scrollbar max-h-[50vh] overflow-y-auto">
            {searchHistory.length > 0 ? (
              searchHistory.map((log, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between border-b border-border px-6 py-4 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <Activity className="h-3 w-3 text-muted-foreground" />
                    <span className="font-data text-xs text-foreground">"{log.query}"</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-data text-[10px] text-muted-foreground">{log.user}</span>
                    <span className="font-data text-[10px] text-muted-foreground">
                      {new Date(log.time).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="p-8 text-center font-data text-xs text-muted-foreground">
                검색 이력이 없습니다.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
