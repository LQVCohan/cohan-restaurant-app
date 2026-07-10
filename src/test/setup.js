import '@testing-library/jest-dom/vitest';
import '@/utils/staffPerformanceGlobalFormat.js';
import { vi } from 'vitest';

vi.stubEnv('VITE_API_URL', 'http://localhost:4000/graphql');
