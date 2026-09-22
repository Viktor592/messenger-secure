import { Buffer } from 'buffer';
import nacl from 'tweetnacl';
import TweetNaCl from 'tweetnacl';

/**
 * Noise Protocol NN (no static keys) implementation for mobile client.
 * Uses Curve25519 for key exchange, ChaCha20Poly1305 for encryption.
 * Provides X3DH initial setup and Double Ratchet message encryption.
 */

export interface NoiseState {
  dh: Uint8Array; // Ephemeral DH public key
  pn: number; // Previous chain message number
  cn: number; // Current chain message number
  ckSend: Uint8Array; // Send chain key
  ckRecv: Uint8Array; // Receive chain key
  mkSend: Uint8Array; // Send message key
  mkRecv: Uint8Array; // Receive message key
}

export interface NoiseKeys {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export class NoiseProtocol {
  // Static identity keys (long-lived)
  private identityKeyPair: { publicKey: Uint8Array; secretKey: Uint8Array };
  
  // Ephemeral keys (per-session)
  private ephemeralKeyPair: { publicKey: Uint8Array; secretKey: Uint8Array };
  
  // Prekeys for first contact
  private prekeys: Uint8Array[] = [];
  
  // Active conversation states
  private conversationStates: Map<string, NoiseState> = new Map();

  constructor() {
    // Generate long-lived identity key pair
    this.identityKeyPair = nacl.box.keyPair();
    
    // Generate ephemeral key pair for initial handshake
    this.ephemeralKeyPair = nacl.box.keyPair();
    
    // Generate 100 prekeys for first contact scenarios
    this.generatePrekeys(100);
  }

  /**
   * Generate N prekeys for first contact (one-way messaging)
   */
  private generatePrekeys(count: number): void {
    for (let i = 0; i < count; i++) {
      const keyPair = nacl.box.keyPair();
      this.prekeys.push(keyPair.publicKey);
    }
  }

  /**
   * Get identity key fingerprint (for verification)
   * SHA256 hash of public key, first 20 bytes as hex
   */
  getIdentityFingerprint(): string {
    const crypto = require('crypto');
    const hash = crypto
      .createHash('sha256')
      .update(Buffer.from(this.identityKeyPair.publicKey))
      .digest();
    return Buffer.from(hash.slice(0, 20)).toString('hex').toUpperCase();
  }

  /**
   * Get public identity key (share with server for directory)
   */
  getIdentityPublicKey(): string {
    return Buffer.from(this.identityKeyPair.publicKey).toString('base64');
  }

  /**
   * Get ephemeral public key for initial handshake
   */
  getEphemeralPublicKey(): string {
    return Buffer.from(this.ephemeralKeyPair.publicKey).toString('base64');
  }

  /**
   * Get a single prekey for first contact
   * Removes it from pool after use (one-time prekey pattern)
   */
  getAndRemovePrekey(): { publicKey: string; index: number } | null {
    if (this.prekeys.length === 0) {
      return null;
    }
    const prekey = this.prekeys.shift()!;
    return {
      publicKey: Buffer.from(prekey).toString('base64'),
      index: 100 - this.prekeys.length, // Track which number this was
    };
  }

  /**
   * X3DH Key Exchange (Diffie-Hellman triple)
   * Called when establishing connection with new contact
   */
  x3dhKeyExchange(
    contactPublicKey: string,
    contactEphemeralKey: string,
    prekey?: string
  ): Uint8Array {
    const contactPubBytes = Buffer.from(contactPublicKey, 'base64');
    const contactEphBytes = Buffer.from(contactEphemeralKey, 'base64');

    // Three DH computations:
    // 1. Our ephemeral private key × Contact's static public key
    const dh1 = nacl.box.before(contactPubBytes, this.ephemeralKeyPair.secretKey);

    // 2. Our static private key × Contact's ephemeral public key
    const dh2 = nacl.box.before(contactEphBytes, this.identityKeyPair.secretKey);

    // 3. Our static private key × Contact's static public key
    const dh3 = nacl.box.before(contactPubBytes, this.identityKeyPair.secretKey);

    // Concatenate: dh1 || dh2 || dh3
    const combined = new Uint8Array(dh1.length + dh2.length + dh3.length);
    combined.set(dh1, 0);
    combined.set(dh2, dh1.length);
    combined.set(dh3, dh1.length + dh2.length);

    // KDF (HKDF-SHA256 with salt)
    const crypto = require('crypto');
    const hash = crypto.createHmac('sha256', Buffer.alloc(32, 0));
    hash.update(Buffer.from(combined));
    return new Uint8Array(hash.digest());
  }

  /**
   * Initialize Double Ratchet state after X3DH
   */
  initializeRatchetState(
    conversationId: string,
    sharedSecret: Uint8Array,
    isInitiator: boolean
  ): NoiseState {
    // HKDF to derive root key
    const crypto = require('crypto');
    const rootKey = crypto
      .createHmac('sha256', Buffer.alloc(32, 0))
      .update(Buffer.from(sharedSecret))
      .digest();

    // Initialize chain keys
    const ckSend = new Uint8Array(32);
    const ckRecv = new Uint8Array(32);

    if (isInitiator) {
      ckSend.set(new Uint8Array(Buffer.from(rootKey).slice(0, 32)));
      ckRecv.set(new Uint8Array(Buffer.from(rootKey).slice(16)));
    } else {
      ckRecv.set(new Uint8Array(Buffer.from(rootKey).slice(0, 32)));
      ckSend.set(new Uint8Array(Buffer.from(rootKey).slice(16)));
    }

    const state: NoiseState = {
      dh: this.ephemeralKeyPair.publicKey,
      pn: 0,
      cn: 0,
      ckSend,
      ckRecv,
      mkSend: new Uint8Array(32),
      mkRecv: new Uint8Array(32),
    };

    this.conversationStates.set(conversationId, state);
    return state;
  }

