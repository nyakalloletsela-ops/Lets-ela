import { createClient, RedisClientType } from 'redis';

export interface ContextKey {
  projectId: string;
  sessionId: string;
}

export interface ContextSnapshot {
  [key: string]: unknown;
}

export class ContextStore {
  private memoryStore: Map<string, Map<string, unknown>> = new Map();
  private redis: RedisClientType | null = null;
  private useRedis: boolean;

  constructor(redisUrl?: string) {
    this.useRedis = !!redisUrl;
    if (this.useRedis) {
      this.redis = createClient({ url: redisUrl });
      this.redis.connect().catch(console.error);
    }
  }

  private getKey({ projectId, sessionId }: ContextKey): string {
    return `letsela:${projectId}:${sessionId}`;
  }

  private getPathKey(key: ContextKey, path: string): string {
    return `${this.getKey(key)}:${path}`;
  }

  async set<T>(key: ContextKey, path: string, value: T): Promise<void> {
    const storeKey = this.getKey(key);
    
    if (this.useRedis && this.redis) {
      await this.redis.hSet(storeKey, path, JSON.stringify(value));
      return;
    }

    // Memory store
    if (!this.memoryStore.has(storeKey)) {
      this.memoryStore.set(storeKey, new Map());
    }
    const projectStore = this.memoryStore.get(storeKey)!;
    projectStore.set(path, value);
  }

  async get<T>(key: ContextKey, path: string): Promise<T | undefined> {
    const storeKey = this.getKey(key);

    if (this.useRedis && this.redis) {
      const value = await this.redis.hGet(storeKey, path);
      if (!value) return undefined;
      return JSON.parse(value) as T;
    }

    const projectStore = this.memoryStore.get(storeKey);
    if (!projectStore) return undefined;
    return projectStore.get(path) as T;
  }

  async getAll(key: ContextKey): Promise<ContextSnapshot> {
    const storeKey = this.getKey(key);

    if (this.useRedis && this.redis) {
      const all = await this.redis.hGetAll(storeKey);
      const result: ContextSnapshot = {};
      for (const [k, v] of Object.entries(all)) {
        result[k] = JSON.parse(v);
      }
      return result;
    }

    const projectStore = this.memoryStore.get(storeKey);
    if (!projectStore) return {};
    return Object.fromEntries(projectStore.entries());
  }

  async snapshot(key: ContextKey): Promise<ContextSnapshot> {
    return this.getAll(key);
  }

  async restore(key: ContextKey, snapshot: ContextSnapshot): Promise<void> {
    const storeKey = this.getKey(key);

    if (this.useRedis && this.redis) {
      await this.redis.del(storeKey);
      for (const [path, value] of Object.entries(snapshot)) {
        await this.redis.hSet(storeKey, path, JSON.stringify(value));
      }
      return;
    }

    const projectStore = new Map();
    for (const [path, value] of Object.entries(snapshot)) {
      projectStore.set(path, value);
    }
    this.memoryStore.set(storeKey, projectStore);
  }

  async delete(key: ContextKey): Promise<void> {
    const storeKey = this.getKey(key);
    
    if (this.useRedis && this.redis) {
      await this.redis.del(storeKey);
      return;
    }

    this.memoryStore.delete(storeKey);
  }

  async projectExists(projectId: string): Promise<boolean> {
    if (this.useRedis && this.redis) {
      const keys = await this.redis.keys(`letsela:${projectId}:*`);
      return keys.length > 0;
    }
    
    for (const key of this.memoryStore.keys()) {
      if (key.startsWith(`letsela:${projectId}:`)) {
        return true;
      }
    }
    return false;
  }
}
