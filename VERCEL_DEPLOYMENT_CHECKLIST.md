# VERCEL DEPLOYMENT CHECKLIST

## ✅ Automatisch Correct (No Action Needed)

### 1. Node.js Runtime
- ✅ Vercel uses Node.js 18+ by default
- ✅ Native `fetch()` API available
- ✅ `crypto` module available
- ✅ No polyfills needed

### 2. Vercel Configuration
- ✅ `vercel.json` correctly configured
- ✅ API routes rewrites working
- ✅ SPA routing to index.html

### 3. Code Compatibility
- ✅ BitvavoPriceCache inline (no imports needed)
- ✅ BitvavoPriceFallback inline (no imports needed)
- ✅ Public `/ticker` endpoint (no auth headers)
- ✅ Fallback to `/markets` if needed

### 4. Environment Variables
- ✅ SUPABASE_URL (existing)
- ✅ SUPABASE_ANON_KEY (existing)
- ✅ ENCRYPTION_KEY (existing)
- ✅ OPENAI_API_KEY (existing)

**Note:** Bitvavo API credentials are stored in Supabase, fetched at runtime.

---

## ⚠️ Optional Enhancements

### If Prices Still Show €0:

1. **Check Vercel Logs**
   ```bash
   vercel logs
   ```
   Look for:
   - `[Bitvavo] Fetching prices via REST API`
   - `[Bitvavo] /ticker returned`
   - `[Bitvavo] REST fallback updated`

2. **Check Function Timeout**
   - Default: 60 seconds (Pro) / 10 seconds (Hobby)
   - Fetch should complete in <2 seconds
   - If needed, increase in `vercel.json`:
   ```json
   {
     "functions": {
       "api/index.ts": {
         "maxDuration": 60
       }
     }
   }
   ```

3. **Check Network**
   - Vercel can access `https://api.bitvavo.com`?
   - No firewall blocking?
   - Bitvavo API returning 200 OK?

4. **Monitor Bitvavo API**
   - Check if `/ticker` endpoint is rate-limited
   - 30-second poll interval should be fine
   - Rate limit: 600 req/min (1 req/100ms)

---

## 🚀 Deployment Status

**Current:** ✅ READY TO DEPLOY

```
git push → Vercel auto-deploys
                ↓
api/index.ts bundled (includes price cache)
                ↓
Price cache initialized
                ↓
WebSocket optional (async)
REST fallback ready (sync)
                ↓
fetchBalances() called
                ↓
Prices: €55.700+ ✅
```

---

## 📋 What If Prices Still Don't Show?

**Step 1: Check Vercel Logs**
```bash
vercel logs --follow
```

**Step 2: Verify Bitvavo Connection**
- Can reach `https://api.bitvavo.com/v2/ticker`?
- Returns valid JSON?
- Has `last` price field?

**Step 3: Check Local**
```bash
npm run dev:server
# Visit http://localhost:3000/api/exchanges/balances
```

**Step 4: Deploy Minimal Test**
Add to `api/index.ts`:
```typescript
export default async (req, res) => {
  try {
    const resp = await fetch('https://api.bitvavo.com/v2/ticker');
    const data = await resp.json();
    res.json({ status: 'ok', priceCount: data.length });
  } catch (err) {
    res.json({ status: 'error', error: err.message });
  }
};
```

---

## 🎯 Summary

**Nothing to change in Vercel!**

The fix is already:
- ✅ Compiled into production build
- ✅ Inlined (no external dependencies)
- ✅ Uses standard APIs (fetch, crypto)
- ✅ Compatible with Node.js 18+
- ✅ Ready to deploy

Just push to main and Vercel auto-deploys. ✅

---

**Last Updated:** February 11, 2026
**Status:** READY FOR PRODUCTION ✅
