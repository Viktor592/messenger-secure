# Messenger Secure Architecture

Полная техническая документация архитектуры системы.

## 📊 System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          MESSENGER ECOSYSTEM                         │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │   iOS App       │    │  Android App    │    │   Web App       │  │
│  │ (React Native)  │    │ (React Native)  │    │   (React)       │  │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘  │
│           │                      │                      │            │
│           └──────────────────────┼──────────────────────┘            │
│                                  │                                   │
│                     ┌────────────▼────────────┐                      │
│                     │   Noise Protocol E2E   │                      │
│                     │   (Client-side crypto) │                      │
│                     └────────────┬────────────┘                      │
│                                  │                                   │
└──────────────────────────────────┼───────────────────────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   WebSocket / Socket.io    │
                    │   (TLS 1.3 transport)      │
                    └──────────────┬──────────────┘
                                   │
┌──────────────────────────────────┼───────────────────────────────────┐
│                      RELAY SERVER LAYER                              │
├──────────────────────────────────┼───────────────────────────────────┤
│                                  ▼                                   │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │         Express Server (Node.js + TypeScript)                │  │
│  │                                                               │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │  │
│  │  │  SMS Auth   │  │  P2P Signal  │  │  Message Relay   │   │  │
│  │  │  (Twilio)   │  │  (WebRTC)    │  │  (Encrypted)     │   │  │
│  │  └─────────────┘  └──────────────┘  └──────────────────┘   │  │
│  │                                                               │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │  │
│  │  │  Directory  │  │    Presence  │  │  Group Mgmt      │   │  │
│  │  │  (Phone→Key)│  │   (Online)   │  │  (Metadata only) │   │  │
│  │  └─────────────┘  └──────────────┘  └──────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                  │                                   │
│          ┌───────────────────────┼───────────────────────┐           │
│          │                       │                       │           │
│          ▼                       ▼                       ▼           │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐       │
│  │ PostgreSQL   │      │    Redis     │      │   TURN Conf  │       │
│  │ (Encrypted)  │      │  (Presence)  │      │  (Public)    │       │
│  └──────────────┘      └──────────────┘      └──────────────┘       │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                     INFRASTRUCTURE LAYER                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐    │
│  │  Hetzner VPS    │  │  External TURN   │  │  DNS / Domain   │    │
│  │  (CAX11)        │  │  (Google/Numb)   │  │  (Cloudflare)   │    │
│  └─────────────────┘  └──────────────────┘  └─────────────────┘    │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │            Docker Container Orchestration                    │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │   │
│  │  │ Backend API  │  │ PostgreSQL   │  │ Redis            │  │   │
│  │  │ Container    │  │ Container    │  │ Container        │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

## 🔄 Message Flow

### Scenario 1: Both Users Online (P2P)

```
User A                          Relay Server                        User B
  │                                  │                               │
  ├─ Connect (WebSocket)────────────►│                               │
  │                                  ├─ Register in Redis            │
  │                                  │                               │
  ├─ Send Offer (Signal)─────────────►│──────────┐                   │
  │                                  │          │                   │
  │                                  ├─ Relay to B ────────────────►│
  │                                  │                               │
  │◄─────────────────────────────────┼──────── Answer Signal ◄──────┤
  │                                  │                               │
  │                                 [P2P WebRTC established]         │
  │                                                                   │
  ├──── Encrypted Message (Noise) ─────────────────────────────────►│
  │                                  ✓ Server doesn't see content    │
  │                                  ✓ Server not in path            │
```

### Scenario 2: User B Offline (Relay + Queue)

```
User A                          Relay Server                        User B
  │                                  │                          (Offline)
  ├─ Connect (WebSocket)────────────►│                               │
  │                                  │                               │
  ├─ Send Msg (encrypted blob)───────►│                               │
  │                                  ├─ Check if B online: NO        │
  │                                  ├─ Store blob in DB (TTL 7d)   │
  │                                  │    (Only encrypted, no key)   │
  │                                  │                               │
  │                    [A disconnects]                               │
  │                                  │                               │
  │                                  │          [B comes online]     │
  │                                  │                               │
  │                                  ├─ Fetch pending (WHERE         │
  │                                  │    phone_hash = B)            │
  │                                  │                               │
  │                                  ├─ Send encrypted blob ────────►│
  │                                  │                               │
  │                                  ├─ B decrypts locally           │
  │                                  ├─ B confirms delivery          │
  │                                  │◄──────────────────────────────┤
  │                                  ├─ DELETE blob from DB          │
```

