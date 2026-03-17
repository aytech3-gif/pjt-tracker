import type { ProjectResult } from '@/components/ResultsList';
import { supabase } from '@/integrations/supabase/client';

const APP_ID = 'lge-pjt-tracker-v3';
const LOCAL_DB_KEY = `${APP_ID}_db`;
const LOCAL_DB_VERSION_KEY = `${APP_ID}_db_version`;
const CLOUD_FILE_PATH = 'shared/local-db.json';
const INDEXED_DB_NAME = `${APP_ID}-indexed`;
const INDEXED_DB_STORE = 'kv';
const INDEXED_DB_VERSION = 1;

export interface LocalDBItem {
  [key: string]: string;
}

export interface LocalDBIndexedItem extends LocalDBItem {
  _searchIdx: string;
  _searchCompact: string;
  _nameCompact: string;
  _addrCompact: string;
}

const normalizeSearchText = (value: string): string => {
  return value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/-/g, '')
    .replace(/[^0-9a-z가-힣]/g, '');
};

/**
 * Levenshtein edit distance.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Combined similarity: max of bigram Dice and Levenshtein-based similarity.
 * Returns 0~1. Guard: returns 0 for very short strings to prevent false positives.
 */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 1;

  // Prevent false positives on very short strings (< 3 chars)
  if (a.length < 3 || b.length < 3) return 0;

  // Levenshtein-based similarity
  const maxLen = Math.max(a.length, b.length);
  const levSim = 1 - levenshtein(a, b) / maxLen;

  // Bigram Dice coefficient
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  const bigramsA = new Set<string>();
  for (let i = 0; i < shorter.length - 1; i++) bigramsA.add(shorter.slice(i, i + 2));
  let matches = 0;
  for (let i = 0; i < longer.length - 1; i++) {
    if (bigramsA.has(longer.slice(i, i + 2))) matches++;
  }
  const total = (shorter.length - 1) + (longer.length - 1);
  const diceSim = total > 0 ? (2 * matches) / total : 0;

  return Math.max(levSim, diceSim);
}

// ── IndexedDB helpers (cached connection) ──

let _dbInstance: IDBDatabase | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (_dbInstance) {
    try {
      // Quick check if connection is still alive
      _dbInstance.transaction(INDEXED_DB_STORE, 'readonly');
      return Promise.resolve(_dbInstance);
    } catch {
      _dbInstance = null;
    }
  }
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB를 사용할 수 없습니다.'));
      return;
    }
    const request = indexedDB.open(INDEXED_DB_NAME, INDEXED_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(INDEXED_DB_STORE)) {
        db.createObjectStore(INDEXED_DB_STORE);
      }
    };
    request.onsuccess = () => {
      _dbInstance = request.result;
      _dbInstance.onclose = () => { _dbInstance = null; };
      resolve(_dbInstance);
    };
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open 실패'));
  });
};

const idbGet = async (key: string): Promise<string | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(INDEXED_DB_STORE, 'readonly');
    const store = tx.objectStore(INDEXED_DB_STORE);
    const request = store.get(key);
    request.onsuccess = () => resolve((request.result as string | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB read 실패'));
  });
};

const idbSet = async (key: string, value: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(INDEXED_DB_STORE, 'readwrite');
    const store = tx.objectStore(INDEXED_DB_STORE);
    store.put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write 실패'));
    tx.onabort = () => reject(new Error('IndexedDB write 중단'));
  });
};

// ── Cloud storage helpers ──

async function getCloudVersion(): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('local-db')
      .list('shared', { limit: 1, search: 'local-db.json' });
    if (error || !data || data.length === 0) return null;
    return data[0].updated_at || data[0].created_at || 'unknown';
  } catch {
    return null;
  }
}

async function downloadFromCloud(): Promise<LocalDBItem[] | null> {
  try {
    const { data, error } = await supabase.storage
      .from('local-db')
      .download(CLOUD_FILE_PATH);
    if (error || !data) return null;
    const text = await data.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return null;
    return parsed as LocalDBItem[];
  } catch {
    return null;
  }
}

export async function uploadToCloud(items: LocalDBItem[]): Promise<void> {
  const json = JSON.stringify(items);
  const blob = new Blob([json], { type: 'application/json' });
  const { error } = await supabase.storage
    .from('local-db')
    .upload(CLOUD_FILE_PATH, blob, { upsert: true });
  if (error) throw new Error(`클라우드 업로드 실패: ${error.message}`);
}

// ── Main API ──

export async function loadLocalDB(): Promise<LocalDBItem[]> {
  const cloudVersion = await getCloudVersion();

  let cachedVersion: string | null = null;
  try {
    cachedVersion = await idbGet(LOCAL_DB_VERSION_KEY);
  } catch { /* no cache */ }

  if (cloudVersion && cloudVersion !== cachedVersion) {
    const cloudData = await downloadFromCloud();
    if (cloudData && cloudData.length > 0) {
      try {
        await idbSet(LOCAL_DB_KEY, JSON.stringify(cloudData));
        await idbSet(LOCAL_DB_VERSION_KEY, cloudVersion);
      } catch { /* cache failed, still usable */ }
      return cloudData;
    }
  }

  try {
    const cached = await idbGet(LOCAL_DB_KEY);
    if (cached) return JSON.parse(cached);
  } catch { /* no cache */ }

  return [];
}

export async function saveLocalDB(data: LocalDBItem[]): Promise<void> {
  const json = JSON.stringify(data);
  try {
    await idbSet(LOCAL_DB_KEY, json);
  } catch { /* cache failed */ }

  await uploadToCloud(data);

  try {
    const newVersion = new Date().toISOString();
    await idbSet(LOCAL_DB_VERSION_KEY, newVersion);
  } catch { /* ok */ }
}

