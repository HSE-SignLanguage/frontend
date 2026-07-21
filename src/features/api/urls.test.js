import { afterEach, describe, expect, it, vi } from 'vitest';

import { getApiUrl, getWsUrl } from './urls';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('API URLs', () => {
  it('uses the same-origin API prefix by default', () => {
    vi.stubGlobal('window', { location: { origin: 'https://hack.example' } });

    expect(getApiUrl('/job/abc')).toBe('https://hack.example/api/job/abc');
    expect(getWsUrl()).toBe('wss://hack.example/api/socket');
  });
});