## 🔐 Cryptographic Flow

### Initial Key Exchange (X3DH-like)

```
┌─────────────────────────────────────────────────────────────────────┐
│              Extended Triple Diffie-Hellman (X3DH)                 │
│                  (Similar to Signal Protocol)                      │
└─────────────────────────────────────────────────────────────────────┘

Alice's Keys:
  ├─ IK_a: Identity Key (long-term, Curve25519)
  ├─ EK_a: Ephemeral Key (one-time, Curve25519)
  └─ PK_a: Prekey (100 prekeys in server, Curve25519)

Bob's Keys:
  ├─ IK_b: Identity Key
  ├─ EK_b: Ephemeral Key
  └─ PK_b: Prekey

Handshake:
  DH1 = ECDH(IK_a, EK_b)     # Identity ← → Ephemeral
  DH2 = ECDH(EK_a, IK_b)     # Ephemeral ← → Identity
  DH3 = ECDH(EK_a, EK_b)     # Ephemeral ← → Ephemeral
  DH4 = ECDH(IK_a, PK_b)     # Identity ← → Prekey

Shared Secret: KDF(DH1 || DH2 || DH3 || DH4)
```

### Session Encryption (Noise NN + Double Ratchet)

```
Message 1 (Alice → Bob):
  ┌─────────────────────────────────────────────────┐
  │ Plaintext Message                               │
  │         │                                       │
  │         ▼                                       │
  │ ┌─────────────────────────────────────────┐   │
  │ │ Double Ratchet (Alice's send chain)    │   │
  │ │ ├─ KDF(root_key, DH)                   │   │
  │ │ ├─ chain_key_send = DH_output[:32]     │   │
  │ │ ├─ message_key = DH_output[32:]        │   │
  │ │ └─ Update DH ephemeral                 │   │
  │ └─────────────────────────────────────────┘   │
  │         │                                       │
  │         ▼                                       │
  │ ┌─────────────────────────────────────────┐   │
  │ │ AEAD Encryption (ChaCha20Poly1305)      │   │
  │ │ ├─ Key: message_key                     │   │
  │ │ ├─ Nonce: message_number               │   │
  │ │ ├─ AD: sender_id || recipient_id       │   │
  │ │ └─ Output: ciphertext + auth_tag       │   │
  │ └─────────────────────────────────────────┘   │
  │         │                                       │
  │         ▼                                       │
  │ ┌─────────────────────────────────────────┐   │
  │ │ Encrypted Message (JSON)                │   │
  │ │ {                                       │   │
  │ │   "type": "message",                    │   │
  │ │   "sender_id": "alice_pubkey",          │   │
  │ │   "recipient_id": "bob_pubkey",         │   │
  │ │   "dh_public": "<ephemeral_pubkey>",    │   │
  │ │   "msg_num": 1,                         │   │
  │ │   "payload": "<ciphertext>",            │   │
  │ │   "auth_tag": "<poly1305_tag>"          │   │
  │ │ }                                       │   │
  │ └─────────────────────────────────────────┘   │
  │         │                                       │
  │         ▼                                       │
  │ ┌─────────────────────────────────────────┐   │
  │ │ Server stores (NO DECRYPTION):          │   │
  │ │ {                                       │   │
  │ │   encrypted_blob: <base64>,             │   │
  │ │   from_phone_hash: <sha256>,            │   │
  │ │   to_phone_hash: <sha256>,              │   │
  │ │   timestamp: <unix>,                    │   │
  │ │   ttl_expires: <unix + 7d>              │   │
  │ │ }                                       │   │
  │ └─────────────────────────────────────────┘   │
  └─────────────────────────────────────────────────┘

Bob's Decryption (only Bob can decrypt with his secret):
  ┌─────────────────────────────────────────────────┐
  │ Encrypted Message from Server                   │
  │         │                                       │
  │         ▼                                       │
  │ ┌─────────────────────────────────────────┐   │
  │ │ Bob's Double Ratchet (receive chain)    │   │
  │ │ ├─ Receive DH public: alice_dh          │   │
  │ │ ├─ KDF(root_key, DH)                    │   │
  │ │ ├─ Derive message_key                   │   │
  │ │ └─ Increment chain counter              │   │
  │ └─────────────────────────────────────────┘   │
  │         │                                       │
  │         ▼                                       │
  │ ┌─────────────────────────────────────────┐   │
  │ │ AEAD Decryption (ChaCha20Poly1305)      │   │
  │ │ ├─ Verify auth_tag                      │   │
  │ │ ├─ Decrypt with message_key             │   │
  │ │ └─ Output: plaintext ✓                  │   │
  │ └─────────────────────────────────────────┘   │
  │         │                                       │
  │         ▼                                       │
  │ Plaintext Message (only Bob reads)             │
  └─────────────────────────────────────────────────┘
```

