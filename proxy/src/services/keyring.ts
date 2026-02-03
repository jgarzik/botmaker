import type { ProxyDatabase } from '../db/index.js';
import type { ProviderKey } from '../types.js';
import { decrypt } from '../crypto/encryption.js';

export class KeyringService {
  private db: ProxyDatabase;
  private masterKey: Buffer;
  private roundRobinIndex = new Map<string, number>();

  constructor(db: ProxyDatabase, masterKey: Buffer) {
    this.db = db;
    this.masterKey = masterKey;
  }

  /**
   * Select a key using round-robin from a set of keys.
   */
  private selectFromKeys(keys: ProviderKey[], cacheKey: string): { keyId: string; secret: string } | null {
    if (keys.length === 0) {
      return null;
    }

    const currentIndex = this.roundRobinIndex.get(cacheKey) ?? 0;
    const key = keys[currentIndex % keys.length];
    this.roundRobinIndex.set(cacheKey, currentIndex + 1);

    const secret = decrypt(key.secret_encrypted, this.masterKey);
    return { keyId: key.id, secret };
  }

  /**
   * Select a key for a vendor (no tag filtering).
   */
  selectKey(vendor: string): { keyId: string; secret: string } | null {
    const keys = this.db.getKeysByVendor(vendor);
    return this.selectFromKeys(keys, vendor);
  }

  /**
   * Select a key for a bot based on its tags.
   * 1. If bot has tags, try each tag in order to find a matching key
   * 2. If no match found (or no tags), fall back to default (untagged) keys
   * 3. Round-robin within the matched set
   */
  selectKeyForBot(vendor: string, botTags: string[] | null): { keyId: string; secret: string } | null {
    // Try each bot tag in order
    if (botTags && botTags.length > 0) {
      for (const tag of botTags) {
        const taggedKeys = this.db.getKeysByVendorAndTag(vendor, tag);
        if (taggedKeys.length > 0) {
          return this.selectFromKeys(taggedKeys, `${vendor}:${tag}`);
        }
      }
    }

    // Fallback to default (untagged) keys
    const defaultKeys = this.db.getDefaultKeysForVendor(vendor);
    if (defaultKeys.length > 0) {
      return this.selectFromKeys(defaultKeys, `${vendor}:default`);
    }

    // Last resort: any key for this vendor
    const allKeys = this.db.getKeysByVendor(vendor);
    return this.selectFromKeys(allKeys, vendor);
  }
}
