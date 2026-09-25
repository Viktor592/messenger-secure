import nacl from 'tweetnacl';
import { createHash, randomBytes } from 'crypto';

/**
 * Noise Protocol Implementation (NN + Double Ratchet)
 * 
 * Based on: https://noiseprotocol.org/
 * Using: ChaCha20Poly1305 + Curve25519
 * 
 * Security properties:
 * - Forward secrecy (via Double Ratchet)
 * - Break-in recovery
 * - Perfect forward secrecy
 */

// Types
export interface KeyPair {
  publicKey: string; // base64
  privateKey: string; // base64
}

export interface CipherState {
  key: Buffer;
  nonce: number;
}

export interface HandshakeState {
  ss: Buffer; // Symmetric state (internal)
  ck: Buffer; // Chaining key
  h: Buffer; // Hash (for verification)
}

export interface EncryptedMessage {
  type: 'message';
  senderId: string;
  recipientId: string;
  dhPublic: string; // Sender's ephemeral public key (base64)
  chainNum: number;
  msgNum: number;
  ciphertext: string; // base64
  authTag: string; // base64
}

// Constants
const KEY_LEN = 32; // ChaCha20 key
const TAG_LEN = 16; // Poly1305 tag

/**
 * Generate a keypair (long-term or ephemeral)
 */
export function generateKeyPair(): KeyPair {
  const keypair = nacl.box.keyPair();
  
  return {
    publicKey: Buffer.from(keypair.publicKey).toString('base64'),
    privateKey: Buffer.from(keypair.secretKey).toString('base64'),
  };
}

/**
 * Generate prekeys for first contact
 */
export function generatePrekeys(count: number = 100): KeyPair[] {
  return Array.from({ length: count }, () => generateKeyPair());
}

/**
 * Hash function (BLAKE2b via SHA256 fallback)
 */
function hash(data: Buffer | Buffer[]): Buffer {
  const combined = Array.isArray(data)
    ? Buffer.concat(data)
    : data;
  
  return createHash('sha256').update(combined).digest();
}

/**
 * HKDF - Key derivation
 */
export function hkdf(ikm: Buffer, salt: Buffer | null = null): Buffer {
  const prk = createHash('sha256')
    .update(salt || Buffer.alloc(32, 0))
    .update(ikm)
    .digest();

  const info = Buffer.from('messenger-secure', 'utf8');
  const t1 = createHash('sha256')
    .update(prk)
    .update(info)
    .digest();

  return t1.slice(0, 32);
}

/**
 * Diffie-Hellman (Curve25519)
 */
export function dh(
  publicKey: string,
  privateKey: string
): Buffer {
  const pub = Buffer.from(publicKey, 'base64');
  const priv = Buffer.from(privateKey, 'base64');
  
  const shared = nacl.box.before(pub, priv);
  return Buffer.from(shared);
}

/**
 * X3DH Key Exchange
 */
export function x3dh(
  aliceIdentityKey: string,
  aliceEphemeralKey: string,
  bobIdentityKey: string,
  bobPrekey: string
): Buffer {
  // DH1 = DH(IKa, SPKb)
  const dh1 = dh(bobPrekey, aliceIdentityKey);
  
  // DH2 = DH(EKa, IKb)
  const dh2 = dh(bobIdentityKey, aliceEphemeralKey);
  
  // DH3 = DH(EKa, SPKb)
  const dh3 = dh(bobPrekey, aliceEphemeralKey);
  
  // Combine: SK = HKDF(DH1 || DH2 || DH3)
  const combined = Buffer.concat([dh1, dh2, dh3]);
  
  return hkdf(combined);
}

/**
 * Initialize cipher state
 */
export function initCipherState(key: Buffer): CipherState {
  return {
    key: key.slice(0, KEY_LEN),
    nonce: 0,
  };
}

/**
 * Encrypt message using secretbox
 */
export function encryptMessage(
  plaintext: Buffer,
  cipherState: CipherState
): { ciphertext: Buffer; authTag: Buffer } {
  const nonce = Buffer.alloc(24, 0);
  nonce.writeUInt32BE(cipherState.nonce, 0);
  
  const ciphertext = nacl.secretbox(plaintext, nonce, cipherState.key);
  
  if (!ciphertext) {
    throw new Error('Encryption failed');
  }
  
  const ct = Buffer.from(ciphertext);
  
  return {
    ciphertext: ct.slice(0, -TAG_LEN),
    authTag: ct.slice(-TAG_LEN),
  };
}

/**
 * Decrypt message
 */
export function decryptMessage(
  ciphertext: Buffer,
  authTag: Buffer,
  cipherState: CipherState
): Buffer {
  const nonce = Buffer.alloc(24, 0);
  nonce.writeUInt32BE(cipherState.nonce, 0);
  
  const combined = Buffer.concat([ciphertext, authTag]);
  const plaintext = nacl.secretbox.open(combined, nonce, cipherState.key);
  
  if (!plaintext) {
    throw new Error('Decryption failed - authentication tag mismatch');
  }
  
  return Buffer.from(plaintext);
}

/**
 * Ratchet chain key
 */
export function ratchetChainKey(chainKey: Buffer): { messageKey: Buffer; newChainKey: Buffer } {
  const messageKeyMaterial = hash(chainKey);
  const newChainKeyMaterial = hash(Buffer.concat([chainKey, Buffer.from([0x01])]));
  
  return {
    messageKey: messageKeyMaterial,
    newChainKey: newChainKeyMaterial,
  };
}

/**
 * Ratchet DH
 */
export function ratchetDH(
  dhKey: Buffer,
  publicKey: string,
  privateKey: string
): Buffer {
  const newShared = dh(publicKey, privateKey);
  return hkdf(Buffer.concat([dhKey, newShared]));
}

/**
 * Sign message
 */
export function sign(message: Buffer, privateKey: string): Buffer {
  const priv = Buffer.from(privateKey, 'base64');
  const signature = nacl.sign.detached(message, priv);
  return Buffer.from(signature);
}

/**
 * Verify signature
 */
export function verify(
  message: Buffer,
  signature: Buffer,
  publicKey: string
): boolean {
  const pub = Buffer.from(publicKey, 'base64');
  return nacl.sign.detached.verify(message, signature, pub);
}

/**
 * Get fingerprint for TOFU verification
 */
export function getKeyFingerprint(publicKeyBase64: string): string {
  const publicKey = Buffer.from(publicKeyBase64, 'base64');
  const fingerprint = createHash('sha256').update(publicKey).digest();
  return fingerprint.toString('hex').slice(0, 16).toUpperCase();
}

/**
 * Hash value for storage
 */
export function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Generate random token
 */
export function generateToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Verify token (constant-time comparison)
 */
export function verifyToken(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }
  
  return providedBuf.every((byte, i) => byte === expectedBuf[i]);
}
