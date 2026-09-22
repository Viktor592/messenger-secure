# Messenger Secure - Mobile Development Guide

## Overview

This is the React Native mobile client for Messenger Secure, a zero-knowledge hybrid P2P messenger with end-to-end encryption.

**Status:** 🚧 Alpha (v0.1.0-alpha)

## Architecture

```
mobile/
├── src/
│   ├── screens/              # UI screens (Auth, Chat, Contacts, Groups, Settings)
│   ├── navigation/           # React Navigation stacks and tabs
│   ├── crypto/              # Noise Protocol client + key derivation
│   ├── storage/             # Encrypted SQLite database + Secure Store
│   ├── socket/              # Socket.io real-time client
│   ├── components/          # Reusable UI components
│   ├── types/               # TypeScript types and interfaces
│   └── utils/               # Store (Zustand), helpers, constants
├── App.tsx                  # Entry point
├── app.json                 # Expo configuration
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
├── jest.config.js           # Testing config
└── .env.example             # Environment variables template
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | React Native 0.73 + Expo 50 |
| **Language** | TypeScript 5.3 |
| **Navigation** | React Navigation 6 |
| **State Management** | Zustand 5 |
| **Crypto** | tweetnacl.js (Noise Protocol, ChaCha20Poly1305) |
| **Storage** | SQLite (encrypted) + Secure Store |
| **Real-time** | Socket.io 4.8 |
| **WebRTC** | react-native-webrtc 111 |
| **Testing** | Jest 29 + React Native Testing Library |

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- iOS: Xcode 14+ (for iOS development)
- Android: Android Studio + Android SDK 14+

### Installation

```bash
cd mobile

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Update API_SERVER and SOCKET_SERVER in .env.local
```

### Running the App

**Start Expo:**
```bash
npm start
```

**iOS:**
```bash
npm run ios
```
- Requires Xcode and a Mac

**Android:**
```bash
npm run android
```
- Requires Android emulator or USB-connected device

**Web (experimental):**
```bash
npm run web
```
- For testing in a browser

## Features Implemented

### ✅ Authentication
- [x] Phone number input (E.164 format)
- [x] SMS verification (6-digit code)
- [x] PIN setup (local device protection)
- [x] JWT token management (access + refresh)

### ✅ Crypto
- [x] Noise Protocol NN (no static keys)
- [x] X3DH key exchange
- [x] Double Ratchet (symmetric ratchet)
- [x] ChaCha20Poly1305 AEAD encryption
- [x] Identity key fingerprint verification
- [x] Perfect Forward Secrecy

### ✅ Storage
- [x] Encrypted SQLite database
- [x] Secure Store (device-specific encryption key)
- [x] Schema: users, contacts, messages, groups, sessions, device_keys, conversation_states
- [x] Automatic cleanup of old messages (7-day TTL)

### ✅ Real-time
- [x] Socket.io client connection
- [x] Presence updates (online/offline/typing)
- [x] Message relay + acknowledgment
- [x] WebRTC signaling (offer/answer/ICE candidates)
- [x] Group messaging events

### ✅ UI Screens
- [x] **Auth Stack**
  - [x] Phone input (formatted)
  - [x] SMS code verification (auto-submit on 6 digits)
  - [x] PIN setup (confirm & verify)
- [x] **Chat Tabs**
  - [x] Chat list (conversations, unread count)
  - [x] Chat detail (message list, encrypted input)
  - [x] Contacts (search, online status)
  - [x] Groups (list, member count)
  - [x] Settings (device info, privacy, logout)

## Features in Progress

### 📝 Round 2 (Current)
- [ ] WebRTC peer connection (audio calls)
- [ ] Voice message recording
- [ ] Media preview (images, files)
- [ ] Contact verification UX (fingerprint display)

### 🔮 Round 3
- [ ] Video calling support
- [ ] Screen sharing
- [ ] File transfer (end-to-end encrypted)
- [ ] Group calling
- [ ] Message reactions & replies

### 🚀 Round 4 (Production)
- [ ] App Store submission (iOS)
- [ ] Google Play submission (Android)
- [ ] Beta testing feedback
- [ ] Security audit & hardening
- [ ] Offline message sync
- [ ] Call recording (encrypted)

## API Integration

### Backend Server
```
API_SERVER: http://localhost:3000        # HTTP endpoints
SOCKET_SERVER: http://localhost:3000    # WebSocket connection
```

### Key Endpoints

**Auth:**
```
POST /api/auth/register          # Send SMS code
POST /api/auth/verify            # Verify code + get JWT
POST /api/auth/refresh           # Refresh access token
POST /api/auth/complete          # Finalize PIN setup
```

**Contacts:**
```
GET  /api/contacts/search?phone=
POST /api/contacts/add
GET  /api/contacts/verify/:fingerprint
```

**Messages:**
```
GET  /api/messages/pending       # Offline queue
POST /api/messages/send          # (relay only)
DELETE /api/messages/:id
POST /api/messages/batch-delete
```

**Groups:**
```
POST   /api/groups/create
GET    /api/groups/list
GET    /api/groups/:id
POST   /api/groups/:id/add-member
DELETE /api/groups/:id
```

### Socket.io Events

**Connection:**
```typescript
socket.on('connect', () => {})
socket.on('disconnect', () => {})
socket.on('connection_ready', () => {})
```

**Messaging:**
```typescript
// Send
socket.emit('message:send', { toPhoneHash, encryptedBlob, nonce })

