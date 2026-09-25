# 🔐 Messenger Secure

Zero-knowledge hybrid P2P messenger with end-to-end encryption.

**Repository**: [Viktor592/messenger-secure](https://github.com/Viktor592/messenger-secure)  
**Status**: 🚧 Active Development  
**Latest Build**: ✅ TypeScript 2150 LOC, 13 files  

---

## 📋 Project Overview

Messenger Secure is a cryptographically secure messaging application that prioritizes user privacy and data protection. It uses a hybrid architecture:

- **P2P Direct**: When both users are online, messages are encrypted end-to-end via WebRTC
- **Relay**: When users are offline, messages are stored encrypted on the server (7-day TTL)
- **Zero-Knowledge**: Server never has access to plaintext messages or encryption keys

---

## 🛡️ Security Stack

| Layer | Technology |
|-------|-----------|
| **Transport** | TLS 1.3 |
| **E2E Encryption** | Noise Protocol (Curve25519, ChaCha20-Poly1305) |
| **Key Exchange** | X3DH + Double Ratchet |
| **Signing** | Ed25519 |
| **Hashing** | SHA256 |

---

## 🏗️ Project Status

### ✅ Completed Phases

| Phase | Description | Status | Files |
|-------|-------------|--------|-------|
| **Round 1** | Backend scaffolding | ✅ Complete | +21 |
| **Round 2** | Mobile app scaffold | ✅ Complete | +23 |
| **Round 3** | API integration | ✅ Complete | +12 |
| **Round 4** | Backend implementation | ✅ Complete | TS fixes |
| **Round 5** | Local dev setup | ✅ Complete | +3 |

**Total Backend Code**: 2,150 lines of TypeScript across 13 files

---

## 📁 Architecture

### Backend Stack
- **Runtime**: Node.js 20+ 
- **Framework**: Express.js + TypeScript
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Crypto**: tweetnacl + Node.js crypto
- **Real-time**: Socket.io

### Mobile Stack
- **Framework**: React Native + Expo
- **Language**: TypeScript
- **State**: Zustand
- **Storage**: SQLite + SecureStore
- **Networking**: Socket.io client

### Web Stack
- **Framework**: React 18
- **Build**: Vite
- **Styling**: TailwindCSS
- **State**: Zustand

---

## 🚀 Quick Start

### Prerequisites
```bash
node --version  # v20+
```

### Install & Build
```bash
git clone https://github.com/Viktor592/messenger-secure.git
cd messenger-secure

# Verify compilation
bash test-build.sh
```

### Local Development
```bash
# Start databases (Docker)
docker-compose -f docker-compose.dev.yml up -d

# Initialize backend
cd backend
npm install
npm run build
npx prisma db push

# Start server
npm run dev
# Opens on http://localhost:3001
```

See **[LOCAL_SETUP.md](./LOCAL_SETUP.md)** for detailed instructions.

---

## 📡 API

### Authentication
```
POST /api/auth/register      → SMS code sent
POST /api/auth/verify        → JWT tokens
POST /api/auth/refresh       → New access token
POST /api/auth/logout        → Session terminated
```

### Contacts
```
GET  /api/contacts/search        → Find user
POST /api/contacts/add           → Add contact
GET  /api/contacts/verify/:fp    → Verify fingerprint
GET  /api/contacts/list          → List contacts
```

### Messages
```
GET  /api/messages/pending       → Offline messages
POST /api/messages/relay         → Store encrypted message
DELETE /api/messages/:id         → Delete message
POST /api/messages/batch-delete  → Bulk delete
GET  /api/messages/stats         → Message statistics
```

### Groups
```
POST /api/groups/create              → Create group
GET  /api/groups/list                → List groups
GET  /api/groups/:id                 → Get group details
POST /api/groups/:id/add-member      → Add member
POST /api/groups/:id/leave           → Leave group
DELETE /api/groups/:id               → Delete group
```

Full API docs: **[API.md](./API.md)**

---

## 🔐 Database Schema

```sql
User
├── id (UUID)
├── phoneHash (SHA256, unique)
├── publicKey (Curve25519)
├── identityKeyFingerprint (Ed25519)
└── displayName

Message (7-day TTL)
├── id
├── fromPhoneHash
├── toPhoneHash
└── encryptedBlob (Noise Protocol)

Group
├── id
├── name
├── creatorPhoneHash
└── GroupMember[]

Session, SmsCode, Prekey, Device, AuditLog
```

---

## 🧪 Testing

### Build Verification
```bash
bash test-build.sh
# ✅ TypeScript compiles
# ✅ 2150 LOC backend
# ✅ 13 source files
```

### API Testing
```bash
# Health check
curl http://localhost:3001/health

# Register phone
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone": "+79991234567"}'
```

### E2E Testing
See **[E2E_TESTING.md](./E2E_TESTING.md)** for full integration tests with two clients.

---

## 📚 Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - 5-minute setup
- **[LOCAL_SETUP.md](./LOCAL_SETUP.md)** - Development environment
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Design decisions
- **[SECURITY.md](./SECURITY.md)** - Threat model
- **[API.md](./API.md)** - Complete API reference
- **[E2E_TESTING.md](./E2E_TESTING.md)** - Integration testing
- **[MOBILE_DEVELOPMENT.md](./MOBILE_DEVELOPMENT.md)** - React Native guide

---

## 🚢 Deployment

### Docker (Recommended)
```bash
# Development
docker-compose -f docker-compose.dev.yml up

# Production
docker-compose -f docker-compose.prod.yml up -d
```

### VPS Setup
See **[SETUP.md](./SETUP.md)** for:
- Server provisioning (Ubuntu 22.04+)
- SSL/TLS certificates (Let's Encrypt)
- PostgreSQL backup strategy
- Monitoring & alerting
- Log aggregation

---

## 🗺️ Roadmap

### ✅ MVP (In Progress)
- Backend API with encryption
- Mobile client scaffold
- Docker compose setup
- E2E testing

### 🚧 Phase 2
- WebRTC P2P implementation
- Group messaging encryption
- File sharing
- Voice/video calls

### ⏳ Phase 3
- Performance optimization
- Offline message queue
- End-to-end search
- Device management

---

## 🤝 Contributing

1. Fork: `git clone https://github.com/Viktor592/messenger-secure.git`
2. Branch: `git checkout -b feature/description`
3. Commit: `git commit -m "feat: description"`
4. Push: `git push origin feature/description`
5. PR: Submit pull request

**Standards**:
- TypeScript strict mode
- No untyped `any`
- Meaningful commits
- Updated docs

---

## 📞 Contact

**Author**: Viktor592  
**Email**: viktor@motor-app.ru  
**GitHub**: [@Viktor592](https://github.com/Viktor592)

---

## 📄 License

[Your License Here]

---

**Status**: ✅ Build Successful (2026-09-25)  
**Next Steps**: Mobile integration + local E2E testing
