-- User table
CREATE TABLE IF NOT EXISTS "User" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "phoneHash" VARCHAR(64) UNIQUE NOT NULL,
    "publicKey" TEXT NOT NULL,
    "identityKeyFingerprint" VARCHAR(16),
    "displayName" VARCHAR(256),
    "lastSeenAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SMS Code table
CREATE TABLE IF NOT EXISTS "SmsCode" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "phoneHash" VARCHAR(64) UNIQUE NOT NULL,
    "codeHash" VARCHAR(64) NOT NULL,
    "attemptCount" INTEGER DEFAULT 0,
    "maxAttempts" INTEGER DEFAULT 5,
    "expiresAt" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session table
CREATE TABLE IF NOT EXISTS "Session" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userPhoneHash" VARCHAR(64) NOT NULL,
    "tokenHash" VARCHAR(64) UNIQUE NOT NULL,
    "expiresAt" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message table (for offline relay)
CREATE TABLE IF NOT EXISTS "Message" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "fromPhoneHash" VARCHAR(64) NOT NULL,
    "toPhoneHash" VARCHAR(64) NOT NULL,
    "encryptedBlob" TEXT NOT NULL,
    "expiresAt" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Group table
CREATE TABLE IF NOT EXISTS "Group" (
    id TEXT PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    "creatorPhoneHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Group Member table
CREATE TABLE IF NOT EXISTS "GroupMember" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "groupId" TEXT NOT NULL REFERENCES "Group"(id) ON DELETE CASCADE,
    "memberPhoneHash" VARCHAR(64) NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
    "joinedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("groupId", "memberPhoneHash")
);

-- Prekey table
CREATE TABLE IF NOT EXISTS "Prekey" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userPhoneHash" VARCHAR(64) NOT NULL,
    "publicKey" TEXT NOT NULL,
    signature VARCHAR(255),
    used BOOLEAN DEFAULT FALSE,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_phone_hash ON "User"("phoneHash");
CREATE INDEX IF NOT EXISTS idx_message_to ON "Message"("toPhoneHash");
CREATE INDEX IF NOT EXISTS idx_message_expires ON "Message"("expiresAt");
CREATE INDEX IF NOT EXISTS idx_group_creator ON "Group"("creatorPhoneHash");
CREATE INDEX IF NOT EXISTS idx_group_member ON "GroupMember"("memberPhoneHash");
CREATE INDEX IF NOT EXISTS idx_prekey_user ON "Prekey"("userPhoneHash");
