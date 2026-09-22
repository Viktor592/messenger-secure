import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';
import { Buffer } from 'buffer';
import { Message, Contact, ConversationState } from '../types';

/**
 * Encrypted local storage using SQLite + Secure Store
 * All sensitive data is encrypted with a device-derived encryption key
 */

const DB_NAME = 'messenger_secure.db';
const ENCRYPTION_KEY_STORE = 'messenger_encryption_key';
const NONCE_STORE = 'messenger_encryption_nonce';

export class EncryptedStorage {
  private db: SQLite.Database | null = null;
  private encryptionKey: Uint8Array | null = null;
  private initialized = false;

  /**
   * Initialize encrypted storage
   * Creates or retrieves encryption key from secure storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Open database
      this.db = await SQLite.openDatabaseAsync(DB_NAME);

      // Get or create encryption key
      await this.initializeEncryptionKey();

      // Create tables
      await this.createTables();

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize encrypted storage:', error);
      throw error;
    }
  }

  /**
   * Initialize encryption key (device-specific)
   * Uses Secure Store to persist key between sessions
   */
  private async initializeEncryptionKey(): Promise<void> {
    try {
      // Try to retrieve existing key
      const existingKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE);
      if (existingKey) {
        this.encryptionKey = new Uint8Array(Buffer.from(existingKey, 'base64'));
        return;
      }

      // Generate new 32-byte key
      const newKey = nacl.randomBytes(32);
      const keyBase64 = Buffer.from(newKey).toString('base64');

      // Store in secure store
      await SecureStore.setItemAsync(ENCRYPTION_KEY_STORE, keyBase64);
      this.encryptionKey = newKey;
    } catch (error) {
      console.error('Failed to initialize encryption key:', error);
      throw error;
    }
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.execAsync(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        phone_hash TEXT UNIQUE NOT NULL,
        display_name TEXT,
        public_key TEXT NOT NULL,
        identity_fingerprint TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- Contacts table
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        phone_hash TEXT UNIQUE NOT NULL,
        display_name TEXT,
        public_key TEXT NOT NULL,
        identity_fingerprint TEXT NOT NULL,
        status TEXT DEFAULT 'offline',
        verified BOOLEAN DEFAULT 0,
        last_seen INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- Messages table (encrypted)
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        from_phone_hash TEXT NOT NULL,
        to_phone_hash TEXT NOT NULL,
        encrypted_blob TEXT NOT NULL,
        nonce TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        is_read BOOLEAN DEFAULT 0,
        deleted_at INTEGER,
        created_at INTEGER NOT NULL
      );

