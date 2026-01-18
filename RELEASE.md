# Winefeed Release Workflow

## Overview

Winefeed uses a **staging → main** workflow to ensure safe deployments:

- **main** = Production (Vercel production deployment)
- **staging** = Pre-production testing (Vercel preview deployment)
- **feature/<name>** = Feature branches (Vercel preview deployments)

## Branch Protection Rules

⚠️ **NEVER push directly to main** - Always go through staging first.

## Workflow: Feature → Staging → Main

```
feature/<name> → staging → main
     ↓              ↓         ↓
  Preview       Preview   Production
```

---

## Scenario 1: New Feature Development

### Terminal Commands

```bash
# 1. Start from staging (ALWAYS)
git checkout staging
git pull origin staging

# 2. Create feature branch
git checkout -b feature/<short-description>
# Example: feature/import-status-ui

# 3. Make your changes, then commit
git add .
git commit -m "feat: <description>

<detailed explanation>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

# 4. Push feature branch
git push -u origin feature/<short-description>

# 5. Create PR to staging (NOT main)
gh pr create --base staging --title "feat: <title>" --body "<description>"

# 6. Merge PR to staging (after review)
gh pr merge --squash

# 7. Test on Vercel staging preview
# Visit: https://winefeed-<hash>.vercel.app
```

### Vercel Preview Deployment

- Each feature branch gets a preview URL: `https://winefeed-git-feature-<name>-<team>.vercel.app`
- Staging branch has its own preview: `https://winefeed-git-staging-<team>.vercel.app`
- Test thoroughly before promoting to main

---

## Scenario 2: Deploy to Staging (Testing)

### Terminal Commands

```bash
# 1. Ensure all features are merged to staging
git checkout staging
git pull origin staging

# 2. Verify staging preview deployment
# Visit: https://winefeed-git-staging-<team>.vercel.app

# 3. Run smoke tests
npm run build    # Verify build succeeds
npm run lint     # Verify no lint errors
npx tsc --noEmit # Verify no type errors

# 4. Test critical flows:
# - Login/signup
# - Create import case
# - Upload supplier CSV
# - Create offer
# - Accept offer
```

### Testing Checklist

- [ ] Build succeeds without errors
- [ ] All ESLint checks pass
- [ ] TypeScript compilation succeeds
- [ ] Login/authentication works
- [ ] Core business flows functional
- [ ] No console errors in browser
- [ ] Email notifications work (if RESEND_API_KEY configured)
- [ ] Database writes succeed
- [ ] RLS policies enforced

---

## Scenario 3: Promote to Production (Main)

### Terminal Commands

```bash
# 1. Verify staging is stable and tested
git checkout staging
git pull origin staging

# 2. Switch to main
git checkout main
git pull origin main

# 3. Merge staging into main (fast-forward)
git merge staging --ff-only

# 4. Push to production
git push origin main

# 5. Verify production deployment
# Visit: https://winefeed.se (or your production URL)

# 6. Monitor Vercel deployment
# Check: https://vercel.com/<team>/winefeed/deployments

# 7. Create release tag (optional)
git tag -a v1.0.0 -m "Release v1.0.0: <description>"
git push origin v1.0.0
```

### Production Deployment Checklist

- [ ] Staging tested and approved
- [ ] All tests pass
- [ ] No breaking changes
- [ ] Database migrations applied (if any)
- [ ] Environment variables configured in Vercel
- [ ] Vercel deployment succeeds
- [ ] Production URL loads correctly
- [ ] Critical flows verified in production
- [ ] Rollback plan ready (revert commit if needed)

---

## Scenario 4: Hotfix (Emergency Production Fix)

### Terminal Commands

```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/<issue-description>

# 2. Make minimal fix
git add .
git commit -m "fix: <critical issue>

Hotfix for production issue: <description>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

# 3. Push hotfix
git push -u origin hotfix/<issue-description>

# 4. Create PR to main (EXCEPTION: hotfixes can skip staging)
gh pr create --base main --title "hotfix: <title>" --body "HOTFIX: <urgent issue>"

# 5. Merge to main immediately
gh pr merge --squash

# 6. Backport to staging
git checkout staging
git pull origin staging
git merge main
git push origin staging
```

⚠️ **Hotfixes are the ONLY exception** to the staging-first rule. Use sparingly.

---

## Common Commands Reference

### Check Current Branch
```bash
git branch --show-current
```

### List All Branches
```bash
git branch -a
```

### Delete Feature Branch (after merge)
```bash
git branch -d feature/<name>          # Local
git push origin --delete feature/<name> # Remote
```

### View Deployment Status
```bash
gh pr view --web  # Opens PR in browser
```

### Rollback Production (if deployment fails)
```bash
git checkout main
git revert HEAD
git push origin main
```

---

## Vercel Environment Configuration

### Required Environment Variables (Production)

Set in Vercel Project Settings → Environment Variables:

```env
# Database (Required)
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Email (Optional - no build failure if missing)
RESEND_API_KEY=<resend-key>
EMAIL_NOTIFICATIONS_ENABLED=true
EMAIL_FROM=noreply@winefeed.se

# App (Required)
NEXT_PUBLIC_APP_URL=https://winefeed.se

# Feature Flags (Optional)
ADMIN_MODE=false
```

### Preview Environments (Staging/Feature Branches)

- Staging branch: Configure same env vars as production (or use test database)
- Feature branches: Inherit from staging or use separate test env

---

## Branch Protection Setup (GitHub)

### Recommended Settings for `main` branch:

1. Go to: Settings → Branches → Branch protection rules
2. Add rule for `main`:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass (Vercel deployment)
   - ✅ Require branches to be up to date
   - ✅ Do not allow bypassing the above settings
   - ❌ Allow force pushes (disabled)

### Recommended Settings for `staging` branch:

1. Add rule for `staging`:
   - ✅ Require pull request reviews (optional, can be less strict)
   - ✅ Require status checks to pass
   - ⚠️ Allow force pushes (if needed for rebasing)

---

## Troubleshooting

### "Cannot push to main directly"
**Solution:** You're trying to push directly to main. Always create a PR from staging:
```bash
git checkout staging
git merge <your-branch>
git push origin staging
# Then create PR: staging → main
```

### "Build fails on Vercel but succeeds locally"
**Solution:** Missing environment variables or Node version mismatch.
1. Check Vercel logs for exact error
2. Verify env vars in Vercel project settings
3. Ensure Node 20 LTS (`engines` in package.json)

### "Feature branch conflicts with staging"
**Solution:** Rebase feature branch on staging:
```bash
git checkout feature/<name>
git fetch origin staging
git rebase origin/staging
git push --force-with-lease
```

### "Need to undo last commit"
**Solution:**
```bash
git reset --soft HEAD~1  # Undo commit, keep changes
git reset --hard HEAD~1  # Undo commit, discard changes
```

---

## Quick Reference Card

| Task | Command |
|------|---------|
| New feature | `git checkout staging && git checkout -b feature/<name>` |
| Push feature | `git push -u origin feature/<name>` |
| PR to staging | `gh pr create --base staging` |
| Deploy staging | `git checkout staging && git pull` (auto-deploys) |
| Deploy production | `git checkout main && git merge staging && git push` |
| Hotfix | `git checkout -b hotfix/<name> main` |
| Check deployment | Visit Vercel dashboard |

---

## Contact

- **Release Manager:** [Your Name]
- **Vercel Project:** https://vercel.com/<team>/winefeed
- **GitHub Repo:** https://github.com/winefeed/winefeed

---

**Last Updated:** 2026-01-16
