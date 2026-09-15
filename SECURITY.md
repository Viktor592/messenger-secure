# Security & Cryptography

Полная документация по безопасности, криптографии и защите от угроз.

## 🔐 Cryptographic Primitives

### Core Algorithms

| Algorithm | Purpose | Implementation | Key Size |
|-----------|---------|-----------------|----------|
| **X25519** | Key Exchange | libsodium | 256-bit |
| **Noise_NN** | Protocol Framework | Custom | - |
| **ChaCha20Poly1305** | AEAD Encryption | libsodium | 256-bit (key), 96-bit (nonce) |
| **BLAKE2b** | Hashing | libsodium | 256-bit output |
| **HMAC-SHA256** | Verification | libsodium | 256-bit |

### Why Noise Instead of Signal Protocol?

| Aspect | Signal Protocol | Noise Protocol |
|--------|-----------------|-----------------|
| **Complexity** | High (X3DH + Double Ratchet) | Medium (simpler handshake) |
| **Forward Secrecy** | Perfect (with ratcheting) | Perfect (with Double Ratchet) |
| **Implementation** | Complex, many dependencies | Modular, minimal deps |
| **Auditability** | Large codebase | Smaller, simpler |
| **Performance** | Good | Excellent |
| **Industry Use** | WhatsApp, Signal | WireGuard, Briar |

**Decision**: Noise NN with Double Ratchet gives us 99% of Signal's security with 50% of complexity.

## 🤝 Key Exchange (X3DH-like)

### Alice's Keys

```
Identity Key (IK_a)
  ├─ Long-term key (never changes)
  ├─ Curve25519 private/public
  └─ Used to verify Alice's identity

Ephemeral Key (EK_a)
  ├─ One-time key (changes per session)
  ├─ Generated fresh for initial contact
  └─ Used only for first message

Prekeys (PK_a)
  ├─ 100 keys uploaded to server
  ├─ Used by Bob to initiate (no prior contact)
  └─ Signed by Identity Key for verification
```

### Handshake (Initial Message)

```
Alice → Server:
  1. Sends IK_a (identity key)
  2. Generates 100 Prekeys
  3. Uploads (Prekeys + IK_signature)

Bob ← Server (wants to message Alice):
  1. Requests one of Alice's Prekeys
  2. Server returns: { prekey, signature, IK_a }
  3. Bob verifies signature with IK_a

Bob → Alice (Initial Message):
  DH1 = ECDH(IK_b, EK_a)        # Bob identity ← → Alice ephemeral
  DH2 = ECDH(EK_b, IK_a)        # Bob ephemeral ← → Alice identity
  DH3 = ECDH(EK_b, EK_a)        # Bob ephemeral ← → Alice ephemeral
  DH4 = ECDH(IK_b, PK_a)        # Bob identity ← → Alice prekey

  Shared_Secret = KDF(DH1 || DH2 || DH3 || DH4)
  
  ├─ First root_key = KDF(Shared_Secret, "root")
  ├─ First send_chain_key = KDF(Shared_Secret, "chain")
  └─ Encryption_key = HKDF(chain_key)

First message encrypted with Encryption_key
  └─ Only Alice can decrypt (knows her prekey)

Alice receives, decrypts:
  ├─ Recovers Shared_Secret (same DH4 with her PK_a)
  ├─ Derives first receive_chain_key
  └─ Decrypts message + continues conversation
```

## 📨 Message Encryption (Double Ratchet)

### Sending Flow