## 📱 Mobile App Architecture

### React Native Project Structure

```
mobile/
├── src/
│   ├── screens/
│   │   ├── AuthScreen.tsx          # SMS verification
│   │   ├── ContactsScreen.tsx      # Contacts list
│   │   ├── ChatScreen.tsx          # 1-on-1 messages
│   │   ├── CallScreen.tsx          # Video/audio calls
│   │   ├── GroupScreen.tsx         # Group management
│   │   └── SettingsScreen.tsx      # Settings
│   │
│   ├── components/
│   │   ├── MessageBubble.tsx
│   │   ├── ContactCard.tsx
│   │   ├── InputField.tsx
│   │   ├── CallWidget.tsx
│   │   └── GroupAvatar.tsx
│   │
│   ├── crypto/
│   │   ├── noiseProtocol.ts        # Noise Protocol impl
│   │   ├── keyManagement.ts        # Key generation/storage
│   │   └── verification.ts         # Fingerprint verification
│   │
│   ├── storage/
│   │   ├── database.ts             # SQLite setup
│   │   ├── messages.ts             # Message persistence
│   │   ├── contacts.ts             # Contact management
│   │   └── keys.ts                 # Encrypted key storage
│   │
│   ├── api/
│   │   ├── relay.ts                # Relay server client
│   │   ├── socket.ts               # WebSocket connection
│   │   └── sms.ts                  # SMS verification
│   │
│   ├── webrtc/
│   │   ├── peer.ts                 # WebRTC peer connection
│   │   ├── signaling.ts            # Offer/Answer/ICE
│   │   └── media.ts                # Audio/Video capture
│   │
│   ├── utils/
│   │   ├── helpers.ts
│   │   ├── formatting.ts
│   │   └── permissions.ts
│   │
│   └── App.tsx
│
├── app.json
├── app.config.ts
├── eas.json
└── package.json
```

### Data Storage (Encrypted SQLite)

```
┌────────────────────────────────────────┐
│      Encrypted SQLite Database         │
│          (On Device Only)              │
└────────────────────────────────────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
        ▼         ▼         ▼
    ┌─────┐  ┌─────┐  ┌─────────┐
    │Users│  │Chats│  │Messages │
    ├─────┤  ├─────┤  ├─────────┤
    │id   │  │id   │  │id       │
    │name │  │name │  │chat_id  │
    │phone│  │type │  │sender   │
    │IK   │  │keys │  │payload  │
    │EKs  │  │meta │  │timestamp│
    └─────┘  └─────┘  └─────────┘
        │         │         │
        ▼         ▼         ▼
    ┌─────────────────────────────────┐
    │  SQLCipher Encryption           │
    │  (AES-256 hardware-backed)      │
    │  Key: Keychain/Secure Storage   │
    └─────────────────────────────────┘
```

## 🖥 Backend Database Schema

### PostgreSQL (Encrypted Blobs Only)

```sql
-- Users directory (minimal)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  phone_hash BYTEA UNIQUE NOT NULL,  -- SHA256(phone), not phone
  public_key BYTEA NOT NULL,          -- Curve25519 public key
  identity_key_fingerprint VARCHAR,   -- For verification
  created_at TIMESTAMP,
  last_seen TIMESTAMP
);

-- Encrypted message queue (TTL 7 days)
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  from_phone_hash BYTEA NOT NULL,     -- Hashed, not actual
  to_phone_hash BYTEA NOT NULL,
  encrypted_blob BYTEA NOT NULL,      -- Noise-encrypted, server can't read
  created_at TIMESTAMP,
  expires_at TIMESTAMP,               -- Auto-delete after 7 days
  CONSTRAINT fk_from FOREIGN KEY (from_phone_hash) REFERENCES users(phone_hash),
  CONSTRAINT fk_to FOREIGN KEY (to_phone_hash) REFERENCES users(phone_hash)
);
CREATE INDEX idx_to_phone_created ON messages(to_phone_hash, created_at DESC);

-- Group metadata (names only, no member list)
CREATE TABLE groups (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,
  creator_phone_hash BYTEA,
  avatar_hash VARCHAR,
  created_at TIMESTAMP
);

-- Group membership (encrypted, phone_hash only)
CREATE TABLE group_members (
  id UUID PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  member_phone_hash BYTEA NOT NULL,
  role VARCHAR DEFAULT 'member',      -- 'admin', 'member'
  joined_at TIMESTAMP
);

-- SMS verification cache (temporary, 10 min TTL)
CREATE TABLE sms_codes (
  id UUID PRIMARY KEY,
  phone_hash BYTEA UNIQUE NOT NULL,
  code_hash BYTEA NOT NULL,           -- Hashed verification code
  attempt_count INT DEFAULT 0,
  created_at TIMESTAMP,
  expires_at TIMESTAMP                -- Auto-delete after 10 min
);
```

