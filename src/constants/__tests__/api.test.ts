/**
 * The API constants decide at module-load time whether the app talks to the
 * local dev server or production, so each case loads a fresh copy of the
 * module inside jest.isolateModules with __DEV__ and the env set up first.
 */

type ApiModule = typeof import('@/constants/api');

declare const global: typeof globalThis & { __DEV__: boolean };

const PROD = {
  baseUrl: 'https://api.thetrickbook.com/api',
  socketUrl: 'https://api.thetrickbook.com',
  kithWsUrl: 'wss://api.thetrickbook.com/kith/ws',
};

function loadApi(dev: boolean, env: Record<string, string | undefined>): ApiModule {
  const originalDev = global.__DEV__;
  const originalEnv = { ...process.env };
  global.__DEV__ = dev;
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    let loaded: ApiModule | undefined;
    jest.isolateModules(() => {
      loaded = require('@/constants/api');
    });
    if (!loaded) throw new Error('module did not load');
    return loaded;
  } finally {
    global.__DEV__ = originalDev;
    process.env = originalEnv;
  }
}

describe('API_CONFIG environment selection', () => {
  it('release builds always point at production', () => {
    const { API_CONFIG } = loadApi(false, {
      EXPO_PUBLIC_USE_PROD_API: undefined,
      EXPO_PUBLIC_DEV_API_HOST: 'should-be-ignored.local',
    });
    expect(API_CONFIG.baseUrl).toBe(PROD.baseUrl);
    expect(API_CONFIG.socketUrl).toBe(PROD.socketUrl);
    expect(API_CONFIG.kithWsUrl).toBe(PROD.kithWsUrl);
  });

  it('dev builds with EXPO_PUBLIC_USE_PROD_API=1 still point at production', () => {
    const { API_CONFIG } = loadApi(true, { EXPO_PUBLIC_USE_PROD_API: '1' });
    expect(API_CONFIG.baseUrl).toBe(PROD.baseUrl);
    expect(API_CONFIG.socketUrl).toBe(PROD.socketUrl);
    expect(API_CONFIG.kithWsUrl).toBe(PROD.kithWsUrl);
  });

  it('dev builds default to the local backend on the configured host', () => {
    const { API_CONFIG } = loadApi(true, {
      EXPO_PUBLIC_USE_PROD_API: undefined,
      EXPO_PUBLIC_DEV_API_HOST: 'dev-box.local',
    });
    expect(API_CONFIG.baseUrl).toBe('http://dev-box.local:9000/api');
    expect(API_CONFIG.socketUrl).toBe('http://dev-box.local:9000');
    expect(API_CONFIG.kithWsUrl).toBe('ws://dev-box.local:3040/ws');
  });

  it('the website origin for shared assets never changes', () => {
    expect(loadApi(false, {}).API_CONFIG.assetBaseUrl).toBe('https://thetrickbook.com');
    expect(loadApi(true, {}).API_CONFIG.assetBaseUrl).toBe('https://thetrickbook.com');
  });
});