```
Alice sends message to Bob:

1. Current Chain Key: chain_key = HKDF(root_key, 32 bytes)
2. Message Key: msg_key = HKDF(chain_key, 32 bytes)
3. Nonce: nonce = message_counter (strictly increasing)

4. AEAD Encryption:
   ciphertext = ChaCha20Poly1305::encrypt(
     key: msg_key,
     nonce: nonce,
     plaintext: message,
     ad: sender_id || recipient_id || msg_num
   )

5. Ratchet Forward:
   new_chain_key = HKDF(chain_key, 32 bytes)
   root_key_new = HKDF(root_key, 32 bytes)  # Every 100 messages

6. Generate New Ephemeral:
   new_ephemeral_key = X25519::generate()
   new_root_key = ECDH(new_ephemeral, bob_ephemeral)

7. Wrap in Protocol Message:
   {
     "type": "message",
     "sender_id": alice_id,
     "dh_public": alice_ephemeral.public,
     "chain_num": current_chain_number,
     "msg_num": message_counter,
     "ciphertext": base64(ciphertext),
     "auth_tag": base64(poly1305_tag)
   }

8. Server Relay (if Bob offline):
   - Server stores encrypted blob
   - Stores: (to_phone_hash, from_phone_hash, blob, ttl=7d)
   - Does NOT decrypt, does NOT log content
```

### Receiving Flow

```
Bob receives message:

1. Extract DH Public (alice_ephemeral)
2. Perform DH Ratchet:
   shared_secret = ECDH(bob_ephemeral_private, alice_ephemeral)
   
3. Update Root Key:
   new_root_key = HKDF(root_key, shared_secret)
   
4. Advance Chain Key:
   for i in range(msg_num - current_msg_num):
     chain_key = HKDF(chain_key)
   
5. Derive Message Key:
   msg_key = HKDF(chain_key)
   
6. Verify & Decrypt:
   plaintext = ChaCha20Poly1305::decrypt(
     key: msg_key,
     nonce: msg_num,
     ciphertext: ciphertext,
     ad: sender_id || recipient_id || msg_num,
     auth_tag: auth_tag
   )
   
   ├─ If auth_tag fails → ABORT (tampering detected)
   └─ If success → Plaintext ✓
   
7. Update Ephemeral:
   bob_ephemeral = alice_ephemeral (for next message from Alice)
   
8. Ratchet Bob's Send Chain (for reply):
   bob_new_ephemeral = X25519::generate()
   bob_root_key = ECDH(bob_new_ephemeral, alice_ephemeral)

✓ Perfect Forward Secrecy: Old messages can't be decrypted 
  even if long-term keys compromised
```

## 🛡 Security Properties

### Passive Attacker (Eavesdropping)

```
Threat: Attacker intercepts network traffic
Mitigation:
  ├─ TLS 1.3: All client↔server communication encrypted
  ├─ Noise E2E: End-to-end encryption (even server can't read)
  ├─ Perfect Forward Secrecy: Old messages safe even if keys stolen
  └─ Authentication: AEAD prevents tampering

Result: ✓ Confidentiality guaranteed
```

### Active Attacker (MITM)

```
Threat: Attacker intercepts and modifies messages
Mitigation:
  ├─ Poly1305 Authentication Tag: Detects tampering
  ├─ Key Fingerprints: Users verify each other's identity
  ├─ Proof of Work: SMS verification prevents fake accounts
  └─ Signature Verification: Prekeys signed with Identity Key

Result: ✓ Integrity guaranteed
```

### Key Compromise

```
Scenario 1: Long-term Identity Key stolen
Threat: Attacker can impersonate user in future
Mitigation:
  ├─ Device compromise detection: key change alert
  ├─ Multiple devices: other devices unaffected
  └─ Manual key rotation available

Result: ⚠ Partial (need key rotation mechanism)

Scenario 2: Session Key stolen (ephemeral)
Threat: Attacker can read current session
Mitigation:
  ├─ Double Ratchet: Key changes every message
  ├─ Forward Secrecy: Can't read past messages
  └─ Receive Ratchet: Can't read future messages

Result: ✓ Only current message readable (limited damage)
```

### Server Compromise

```
Threat: Attacker gains access to server
Attacker can see:
  ├─ Phone number → Public Key mapping
  ├─ Group metadata (names, member list - encrypted)
  ├─ Encrypted message blobs (can't decrypt)
  ├─ Presence status (online/offline)
  └─ Timestamps (not meaningful without content)

Attacker CANNOT see:
  ├─ Message content (Noise E2E encrypted)
  ├─ File contents (encrypted before upload)
  ├─ Voice/video (WebRTC encrypted)
  ├─ Contact list (stored only on device)
  └─ Long-term keys (never sent to server)

Result: ✓ Content safe, metadata leaks only

Mitigation:
  ├─ Regular backups
  ├─ Monitoring/alerting
  ├─ Encrypted database backups
  ├─ Regular security audits
  └─ Open-source code (anyone can audit)
```