/**
 * Build search index — pre-compute normalized fields for faster search.
 */
export function buildSearchIndex(data: LocalDBItem[]): LocalDBIndexedItem[] {
  return data.map(item => {
    const bizIds = [item['건축주사업자번호'], item['설계자사업자번호'], item['시공자사업자번호']]
      .filter(Boolean)
      .map(id => id.replace(/-/g, ''))
      .join(' ');
    const mergedText = `${Object.values(item).join(' ')} ${bizIds}`;

    // Pre-compute per-field normalized text for fuzzy matching
    const nameCompact = normalizeSearchText(item['건물명'] || item['공사명'] || '');
    const addrCompact = normalizeSearchText(
      [item['시도'], item['시군구'], item['법정동'], item['대지위치']].filter(Boolean).join('')
    );

    return {
      ...item,
      _searchIdx: mergedText.toLowerCase(),
      _searchCompact: normalizeSearchText(mergedText),
      _nameCompact: nameCompact,
      _addrCompact: addrCompact,
    };
  });
}

// Unique ID counter
let _idCounter = 0;

/**
 * Search local DB with exact substring + fuzzy (70%+) matching.
 * Pre-computed _nameCompact / _addrCompact avoids redundant normalization per search.
 */
export function searchLocalDB(indexedData: LocalDBIndexedItem[], query: string): ProjectResult[] {
  const rawQ = query.trim().toLowerCase();
  const compactQ = normalizeSearchText(rawQ);

  if (rawQ.length < 2 && compactQ.length < 2) return [];

  const scored: { item: LocalDBIndexedItem; score: number }[] = [];
  const doFuzzy = compactQ.length >= 3; // Only fuzzy-match for meaningful queries

  // Normalize biz number query (strip dashes) for dedicated biz number matching
  const isBizNoQuery = /^\d[\d-]{5,}$/.test(rawQ.replace(/\s/g, ''));
  const bizNoQ = rawQ.replace(/[\s-]/g, '');

  for (const item of indexedData) {
    // 1) Exact substring match → score 1.0
    if (item._searchIdx.includes(rawQ) || (compactQ.length >= 2 && item._searchCompact.includes(compactQ))) {
      scored.push({ item, score: 1.0 });
      continue;
    }

    // 2) Business number match (dash-insensitive)
    if (isBizNoQuery && bizNoQ.length >= 6) {
      const itemBizNos = [
        item['건축주사업자번호'], item['설계자사업자번호'], item['시공자사업자번호']
      ].filter(Boolean).map(v => v.replace(/[\s-]/g, ''));
      if (itemBizNos.some(bn => bn.includes(bizNoQ) || bizNoQ.includes(bn))) {
        scored.push({ item, score: 1.0 });
        continue;
      }
    }

    // 3) Fuzzy match against name and address (threshold 0.55)
    if (doFuzzy) {
      const nameSim = similarity(compactQ, item._nameCompact);
      const addrSim = similarity(compactQ, item._addrCompact);
      const bestSim = Math.max(nameSim, addrSim);

      if (bestSim >= 0.55) {
        scored.push({ item, score: bestSim });
      }
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored
    .slice(0, 20)
    .map(({ item, score }) => {
      const formatNum = (val: string | undefined) => {
        if (!val || val === '0') return '';
        const num = parseFloat(String(val).replace(/,/g, ''));
        return isNaN(num) ? val : num.toLocaleString();
      };

      const addressParts = [item['시도'], item['시군구'], item['법정동']].filter(Boolean);
      let lot = (item['번'] && item['번'] !== '0') ? String(item['번']).replace(/^0+/, '') : '';
      if (lot && item['지'] && item['지'] !== '0') lot += `-${String(item['지']).replace(/^0+/, '')}`;
      const address = addressParts.length > 0 ? [...addressParts, lot].join(' ').trim() : '';

      // Status from dates
      const hasPermit = !!item['허가일'];
      const hasStart = !!item['착공일'];
      const hasCompletion = !!item['준공일'];
      let status = '확인필요';
      if (hasCompletion) status = '준공';
      else if (hasStart) status = '착공';
      else if (hasPermit) status = '인허가';

      // Builder status
      let builderStatus = '';
      if (item['시공자상호명'] && item['시공자상호명'] !== '확인필요' && item['시공자상호명'].trim()) {
        builderStatus = `선정 (${item['시공자상호명']})`;
      } else {
        builderStatus = '미선정';
      }

      return {
        id: `local-${++_idCounter}-${Date.now()}`,
        name: item['건물명'] || item['공사명'] || '정보없음',
        address: address || item['대지위치'] || '',
        developer: item['건축주상호명'] || '확인필요',
        builder: item['시공자상호명'] || '확인필요',
        designer: item['설계자상호명'] || '',
        scale: `지상${item['지상층수'] || '?'}층/지하${item['지하층수'] || '?'}층`,
        purpose: item['주용도'] || '',
        area: item['연면적(㎡)'] ? `${formatNum(item['연면적(㎡)'])}` : (item['연면적'] || ''),
        status,
        date: item['허가일'] || item['착공일'] || '',
        source: '📂 내부 DB',
        summary: '',
        ownerBizNo: item['건축주사업자번호'] || '',
        startDate: item['착공일'] || '',
        completionDate: item['준공일'] || '',
        builderStatus,
        matchRate: Math.round(score * 100),
      };
    });
}