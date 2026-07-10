import '@testing-library/jest-dom/vitest';
import '@/utils/staffPerformanceGlobalFormat.js';
import { vi } from 'vitest';

const createMemoryStorage = () => {
  const items = new Map();
  return {
    get length() {
      return items.size;
    },
    clear() {
      items.clear();
    },
    getItem(key) {
      const normalizedKey = String(key);
      return items.has(normalizedKey) ? items.get(normalizedKey) : null;
    },
    key(index) {
      return Array.from(items.keys())[index] ?? null;
    },
    removeItem(key) {
      items.delete(String(key));
    },
    setItem(key, value) {
      items.set(String(key), String(value));
    },
  };
};

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: createMemoryStorage(),
});
Object.defineProperty(window, 'sessionStorage', {
  configurable: true,
  value: createMemoryStorage(),
});

vi.stubEnv('VITE_API_URL', 'http://localhost:4000/graphql');
