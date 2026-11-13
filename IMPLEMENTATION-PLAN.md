# Roundtable Storage Architecture Implementation Plan

## Overview
This document outlines the proposed improvements to Roundtable's storage architecture to provide robust, reliable, and scalable local persistence for user conversations, artifacts, and configurations.

## Current State Analysis

### Existing Storage Implementation
Roundtable currently uses a simple `localStorage`-based approach:
- `rt.cfg` - Configuration (model slots, preamble, settings)
- `rt.msgs` - Active conversation messages
- `rt.chats` - Saved conversations collection
- `rt.artifactHistory` - Artifact versions
- `rt.persistKey` - Key persistence preference

### Current Issues
1. **No Atomic Operations**: Individual saves can fail mid-operation
2. **No Cross-Tab Sync**: Single tab changes aren't visible in others
3. **No Size Management**: Artifacts can consume all available storage
4. **No Conflict Resolution**: Multiple simultaneous edits cause data loss
5. **No Migration Path**: Schema changes break existing data
6. **Manual Save Required**: Users must remember to save frequently
7. **No Error Recovery**: Crashes lose unsaved work
8. **Limited Data Integrity**: No validation or consistency checks

## Proposed Architecture

### 1. Persistent Storage Layer

#### Core Classes
```javascript
class PersistentStorage {
  // Atomic save/load operations
  async save(key, value, options = {})
  async load(key, options = {})
  async bulkSave(changes)
  async migrate(fromVersion, toVersion)
  
  // Storage lifecycle management
  cleanup(maxAge, maxSize)
  exportData(exportOptions)
  importData(data)
}

class ConfigManager {
  // Schema validation and migration
  validate(config)
  migrate(data, fromVersion)
  
  // Configuration updates
  update(newConfig, merge = true)
  get()
  watch(callback) // Observer pattern
}

class ChatManager {
  // Chat lifecycle management
  createChat(title, initialMessages)
  addMessage(chatId, message)
  saveCurrentChat()
  loadChat(chatId)
  deleteChat(chatId)
  
  // Auto-save with debouncing
  scheduleAutoSave()
  performAutoSave()
}

class ArtifactManager {
  // Artifact lifecycle and deduplication
  addArtifact(lang, text, role)
  getAll()
  getCurrent()
  
  // Size and count management
  cleanup(sizeLimit, countLimit)
  deduplicate()
}

class SyncManager {
  // Cross-tab synchronization
  broadcast(type, data)
  subscribe(type, callback)
  enable(peerId)
  disable()
}
```

### 2. Storage Schema Design

#### Versioned Data Structure
```javascript
{
  version: '2.0.0',
  timestamp: 1700000000000,
  sessionId: 'unique-session-id',
  
  config: {
    freellmUrl: 'http://127.0.0.1:31415',
    key: '***',
    slots: [...],
    rounds: 1,
    preamble: '...',
    previewOpen: true
    // ... other settings
  },
  
  activeChat: {
    id: 'chat-id',
    title: 'Chat title',
    messages: [...],
    lastModified: 1700000000000
  },
  
  chats: {
    'chat-id-1': {
      id: 'chat-id-1',
      title: '...',
      messages: [...],
      time: 1700000000000,
      slots: [...],
      rounds: 1,
      artifactHistory: [...]
    }
  },
  
  artifactHistory: [
    {
      lang: 'javascript',
      text: '...',
      timestamp: 1700000000000,
      checksum: 'hash',
      size: 1234,
      role: 'synthesizer'
    }
  ],
  
  metadata: {
    version: '2.0.0',
    lastBackup: 1700000000000,
    storageQuota: 5242880, // 5MB
    storageUsed: 123456
  }
}
```

### 3. Key Features

#### 3.1 Atomic Operations
- **Write Ahead Log**: Changes written to temp file before applying
- **Transaction Support**: All-or-nothing operations
- **Retry Logic**: Automatic retry on failure
- **Compensation Actions**: Rollback on failure

#### 3.2 Cross-Tab Synchronization
- **BroadcastChannel API**: Real-time sync between tabs
- **LocalStorage Fallback**: Works in environments without BroadcastChannel
- **Conflict Resolution**: Last-write-wins with versioning
- **Presence Awareness**: Knows which tab is active

#### 3.3 Data Integrity
- **Schema Validation**: Ensures data conforms to expected structure
- **Checksum Verification**: Detects corruption
- **Size Limits**: Prevents storage quota exhaustion
- **Age-based Cleanup**: Automatically removes old data

#### 3.4 User Experience
- **Auto-Save**: Debounced saves for responsive UI
- **Version History**: Per-chat version control
- **Export/Import**: Backup and restore functionality
- **Storage Analytics**: Usage insights and cleanup suggestions

### 4. Implementation Phases

#### Phase 1: Core Infrastructure (Week 1)
1. **PersistentStorage Class**: Atomic operations, error handling
2. **Storage Factory**: Initialize and configure storage
3. **Migration Manager**: Backward compatibility layer
4. **Unit Tests**: Comprehensive test coverage

