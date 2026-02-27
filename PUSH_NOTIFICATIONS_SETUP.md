# Push Notifications Setup Guide

## Genereer VAPID Keys

Push notifications vereisen VAPID (Voluntary Application Server Identification) keys. Dit is hoe je ze genereert:

### 1. Installeer web-push CLI tool (eenmalig)
```bash
npm install -g web-push
```

### 2. Genereer vraag je web-push commande
```bash
web-push generate-vapid-keys
```

Output ziet er uit als:
```
Public Key: BPak9X...
Private Key: C2j7k...
```

### 3. Voeg keys toe aan .env

```env
# Push Notifications (Web Push API)
VITE_VAPID_PUBLIC_KEY=BPak9X...
VAPID_PRIVATE_KEY=C2j7k...
VAPID_EMAIL=jouw-email@example.com
CRON_SECRET=your-secret-key-for-vercel-cron
```

## Stappen voor deployment:

1. **Genereer VAPID keys** (bovenstaande commando's)

2. **Voeg environment variables toe in Vercel:**
   - Ga naar: https://vercel.com/dashboard
   - Kies je project
   - Settings → Environment Variables
   - Voeg toe:
     - `VITE_VAPID_PUBLIC_KEY`
     - `VAPID_PRIVATE_KEY`
     - `VAPID_EMAIL`
     - `CRON_SECRET`

3. **Voer database migration uit:**
   ```sql
   -- From: src/sql/add_push_subscriptions.sql
   -- In Supabase SQL editor
   ```

4. **Deploy naar Vercel:**
   ```bash
   git add -A
   git commit -m "feat: add push notifications support"
   git push origin main
   ```

## Hoe werkt het:

### User Side:
1. User klikt op "Meldingen aan" knop
2. Browser vraagt toestemming
3. Service Worker wordt geregistreerd
4. Push subscription opgeslagen in database

### Agent Side (Cron Jobs):
1. Portfolio check cron runs elk uur
2. Bij BUY/SELL signaal:
   ```typescript
   await sendTradingAlert(userId, 'BUY', 'BTC', 'Price dropped 5%');
   ```
3. Push notification verzonden naar all users subscribers
4. Desktop/mobile notification toont zich

### Push Flow:
```
User (Frontend)
    ↓ Subscribe
Service Worker
    ↓ Listen for push
Backend (Cron Job)
    ↓ Send Notification
Web Push Service
    ↓ Deliver
User's Phone/Browser
```

## Testing

### Test locally:
1. Start development server: `npm run dev`
2. Open in browser: `http://localhost:5173`
3. Click "Enable Notifications"
4. Browser will ask for permission
5. Check subscription in DevTools:
   ```javascript
   // In console:
   const reg = await navigator.serviceWorker.ready;
   const sub = await reg.pushManager.getSubscription();
   console.log(sub);
   ```

### Send test notification:
```bash
# Dit zou je in code kunnen doen:
const { sendTradingAlert } = require('./src/lib/notifications/pushSender');
await sendTradingAlert('user-id', 'BUY', 'BTC', 'Test alert');
```

## Troubleshooting

**"Notifications niet ondersteund"**
- Check browser support: https://caniuse.com/push-api
- Safari support is beperkt

**"Permission denied"**
- Gebruiker moet toestemming geven in browser settings
- Dit kan per domain ingesteld worden

**"Notification niet aangekomen"**
- Check Vercel logs: `vercel logs <project-name>`
- Verify subscription exists in Supabase: `push_subscriptions` table
- Check VAPID keys zijn correct ingesteld

---

Ready! Push notifications zijn nu ingesteld en zullen werken zodra je deployt naar Vercel!