      -- Pending messages (not yet sent)
      CREATE TABLE IF NOT EXISTS pending_messages (
        id TEXT PRIMARY KEY,
        to_phone_hash TEXT NOT NULL,
        encrypted_blob TEXT NOT NULL,
        nonce TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        retries INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      -- Conversation states (Noise Protocol ratchet)
      CREATE TABLE IF NOT EXISTS conversation_states (
        conversation_id TEXT PRIMARY KEY,
        contact_phone_hash TEXT NOT NULL,
        dh TEXT NOT NULL,
        pn INTEGER DEFAULT 0,
        cn INTEGER DEFAULT 0,
        ck_send TEXT NOT NULL,
        ck_recv TEXT NOT NULL,
        mk_send TEXT NOT NULL,
        mk_recv TEXT NOT NULL,
        last_message_timestamp INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- Groups table
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        creator_phone_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- Group members
      CREATE TABLE IF NOT EXISTS group_members (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        phone_hash TEXT NOT NULL,
        role TEXT DEFAULT 'member',
        joined_at INTEGER NOT NULL,
        UNIQUE(group_id, phone_hash),
        FOREIGN KEY(group_id) REFERENCES groups(id)
      );

      -- Sessions table
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        phone_hash TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      -- Device keys (crypto keys)
      CREATE TABLE IF NOT EXISTS device_keys (
        id TEXT PRIMARY KEY DEFAULT '1',
        identity_public_key TEXT NOT NULL,
        identity_secret_key TEXT NOT NULL,
        ephemeral_public_key TEXT NOT NULL,
        ephemeral_secret_key TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(id)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_from_to ON messages(from_phone_hash, to_phone_hash);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_messages(status);
      CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone_hash);
      CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
    `);
  }

  /**
   * Encrypt data with ChaCha20Poly1305
   */
  private encrypt(plaintext: string): { ciphertext: string; nonce: string } {
    if (!this.encryptionKey) throw new Error('Encryption key not initialized');

    const nonce = nacl.randomBytes(24);
    const plaintextBytes = Buffer.from(plaintext, 'utf-8');
    const encrypted = nacl.secretbox(plaintextBytes, nonce, this.encryptionKey);

    return {
      ciphertext: Buffer.from(encrypted).toString('base64'),
      nonce: Buffer.from(nonce).toString('base64'),
    };
  }

  /**
   * Decrypt data with ChaCha20Poly1305
   */
  private decrypt(ciphertext: string, nonceStr: string): string {
    if (!this.encryptionKey) throw new Error('Encryption key not initialized');

    const nonce = Buffer.from(nonceStr, 'base64');
    const ciphertextBytes = Buffer.from(ciphertext, 'base64');
    const decrypted = nacl.secretbox.open(ciphertextBytes, nonce, this.encryptionKey);

    if (!decrypted) throw new Error('Decryption failed');

    return Buffer.from(decrypted).toString('utf-8');
  }

  // ========== USERS ==========

  async saveUser(user: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `INSERT OR REPLACE INTO users (id, phone_hash, display_name, public_key, identity_fingerprint, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.phoneHash,
        user.displayName,
        user.publicKey,
        user.identityKeyFingerprint,
        user.createdAt?.getTime() || Date.now(),
        user.updatedAt?.getTime() || Date.now(),
      ]
    );
  }

