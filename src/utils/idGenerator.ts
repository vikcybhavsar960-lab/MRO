const TAB_TAG_STORAGE_KEY = 'erp_client_tab_tag';

function randomTabTag(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'T';
  for (let i = 0; i < 2; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function getClientTabTag(): string {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      let existing = window.sessionStorage.getItem(TAB_TAG_STORAGE_KEY);
      if (!existing || !/^T[A-Z0-9]{2,4}$/.test(existing)) {
        existing = randomTabTag();
        window.sessionStorage.setItem(TAB_TAG_STORAGE_KEY, existing);
      }
      return existing;
    }
  } catch {
    // Fallback for restricted storage contexts
  }
  return randomTabTag();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function generateCollisionSafeSeqId(
  prefix: string,
  items: Array<{ id?: string; rfqNumber?: string }>,
  tombstoneIds: string[] = [],
  tabTag?: string,
  padLength: number = 3
): string {
  let maxNum = 0;
  const regex = new RegExp(`^${escapeRegex(prefix)}-(\\d+)(?:-[A-Z0-9]+)?$`, 'i');

  const scan = (val?: string) => {
    const m = String(val || '').trim().match(regex);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  };

  (items || []).forEach((it) => {
    scan(it?.id);
    scan(it?.rfqNumber);
  });
  (tombstoneIds || []).forEach((tid) => scan(tid));

  const tag = tabTag || getClientTabTag();
  return `${prefix}-${String(maxNum + 1).padStart(padLength, '0')}-${tag}`;
}

export function generateCollisionSafeYearlyId(
  prefix: string,
  year: number,
  items: Array<{ id?: string; rfqNumber?: string }>,
  tombstoneIds: string[] = [],
  tabTag?: string,
  padLength: number = 5
): string {
  let maxNum = 0;
  const regex = new RegExp(`^${escapeRegex(prefix)}-\\d{4}-(\\d+)(?:-[A-Z0-9]+)?$`, 'i');

  const scan = (val?: string) => {
    const m = String(val || '').trim().match(regex);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  };

  (items || []).forEach((it) => {
    scan(it?.id);
    scan(it?.rfqNumber);
  });
  (tombstoneIds || []).forEach((tid) => scan(tid));

  const tag = tabTag || getClientTabTag();
  return `${prefix}-${year}-${String(maxNum + 1).padStart(padLength, '0')}-${tag}`;
}