### Network Monitoring (ISP/Government)

```
What they can see:
  ├─ You connected to messenger.example.com
  ├─ Traffic volume (how much data)
  ├─ Frequency of messages (timing correlation)
  ├─ IP addresses of communication parties
  └─ DNS queries

What they CANNOT see:
  ├─ Message content (E2E encrypted)
  ├─ Who you're talking to (if using Tor/VPN)
  ├─ File contents
  └─ Metadata (if properly stripped)

Mitigation (User's responsibility):
  ├─ Use VPN/Tor for IP anonymity
  ├─ Avoid patterns (don't message at predictable times)
  └─ Disable traffic analysis
```

## 📱 Mobile Security

### Key Storage

```
iOS:
  ├─ Identity Keys: Stored in Secure Enclave
  │  └─ Encrypted, hardware-backed, can't export
  ├─ Session Keys: Stored in Keychain
  │  └─ Protected with device passcode
  └─ Database: Encrypted with SQLCipher (AES-256)

Android:
  ├─ Identity Keys: Stored in AndroidKeyStore
  │  └─ Hardware-backed if available, SW fallback
  ├─ Session Keys: Stored in EncryptedSharedPreferences
  │  └─ AES-256 by default
  └─ Database: Encrypted with SQLCipher (AES-256)
```

### Threat Model

```
Local Attacker (physical device access):
  ├─ If device unlocked: Can access all data
  │  └─ Mitigation: Use strong passcode + biometric
  ├─ If device locked: Secure Enclave/Keystore protects keys
  └─ Without passcode: Forensic extraction possible
     └─ Mitigation: Factory reset or key rotation

Remote Attacker (compromised app):
  ├─ Can access decrypted data in memory
  ├─ Can intercept new messages
  └─ Mitigation: Code review + reproducible builds

Malicious OS:
  ├─ Can theoretically intercept anything
  └─ Mitigation: Keep OS updated + careful app permissions
```

## 🔑 Key Management

### Lifecycle

```
1. Generation
   ├─ On-device only
   ├─ Using OS's secure random
   └─ Keys never leave device at creation

2. Upload (Public Keys Only)
   ├─ Identity Public Key → Server (on registration)
   ├─ Prekeys → Server (100 at a time)
   ├─ Signed with Identity Private Key
   └─ Verification by recipients

3. Storage
   ├─ Private Keys: Never leave device
   ├─ Session Keys: Encrypted local storage
   └─ Backups: Optional encrypted cloud backup (user choice)

4. Usage
   ├─ Ephemeral keys: Generated per-session, deleted after use
   ├─ Chain keys: Ratcheted forward every message
   └─ Message keys: Used once, discarded

5. Rotation
   ├─ Automatic: Ephemeral keys (every message)
   ├─ Periodic: Session keys (every 100 messages)
   ├─ Manual: Identity keys (user-initiated)
   └─ Revocation: Lost device (mark old keys untrusted)

6. Deletion
   ├─ Explicit: User deletes contact
   ├─ Automatic: Archived after 30 days inactivity
   └─ Secure Erase: Use TRIM command (SSDs)
```

## ✅ Verification

### Fingerprint Verification

```
User A wants to verify User B:

1. Both users see 256-bit fingerprints:
   FP_B = BLAKE2b(identity_public_key_b, 32 bytes)
   Display as: 4FD7-8E2A-91C3-45B6-...
   
2. Verify through trusted channel:
   ├─ In-person meeting
   ├─ Phone call
   ├─ Video call
   └─ Other messaging app
   
3. If match: Mark as "Trusted"
   ├─ Future messages have ✓ badge
   ├─ Warning if key changes
   └─ Require re-verification for new device

4. If mismatch: Possible MITM!
   ├─ DO NOT continue conversation
   ├─ Contact user through other channel
   └─ Investigate compromise
```