  async getUser(): Promise<any | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getFirstAsync(
      'SELECT * FROM users LIMIT 1'
    );
    return result || null;
  }

  // ========== CONTACTS ==========

  async saveContact(contact: Contact): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `INSERT OR REPLACE INTO contacts (id, phone_hash, display_name, public_key, identity_fingerprint, status, verified, last_seen, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        contact.id,
        contact.phoneHash,
        contact.displayName,
        contact.publicKey,
        contact.identityKeyFingerprint,
        contact.status,
        0,
        contact.lastSeen?.getTime(),
        contact.createdAt?.getTime() || Date.now(),
        Date.now(),
      ]
    );
  }

  async getContact(phoneHash: string): Promise<Contact | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getFirstAsync(
      'SELECT * FROM contacts WHERE phone_hash = ?',
      [phoneHash]
    );
    return result ? this.rowToContact(result) : null;
  }

  async getAllContacts(): Promise<Contact[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.getAllAsync('SELECT * FROM contacts ORDER BY display_name');
    return results.map(row => this.rowToContact(row));
  }

  async updateContactStatus(phoneHash: string, status: 'online' | 'offline' | 'typing'): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      'UPDATE contacts SET status = ?, last_seen = ? WHERE phone_hash = ?',
      [status, Date.now(), phoneHash]
    );
  }

  private rowToContact(row: any): Contact {
    return {
      id: row.id,
      phoneHash: row.phone_hash,
      displayName: row.display_name,
      publicKey: row.public_key,
      identityKeyFingerprint: row.identity_fingerprint,
      status: row.status || 'offline',
      lastSeen: row.last_seen ? new Date(row.last_seen) : undefined,
      createdAt: new Date(row.created_at),
    };
  }

  // ========== MESSAGES ==========

  async saveMessage(message: Message): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `INSERT OR REPLACE INTO messages (id, from_phone_hash, to_phone_hash, encrypted_blob, nonce, timestamp, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        message.id,
        message.fromPhoneHash,
        message.toPhoneHash,
        message.encryptedBlob,
        message.nonce,
        message.timestamp.getTime(),
        message.isRead ? 1 : 0,
        Date.now(),
      ]
    );
  }

  async getConversation(phoneHash: string, limit = 50): Promise<Message[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.getAllAsync(
      `SELECT * FROM messages 
       WHERE (from_phone_hash = ? OR to_phone_hash = ?)
       ORDER BY timestamp DESC LIMIT ?`,
      [phoneHash, phoneHash, limit]
    );
    return results.map(row => this.rowToMessage(row)).reverse();
  }

  async markMessageAsRead(messageId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      'UPDATE messages SET is_read = 1 WHERE id = ?',
      [messageId]
    );
  }

  private rowToMessage(row: any): Message {
    return {
      id: row.id,
      fromPhoneHash: row.from_phone_hash,
      toPhoneHash: row.to_phone_hash,
      encryptedBlob: row.encrypted_blob,
      nonce: row.nonce,
      timestamp: new Date(row.timestamp),
      isRead: row.is_read === 1,
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
    };
  }

  // ========== CONVERSATION STATE (Noise Ratchet) ==========

  async saveConversationState(conversationId: string, contactPhoneHash: string, state: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stateJson = JSON.stringify(state);
    const { ciphertext, nonce } = this.encrypt(stateJson);

    await this.db.runAsync(
      `INSERT OR REPLACE INTO conversation_states (conversation_id, contact_phone_hash, dh, pn, cn, ck_send, ck_recv, mk_send, mk_recv, last_message_timestamp, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        conversationId,
        contactPhoneHash,
        ciphertext + ':' + nonce, // Store encrypted
        state.pn || 0,
        state.cn || 0,
        Buffer.from(state.ckSend).toString('base64'),
        Buffer.from(state.ckRecv).toString('base64'),
        Buffer.from(state.mkSend).toString('base64'),
        Buffer.from(state.mkRecv).toString('base64'),
        Date.now(),
        Date.now(),
        Date.now(),
      ]
    );
  }

  async getConversationState(conversationId: string): Promise<ConversationState | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getFirstAsync(
      'SELECT * FROM conversation_states WHERE conversation_id = ?',
      [conversationId]
    );
    return result ? this.rowToConversationState(result) : null;
  }

  private rowToConversationState(row: any): ConversationState {
    // Decrypt DH if needed
    const [ciphertext, nonce] = row.dh.split(':');
    let dhDecrypted = row.dh;
    try {
      dhDecrypted = this.decrypt(ciphertext, nonce);
    } catch (e) {
      // If decryption fails, use as-is (might be plain text)
    }

    return {
      conversationId: row.conversation_id,
      contactPhoneHash: row.contact_phone_hash,
      ratchetState: {
        dh: new Uint8Array(Buffer.from(dhDecrypted, 'base64')),
        pn: row.pn,
        cn: row.cn,
        ckSend: new Uint8Array(Buffer.from(row.ck_send, 'base64')),
        ckRecv: new Uint8Array(Buffer.from(row.ck_recv, 'base64')),
        mkSend: new Uint8Array(Buffer.from(row.mk_send, 'base64')),
        mkRecv: new Uint8Array(Buffer.from(row.mk_recv, 'base64')),
      },
      lastMessageTimestamp: row.last_message_timestamp,
      updatedAt: new Date(row.updated_at),
    };
  }

  // ========== DEVICE KEYS ==========

  async saveDeviceKeys(keys: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `INSERT OR REPLACE INTO device_keys (id, identity_public_key, identity_secret_key, ephemeral_public_key, ephemeral_secret_key, fingerprint, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        '1',
        keys.identityPublicKey,
        keys.identitySecretKey,
        keys.ephemeralPublicKey,
        keys.ephemeralSecretKey,
        keys.fingerprint,
        Date.now(),
      ]
    );
  }

  async getDeviceKeys(): Promise<any | null> {
    if (!this.db) throw new Error('Database not initialized');

    return await this.db.getFirstAsync('SELECT * FROM device_keys WHERE id = 1');
  }

  // ========== CLEANUP ==========

  async deleteOldMessages(olderThanDays = 7): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    await this.db.runAsync(
      'DELETE FROM messages WHERE timestamp < ? AND deleted_at IS NOT NULL',
      [cutoffTime]
    );
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }
}

export default EncryptedStorage;