### Redis (Session Data Only, No Persistence)

```
# Presence tracking (in-memory, no persistence)
presence:user:{user_id} = {
  "online": true,
  "last_active": 1234567890
}

# WebSocket session mapping
socket:{socket_id} = {
  "user_id": "uuid",
  "phone_hash": "hash",
  "connected_at": 1234567890
}

# P2P signaling (temporary, RTL 5 min)
signal:{user_id}:offers = [
  { "from": "peer_id", "offer": "webrtc_offer", "expires_at": 1234567890 }
]
```

## 🔌 API Endpoints

### HTTP REST

```
POST /api/auth/register
  ├─ Body: { phone: "+79991234567" }
  └─ Response: { sms_required: true, session_token: "..." }

POST /api/auth/verify
  ├─ Body: { session_token, sms_code, public_key }
  └─ Response: { access_token, refresh_token, user_id }

GET /api/contacts/search
  ├─ Query: ?phone=+79991234567
  ├─ Auth: Bearer token
  └─ Response: { user: { id, name, fingerprint } } | 404

POST /api/contacts/add
  ├─ Body: { contact_phone, name }
  ├─ Auth: Bearer token
  └─ Response: { contact_id }
```

### WebSocket Events (Socket.io)

```
# Connection
connect
  └─ Auth: { token: "access_token" }
  └─ Emits: connection_ready

# Messaging
message:send
  ├─ Body: { to_user_id, encrypted_payload, delivery_receipt }
  └─ Reply: { message_id, timestamp, status }

message:receive
  ├─ From: Server
  ├─ Body: { from_user_id, encrypted_payload }
  └─ Reply: ack({ message_id })

# Signaling (WebRTC)
signal:offer
  ├─ Body: { to_user_id, sdp_offer }
  └─ Relay to recipient

signal:answer
  ├─ Body: { to_user_id, sdp_answer }
  └─ Relay to initiator

signal:ice_candidate
  ├─ Body: { to_user_id, candidate }
  └─ Relay to recipient

# Groups
group:create
  ├─ Body: { name, members: [phone1, phone2] }
  └─ Reply: { group_id }

group:send_message
  ├─ Body: { group_id, encrypted_payload }
  └─ Broadcast to all members

# Presence
presence:update
  ├─ Body: { status: "online" | "typing" | "offline" }
  └─ Broadcast to contacts
```

## 🚀 Deployment

### Docker Compose Stack

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://...
      REDIS_URL: redis://redis:6379
      TWILIO_ACCOUNT_SID: ...
      NODE_ENV: production
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    volumes:
      - db_data:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: secure_password
      POSTGRES_DB: messenger

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - /etc/letsencrypt:/etc/letsencrypt
    depends_on:
      - backend

volumes:
  db_data:
  redis_data:
```

## 🔄 Scaling Considerations

### Horizontal Scaling

```
Load Balancer (Cloudflare / Nginx)
         │
    ┌────┼────┐
    │    │    │
    ▼    ▼    ▼
  Backend1 Backend2 Backend3
    │    │    │
    └────┼────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
PostgreSQL  Redis Cluster
(Replicated) (Partitioned)
```

- **Stateless backend**: Каждый инстанс автономен
- **Redis Cluster**: Partitioned presence/signals
- **PostgreSQL Replication**: Primary-replica setup
- **Message Queue**: BullMQ for async tasks

## 📊 Performance Targets

- **Message latency**: < 100ms (P2P), < 500ms (relay)
- **SMS delivery**: < 1 minute
- **Video call setup**: < 3 seconds
- **Concurrent users**: 10,000+ on single CAX11
- **Message throughput**: 10,000 msg/sec

---

This is the foundation. Implementation details follow in code.
