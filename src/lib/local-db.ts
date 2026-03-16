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
 * Calculate similarity ratio between two strings (0~1).
 * Uses longest common subsequence approach for Korean text matching.
 */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  // If one contains the other, high similarity
  if (a.includes(b) || b.includes(a)) return 1;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;

  // Bigram-based similarity (Dice coefficient)
  const bigramsA = new Set<string>();
  for (let i = 0; i < shorter.length - 1; i++) bigramsA.add(shorter.slice(i, i + 2));
  let matches = 0;
  for (let i = 0; i < longer.length - 1; i++) {
    if (bigramsA.has(longer.slice(i, i + 2))) matches++;
  }
  const total = (shorter.length - 1) + (longer.length - 1);
  return total > 0 ? (2 * matches) / total : 0;
}

// ── IndexedDB helpers ──

const openDB = (): Promise<IDBDatabase> => {
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
    request.onsuccess = () => resolve(request.result);
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
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
    tx.onabort = () => db.close();
  });
};

const idbSet = async (key: string, value: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(INDEXED_DB_STORE, 'readwrite');
    const store = tx.objectStore(INDEXED_DB_STORE);
    store.put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('IndexedDB write 실패')); };
    tx.onabort = () => { db.close(); reject(new Error('IndexedDB write 중단')); };
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
    return JSON.parse(text) as LocalDBItem[];
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

/**
 * Load local DB: check cloud version → if newer than cache, download → cache in IndexedDB.
 */
export async function loadLocalDB(): Promise<LocalDBItem[]> {
  // 1. Check cloud version
  const cloudVersion = await getCloudVersion();

  // 2. Check local cache version
  let cachedVersion: string | null = null;
  try {
    cachedVersion = await idbGet(LOCAL_DB_VERSION_KEY);
  } catch { /* no cache */ }

  // 3. If cloud has data and it's newer (or no cache), download
  if (cloudVersion && cloudVersion !== cachedVersion) {
    const cloudData = await downloadFromCloud();
    if (cloudData && cloudData.length > 0) {
      // Cache locally
      try {
        await idbSet(LOCAL_DB_KEY, JSON.stringify(cloudData));
        await idbSet(LOCAL_DB_VERSION_KEY, cloudVersion);
      } catch { /* cache failed, still usable */ }
      return cloudData;
    }
  }

  // 4. Use local cache
  try {
    const cached = await idbGet(LOCAL_DB_KEY);
    if (cached) return JSON.parse(cached);
  } catch { /* no cache */ }

  return [];
}

export async function saveLocalDB(data: LocalDBItem[]): Promise<void> {
  const json = JSON.stringify(data);
  // Save to IndexedDB cache
  try {
    await idbSet(LOCAL_DB_KEY, json);
  } catch { /* cache failed */ }

  // Upload to cloud (shared with all users)
  await uploadToCloud(data);

  // Update local version marker
  try {
    const newVersion = new Date().toISOString();
    await idbSet(LOCAL_DB_VERSION_KEY, newVersion);
  } catch { /* ok */ }
}

export function buildSearchIndex(data: LocalDBItem[]): LocalDBIndexedItem[] {
  return data.map(item => {
    const bizIds = [item['건축주사업자번호'], item['설계자사업자번호'], item['시공자사업자번호']]
      .filter(Boolean)
      .map(id => id.replace(/-/g, ''))
      .join(' ');
    const mergedText = `${Object.values(item).join(' ')} ${bizIds}`;
    return {
      ...item,
      _searchIdx: mergedText.toLowerCase(),
      _searchCompact: normalizeSearchText(mergedText),
    };
  });
}

export function searchLocalDB(indexedData: LocalDBIndexedItem[], query: string): ProjectResult[] {
  const rawQ = query.trim().toLowerCase();
  const compactQ = normalizeSearchText(rawQ);

  if (rawQ.length < 2 && compactQ.length < 2) return [];

  return indexedData
    .filter(i => i._searchIdx.includes(rawQ) || (compactQ.length >= 2 && i._searchCompact.includes(compactQ)))
    .slice(0, 15)
    .map((item, idx) => {
      const formatNum = (val: string | undefined) => {
        if (!val || val === '0') return '';
        const num = parseFloat(String(val).replace(/,/g, ''));
        return isNaN(num) ? val : num.toLocaleString();
      };

      const addressParts = [item['시도'], item['시군구'], item['법정동']].filter(Boolean);
      let lot = (item['번'] && item['번'] !== '0') ? String(item['번']).replace(/^0+/, '') : '';
      if (lot && item['지'] && item['지'] !== '0') lot += `-${String(item['지']).replace(/^0+/, '')}`;
      const address = addressParts.length > 0 ? [...addressParts, lot].join(' ').trim() : '';

      return {
        id: `local-${idx}-${Date.now()}`,
        name: item['건물명'] || item['공사명'] || '정보없음',
        address: address || item['대지위치'] || '',
        developer: item['건축주상호명'] || '확인필요',
        builder: item['시공자상호명'] || '확인필요',
        designer: item['설계자상호명'] || '',
        scale: `지상${item['지상층수'] || '?'}층/지하${item['지하층수'] || '?'}층`,
        purpose: item['주용도'] || '',
        area: item['연면적(㎡)'] ? `${formatNum(item['연면적(㎡)'])}` : (item['연면적'] || ''),
        status: item['허가일'] ? '인허가' : '확인필요',
        date: item['허가일'] || item['착공일'] || '',
        source: '📂 내부 DB',
        summary: '',
      };
    });
}
