# Messenger Secure — Zero-Knowledge Hybrid P2P Messenger

Приватный мессенджер для Android, iOS и Web с **гибридной архитектурой P2P + relay**, **Noise Protocol E2E шифрованием** и **абсолютным нулевым сбором данных**.

## 🎯 Цель

Создать **неблокируемый, независимый мессенджер** для простых людей, где:
- ✅ Сервер **не видит** ваши сообщения (полное E2E)
- ✅ Никакие данные **не логируются** и **не сохраняются**
- ✅ Сообщения **удаляются с сервера** через 7 дней (если офлайн юзер их не скачал)
- ✅ **P2P** когда оба онлайн (сервер в стороне)
- ✅ **Relay** только если кто-то офлайн
- ✅ Работает **при блокировке** (нет зависимости от домена)

## 🏗 Архитектура

```
┌─────────────────┐           P2P (WebRTC)          ┌─────────────────┐
│  iOS App        ├──────────────────────────────────►  Android App    │
│  (Noise E2E)    │                                  │  (Noise E2E)    │
└────────┬────────┘                                  └─────┬──────────┘
         │                                                  │
         └──────────────────┬───────────────────────────────┘
                            │
                    Relay Server (если офлайн)
                    ├─ SMS верификация
                    ├─ Encrypted message queue (TTL 7d)
                    ├─ P2P signaling
                    ├─ TURN server config
                    └─ Zero logs, zero data
                            │
                    ┌────────┴────────┐
                    │   PostgreSQL    │ (only encrypted blobs)
                    │   Redis         │ (presence only)
                    └─────────────────┘
```

## 📦 Технологии

### Backend (Relay Server)
- **Node.js 20** + TypeScript + Express + Socket.io
- **PostgreSQL** (encrypted data only)
- **Redis** (presence tracking, no persistence)
- **libsodium** (Noise Protocol implementation)
- **Twilio** (SMS verification)

### Mobile
- **React Native** (Expo)
- **TypeScript**
- **SQLite** (local encrypted storage)
- **WebRTC** (P2P video/audio)

### Web
- **React 18** + TypeScript
- **TailwindCSS**
- **Socket.io Client**
- **Electron** (desktop wrapper)

## 🚀 Быстрый старт

### Требования
- Node.js 20+
- Docker + Docker Compose
- PostgreSQL 16
- Redis 7
- Twilio API key (для SMS)

### Локальная разработка

```bash
# 1. Клонировать
git clone https://github.com/viktor592/messenger-secure.git
cd messenger-secure

# 2. Setup backend
cd backend
npm install
cp .env.example .env
# Отредактируйте .env (Twilio ключи, БД)

# 3. Setup DB
npx prisma migrate dev --name init

# 4. Запустить relay server
npm run dev

# Сервер будет на http://localhost:3001
```

### Production Deployment

```bash
# На Hetzner VPS
curl https://setup.messenger-secure.local/deploy.sh | bash

# Или вручную:
docker-compose -f docker-compose.prod.yml up -d
```

## 🔐 Криптография

### Noise Protocol
- **Double Ratchet** для Perfect Forward Secrecy
- **DH25519** (Curve25519) для key exchange
- **ChaCha20Poly1305** для симметричного шифрования
- **BLAKE2** для хеширования

### Layers
1. **Transport**: TLS 1.3 (client ↔ server)
2. **E2E**: Noise Protocol (client ↔ client)
3. **Storage**: AES-256-GCM (local on device)

### Ключи
- **Identity Key**: долгосрочный ключ (не меняется)
- **Prekeys**: для первого контакта (100 штук)
- **Session Key**: для каждого чата (обновляется через Double Ratchet)

## 🛡 Безопасность

### Zero Knowledge Policy
- **Нет логов**: IP адреса, user-agent, времени не логируются
- **Нет метаданных**: Даже временные метки удаляются
- **Auto-delete**: Зашифрованные сообщения удаляются через 7 дней
- **Encrypted at rest**: БД содержит только шифрованные блобы

### SMS Верификация
- **Rate limiting**: 5 попыток в час
- **Code expiry**: 10 минут
- **Phone hash**: Номер хешируется, оригинал не хранится

### P2P Safety
- **WebRTC encryption**: Весь видео/аудио шифруется
- **Key pinning**: Верификация по fingerprints
- **No NAT traversal metadata**: TURN использует только для connectivity

## 📋 Функции

### v1.0 (MVP)
- [x] 1-на-1 текстовые сообщения
- [x] Видеозвонки (WebRTC P2P)
- [x] Голосовые сообщения
- [x] Контакты + поиск
- [x] Группы (до 100 человек)
- [x] E2E шифрование
- [x] Offline message queue

### v1.1
- [ ] Видеосообщения (кружочки)
- [ ] Forward messages
- [ ] Pin messages
- [ ] Message reactions
- [ ] Dark mode

### v2.0
- [ ] Bot API
- [ ] Channels (broadcast)
- [ ] Message search
- [ ] Voice channels

## 📚 Документация

- [ARCHITECTURE.md](./ARCHITECTURE.md) — детальная архитектура
- [SECURITY.md](./SECURITY.md) — криптография + угрозы
- [API.md](./API.md) — Socket.io events + HTTP endpoints
- [SETUP.md](./SETUP.md) — deployment инструкция
- [CONTRIBUTING.md](./CONTRIBUTING.md) — как контрибьютить

## 🔧 Структура репо

```
messenger-secure/
├── backend/              # Relay сервер
│   ├── src/
│   │   ├── index.ts
│   │   ├── crypto/      # Noise Protocol
│   │   ├── routes/      # HTTP endpoints
│   │   ├── socket/      # WebSocket handlers
│   │   └── db/          # Prisma models
│   ├── Dockerfile
│   └── package.json
├── mobile/              # React Native (Expo)
│   ├── src/
│   ├── app.json
│   └── package.json
├── web/                 # React web app
│   ├── src/
│   └── package.json
├── docker-compose.prod.yml
├── docker-compose.dev.yml
└── docs/
```

## 🌟 Особенности

- **Гибридная архитектура**: P2P когда возможно, relay как fallback
- **Абсолютная приватность**: Ноль данных о пользователях
- **Простота использования**: SMS верификация как Telegram
- **Масштабируемость**: От 10 юзеров до миллионов
- **Отсутствие блокировок**: Сервер можно запустить где угодно
- **Open Source**: Полная прозрачность кода

## 📄 Лицензия

MIT — используйте и модифицируйте как хотите.

## 🤝 Контрибьютинг

Смотрите [CONTRIBUTING.md](./CONTRIBUTING.md)

---

**Status**: 🚀 Active Development (Round 1 in progress)
**Latest**: v0.1.0-alpha
