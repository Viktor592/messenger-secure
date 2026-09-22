# E2E Integration Testing Guide

## Запуск Backend Локально

### 1. Подготовка окружения

```bash
cd /home/claude/messenger-secure/backend

# Создать .env файл
cat > .env << 'EOF'
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/messenger_secure"

# Redis
REDIS_URL="redis://localhost:6379"

# API
PORT=3001
NODE_ENV=development
LOG_LEVEL=info

# Twilio (для SMS верификации)
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:19006,http://127.0.0.1:8081

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF

npm install
```

### 2. Запуск PostgreSQL и Redis

```bash
# Вариант 1: Docker Compose
docker-compose -f docker-compose.dev.yml up -d postgres redis

# Вариант 2: Локально (если установлены)
# Убедитесь, что PostgreSQL и Redis запущены
postgres -D /usr/local/var/postgres &
redis-server &
```

### 3. Инициализация БД

```bash
# Применить миграции Prisma
npx prisma migrate deploy

# Или создать БД с нуля
npx prisma db push
```

### 4. Запуск Backend сервера

```bash
npm run dev
# или
npm start
```

Сервер будет доступен на `http://localhost:3001`

---

## API Endpoints - Quick Test

### 1. Health Check

```bash
curl http://localhost:3001/health
```

Ожидаемый ответ:
```json
{
  "status": "ok",
  "timestamp": "2024-09-22T12:00:00.000Z"
}
```

### 2. SMS Регистрация

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+79991234567"
  }'
```

Ожидаемый ответ:
```json
{
  "data": {
    "phoneHash": "abc123...",
    "sessionToken": "xyz789...",
    "expiresAt": "2024-09-22T12:10:00.000Z"
  }
}
```

### 3. Верификация кода

```bash
curl -X POST http://localhost:3001/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "phoneHash": "abc123...",
    "sessionToken": "xyz789...",
    "code": "123456"
  }'
```

Ожидаемый ответ:
```json
{
  "data": {
    "user": {
      "phoneHash": "abc123...",
      "displayName": "User",
      "publicKey": "...",
      "identityKeyFingerprint": "..."
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "expiresAt": "2024-09-22T13:00:00.000Z"
  }
}
```

### 4. Поиск контакта

```bash
curl -X GET "http://localhost:3001/api/contacts/search?phone=%2B79991234567" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 5. Получить офлайн сообщения

```bash
curl -X GET http://localhost:3001/api/messages/pending \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## E2E Test Scenario

### Тестовый сценарий: Два клиента обмениваются зашифрованными сообщениями

#### Клиент 1: Alice

```bash
# 1. Регистрация
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone": "+79991111111"}'

# Сохранить: phoneHash_alice, sessionToken_alice

# 2. Верификация кода
curl -X POST http://localhost:3001/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "phoneHash": "phoneHash_alice",
    "sessionToken": "sessionToken_alice",
    "code": "000000"
  }'

# Сохранить: accessToken_alice
```

#### Клиент 2: Bob

```bash
# Аналогично регистрация + верификация
# Номер: +79992222222
# Сохранить: accessToken_bob
```

#### Alice отправляет сообщение Bob'у (Bob офлайн)

```bash
# Alice ищет Bob
curl -X GET "http://localhost:3001/api/contacts/search?phone=%2B79992222222" \
  -H "Authorization: Bearer accessToken_alice"

# Сохранить: bob_publicKey, bob_fingerprint

# Alice зашифровывает сообщение и отправляет через relay
curl -X POST http://localhost:3001/api/messages/relay \
  -H "Authorization: Bearer accessToken_alice" \
  -H "Content-Type: application/json" \
  -d '{
    "toPhoneHash": "phoneHash_bob",
    "encryptedBlob": "BASE64_ENCRYPTED_MESSAGE"
  }'
```

#### Bob получает сообщение (подключился онлайн)

```bash
# Bob получает список офлайн сообщений
curl -X GET http://localhost:3001/api/messages/pending \
  -H "Authorization: Bearer accessToken_bob"

# Ответ содержит зашифрованное сообщение от Alice
# Bob расшифровывает локально и удаляет с сервера
curl -X DELETE http://localhost:3001/api/messages/MESSAGE_ID \
  -H "Authorization: Bearer accessToken_bob"
```

---

## Socket.io Events (WebSocket P2P)

Когда оба клиента онлайн, они используют WebRTC через Socket.io для прямого соединения.

### Подключиться к Socket.io

```javascript
const socket = io('http://localhost:3001', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
});

socket.on('connection_ready', (data) => {
  console.log('Connected:', data);
});

// Отправить WebRTC сигнал
socket.emit('signal:offer', {
  targetPhoneHash: 'bob_phone_hash',
  sdp: 'WEBRTC_SDP_OFFER'
});

// Получить ответ
socket.on('signal:answer', (data) => {
  console.log('WebRTC Answer:', data);
});
```

---

## Troubleshooting

### 1. `Connection refused: ECONNREFUSED`

- Убедитесь, что backend запущен на порту 3001
- Проверьте `http://localhost:3001/health`

### 2. `Unauthorized: JWT invalid`

- Используйте корректный access token
- Проверьте, что JWT_SECRET в .env совпадает

### 3. `Database connection failed`

- Убедитесь, что PostgreSQL запущен
- Проверьте DATABASE_URL в .env
- Запустите `npx prisma db push`

### 4. `SMS code verification fails`

- В development режиме, используйте код `000000`
- Или настройте Twilio credentials в .env

---

## Mock Testing (без Twilio)

Для локального тестирования без SMS:

```bash
# В auth.ts, измените verification на:
if (code === '000000' || process.env.NODE_ENV === 'development') {
  // Allow verification
}
```

---

## Next Steps: Интегрировать с Mobile App

1. Обновить `REACT_NATIVE_API_URL` в mobile/.env на `http://YOUR_IP:3001`
2. Запустить мобиль-приложение
3. Протестировать E2E отправку и получение сообщений