### Cryptographic Commitment

```
Alice sends first message:

1. Generate ephemeral key: ek_a
2. Compute commitment: H(ek_a) = BLAKE2b(ek_a)
3. Send in plaintext (commitment)

4. Send in ciphertext (ephemeral key)
   └─ Only after verifying receipt

5. Bob verifies:
   ├─ Decrypts ciphertext → ek_a'
   ├─ Computes H(ek_a')
   └─ Compares with commitment
   
Result: Commitment binding ensures key can't be changed
```

## 🔒 Protocol Security Analysis

### Known Security Properties

✅ **Confidentiality**: E2E encryption ensures only intended recipient reads message
✅ **Integrity**: AEAD authentication prevents tampering
✅ **Authentication**: Key fingerprints + signatures verify identity
✅ **Perfect Forward Secrecy**: Old messages safe if session keys compromised
✅ **Break-in Recovery**: Future messages safe after key rotation
✅ **Replay Protection**: Monotonically increasing message counter
✅ **Reordering Detection**: Nonce mismatch fails decryption

### Potential Weaknesses

⚠️ **Prekey Exhaustion**: If Alice never comes online, Bob's prekeys might run out
   └─ Mitigation: Server never releases more than 1 prekey per contact

⚠️ **Untrusted Certificate**: TLS MITM possible if cert compromised
   └─ Mitigation: Certificate pinning + HPKP headers

⚠️ **Group Message Ordering**: No total order guarantee across all devices
   └─ Mitigation: Server timestamp (clock-based, not canonical)

⚠️ **Metadata Leakage**: Server knows group membership + structure
   └─ Mitigation: Group metadata minimal (name + member count only)

### Out of Scope

🚫 **Quantum Resistance**: Uses only classical crypto (Curve25519)
   └─ Upgrade path: Post-quantum key encapsulation available

🚫 **Deniability**: Perfect message deniability not guaranteed
   └─ Design decision: Sacrifice deniability for authentication

🚫 **Anonymity**: Communication patterns visible to network observer
   └─ Mitigation: Use Tor/VPN for IP anonymity (user's choice)

## 📊 Threat Model Summary

| Threat | Likelihood | Impact | Mitigation |
|--------|------------|--------|-----------|
| **Eavesdropping** | High | Critical | E2E + TLS encryption |
| **MITM** | Medium | Critical | Key verification + signatures |
| **Server Compromise** | Low | High | No message content stored |
| **Device Theft** | Medium | High | Device encryption + biometric |
| **Account Takeover** | Medium | High | SMS verification + 2FA |
| **Denial of Service** | High | Medium | Rate limiting + backups |
| **Social Engineering** | High | Medium | Education + key verification |
| **Quantum Attack** | Very Low | Critical | Future upgrade available |

## 🔧 Implementation Checklist

- [ ] Use libsodium for all crypto (no custom crypto!)
- [ ] Constant-time comparison for secrets
- [ ] Secure random from OS (not Math.random())
- [ ] Hash all passwords (Argon2id)
- [ ] Rate limiting on auth endpoints
- [ ] HTTPS/TLS only (no HTTP)
- [ ] Certificate pinning on mobile apps
- [ ] Regular security audits
- [ ] Dependency scanning for vulnerabilities
- [ ] Keep dependencies up-to-date
- [ ] Secure error messages (no internal details)
- [ ] Logging without sensitive data
- [ ] Backup encryption separate from app
- [ ] Account recovery mechanism
- [ ] Device registration tracking

## 📚 References

- [Signal Protocol Specification](https://signal.org/docs/specifications/doubleratchet/)
- [Noise Protocol Framework](https://noiseprotocol.org/)
- [libsodium Documentation](https://doc.libsodium.org/)
- [OWASP Mobile Security](https://owasp.org/www-project-mobile-security/)
- [NIST Cryptographic Standards](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/)

---

**Last Updated**: 2024
**Review Status**: Ready for implementation
**Audit Status**: Awaiting independent review
