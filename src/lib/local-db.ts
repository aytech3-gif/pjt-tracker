import type { ProjectResult } from '@/components/ResultsList';

const APP_ID = 'lge-pjt-tracker-v3';

export interface LocalDBItem {
  [key: string]: string;
}

export function loadLocalDB(): LocalDBItem[] {
  try {
    const d = localStorage.getItem(`${APP_ID}_db`);
    return d ? JSON.parse(d) : [];
  } catch {
    return [];
  }
}

export function saveLocalDB(data: LocalDBItem[]): void {
  try {
    const json = JSON.stringify(data);
    if (json.length < 4_500_000) {
      localStorage.setItem(`${APP_ID}_db`, json);
    }
  } catch {
    // localStorage full
  }
}

export function buildSearchIndex(data: LocalDBItem[]): (LocalDBItem & { _searchIdx: string })[] {
  return data.map(item => {
    const bizIds = [item['건축주사업자번호'], item['설계자사업자번호'], item['시공자사업자번호']]
      .filter(Boolean)
      .map(id => id.replace(/-/g, ''))
      .join(' ');
    return {
      ...item,
      _searchIdx: (Object.values(item).join(' ') + ' ' + bizIds).toLowerCase(),
    };
  });
}

export function searchLocalDB(
  indexedData: (LocalDBItem & { _searchIdx: string })[],
  query: string
): ProjectResult[] {
  const rawQ = query.trim().toLowerCase();
  const cleanQ = rawQ.replace(/-/g, '');
  if (rawQ.length < 2) return [];

  return indexedData
    .filter(i => i._searchIdx.includes(rawQ) || (cleanQ.length > 5 && i._searchIdx.includes(cleanQ)))
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
