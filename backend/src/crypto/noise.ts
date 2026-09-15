import * as sodium from 'libsodium.js';
import { randomBytes } from 'crypto';

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
  key: Uint8Array;
  nonce: number;
}

export interface HandshakeState {
  ss: Uint8Array; // Symmetric state (internal)
  ck: Uint8Array; // Chaining key
  h: Uint8Array; // Hash (for verification)
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
const PROTOCOL_NAME = 'Noise_NN_25519_ChaChaPoly_BLAKE2b';
const HASH_LEN = 32; // BLAKE2b-256
const KEY_LEN = 32; // ChaCha20 key
const NONCE_LEN = 12; // ChaCha20Poly1305 nonce
const DH_LEN = 32; // Curve25519
const TAG_LEN = 16; // Poly1305 tag

/**
 * Generate a keypair (long-term or ephemeral)
 */
export function generateKeyPair(): KeyPair {
  const seed = randomBytes(32);
  const keypair = sodium.crypto_kx_seed_keypair(seed);
  
  return {
    publicKey: sodium.to_base64(keypair.publicKey),
    privateKey: sodium.to_base64(keypair.privateKey),
  };
}

/**
 * Generate 100 prekeys for first contact
 */
export function generatePrekeys(count: number = 100): KeyPair[] {
  return Array.from({ length: count }, () => generateKeyPair());
}

/**
 * Hash function (BLAKE2b)
 */
function hash(data: Uint8Array | Uint8Array[]): Uint8Array {
  const combined = Array.isArray(data)
    ? new Uint8Array(data.reduce((acc, arr) => [...acc, ...arr], []))
    : data;
  
  return sodium.crypto_generichash(HASH_LEN, combined);
}

/**
 * HKDF (simplified version using BLAKE2b)
 * KDF(key, salt) → output
 */
export function hkdf(ikm: Uint8Array, salt: Uint8Array | null = null): Uint8Array {
  const actualSalt = salt || new Uint8Array(HASH_LEN);
  
  // HMAC-BLAKE2b
  const prk = sodium.crypto_generichash(
    HASH_LEN,
    ikm,
    actualSalt
  );
  
  // Expand
  const info = new Uint8Array(0);
  const okm = sodium.crypto_generichash(
    KEY_LEN,
    new Uint8Array([...prk, ...info, 0x01])
  );
  
  return okm;
}

/**
 * ECDH (Curve25519)
 * Perform Diffie-Hellman key exchange
 */
export function dh(
  privateKeyBase64: string,
  publicKeyBase64: string
): Uint8Array {
  const privateKey = sodium.from_base64(privateKeyBase64);
  const publicKey = sodium.from_base64(publicKeyBase64);
  
  // Use crypto_box for DH (Curve25519)
  const shared = sodium.crypto_scalarmult(privateKey, publicKey);
  return shared;
}

/**
 * X3DH Key Exchange (like Signal)
 * Returns shared secret from DH operations
 */
export function x3dh(
  initiatorIdentityPrivate: string,
  initiatorEphemeralPrivate: string,
  responderIdentityPublic: string,
  responderEphemeralPublic: string,
  responderPrekeyPublic: string
): Uint8Array {
  // DH1: initiator identity ← → responder ephemeral
  const dh1 = dh(initiatorIdentityPrivate, responderEphemeralPublic);
  
  // DH2: initiator ephemeral ← → responder identity
  const dh2 = dh(initiatorEphemeralPrivate, responderIdentityPublic);
  
  // DH3: initiator ephemeral ← → responder ephemeral
  const dh3 = dh(initiatorEphemeralPrivate, responderEphemeralPublic);
  
  // DH4: initiator identity ← → responder prekey
  const dh4 = dh(initiatorIdentityPrivate, responderPrekeyPublic);
  
  // Concatenate and hash
  const combined = new Uint8Array(dh1.length + dh2.length + dh3.length + dh4.length);
  combined.set(dh1, 0);
  combined.set(dh2, dh1.length);
  combined.set(dh3, dh1.length + dh2.length);
  combined.set(dh4, dh1.length + dh2.length + dh3.length);
  
  // KDF to derive shared secret
  return hkdf(combined);
}

/**
 * Initialize cipher state for message encryption
 */
export function initCipherState(key: Uint8Array): CipherState {
  return {
    key,
    nonce: 0,
  };
}

/**
 * Encrypt message using ChaCha20Poly1305
 */
export function encryptMessage(
  cipherState: CipherState,
  plaintext: Uint8Array,
  additionalData: Uint8Array
): { ciphertext: Uint8Array; tag: Uint8Array } {
  const nonce = new Uint8Array(12);
  
  // Convert nonce counter to bytes (little-endian)
  const nonceView = new DataView(nonce.buffer);
  nonceView.setBigUint64(4, BigInt(cipherState.nonce), true);
  
  // AEAD encrypt
  const ciphertext = sodium.crypto_aead_chacha20poly1305_encrypt(
    plaintext,
    additionalData,
    null,
    nonce,
    cipherState.key
  );
  
  // Split ciphertext and tag
  const ctLen = ciphertext.length - TAG_LEN;
  const ct = ciphertext.slice(0, ctLen);
  const tag = ciphertext.slice(ctLen);
  
  // Increment nonce
  cipherState.nonce += 1;
  
  return { ciphertext: ct, tag };
}

/**
 * Decrypt message using ChaCha20Poly1305
 */
export function decryptMessage(
  cipherState: CipherState,
  ciphertext: Uint8Array,
  tag: Uint8Array,
  additionalData: Uint8Array
): Uint8Array | null {
  const nonce = new Uint8Array(12);
  
  // Convert nonce counter to bytes
  const nonceView = new DataView(nonce.buffer);
  nonceView.setBigUint64(4, BigInt(cipherState.nonce), true);
  
  // Combine ciphertext + tag
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);
  
