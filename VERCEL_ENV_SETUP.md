# 🔐 VERCEL ENVIRONMENT VARIABLES SETUP

## Current Status
✅ Already Configured:
- `ENCRYPTION_KEY` - For encrypting API credentials
- `STORAGE_DRIVER` - File storage system (fs/s3)
- `SUPABASE_ANON_KEY` - Supabase public key
- `SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Frontend Supabase key
- `VITE_SUPABASE_URL` - Frontend Supabase URL

❌ **MISSING - Need to Add:**
- `RESEND_API_KEY` - Email sending service
- `OPENAI_API_KEY` - ChatGPT/OpenAI API access
- `SUPABASE_SERVICE_ROLE_KEY` - Backend Supabase admin key (optional but recommended)

---

## Missing Environment Variables

### 1. RESEND_API_KEY (Critical for Email)

**What it does:** Powers email notifications
- Daily digest emails
- Trade execution alerts
- Market alert notifications
- User notifications

**How to get it:**
1. Go to [https://resend.com/](https://resend.com/)
2. Sign up for free account
3. Create API key in dashboard
4. Copy the key (starts with `re_`)

**Format:** `re_xxxxxxxxxxxxxxxxxxxxx`

**Usage in code:**
```typescript
// src/lib/notifications/emailService.ts
const RESEND_API_KEY = process.env.RESEND_API_KEY;

await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${RESEND_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    from: 'noreply@autoinvestoracle.com',
    to: userEmail,
    subject: 'Your Daily Market Digest',
    html: emailHtml
  })
});
```

---

### 2. OPENAI_API_KEY (Critical for ChatGPT Chat)

**What it does:** Powers ChatGPT chat function
- Market analysis via ChatGPT
- Trading advice and insights
- Natural language intent parsing
- Settings changes through conversation

**How to get it:**
1. Go to [https://platform.openai.com/api/keys](https://platform.openai.com/api/keys)
2. Sign in with OpenAI account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)

**Format:** `sk_proj_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` or `sk-xxxxxxxxxxxxxxx`

**Usage in code:**
```typescript
// api/index.ts - generateChatReply function
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const resp = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: formattedMessages,
    temperature: 0.7,
    max_tokens: 1000
  })
});
```

---

### 3. SUPABASE_SERVICE_ROLE_KEY (Optional but Recommended)

**What it does:** Backend-only Supabase access with elevated permissions
- Can be used for server-side operations
- Bypass Row Level Security (RLS) when needed
- More secure than using anon key for sensitive operations

**How to get it:**
1. Go to Supabase project dashboard
2. Navigate to Settings → API
3. Under "Project API Keys", copy "Service Role key"
4. Format: starts with `eyJhbGci...`

**Usage:**
```typescript
// Optional backend client with elevated permissions
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Admin key
);
```

---

## Adding to Vercel

### Step 1: Go to Vercel Project Settings
1. Open your project on [https://vercel.com](https://vercel.com)
2. Click **Settings** (top menu)
3. Click **Environment Variables** (left sidebar)

### Step 2: Add RESEND_API_KEY
1. Click **Add New**
2. Name: `RESEND_API_KEY`
3. Value: Paste your Resend API key
4. Select **All Environments** (Production, Preview, Development)
5. Click **Save**

### Step 3: Add OPENAI_API_KEY
1. Click **Add New**
2. Name: `OPENAI_API_KEY`
3. Value: Paste your OpenAI API key
4. Select **All Environments**
5. Click **Save**

### Step 4: (Optional) Add SUPABASE_SERVICE_ROLE_KEY
1. Click **Add New**
2. Name: `SUPABASE_SERVICE_ROLE_KEY`
3. Value: Paste your Supabase Service Role key
4. Select **All Environments**
5. Click **Save**

---

## Verification

### Check Variables Are Available
```typescript
// These should NOT be undefined in production
console.log('Has RESEND:', !!process.env.RESEND_API_KEY);
console.log('Has OPENAI:', !!process.env.OPENAI_API_KEY);
console.log('Has SUPABASE_SERVICE:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
```

### After Adding Variables
1. **Redeploy** your Vercel project:
   - Vercel will automatically redeploy with new env vars
   - OR click **Deployments** → **Redeploy** on latest deployment

2. **Test Email Function**
   - Try triggering a daily digest email
   - Check email was received

3. **Test ChatGPT Chat**
   - Open chat interface
   - Ask a question
   - Verify response from OpenAI

---

## Environment Variable Summary

| Variable | Required | Source | Environment |
|----------|----------|--------|-------------|
| ENCRYPTION_KEY | ✅ Yes | Created during setup | All |
| STORAGE_DRIVER | ✅ Yes | Created during setup | All |
| SUPABASE_URL | ✅ Yes | Supabase Dashboard | All |
| SUPABASE_ANON_KEY | ✅ Yes | Supabase Dashboard | All |
| VITE_SUPABASE_URL | ✅ Yes | Supabase Dashboard | All |
| VITE_SUPABASE_ANON_KEY | ✅ Yes | Supabase Dashboard | All |
| RESEND_API_KEY | ✅ Yes | Resend.com | All |
| OPENAI_API_KEY | ✅ Yes | OpenAI Platform | All |
| SUPABASE_SERVICE_ROLE_KEY | ⚠️ Optional | Supabase Dashboard | All |

---

## Troubleshooting

### Email Not Sending
❌ **Error:** "RESEND_API_KEY ontbreekt"
- Check Vercel env var is added and spelled correctly
- Verify Resend API key is valid
- Redeploy Vercel project after adding env var

### ChatGPT Chat Returns Error
❌ **Error:** "OPENAI_API_KEY ontbreekt"
- Check Vercel env var is added
- Verify OpenAI API key has credits
- Check OpenAI account status and usage limits
- Redeploy Vercel project

### Key Rotation
If you need to rotate keys:
1. Generate new key on service (Resend/OpenAI)
2. Update in Vercel Environment Variables
3. Redeploy project
4. Delete old key on service

---

## Security Best Practices

✅ **DO:**
- Store keys only in Vercel Environment Variables
- Use different keys per environment if possible
- Rotate keys regularly (quarterly recommended)
- Monitor API usage on each service

❌ **DON'T:**
- Commit keys to Git repository
- Share keys in Slack/email
- Use development keys in production
- Log keys to console

---

## Next Steps

1. **Immediate:** Add RESEND_API_KEY and OPENAI_API_KEY to Vercel
2. **Verify:** Redeploy and test both email and chat functions
3. **Monitor:** Check Resend and OpenAI dashboards for usage
4. **Document:** Keep track of key creation dates for rotation schedule

---

## Related Documentation

- [Resend Documentation](https://resend.com/docs)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Supabase API Keys](https://supabase.com/docs/guides/api)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
