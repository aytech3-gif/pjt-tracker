import type { ProjectResult } from '@/components/ResultsList';

const APP_ID = 'lge-pjt-tracker-v3';
const LOCAL_DB_KEY = `${APP_ID}_db`;
const LEGACY_LOCAL_STORAGE_LIMIT = 4_500_000;
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

const readFromLocalStorage = (): LocalDBItem[] => {
  try {
    const d = localStorage.getItem(LOCAL_DB_KEY);
    return d ? JSON.parse(d) : [];
  } catch {
    return [];
  }
};

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

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB write 실패'));
    };
    tx.onabort = () => {
      db.close();
      reject(new Error('IndexedDB write 중단'));
    };
  });
};

export async function loadLocalDB(): Promise<LocalDBItem[]> {
  try {
    const indexed = await idbGet(LOCAL_DB_KEY);
    if (indexed) return JSON.parse(indexed);
  } catch {
    // IndexedDB unavailable or failed
  }

  const legacy = readFromLocalStorage();
  if (legacy.length > 0) {
    try {
      await idbSet(LOCAL_DB_KEY, JSON.stringify(legacy));
    } catch {
      // keep legacy fallback only
    }
  }

  return legacy;
}

export async function saveLocalDB(data: LocalDBItem[]): Promise<void> {
  const json = JSON.stringify(data);

  try {
    await idbSet(LOCAL_DB_KEY, json);
    return;
  } catch {
    // Fallback to localStorage
  }

  if (json.length >= LEGACY_LOCAL_STORAGE_LIMIT) {
    throw new Error('데이터가 커서 브라우저 저장공간에 저장되지 않았습니다.');
  }

  try {
    localStorage.setItem(LOCAL_DB_KEY, json);
  } catch {
    throw new Error('브라우저 저장공간이 부족해 내부 DB 저장에 실패했습니다.');
  }
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
        source: '📂 로컬 DB',
        summary: '',
      };
    });
}