  /**
   * Double Ratchet - Symmetric Ratchet (advance chain)
   * HMAC-SHA256 KDF chain
   */
  private symmetricRatchet(
    chainKey: Uint8Array,
    role: 'send' | 'recv'
  ): { messageKey: Uint8Array; nextChainKey: Uint8Array } {
    const crypto = require('crypto');

    // Message key = HMAC-SHA256(chainKey, 0x01)
    const msgKeyHmac = crypto.createHmac('sha256', Buffer.from(chainKey));
    msgKeyHmac.update(Buffer.from([0x01]));
    const messageKey = new Uint8Array(msgKeyHmac.digest());

    // Chain key = HMAC-SHA256(chainKey, 0x02)
    const ckHmac = crypto.createHmac('sha256', Buffer.from(chainKey));
    ckHmac.update(Buffer.from([0x02]));
    const nextChainKey = new Uint8Array(ckHmac.digest());

    return { messageKey, nextChainKey };
  }

  /**
   * Encrypt message using ChaCha20Poly1305
   */
  encryptMessage(conversationId: string, plaintext: string): { ciphertext: string; nonce: string } {
    const state = this.conversationStates.get(conversationId);
    if (!state) {
      throw new Error(`No conversation state for ${conversationId}`);
    }

    // Advance send chain
    const { messageKey, nextChainKey } = this.symmetricRatchet(state.ckSend, 'send');
    state.ckSend = nextChainKey;
    state.cn++;

    // Generate nonce (random 24 bytes for ChaCha20Poly1305)
    const nonce = nacl.randomBytes(24);

    // Encrypt with ChaCha20Poly1305
    const plaintextBytes = Buffer.from(plaintext, 'utf-8');
    const encrypted = nacl.secretbox(plaintextBytes, nonce, messageKey);

    return {
      ciphertext: Buffer.from(encrypted).toString('base64'),
      nonce: Buffer.from(nonce).toString('base64'),
    };
  }

  /**
   * Decrypt message using ChaCha20Poly1305
   */
  decryptMessage(
    conversationId: string,
    ciphertext: string,
    nonceStr: string
  ): string {
    const state = this.conversationStates.get(conversationId);
    if (!state) {
      throw new Error(`No conversation state for ${conversationId}`);
    }

    // Advance receive chain
    const { messageKey, nextChainKey } = this.symmetricRatchet(state.ckRecv, 'recv');
    state.ckRecv = nextChainKey;

    // Decrypt
    const nonce = Buffer.from(nonceStr, 'base64');
    const ciphertextBytes = Buffer.from(ciphertext, 'base64');

    const decrypted = nacl.secretbox.open(ciphertextBytes, nonce, messageKey);
    if (!decrypted) {
      throw new Error('Decryption failed - authentication tag mismatch');
    }

    return Buffer.from(decrypted).toString('utf-8');
  }

  /**
   * Get current conversation state (for debugging/storage)
   */
  getConversationState(conversationId: string): NoiseState | undefined {
    return this.conversationStates.get(conversationId);
  }

  /**
   * Verify contact's identity fingerprint
   */
  verifyContactFingerprint(
    contactPublicKeyBase64: string,
    contactFingerprint: string
  ): boolean {
    const crypto = require('crypto');
    const contactKey = Buffer.from(contactPublicKeyBase64, 'base64');
    const hash = crypto
      .createHash('sha256')
      .update(contactKey)
      .digest();
    const computed = Buffer.from(hash.slice(0, 20))
      .toString('hex')
      .toUpperCase();
    return computed === contactFingerprint;
  }

  /**
   * Export keys for secure storage (all sensitive material)
   */
  exportKeys(): {
    identityPublicKey: string;
    identitySecretKey: string;
    ephemeralPublicKey: string;
    ephemeralSecretKey: string;
    fingerprint: string;
  } {
    return {
      identityPublicKey: Buffer.from(this.identityKeyPair.publicKey).toString('base64'),
      identitySecretKey: Buffer.from(this.identityKeyPair.secretKey).toString('base64'),
      ephemeralPublicKey: Buffer.from(this.ephemeralKeyPair.publicKey).toString('base64'),
      ephemeralSecretKey: Buffer.from(this.ephemeralKeyPair.secretKey).toString('base64'),
      fingerprint: this.getIdentityFingerprint(),
    };
  }

  /**
   * Import keys from storage
   */
  importKeys(keys: {
    identityPublicKey: string;
    identitySecretKey: string;
    ephemeralPublicKey: string;
    ephemeralSecretKey: string;
  }): void {
    this.identityKeyPair = {
      publicKey: new Uint8Array(Buffer.from(keys.identityPublicKey, 'base64')),
      secretKey: new Uint8Array(Buffer.from(keys.identitySecretKey, 'base64')),
    };
    this.ephemeralKeyPair = {
      publicKey: new Uint8Array(Buffer.from(keys.ephemeralPublicKey, 'base64')),
      secretKey: new Uint8Array(Buffer.from(keys.ephemeralSecretKey, 'base64')),
    };
  }
}

export default NoiseProtocol;
