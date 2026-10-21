const fallback = new Map<string, string | null>();
const listeners = new Set<() => void>();
let warning = "";

function storageFailed() {
  warning = "浏览器无法保存本地数据，本次操作仍可继续；关闭页面后部分设置可能丢失。";
  listeners.forEach((listener) => listener());
}

export const storage = {
  get(key: string): string | null {
    if (fallback.has(key)) return fallback.get(key) ?? null;
    try { return window.localStorage.getItem(key); }
    catch { storageFailed(); return null; }
  },
  set(key: string, value: string) {
    fallback.set(key, value);
    try { window.localStorage.setItem(key, value); }
    catch { storageFailed(); }
  },
  remove(key: string) {
    fallback.set(key, null);
    try { window.localStorage.removeItem(key); }
    catch { storageFailed(); }
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  getWarning: () => warning
};

export function readJson(key: string): unknown {
  try { return JSON.parse(storage.get(key) || "null"); }
  catch { return null; }
}
