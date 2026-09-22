#!/bin/bash

set -e

echo "🚀 Messenger Secure - Dev Setup"
echo "================================"

# Navigate to project root
cd "$(dirname "$0")/.."

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
  echo "❌ Docker не запущен. Запустите Docker и попробуйте снова."
  exit 1
fi

echo "📦 Запуск PostgreSQL и Redis..."
docker-compose -f docker-compose.dev.yml up -d postgres redis

echo "⏳ Ожидание инициализации БД..."
sleep 5

echo "🔧 Инициализация Prisma..."
cd backend
npm install > /dev/null 2>&1

# Create .env if not exists
if [ ! -f .env ]; then
  echo "📝 Создание .env файла..."
  cat > .env << 'EOF'
DATABASE_URL="postgresql://messenger:devpassword@localhost:5432/messenger_dev"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="dev-secret-change-in-production"
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
CORS_ORIGIN="http://localhost:3000,http://localhost:8081"
LOG_LEVEL=debug
PORT=3001
NODE_ENV=development
EOF
fi

# Initialize database
echo "💾 Инициализация БД..."
npx prisma db push --skip-generate

echo ""
echo "✅ Dev окружение готово!"
echo ""
echo "📝 Следующие шаги:"
echo "  1. cd backend"
echo "  2. npm run dev"
echo ""
echo "🌐 Backend будет доступен на http://localhost:3001"
echo "📊 PostgreSQL на localhost:5432"
echo "🔴 Redis на localhost:6379"
echo "📊 PgAdmin на http://localhost:5050 (admin@example.com / admin)"
