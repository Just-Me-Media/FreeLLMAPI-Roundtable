/**
 * ConfigManager.js
 * Schema validation and migration for Roundtable configuration.
 */

export class ConfigManager {
  constructor(storage) {
    this.storage = storage;
    this.schema = {
      freellmUrl: 'http://127.0.0.1:31415',
      key: '',
      directKey: '',
      slots: [],
      rounds: 1,
      fallback: 'auto',
      preamble: '',
      maxTokens: 0,
      outputFormat: 'markdown',
      previewOpen: true,
    };
  }

  /**
   * Validate a config object against the schema.
   */
  validate(config) {
    const validated = { ...this.schema };
    for (const [key, defaultValue] of Object.entries(this.schema)) {
      if (config[key] !== undefined) {
        validated[key] = config[key];
      }
    }
    return validated;
  }

  /**
   * Get the current configuration.
   */
  async get() {
    const result = await this.storage.load('rt.cfg');
    if (result.success && result.data) {
      return this.validate(result.data);
    }
    return { ...this.schema };
  }

  /**
   * Update the configuration atomically.
   */
  async update(newConfig, merge = true) {
    const current = await this.get();
    const updated = merge ? { ...current, ...newConfig } : newConfig;
    const validated = this.validate(updated);
    return await this.storage.save('rt.cfg', validated);
  }

  /**
   * Reset configuration to defaults.
   */
  async reset() {
    return await this.storage.save('rt.cfg', { ...this.schema });
  }
}