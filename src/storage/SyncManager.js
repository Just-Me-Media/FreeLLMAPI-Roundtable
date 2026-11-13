/**
 * SyncManager.js
 * Cross-tab synchronization via BroadcastChannel API.
 */

export class SyncManager {
  constructor(storage, configManager, chatManager, artifactManager) {
    this.storage = storage;
    this.configManager = configManager;
    this.chatManager = chatManager;
    this.artifactManager = artifactManager;
    this.listeners = new Set();
    this.channel = null;
    this.enabled = false;
    this.initChannel();
  }

  /**
   * Initialize BroadcastChannel.
   */
  initChannel() {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('rt.sync');
        this.channel.onmessage = this.handleMessage.bind(this);
        this.enabled = true;
      } catch (err) {
        console.warn('[SyncManager] BroadcastChannel failed to initialize:', err);
      }
    } else {
      console.warn('[SyncManager] BroadcastChannel API not supported in this environment');
    }
  }

  /**
   * Broadcast an event to other tabs.
   */
  broadcast(type, data = {}) {
    if (!this.enabled || !this.channel) return;
    try {
      this.channel.postMessage({
        type,
        data,
        timestamp: Date.now(),
        sender: this.sessionId,
      });
    } catch (err) {
      console.error('[SyncManager] Failed to broadcast:', err);
    }
  }

  /**
   * Subscribe to incoming messages from other tabs.
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Handle incoming message from another tab.
   */
  handleMessage(event) {
    const { type, data, timestamp } = event.data;
    // Notify all subscribers
    this.listeners.forEach(cb => {
      try {
        cb({ type, data, timestamp });
      } catch (err) {
        console.error('[SyncManager] Subscriber threw an error:', err);
      }
    });
  }

  /**
   * Notify about configuration changes.
   */
  notifyConfigUpdated(config) {
    this.broadcast('configUpdated', config);
  }

  /**
   * Notify about message changes.
   */
  notifyMessageAdded(chatId, message) {
    this.broadcast('messageAdded', { chatId, message });
  }

  /**
   * Notify about artifact changes.
   */
  notifyArtifactAdded(artifact) {
    this.broadcast('artifactAdded', artifact);
  }

  /**
   * Close channel.
   */
  close() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.enabled = false;
  }
}