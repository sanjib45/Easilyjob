/**
 * In-process TTL cache for public job listings.
 * Zero external dependencies; safe fallthrough if cold.
 */

class MemoryCache {
  constructor(defaultTtlMs = 60 * 1000) {
    this.store = new Map();
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

export const jobCache = new MemoryCache(60 * 1000);

/**
 * Invalidates all cached public job list responses.
 * Must be called whenever a job is created, updated, deleted, or closed.
 */
export const invalidateJobCache = () => {
  jobCache.clear();
};
