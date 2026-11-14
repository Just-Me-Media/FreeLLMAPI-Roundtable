/**
 * ChatManager.js
 * Chat lifecycle management with auto-save and version control.
 */

export class ChatManager {
  constructor(storage, configManager) {
    this.storage = storage;
    this.configManager = configManager;
    this.autoSaveTimeout = null;
    this.autoSaveDelay = 1000; // ms
  }

  /**
   * Create a new chat.
   */
  async createChat(title, messages = []) {
    const id = this.generateId();
    const chat = {
      id,
      title,
      messages,
      time: Date.now(),
      slots: [], // Will be populated when models are loaded
      rounds: 1,
      artifactHistory: null,
    };
    await this.saveChat(chat);
    return id;
  }

  /**
   * Add a message to a chat.
   */
  async addMessage(chatId, message) {
    const chats = await this.loadAllChats();
    if (!chats[chatId]) throw new Error(`Chat not found: ${chatId}`);
    chats[chatId].messages.push(message);
    chats[chatId].time = Date.now();
    await this.saveChat(chats[chatId]);
    // Also update active chat if it's the same
    await this.updateActiveChatIfNeeded(chatId, message);
  }

  /**
   * Load a specific chat.
   */
  async loadChat(chatId) {
    const chats = await this.loadAllChats();
    return chats[chatId] || null;
  }

  /**
   * Delete a chat.
   */
  async deleteChat(chatId) {
    const chats = await this.loadAllChats();
    delete chats[chatId];
    await this.saveAllChats(chats);
  }

  /**
   * Get all chats sorted by most recent first.
   */
  async getAllChats() {
    const chats = await this.loadAllChats();
    const entries = Object.values(chats);
    entries.sort((a, b) => b.time - a.time);
    return entries;
  }

  /**
   * Save current chat as active.
   */
  async saveCurrentChat(chatId) {
    const chat = await this.loadChat(chatId);
    if (!chat) return;
    // Persist to storage
    await this.saveChat(chat);
    // Also save active chat reference
    await this.storage.save('rt.activeChatId', chatId);
    return true;
  }

  /**
   * Schedule an auto-save for the current chat.
   */
  scheduleAutoSave(chatId) {
    if (this.autoSaveTimeout) clearTimeout(this.autoSaveTimeout);
    this.autoSaveTimeout = setTimeout(() => {
      this.performAutoSave(chatId);
    }, this.autoSaveDelay);
  }

  /**
   * Perform an immediate auto-save.
   */
  async performAutoSave(chatId) {
    try {
      const chat = await this.loadChat(chatId);
      if (chat) {
        await this.saveChat(chat);
      }
    } catch (err) {
      console.error('[ChatManager] Auto-save failed:', err);
    }
  }

  /**
   * Update active chat state with new message.
   */
  async updateActiveChatIfNeeded(chatId, message) {
    const activeId = await this.getActiveChatId();
    if (activeId === chatId) {
      // Update active messages in storage
      const result = await this.storage.load('rt.msgs');
      if (result.success && result.data) {
        result.data.push(message);
        await this.storage.save('rt.msgs', result.data);
      }
    }
  }

  /*
   * Helper: generate a random ID.
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }

  /*
   * Helper: load all chats from storage.
   */
  async loadAllChats() {
    const result = await this.storage.load('rt.chats');
    return result.success && result.data ? result.data : {};
  }

  /*
   * Helper: save a chat.
   */
  async saveChat(chat) {
    const chats = await this.loadAllChats();
    chats[chat.id] = chat;
    await this.saveAllChats(chats);
  }

  /*
   * Helper: save all chats.
   */
  async saveAllChats(chats) {
    await this.storage.save('rt.chats', chats);
  }

  /*
   * Helper: get active chat ID.
   */
  async getActiveChatId() {
    const result = await this.storage.load('rt.activeChatId');
    return result.success && result.data ? result.data : null;
  }
}