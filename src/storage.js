// localStorage 래퍼: 사생활 보호 모드 등에서 실패해도 앱이 멈추지 않도록 한다.
const PREFIX = 'blockdrop.';

export const storage = {
  get(key) {
    try {
      return localStorage.getItem(PREFIX + key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, String(value));
    } catch {
      /* 무시 */
    }
  },
  getJSON(key, fallback) {
    try {
      const raw = this.get(key);
      return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
    } catch {
      return { ...fallback };
    }
  },
  setJSON(key, value) {
    this.set(key, JSON.stringify(value));
  },
};

/** 이모지·한글도 한 글자로 센다 (Postgres char_length 와 같게) */
export const charLength = (s) => [...s].length;