#### Phase 2: Business Logic (Week 2)
1. **ConfigManager**: Schema validation and updates
2. **ChatManager**: Chat lifecycle with auto-save
3. **ArtifactManager**: Deduplication and cleanup
4. **SyncManager**: Cross-tab synchronization

#### Phase 3: Integration (Week 3)
1. **Storage Integration**: Replace existing storage calls
2. **Performance Monitoring**: Track storage operations
3. **Error Boundaries**: Graceful degradation
4. **Accessibility**: Screen reader support for storage operations

### 5. Technical Specifications

#### 5.1 API Design
```javascript
// Storage operations
await storage.save('key', value)
await storage.bulkSave([{key: 'k1', value: v1}, {key: 'k2', value: v2}])

// Configuration management
const config = await configManager.get()
await configManager.update({ preamble: 'new preamble' })

// Chat management
const chats = await chatManager.getAll()
const chatId = await chatManager.createChat('New Chat', [])
await chatManager.addMessage(chatId, { role: 'user', text: 'Hello' })

// Artifact management
await artifactManager.addArtifact('javascript', 'console.log("test")', 'synthesizer')
const artifacts = await artifactManager.getAll()
```

#### 5.2 Error Handling
```javascript
class StorageError extends Error {
  constructor(code, message, data = {}) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

const errors = {
  QUOTA_EXCEEDED: 'QUOTA',
  CORRUPTION: 'CORRUPT',
  NOT_FOUND: 'NOTFOUND',
  PERMISSION_DENIED: 'PERM',
  TRANSACTION_FAILED: 'TRANSFAIL'
};
```

#### 5.3 Performance Optimizations
- **Debounced Saves**: Throttle save operations to 1 second
- **Batch Operations**: Group multiple saves into single operation
- **Compression**: Compress large artifact texts
- **Lazy Loading**: Load only needed data
- **Caching**: Cache frequently accessed data

### 6. Testing Strategy

#### 6.1 Unit Tests
```javascript
// Storage layer tests
it('should save and load data atomically', async () => { ... })
it('should handle storage quota exceeded gracefully', async () => { ... })
it('should maintain data integrity after multiple operations', async () => { ... })

// Config manager tests
it('should validate config against schema', () => { ... })
it('should migrate between versions correctly', async () => { ... })

// Sync manager tests
it('should sync changes across tabs', async () => { ... })
it('should handle connection drops', async () => { ... })
```

#### 6.2 Integration Tests
- Load/save cycle tests
- Cross-tab synchronization tests
- Conflict resolution tests
- Performance benchmarks

#### 6.3 E2E Tests
- Storage quota exhaustion scenarios
- Network failure recovery
- User workflow testing

### 7. Migration Path

#### 7.1 Backward Compatibility
- **Automatic Migration**: Existing data migrated on first load
- **Version Detection**: Identify current schema version
- **Progressive Enhancement**: New features optional

#### 7.2 Data Loss Prevention
- **Backups**: Automatic backups before schema changes
- **Rollback**: Ability to revert to previous version
- **Validation**: Pre-migration validation

### 8. Monitoring and Analytics

#### 8.1 Storage Metrics
```javascript
const metrics = {
  saveOperations: 0,
  bulkSaveOperations: 0,
  loadOperations: 0,
  errors: {
    quota: 0,
    corruption: 0,
    permission: 0
  },
  performance: {
    avgSaveTime: 0,
    maxSaveTime: 0,
    operationsPerSecond: 0
  },
  usage: {
    configSize: 0,
    messagesSize: 0,
    artifactsSize: 0,
    chatsCount: 0,
    artifactsCount: 0
  }
};
```

#### 8.2 User Feedback
- Storage usage warnings before quota exceeded
- Cleanup suggestions when approaching limits
- Performance alerts for slow operations
- Success indicators for background saves

## Rollout Plan

### Phase 1: Development (Weeks 1-3)
1. Implement core storage classes
2. Add unit and integration tests
3. Integrate with existing UI
4. Performance optimization

### Phase 2: Testing (Weeks 4-5)
1. Comprehensive testing
2. Beta testing with volunteers
3. Performance benchmarking
4. Security review

### Phase 3: Deployment (Weeks 6-8)
1. Gradual rollout to all users
2. Monitoring and support
3. Documentation updates
4. Issue resolution

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Storage quota exceeded | Medium | High | Size limits, warnings |
| Data corruption | Low | High | Checksums, validation |
| Cross-tab conflicts | Medium | Medium | Versioning, last-write-wins |
| Performance degradation | Low | Medium | Optimization, monitoring |
| Migration failures | Low | High | Backups, rollback |

## Conclusion

This implementation plan provides a comprehensive upgrade to Roundtable's storage architecture, addressing current limitations while maintaining backward compatibility. The new architecture will provide:

- **Reliable persistence** with atomic operations
- **Real-time synchronization** across tabs
- **Intelligent cleanup** to prevent storage exhaustion
- **Enhanced user experience** with auto-save and version control
- **Robust error handling** with graceful degradation

The phased rollout approach minimizes risk while delivering immediate value through auto-save and cross-tab sync features, with additional capabilities available in later phases.