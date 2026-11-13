/**
 * Roundtable Storage Architecture Entry Point
 *
 * This module provides the modern storage layer for Roundtable,
 * replacing the legacy localStorage approach with:
 * - Atomic operations with transaction support
 * - Auto-save with debouncing
 * - Cross-tab synchronization
 * - Schema validation and migration
 * - Error recovery and fallback
 */

import { PersistentStorage } from './storage/PersistentStorage.js';
import { ConfigManager } from './storage/ConfigManager.js';
import { ChatManager } from './storage/ChatManager.js';
import { ArtifactManager } from './storage/ArtifactManager.js';
import { SyncManager } from './storage/SyncManager.js';
import { MigrationManager } from './storage/MigrationManager.js';
import { StorageFactory } from './storage/StorageFactory.js';

export {
  PersistentStorage,
  ConfigManager,
  ChatManager,
  ArtifactManager,
  SyncManager,
  MigrationManager,
  StorageFactory
};