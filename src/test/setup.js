import '@testing-library/jest-dom/vitest';
import '@/utils/staffPerformanceGlobalFormat.js';
import { afterEach, vi } from 'vitest';

vi.stubEnv('VITE_API_URL', 'http://localhost:4000/graphql');

// jsdom dispatches Web Storage events through a zero-delay timer. Let that
// native timer settle before Vitest snapshots open handles for leak detection.
afterEach(async () => {
  if (vi.isFakeTimers()) return;
  await new Promise((resolve) => setTimeout(resolve, 0));
});
