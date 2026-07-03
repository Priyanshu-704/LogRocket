import { vi } from 'vitest';

// Globally mock fetch to prevent real outbound HTTP network leaks
vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ status: 'success' })
})));

// Globally mock navigator.sendBeacon
if (typeof navigator !== 'undefined') {
  (navigator as any).sendBeacon = vi.fn().mockReturnValue(true);
} else {
  vi.stubGlobal('navigator', {
    sendBeacon: vi.fn().mockReturnValue(true)
  });
}
