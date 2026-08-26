import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface RequestStore {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestStore>();

export const requestContext = {
  run<T>(store: RequestStore, callback: () => T): T {
    return storage.run(store, callback);
  },
  getStore(): RequestStore | undefined {
    return storage.getStore();
  },
  requestId(): string | undefined {
    return storage.getStore()?.requestId;
  },
};

export function resolveRequestId(headers: Record<string, string>): string {
  const provided = headers['x-request-id'];

  return provided && provided.trim() !== '' ? provided.trim() : randomUUID();
}