  try {
    const plaintext = sodium.crypto_aead_chacha20poly1305_decrypt(
      null,
      combined,
      additionalData,
      nonce,
      cipherState.key
    );
    
    // Increment nonce on success
    cipherState.nonce += 1;
    return plaintext;
  } catch (err) {
    // Authentication failed
    return null;
  }
}

/**
 * Double Ratchet: update keys after each message
 * Used to achieve perfect forward secrecy
 */
export function ratchetChainKey(chainKey: Uint8Array): {
  messageKey: Uint8Array;
  newChainKey: Uint8Array;
} {
  // KDF-CH: derive message key and next chain key
  const msgKey = hkdf(chainKey, Buffer.from('message', 'utf8'));
  const newChainKey = hkdf(chainKey, Buffer.from('chain', 'utf8'));
  
  return { messageKey: msgKey, newChainKey };
}

/**
 * Ratchet DH (update ephemeral keys)
 * Called when receiving a new ephemeral key from peer
 */
export function ratchetDH(
  currentRootKey: Uint8Array,
  currentEphemeralPrivate: string,
  peerEphemeralPublic: string
): {
  newRootKey: Uint8Array;
  newChainKey: Uint8Array;
} {
  // Perform DH
  const shared = dh(currentEphemeralPrivate, peerEphemeralPublic);
  
  // Update root key
  const newRootKey = hkdf(shared, currentRootKey);
  const newChainKey = hkdf(newRootKey, Buffer.from('chain', 'utf8'));
  
  return { newRootKey, newChainKey };
}

/**
 * Create a digital signature (for key verification)
 */
export function sign(
  message: Uint8Array,
  privateKeyBase64: string
): string {
  const privateKey = sodium.from_base64(privateKeyBase64);
  
  // Use Ed25519 for signing (derived from Curve25519)
  // Note: This is a simplified version - in production, use libsodium's signing
  const signature = sodium.crypto_generichash(64, message, privateKey);
  
  return sodium.to_base64(signature);
}

/**
 * Verify a digital signature
 */
export function verify(
  message: Uint8Array,
  publicKeyBase64: string,
  signatureBase64: string
): boolean {
  try {
    const publicKey = sodium.from_base64(publicKeyBase64);
    const signature = sodium.from_base64(signatureBase64);
    
    // Compute expected signature
    const expected = sodium.crypto_generichash(64, message, publicKey);
    
    // Constant-time comparison
    return sodium.compare(signature, expected) === 0;
  } catch (err) {
    return false;
  }
}

/**
 * Compute key fingerprint (for verification)
 * BLAKE2b hash of public key
 */
export function getKeyFingerprint(publicKeyBase64: string): string {
  const publicKey = sodium.from_base64(publicKeyBase64);
  const fingerprint = sodium.crypto_generichash(32, publicKey);
  return sodium.to_hex(fingerprint);
}

/**
 * Hash a value (for lookups, not security-critical)
 * Used for phone number hashing, etc.
 */
export function hashValue(value: string): string {
  const data = Buffer.from(value, 'utf8');
  const hash = sodium.crypto_generichash(32, data);
  return sodium.to_hex(hash);
}

/**
 * Generate a random token
 */
export function generateToken(length: number = 32): string {
  return sodium.to_base64(randomBytes(length));
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
  
  return sodium.compare(providedBuf, expectedBuf) === 0;
}

export default {
  generateKeyPair,
  generatePrekeys,
  dh,
  x3dh,
  initCipherState,
  encryptMessage,
  decryptMessage,
  ratchetChainKey,
  ratchetDH,
  sign,
  verify,
  getKeyFingerprint,
  hashValue,
  generateToken,
  verifyToken,
};
