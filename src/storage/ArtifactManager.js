/**
 * ArtifactManager.js
 * Artifact lifecycle with deduplication, cleanup, and size management.
 */

export class ArtifactManager {
  constructor(storage) {
    this.storage = storage;
    this.maxArtifacts = 50;
    this.maxSizePerArtifact = 1024 * 1024; // 1MB
  }

  /**
   * Add an artifact to history.
   */
  async addArtifact(lang, text, role) {
    // Validate size
    const size = new TextEncoder().encode(text).length;
    if (size > this.maxSizePerArtifact) {
      throw new Error(`Artifact too large: ${Math.round(size/1024)}KB exceeds ${Math.round(this.maxSizePerArtifact/1024)}KB limit`);
    }

    const artifact = {
      lang,
      text,
      size,
      timestamp: Date.now(),
      checksum: this.generateChecksum(text),
      role,
    };

    // Load existing history
    const result = await this.storage.load('rt.artifactHistory');
    const history = result.success && result.data ? result.data : [];

    // Deduplicate
    const deduped = this.deduplicate([...history, artifact]);

    // Enforce limit
    if (deduped.length > this.maxArtifacts) {
      deduped.splice(0, deduped.length - this.maxArtifacts);
    }

    await this.storage.save('rt.artifactHistory', deduped);
    return deduped.length - 1; // index
  }

  /**
   * Get all artifacts.
   */
  async getAll() {
    const result = await this.storage.load('rt.artifactHistory');
    return result.success && result.data ? result.data : [];
  }

  /**
   * Get artifact by index.
   */
  async getAt(index) {
    const all = await this.getAll();
    return all[index] || null;
  }

  /**
   * Get current artifact (latest).
   */
  async getCurrent() {
    const all = await this.getAll();
    return all.length ? all[all.length - 1] : null;
  }

  /**
   * Clean up artifacts by size or count.
   */
  async cleanup(sizeLimit, countLimit) {
    const all = await this.getAll();
    let cleaned = all.slice();

    if (sizeLimit) {
      let totalSize = 0;
      cleaned = cleaned.filter(a => {
        const size = a.size || new TextEncoder().encode(a.text || '').length;
        if (totalSize + size <= sizeLimit) {
          totalSize += size;
          return true;
        }
        return false;
      });
    }

    if (countLimit && cleaned.length > countLimit) {
      cleaned.splice(0, cleaned.length - countLimit);
    }

    if (cleaned.length !== all.length) {
      await this.storage.save('rt.artifactHistory', cleaned);
    }
    return cleaned.length;
  }

  /**
   * Remove old artifacts to make room.
   */
  async trimOldArtifacts() {
    const all = await this.getAll();
    if (all.length <= this.maxArtifacts) return;

    // Sort by timestamp ascending (oldest first)
    all.sort((a, b) => a.timestamp - b.timestamp);
    const keep = all.slice(-this.maxArtifacts);
    await this.storage.save('rt.artifactHistory', keep);
  }

  /**
   * Deduplicate based on checksum.
   */
  deduplicate(artifacts) {
    const seen = new Map();
    return artifacts.filter(a => {
      const key = `${a.lang}:${a.checksum}`;
      if (seen.has(key)) return false;
      seen.set(key, true);
      return true;
    });
  }

  /**
   * Generate simple checksum for deduplication.
   */
  generateChecksum(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}