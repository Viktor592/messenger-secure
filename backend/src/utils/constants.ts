/**
 * Application constants
 */

// SMS verification
export const SMS_CODE_LENGTH = 6;
export const SMS_CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
export const SMS_MAX_ATTEMPTS = 5;
export const SMS_RATE_LIMIT = 5; // Max 5 SMS per hour

// Session tokens
export const SESSION_TOKEN_LENGTH = 32;
export const SESSION_TOKEN_EXPIRY_S = 600; // 10 minutes

// JWT
export const JWT_ALGORITHM = 'HS256';
export const JWT_ACCESS_TOKEN_EXPIRY = '15m';
export const JWT_REFRESH_TOKEN_EXPIRY = '30d';

// Messages
export const MESSAGE_TTL_DAYS = 7;
export const MESSAGE_MAX_SIZE = 1024 * 100; // 100KB

// Groups
export const GROUP_NAME_MIN_LENGTH = 1;
export const GROUP_NAME_MAX_LENGTH = 256;
export const GROUP_MAX_MEMBERS = 500;

// Display name
export const DISPLAY_NAME_MIN_LENGTH = 1;
export const DISPLAY_NAME_MAX_LENGTH = 256;

// Rate limiting
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const RATE_LIMIT_MAX_REQUESTS = 100;

// Prekeys
export const PREKEY_BATCH_SIZE = 100;
export const PREKEY_LOW_THRESHOLD = 20;

// WebSocket
export const WEBSOCKET_HEARTBEAT_MS = 30000; // 30 seconds
export const WEBSOCKET_HEARTBEAT_TIMEOUT_MS = 60000; // 60 seconds

// Redis
export const REDIS_PRESENCE_TTL_S = 3600; // 1 hour
export const REDIS_SIGNAL_TTL_S = 300; // 5 minutes
export const REDIS_SESSION_TTL_S = 600; // 10 minutes

// Crypto
export const NOISE_DH_LEN = 32; // Curve25519
export const NOISE_HASH_LEN = 32; // BLAKE2b-256
export const NOISE_KEY_LEN = 32; // ChaCha20
export const NOISE_NONCE_LEN = 12; // ChaCha20Poly1305
export const NOISE_TAG_LEN = 16; // Poly1305

// Error codes
export const ERROR_CODES = {
  INVALID_INPUT: 'INVALID_INPUT',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};
