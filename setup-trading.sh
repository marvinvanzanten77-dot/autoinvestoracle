#!/bin/bash

# 🤖 AI TRADING AGENT — SETUP CHECKLIST
# 
# Run this before starting trading agent tests:
# bash setup-trading.sh

echo "🚀 AI Trading Agent Setup Checklist"
echo "===================================="
echo ""

# Check 1: Environment variables
echo "1️⃣ Checking environment variables..."
if [ -z "$OPENAI_API_KEY" ]; then
  echo "   ❌ OPENAI_API_KEY not set"
  echo "   Run: export OPENAI_API_KEY=sk_test_..."
else
  echo "   ✅ OPENAI_API_KEY is set"
fi

if [ -z "$BITVAVO_API_KEY" ]; then
  echo "   ⚠️  BITVAVO_API_KEY not set (needed for live trading)"
else
  echo "   ✅ BITVAVO_API_KEY is set"
fi

if [ -z "$BITVAVO_API_SECRET" ]; then
  echo "   ⚠️  BITVAVO_API_SECRET not set (needed for live trading)"
else
  echo "   ✅ BITVAVO_API_SECRET is set"
fi

echo ""

# Check 2: Dependencies
echo "2️⃣ Checking npm dependencies..."
if [ -f "package.json" ]; then
  echo "   ✅ package.json found"
  if [ -d "node_modules" ]; then
    echo "   ✅ node_modules exists"
  else
    echo "   ⚠️  Running npm install..."
    npm install
  fi
else
  echo "   ❌ package.json not found"
  exit 1
fi

echo ""

# Check 3: Database
echo "3️⃣ Checking Supabase setup..."
if grep -q "SUPABASE_URL" .env.local 2>/dev/null; then
  echo "   ✅ SUPABASE_URL configured"
else
  echo "   ⚠️  SUPABASE_URL not found in .env.local"
  echo "   You'll need to run the trading schema manually:"
  echo "   src/sql/trading_schema.sql"
fi

echo ""

# Check 4: Files
echo "4️⃣ Checking new files..."
files=(
  "server/ai/tradingAgent.ts"
  "server/ai/tradingAgent.test.ts"
  "src/server/handlers/trading.ts"
  "src/api/trading.ts"
  "src/sql/trading_schema.sql"
  "TRADING_AGENT_GUIDE.md"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "   ✅ $file"
  else
    echo "   ❌ $file NOT FOUND"
  fi
done

echo ""

# Check 5: Build
echo "5️⃣ Checking TypeScript compilation..."
if npx tsc --noEmit 2>/dev/null; then
  echo "   ✅ TypeScript compiles without errors"
else
  echo "   ⚠️  TypeScript has errors. Run: npx tsc --noEmit"
fi

echo ""

# Check 6: Server
echo "6️⃣ Ready to start server?"
echo "   Run: npm run dev:server"
echo "   Then in another terminal: npm run dev"
echo ""

# Check 7: Testing
echo "7️⃣ Ready to test?"
echo "   Run: npx ts-node server/ai/tradingAgent.test.ts"
echo ""

echo "✅ Setup checklist complete!"
echo ""
echo "📖 Next steps:"
echo "1. Set environment variables (OPENAI_API_KEY)"
echo "2. Create Bitvavo test account (if needed)"
echo "3. Run: npm run dev:server"
echo "4. Test in another terminal:"
echo "   curl -X POST http://localhost:4000/api/trading/analyze"
echo ""
