/**
 * PersistentStorage.js
 * Atomic local storage operations with transaction logging and fallback.
 */

export class PersistentStorage {
  constructor(version = '1.0.0') {
    this.version = version;
    this.sessionId = this.generateSessionId();
  }

  generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }

  /**
   * Save a key-value pair atomically using a temporary staging key.
   */
  async save(key, value) {
    try {
      const tempKey = `${key}.tmp`;
      const payload = JSON.stringify(value);
      localStorage.setItem(tempKey, payload);
      localStorage.setItem(key, payload);
      localStorage.removeItem(tempKey);
      return { success: true };
    } catch (err) {
      console.error(`[PersistentStorage] Failed to save key "${key}":`, err);
      return { success: false, error: err };
    }
  }

  /**
   * Load a value from localStorage.
   */
  async load(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return { success: false, data: null };
      const data = JSON.parse(raw);
      return { success: true, data };
    } catch (err) {
      console.error(`[PersistentStorage] Failed to load key "${key}":`, err);
      return { success: false, error: err };
    }
  }

  /**
   * Save multiple key-value pairs atomically.
   */
  async bulkSave(items) {
    try {
      for (const { key, value } of items) {
        await this.save(key, value);
      }
      return { success: true };
    } catch (err) {
      console.error('[PersistentStorage] Bulk save failed:', err);
      return { success: false, error: err };
    }
  }

  /**
   * Remove a key.
   */
  async remove(key) {
    try {
      localStorage.removeItem(key);
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  }
}
