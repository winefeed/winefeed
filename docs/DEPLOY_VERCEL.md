# Winefeed - Vercel Deployment Guide

Complete guide for deploying Winefeed to Vercel production and connecting the domain **winefeed.se**.

## Prerequisites

- [ ] Vercel account with access to the Winefeed project
- [ ] Supabase project with database configured
- [ ] Domain winefeed.se configured in your DNS provider
- [ ] GitHub repository connected to Vercel

## Step 1: Local Build Verification

Before deploying to Vercel, verify the build works locally:

```bash
# Use Node 20 LTS
node -v  # Should show v20.x.x

# Install dependencies
npm ci

# Run build
npm run build

# Verify build succeeds
# Expected output: "✓ Compiled successfully"
```

**Expected Result:** Build completes without errors. Dynamic server usage warnings are expected and normal for API routes.

## Step 2: Environment Variables - Minimal Set

The following are **REQUIRED** for build to succeed:

### Supabase (Required)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

### App Configuration (Required)

```bash
NEXT_PUBLIC_APP_URL=https://winefeed.se
```

### Email Notifications (Optional - Recommended for Production)

```bash
EMAIL_NOTIFICATIONS_ENABLED=true
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@winefeed.se
```

**Note:** If `RESEND_API_KEY` is missing, email sending is skipped gracefully. If `EMAIL_NOTIFICATIONS_ENABLED=false`, emails are logged to console only.

### AI Features (Optional)

```bash
# Anthropic Claude API (for AI suggestions)
ANTHROPIC_API_KEY=sk-ant-api03-...

# Wine-Searcher API (for wine enrichment - NO PRICE DATA)
WINESEARCHER_API_KEY=your_winesearcher_api_key_here
WINESEARCHER_CACHE_TTL_DAYS=7

# GS1 Barcode Verification
GS1_API_KEY=your_gs1_api_key_here
GS1_API_URL=https://api.gs1.org/v1
```

**Note:** These are optional. If missing, features will be disabled but build will succeed.

## Step 3: Configure Vercel Project

### 3.1 Node Version

Vercel will use Node 20 based on:
- `package.json` engines field: `"node": ">=20 <21"`
- `.nvmrc` file containing: `20`

**Verify in Vercel UI:**
- Project Settings → General → Node.js Version should show **20.x**

### 3.2 Build Settings

**Framework Preset:** Next.js
**Build Command:** `npm run build` (auto-detected)
**Install Command:** `npm ci` (specified in vercel.json)
**Output Directory:** `.next` (auto-detected)

### 3.3 Environment Variables

**In Vercel Project Settings → Environment Variables:**

1. Add all required variables from Step 2
2. Set **Environment** to: `Production`, `Preview`, `Development` (or selectively)
3. For sensitive keys (API keys, service role key), use Vercel's "Sensitive" option

**Vercel UI Checklist:**
- [ ] `NEXT_PUBLIC_SUPABASE_URL` set
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set (Sensitive)
- [ ] `NEXT_PUBLIC_APP_URL` set to `https://winefeed.se`
- [ ] Optional: `EMAIL_NOTIFICATIONS_ENABLED=true`
- [ ] Optional: `RESEND_API_KEY` set (Sensitive)
- [ ] Optional: `ANTHROPIC_API_KEY` set (Sensitive)
- [ ] Optional: `WINESEARCHER_API_KEY` set (Sensitive)

## Step 4: Deploy to Vercel

### 4.1 Deploy via Git Push

```bash
# Commit changes
git add .
git commit -m "Configure for Vercel deployment"
git push origin main
```

Vercel will automatically deploy on push to `main` branch.

### 4.2 Monitor Deployment

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select Winefeed project
3. Click on latest deployment
4. Monitor build logs

**Expected Build Output:**
```
✓ Compiled successfully
Linting and checking validity of types ...
✓ Generating static pages (34/34)
```

**Warnings (Expected & Safe):**
- `⚠️ GS1_API_KEY not configured` - if GS1 is not set
- `[WineSearcher] API key not configured` - if Wine-Searcher is not set
- `Dynamic server usage: Route /api/...` - expected for API routes

### 4.3 Verify Deployment

Once deployed, Vercel provides a URL like:
```
https://winefeed-xxxxxx.vercel.app
```

**Test the deployment:**
```bash
# Health check (if you have one)
curl https://winefeed-xxxxxx.vercel.app/

# Test API endpoint
curl https://winefeed-xxxxxx.vercel.app/api/debug/env
```

## Step 5: Connect Domain winefeed.se

### 5.1 Add Domain in Vercel

1. Go to Project Settings → Domains
2. Click "Add Domain"
3. Enter: `winefeed.se`
4. Click "Add"
5. Repeat for: `www.winefeed.se`

### 5.2 Configure DNS Records

**In your DNS provider (e.g., Loopia, Cloudflare, etc.):**

