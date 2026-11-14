/**
 * MigrationManager.js
 * Handles data migration between storage schema versions.
 * Provides backward compatibility for existing data.
 */

export class MigrationManager {
  constructor(storage, version = '1.0.0') {
    this.storage = storage;
    this.version = version;
    this.migrations = [
      // Define migrations for different versions
      // Each migration is an object with fromVersion and toVersion
      // and a migrate function that transforms the data
    ];
  }

  /**
   * Check if migration is needed.
   * @returns {boolean} True if migration is required
   */
  async needsMigration() {
    const meta = await this.storage.load('rt.meta');
    if (!meta.success || !meta.data) return true;
    return meta.data.version !== this.version;
  }

  /**
   * Run all necessary migrations.
   * @returns {Promise<boolean>} True if migration was successful
   */
  async migrate() {
    try {
      // Load all current storage
      const storage = {};
      const keys = ['rt.cfg', 'rt.msgs', 'rt.chats', 'rt.artifactHistory', 'rt.activeChatId', 'rt.persistKey'];
      
      for (const key of keys) {
        const result = await this.storage.load(key);
        if (result.success && result.data !== null) {
          storage[key] = result.data;
        }
      }

      // Apply migrations in order
      const migratedData = await this.applyMigrations(storage);
      
      // Save migrated data with new schema
      await this.saveMigratedData(migratedData);
      
      // Clean up old data
      await this.cleanupOldData(keys);
      
      return true;
    } catch (err) {
      console.error('[MigrationManager] Migration failed:', err);
      return false;
    }
  }

  /**
   * Apply all necessary migrations to the storage data.
   * @param {Object} data - Current storage data
   * @returns {Object} Migrated data
   */
  async applyMigrations(data) {
    // For now, just return data as-is since we're migrating from v0.x to v1.0.0
    // In a real implementation, you would have specific migration logic
    // for each schema version change

    // Add metadata to indicate successful migration
    data['rt.meta'] = {
      version: this.version,
      migratedAt: Date.now(),
      sourceVersion: '0.x'
    };

    // Normalize data structure
    if (data['rt.cfg'] && !data['rt.cfg'].previewOpen) {
      data['rt.cfg'].previewOpen = true;
    }

    // Ensure chats have proper structure
    if (data['rt.chats']) {
      Object.values(data['rt.chats']).forEach(chat => {
        if (!chat.artifactHistory && data['rt.artifactHistory']) {
          chat.artifactHistory = data['rt.artifactHistory'];
        }
      });
    }

    return data;
  }

  /**
   * Save migrated data to storage.
   * @param {Object} data - Migrated data
   */
  async saveMigratedData(data) {
    // Save all migrated data atomically
    const saveItems = [];

    if (data['rt.meta']) {
      saveItems.push({ key: 'rt.meta', value: data['rt.meta'] });
    }

    if (data['rt.cfg']) {
      saveItems.push({ key: 'rt.cfg', value: data['rt.cfg'] });
    }

    if (data['rt.msgs'] !== undefined) {
      saveItems.push({ key: 'rt.msgs', value: data['rt.msgs'] });
    }

    if (data['rt.chats']) {
      saveItems.push({ key: 'rt.chats', value: data['rt.chats'] });
    }

    if (data['rt.artifactHistory']) {
      saveItems.push({ key: 'rt.artifactHistory', value: data['rt.artifactHistory'] });
    }

    if (data['rt.activeChatId'] !== undefined) {
      saveItems.push({ key: 'rt.activeChatId', value: data['rt.activeChatId'] });
    }

    if (data['rt.persistKey'] !== undefined) {
      saveItems.push({ key: 'rt.persistKey', value: data['rt.persistKey'] });
    }

    if (saveItems.length > 0) {
      await this.storage.bulkSave(saveItems);
    }
  }

  /**
   * Clean up old data after migration.
   * @param {Array} keys - Original storage keys
   */
  async cleanupOldData(keys) {
    // Remove old metadata if it exists
    await this.storage.remove('rt.meta');
    
    // Note: We keep the old keys for backward compatibility
    // but they should be overwritten with new schema data
  }

  /**
   * Export data for backup purposes.
   * @returns {Promise<Object>} Exported data
   */
  async exportData() {
    const exported = {
      version: this.version,
      timestamp: Date.now(),
      data: {}
    };
    
    const keys = ['rt.cfg', 'rt.msgs', 'rt.chats', 'rt.artifactHistory', 'rt.activeChatId'];
    
    for (const key of keys) {
      const result = await this.storage.load(key);
      if (result.success && result.data !== null) {
        exported.data[key] = result.data;
      }
    }
    
    return exported;
  }

  /**
   * Import data from backup.
   * @param {Object} data - Exported data to import
   * @returns {Promise<boolean>} True if import was successful
   */
  async importData(data) {
    try {
      if (!data || !data.data) {
        throw new Error('Invalid backup data format');
      }
      
      // Save imported data
      const saveItems = [];
      
      for (const [key, value] of Object.entries(data.data)) {
        if (key.startsWith('rt.')) {
          saveItems.push({ key, value });
        }
      }
      
      await this.storage.bulkSave(saveItems);
      
      // Update metadata
      await this.storage.save('rt.meta', {
        version: this.version,
        importedAt: Date.now(),
        sourceVersion: data.version || 'unknown'
      });
      
      return true;
    } catch (err) {
      console.error('[MigrationManager] Import failed:', err);
      return false;
    }
  }

  /**
   * Get storage statistics for monitoring.
   * @returns {Promise<Object>} Storage statistics
   */
  async getStats() {
    const stats = {
      version: this.version,
      keys: [],
      itemCount: 0,
      totalSize: 0,
      lastMigration: null
    };
    
    const meta = await this.storage.load('rt.meta');
    if (meta.success && meta.data) {
      stats.lastMigration = meta.data.migratedAt;
    }
    
    const keys = ['rt.cfg', 'rt.msgs', 'rt.chats', 'rt.artifactHistory'];
    
    for (const key of keys) {
      const result = await this.storage.load(key);
      if (result.success && result.data !== null) {
        stats.keys.push(key);
        
        if (Array.isArray(result.data)) {
          stats.itemCount += result.data.length;
        } else if (typeof result.data === 'object') {
          stats.itemCount += Object.keys(result.data).length;
        }
      }
    }
    
    return stats;
  }
}