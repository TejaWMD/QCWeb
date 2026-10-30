import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// Fallback dummy client for standalone deployment (e.g. GitHub Pages) where
// no Base44 backend is active, preventing failed WebSockets and 404/405 API calls.
function createDummyEntity() {
  return {
    filter: async () => ({ items: [], total: 0 }),
    list: async () => [],
    get: async () => null,
    count: async () => 0,
    create: async (data) => ({ id: `local_${Date.now()}`, ...data }),
    update: async (id, data) => ({ id, ...data }),
    updateMany: async () => ({ updated: 0 }),
    delete: async () => true,
    deleteMany: async () => ({ deleted: 0 }),
    bulkUpdate: async () => [],
    subscribe: () => () => {},
  };
}

function createDummyBase44Client() {
  const entityCache = new Map();
  const entities = new Proxy({}, {
    get(target, prop) {
      if (typeof prop !== 'string') return undefined;
      if (!entityCache.has(prop)) {
        entityCache.set(prop, createDummyEntity());
      }
      return entityCache.get(prop);
    }
  });

  return {
    entities,
    app: {
      getPublicSettings: async () => ({ id: 'qc-web', public_settings: {} }),
    },
    auth: {
      me: async () => ({ id: "dev-admin-id", email: "admin@factoryops.local", full_name: "Admin", role: "admin" }),
      logout: () => {},
      loginWithProvider: () => {},
      setToken: () => {},
      verifyOtp: async () => ({ access_token: 'dummy' }),
      register: async () => {},
      resendOtp: async () => {},
      resetPassword: async () => {},
    },
    functions: {
      invoke: async () => ({ data: null }),
    },
  };
}

export const base44 = appId
  ? createClient({
      appId,
      token,
      functionsVersion,
      serverUrl: '',
      appBaseUrl
    })
  : createDummyBase44Client();

