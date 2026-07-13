export const uid = (prefix = 'item') => `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
export const clone = value => structuredClone(value);
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const round = (value, digits = 3) => Number(Number(value).toFixed(digits));
export const rad = degrees => degrees * Math.PI / 180;
export const deg = radians => radians * 180 / Math.PI;
export const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
export const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const escapeHTML = value => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
export const debounce = (fn, delay) => { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); }; };
export const downloadBlob = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const anchor = Object.assign(document.createElement('a'), { href: url, download: name });
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
export const readFile = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsArrayBuffer(file);
});
export const textFile = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsText(file);
});
export const formatBytes = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/1048576).toFixed(1)} MB`;
export const fileBase = name => name.replace(/\.[^.]+$/, '');
export const safeName = name => name.trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'Untitled';
export const timestamp = () => new Date().toISOString();

export function parseUnitValue(raw, projectUnit = 'mm') {
  const match = String(raw).trim().toLowerCase().match(/^(-?\d*\.?\d+(?:e[+-]?\d+)?)\s*(mm|cm|m|in|inch|inches)?$/);
  if (!match) return null;
  const unit = match[2] === 'inch' || match[2] === 'inches' ? 'in' : (match[2] || projectUnit);
  const factors = { mm: 1, cm: 10, m: 1000, in: 25.4 };
  return Number(match[1]) * factors[unit] / factors[projectUnit];
}

export function idle(callback) {
  return 'requestIdleCallback' in window ? requestIdleCallback(callback, { timeout: 250 }) : setTimeout(callback, 16);
}