// Receive
socket.on('message:receive', (message) => {})

// Acknowledge
socket.emit('message:ack', { messageId, delivered: true })
```

**Presence:**
```typescript
socket.emit('presence:update', { status: 'online' })
socket.on('presence:update', (data) => {})
```

**WebRTC Signaling:**
```typescript
// Offer (initiate call)
socket.emit('signal:offer', { toPhoneHash, offer })

// Answer
socket.emit('signal:answer', { toPhoneHash, answer })

// ICE Candidate
socket.emit('signal:ice_candidate', { toPhoneHash, candidate })

// Receive signals
socket.on('signal:offer', (data) => {})
socket.on('signal:answer', (data) => {})
socket.on('signal:ice_candidate', (data) => {})
```

## Crypto Implementation

### Noise Protocol NN

1. **X3DH Key Exchange (first contact):**
   - Three DH computations: ephemeral + ephemeral, static + ephemeral, static + static
   - Combined into 96 bytes, HKDF-SHA256 derived to 32-byte session key

2. **Double Ratchet (ongoing):**
   - Symmetric ratchet: HMAC-SHA256 KDF chain
   - Chain keys advance with each message (provides forward secrecy)
   - Message keys derived per-message

3. **Message Encryption (ChaCha20Poly1305):**
   - 256-bit key from message key
   - 192-bit nonce (random, per message)
   - Authenticated encryption (AEAD)
   - Tamper detection on receive

4. **Identity Verification:**
   - SHA256(public_key)[0:20] → fingerprint (40-char hex)
   - User-facing: uppercase, no separators
   - Compare side-by-side or scan QR code

## Testing

### Run Tests
```bash
npm test
```

### Test Coverage
```bash
npm test -- --coverage
```

### Type Checking
```bash
npm run type-check
```

## Environment Variables

See `.env.example` for all available options. Key ones:

```env
REACT_APP_API_SERVER=http://localhost:3000
REACT_APP_SOCKET_SERVER=http://localhost:3000
REACT_APP_ENABLE_DEBUG=true
REACT_APP_STORAGE_ENCRYPTION_ENABLED=true
```

Load at runtime:
```typescript
import { config } from './src/utils/config';
console.log(config.apiServer);
```

## Debugging

### Console Logging
```typescript
import { debugLog } from './src/utils/debug';
debugLog('crypto', 'Key exchange complete');
```

### Redux DevTools
Install Redux DevTools browser extension for Zustand inspection.

### React Native Debugger
```bash
# Install
npm install -g react-native-debugger

# Launch app with debugging
npm start -- --localhost
```

## Deployment

### iOS (App Store)

1. **Prebuild native code:**
   ```bash
   npm run prebuild
   ```

2. **Build for App Store:**
   ```bash
   npm run build:ios
   ```

3. **Upload to App Store Connect**

### Android (Google Play)

1. **Prebuild native code:**
   ```bash
   npm run prebuild
   ```

2. **Build for Play Store:**
   ```bash
   npm run build:android
   ```

3. **Upload to Google Play Console**

## Troubleshooting

### Port 8081 already in use
```bash
lsof -i :8081
kill -9 <PID>
```

### Metro bundler issues
```bash
# Clear cache
expo start --clear

# Or reset with node_modules
rm -rf node_modules && npm install
```

### Crypto errors
- Ensure `tweetnacl` and `sodium-plus` are installed
- Check Node version (18+)
- Verify `.env` has correct API server

### Storage initialization fails
- Check Secure Store permissions (iOS/Android)
- Clear app data and reinstall
- Check device storage availability

## Security Considerations

1. **Device Key Storage:**
   - Private keys stored in Secure Store (TEE on Android, Keychain on iOS)
   - Never logged or transmitted

2. **Message Encryption:**
   - All messages encrypted before leaving device
   - Server cannot access plaintext
   - Forward secrecy ensures old messages safe if key compromised

3. **Network:**
   - TLS 1.3 for transport layer
   - Noise Protocol for application layer
   - Certificate pinning recommended for production

4. **Memory:**
   - Sensitive data cleared from memory after use
   - No plaintext persistence (except current conversation)

## Contributing

1. Branch from `master`
2. Follow TypeScript strict mode
3. Add tests for new features
4. Update types in `src/types/index.ts`
5. Submit PR with description

## License

MIT - See LICENSE file in project root
