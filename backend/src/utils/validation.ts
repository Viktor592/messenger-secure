/**
 * Validation utilities for request inputs
 */

export function validatePhoneHash(phoneHash: string): boolean {
  if (!phoneHash || typeof phoneHash !== 'string') {
    return false;
  }
  
  // Should be SHA256 hash (64 hex characters)
  return /^[a-f0-9]{64}$/.test(phoneHash);
}

export function validateDisplayName(displayName: string): boolean {
  if (!displayName || typeof displayName !== 'string') {
    return false;
  }
  
  // 1-256 characters, no control characters
  if (displayName.length < 1 || displayName.length > 256) {
    return false;
  }
  
  return !/[\x00-\x1F\x7F]/.test(displayName);
}

export function validateMessageId(messageId: string): boolean {
  if (!messageId || typeof messageId !== 'string') {
    return false;
  }
  
  // UUID format
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId);
}

export function validateGroupName(groupName: string): boolean {
  if (!groupName || typeof groupName !== 'string') {
    return false;
  }
  
  // 1-256 characters
  if (groupName.length < 1 || groupName.length > 256) {
    return false;
  }
  
  return !/[\x00-\x1F\x7F]/.test(groupName);
}

export function validateBase64(data: string): boolean {
  if (!data || typeof data !== 'string') {
    return false;
  }
  
  try {
    Buffer.from(data, 'base64').toString('base64');
    return true;
  } catch {
    return false;
  }
}

export function validatePublicKey(publicKey: string): boolean {
  if (!publicKey || typeof publicKey !== 'string') {
    return false;
  }
  
  // Should be valid base64 and at least 32 bytes
  if (!validateBase64(publicKey)) {
    return false;
  }
  
  const decoded = Buffer.from(publicKey, 'base64');
  return decoded.length >= 32;
}
