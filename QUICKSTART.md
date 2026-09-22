# 🚀 Quickstart - Запуск Messenger Secure Backend

## Два варианта: выбери один

---

## Вариант 1: БД в Docker, Backend локально ✅ **Рекомендуется для dev**

Самый быстрый и удобный способ для разработки.

### Шаг 1: Запустить PostgreSQL и Redis

```bash
cd /home/claude/messenger-secure

# Запустить только БД сервисы
docker-compose -f docker-compose.dev.yml up -d postgres redis

# Проверить, что запустились
docker ps | grep messenger
```

✅ Вы должны увидеть:
- `messenger_postgres_dev`
- `messenger_redis_dev`

### Шаг 2: Запустить Backend локально

```bash
cd backend

# Установить зависимости
npm install

# Инициализировать БД (одноразово)
npx prisma db push

# Запустить dev сервер (с hot reload)
npm run dev
```

### Готово! 🎉

Backend будет доступен на:
- **API:** `http://localhost:3001`
- **Health check:** `curl http://localhost:3001/health`

---

## Вариант 2: Полный Docker (с контейнером Backend)

Если нужно всё в Docker.

### Одна команда:

```bash
cd /home/claude/messenger-secure

# Собрать и запустить всё
docker-compose -f docker-compose.dev.yml up --build

# Или в фоне:
docker-compose -f docker-compose.dev.yml up -d --build
```

### Инициализировать БД (первый запуск):

```bash
docker-compose -f docker-compose.dev.yml exec backend npx prisma db push
```

### Готово!

Backend будет доступен на:
- **API:** `http://localhost:3001`
- **Logs:** `docker-compose -f docker-compose.dev.yml logs -f backend`

---

## Остановить

```bash
# Вариант 1: только БД
docker-compose -f docker-compose.dev.yml down

# Вариант 2: включая volumes (удалит данные)
docker-compose -f docker-compose.dev.yml down -v
```

---

## Тестирование API

### Health check

```bash
curl http://localhost:3001/health
```

Ожидаемый ответ:
```json
{"status":"ok","timestamp":"2024-09-22T..."}
```

### Регистрация (SMS)

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone":"+79991234567"}'
```

### Полный гайд тестирования

Смотри [E2E_TESTING.md](./E2E_TESTING.md)

---

## Troubleshooting

### "Docker не запущен"
```bash
# macOS
open /Applications/Docker.app

# Linux
sudo systemctl start docker

# Windows
Open Docker Desktop
```

### "Port 3001 already in use"
```bash
# Найти процесс
lsof -i :3001

# Убить процесс
kill -9 <PID>
```

### "Database connection refused"
```bash
# Проверить PostgreSQL
docker-compose -f docker-compose.dev.yml logs postgres

# Пересоздать
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d postgres redis
```

### "node_modules не найден"
```bash
cd backend
npm install

# Или в Docker:
docker-compose -f docker-compose.dev.yml exec backend npm install
```

---

## Переменные окружения

Создай `backend/.env`:

```env
# База данных
DATABASE_URL="postgresql://messenger:devpassword@localhost:5432/messenger_dev"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="dev-secret-change-in-production"

# Port
PORT=3001
NODE_ENV=development

# Twilio (опционально для SMS)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# CORS
CORS_ORIGIN="http://localhost:3000,http://localhost:8081"

# Логирование
LOG_LEVEL=debug
```

---

## Что дальше?

1. ✅ Backend запущен
2. ⏭️ [Интегрировать мобиль](./MOBILE_DEVELOPMENT.md)
3. ⏭️ [Протестировать E2E](./E2E_TESTING.md)
4. ⏭️ [Развернуть на VPS](./SETUP.md)
