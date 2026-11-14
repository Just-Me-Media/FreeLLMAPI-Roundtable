/**
 * StorageFactory.js
 * Initialize and configure the storage architecture for Roundtable.
 */

import { PersistentStorage } from './PersistentStorage.js';
import { ConfigManager } from './ConfigManager.js';
import { ChatManager } from './ChatManager.js';
import { ArtifactManager } from './ArtifactManager.js';
import { SyncManager } from './SyncManager.js';
import { MigrationManager } from './MigrationManager.js';

/**
 * Storage factory for creating and initializing storage managers
 */
export class StorageFactory {
  /**
   * Initialize storage with automatic migration
   * @param {string} [version='1.0.0'] - Storage schema version
   * @returns {Promise<Object>} Storage managers
   */
  static async initialize(version = '1.0.0') {
    const storage = new PersistentStorage(version);
    const configManager = new ConfigManager(storage);
    const chatManager = new ChatManager(storage, configManager);
    const artifactManager = new ArtifactManager(storage);
    const syncManager = new SyncManager(storage, configManager, chatManager, artifactManager);
    const migrationManager = new MigrationManager(storage, version);

    // Auto-migrate if needed
    const needsMigration = await migrationManager.needsMigration();
    if (needsMigration) {
      const migrated = await migrationManager.migrate();
      if (!migrated) {
        console.warn('[StorageFactory] Migration failed, continuing with legacy data');
      }
    }

    return {
      storage,
      configManager,
      chatManager,
      artifactManager,
      syncManager,
      migrationManager,
      version
    };
  }
}