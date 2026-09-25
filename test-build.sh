#!/bin/bash

echo "🧪 Messenger Secure - Build & Type Check"
echo "=========================================="

set -e

cd backend

echo "📦 Installing dependencies..."
npm install > /dev/null 2>&1

echo "🔨 Compiling TypeScript..."
npm run build

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ TypeScript compilation successful!"
  echo ""
  echo "📋 Checking file structure..."
  
  files=(
    "src/index.ts"
    "src/crypto/noise.ts"
    "src/middleware/errors.ts"
    "src/middleware/logger.ts"
    "src/routes/auth.ts"
    "src/routes/contacts.ts"
    "src/routes/messages.ts"
    "src/routes/groups.ts"
    "src/socket/handlers.ts"
    "src/utils/validation.ts"
    "src/utils/constants.ts"
    "src/db.ts"
  )
  
  for file in "${files[@]}"; do
    if [ -f "$file" ]; then
      echo "  ✓ $file"
    else
      echo "  ✗ $file (MISSING)"
    fi
  done
  
  echo ""
  echo "📊 Project Statistics:"
  echo "  - Total files: $(find src -type f -name '*.ts' | wc -l)"
  echo "  - Total lines: $(find src -type f -name '*.ts' -exec wc -l {} + | tail -1 | awk '{print $1}')"
  
  echo ""
  echo "✨ Ready for local testing!"
  echo ""
  echo "Next steps:"
  echo "  1. Start PostgreSQL and Redis"
  echo "  2. Run: npm run dev"
  echo "  3. Test: curl http://localhost:3001/health"
  echo ""
else
  echo "❌ Compilation failed!"
  exit 1
fi