#### Root Domain (winefeed.se)

**Type:** A Record
**Name:** `@` (or blank)
**Value:** `76.76.21.21`
**TTL:** 3600 (or auto)

#### WWW Subdomain (www.winefeed.se)

**Type:** CNAME
**Name:** `www`
**Value:** `cname.vercel-dns.com`
**TTL:** 3600 (or auto)

### 5.3 Verify DNS Propagation

```bash
# Check A record
dig winefeed.se A +short
# Expected: 76.76.21.21

# Check CNAME
dig www.winefeed.se CNAME +short
# Expected: cname.vercel-dns.com

# Test domain
curl https://winefeed.se/
curl https://www.winefeed.se/
```

**Note:** DNS propagation can take up to 48 hours, but usually completes in 5-15 minutes.

### 5.4 Enable HTTPS

Vercel automatically provisions SSL certificates via Let's Encrypt. Once DNS is configured:

1. Go to Project Settings → Domains
2. Wait for SSL certificate to be issued (usually < 5 minutes)
3. Status should show ✅ for both `winefeed.se` and `www.winefeed.se`

## Step 6: Post-Deployment Verification

### 6.1 Functional Tests

- [ ] Visit https://winefeed.se/ - homepage loads
- [ ] Test login/signup flow
- [ ] Test API endpoints (if authenticated)
- [ ] Check Supabase connection (data loads correctly)
- [ ] Test email notifications (if enabled)

### 6.2 Environment Variable Check

```bash
# Test that env vars are set correctly
curl https://winefeed.se/api/debug/env

# Expected: Should return env var status (without sensitive values)
```

### 6.3 Monitor Logs

In Vercel Dashboard → Your Project → Logs:
- Check for any runtime errors
- Verify API routes are responding correctly
- Check for missing env var warnings

## Troubleshooting

### Build Fails with "Missing API key" Error

**Problem:** Build fails during page data collection with Resend/Anthropic/etc. API key error.

**Solution:** This should not happen with the lazy initialization fix, but if it does:
1. Verify `lib/email-service.ts` uses lazy initialization (see commit history)
2. Check that optional integrations have guard clauses
3. Ensure `EMAIL_NOTIFICATIONS_ENABLED=false` if `RESEND_API_KEY` is not set

### "Dynamic server usage" Errors During Build

**Problem:** Build logs show multiple "Dynamic server usage" errors.

**Solution:** These are **expected and normal** for API routes that use `request.headers` or `request.url`. They cannot be statically generated. The build should still succeed.

### Domain Not Resolving

**Problem:** winefeed.se returns DNS_PROBE_FINISHED_NXDOMAIN or similar.

**Solution:**
1. Verify DNS records in your DNS provider
2. Wait 15-30 minutes for propagation
3. Use `dig winefeed.se` to check DNS status
4. Ensure A record points to `76.76.21.21`
5. Ensure CNAME points to `cname.vercel-dns.com`

### SSL Certificate Not Issued

**Problem:** Domain shows "Not Secure" or certificate error.

**Solution:**
1. Ensure DNS is properly configured and propagated
2. In Vercel, remove domain and re-add it
3. Wait 5-10 minutes for Let's Encrypt to issue certificate
4. Check Project Settings → Domains for certificate status

### Supabase Connection Fails

**Problem:** App loads but can't connect to Supabase.

**Solution:**
1. Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel env vars
2. Check Supabase project is active and accessible
3. Verify RLS policies allow the operations
4. Check Vercel logs for specific Supabase errors

## Security Checklist

Before going live:

- [ ] `SUPABASE_SERVICE_ROLE_KEY` marked as Sensitive in Vercel
- [ ] `RESEND_API_KEY` marked as Sensitive in Vercel
- [ ] `ANTHROPIC_API_KEY` marked as Sensitive in Vercel
- [ ] All API keys rotated from development values
- [ ] Supabase RLS policies enabled and tested
- [ ] CORS settings configured in Supabase (allow winefeed.se)
- [ ] Rate limiting enabled for public API routes (if applicable)

## Monitoring & Maintenance

### Recommended Monitoring

- **Vercel Analytics:** Enable in Project Settings → Analytics
- **Supabase Logs:** Monitor database queries and auth events
- **Error Tracking:** Consider Sentry or similar for production errors
- **Uptime Monitoring:** Use service like UptimeRobot to monitor https://winefeed.se/

### Regular Maintenance

- Update dependencies: `npm outdated && npm update`
- Review Vercel logs weekly for errors
- Monitor Supabase usage and quotas
- Review and rotate API keys quarterly

## Support

For issues or questions:
- Vercel Support: https://vercel.com/support
- Supabase Support: https://supabase.com/support
- Project Repository: [Your GitHub URL]

---

**Last Updated:** 2026-01-16
**Node Version:** 20 LTS
**Next.js Version:** 14.2.21
