# Sidebar Navigation - Test Plan

## Översikt

Denna testplan täcker verifiering av rollbaserad sidebar-navigation i Winefeed.

## Test Environment

- **Dev Server:** `npm run dev` → http://localhost:3000
- **Test Users:** Se dokumentation för att skapa testanvändare med olika roller

## Förutsättningar

### Skapa testanvändare

Du behöver användare med följande roller för att testa:

1. **RESTAURANT** - En restauranganvändare
2. **SELLER** - En leverantörsanvändare
3. **IOR** - En importör (Importer of Record)
4. **ADMIN** - En adminanvändare
5. **Multi-role** - En användare med flera roller (t.ex. RESTAURANT + SELLER)

**Skapa användare via Supabase Dashboard:**
```sql
-- 1. Skapa användare i Supabase Auth (Dashboard → Authentication → Add User)
-- 2. Lägg till i rätt roll-tabell:

-- RESTAURANT role:
INSERT INTO restaurant_users (tenant_id, user_id, restaurant_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'USER_ID', 'RESTAURANT_ID');

-- SELLER role:
INSERT INTO supplier_users (tenant_id, user_id, supplier_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'USER_ID', 'SUPPLIER_ID');

-- ADMIN role:
INSERT INTO admin_users (tenant_id, user_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'USER_ID');
```

---

## Test 1: RESTAURANT Role Navigation

### Setup
- Logga in som användare med **endast RESTAURANT** roll

### Förväntade menyval (Dashboard Sidebar)
- ✅ Dashboard
- ✅ Requests
- ✅ Orders
- ✅ Order Quote (role-specific)

### Verifiering
- [ ] Alla förväntade menyval visas
- [ ] Inga SELLER/IOR-specifika menyval visas
- [ ] Aktiv länk highlightas korrekt
- [ ] Icons renderas korrekt
- [ ] Länkar fungerar (navigerar till rätt sida)

### Admin Access
- [ ] `/admin` redirectar till `/dashboard/new-request?error=admin_access_denied`
- [ ] Ingen admin-meny visas

---

## Test 2: SELLER Role Navigation

### Setup
- Logga in som användare med **endast SELLER** roll

### Förväntade menyval (Dashboard Sidebar)
- ✅ Dashboard
- ✅ Requests
- ✅ Orders
- ✅ Products (role-specific)
- ✅ Incoming Requests (role-specific)

### Verifiering
- [ ] Alla förväntade menyval visas
- [ ] Inga RESTAURANT/IOR-specifika menyval visas
- [ ] Aktiv länk highlightas korrekt
- [ ] Icons renderas korrekt
- [ ] Länkar fungerar

### Admin Access
- [ ] `/admin` redirectar till `/dashboard/new-request?error=admin_access_denied`

---

## Test 3: IOR Role Navigation

### Setup
- Logga in som användare med **endast IOR** roll

### Förväntade menyval (Dashboard Sidebar)
- ✅ Dashboard
- ✅ Requests
- ✅ Orders
- ✅ IOR Orders (role-specific)

### Verifiering
- [ ] Alla förväntade menyval visas
- [ ] Inga RESTAURANT/SELLER-specifika menyval visas
- [ ] Aktiv länk highlightas korrekt
- [ ] Icons renderas korrekt
- [ ] Länkar fungerar

### Admin Access
- [ ] `/admin` redirectar till `/dashboard/new-request?error=admin_access_denied`

---

## Test 4: ADMIN Role Navigation

### Setup
- Logga in som användare med **ADMIN** roll

### Förväntade menyval (Admin Sidebar - Red Theme)
- ✅ Dashboard
- ✅ Users
- ✅ Invitations
- ✅ Pilot Console

### Verifiering
- [ ] Admin sidebar visas med röd accent-färg
- [ ] Alla förväntade admin-menyval visas
- [ ] Aktiv länk highlightas korrekt
- [ ] Icons renderas korrekt
- [ ] Länkar fungerar
- [ ] `/admin` är åtkomlig (ingen redirect)

### Dashboard Navigation
När admin besöker `/dashboard/*`:
- [ ] Regular dashboard sidebar visas (inte admin-sidebar)
- [ ] User har ADMIN i roles lista (UserMenu)

---

## Test 5: Multi-Role User

### Setup
- Logga in som användare med **RESTAURANT + SELLER** roller

### Förväntade menyval (Dashboard Sidebar)
- ✅ Dashboard
- ✅ Requests
- ✅ Orders
- ✅ Order Quote (RESTAURANT)
- ✅ Products (SELLER)
- ✅ Incoming Requests (SELLER)

### Verifiering
- [ ] Alla menyval för båda rollerna visas
- [ ] Inga duplicerade menyval
- [ ] Role badges i UserMenu visar båda rollerna

---

## Test 6: Sidebar Collapse (Desktop)

### Setup
- Öppna i desktop viewport (>1024px bredd)
- Logga in som valfri användare

### Förväntade funktioner
- ✅ Collapse-knapp visas längst ner i sidebar
- ✅ Vid collapse: Sidebar shrinks till 64px
- ✅ Icons förblir synliga
- ✅ Labels döljs
- ✅ Tooltips visas vid hover över icons
- ✅ UserMenu visar endast logout-knapp med tooltip

### Verifiering - Collapsed State
- [ ] Sidebar är 64px bred
- [ ] Icons synliga
- [ ] Labels dolda
- [ ] Tooltips fungerar på hover
- [ ] UserMenu kompakt läge
- [ ] Winefeed/Admin logo visas som endast icon

### Verifiering - Expanded State
- [ ] Sidebar är 256px bred
- [ ] Icons + labels synliga
- [ ] UserMenu fullständigt läge (email, roles, logout)
- [ ] Smooth transition mellan collapsed/expanded

### LocalStorage Persistence
- [ ] Collapse sidebar → Ladda om sidan → Sidebar fortfarande collapsed
- [ ] Expand sidebar → Ladda om sidan → Sidebar fortfarande expanded
- [ ] State sparas mellan olika sidor i samma domain

---

## Test 7: Mobile Responsive (Hamburger Menu)

### Setup
- Öppna i mobile viewport (<1024px bredd)
- Eller resize browser window

### Förväntade funktioner
- ✅ Sidebar döljs automatiskt
- ✅ Hamburger-knapp visas (top-left)
- ✅ Klicka hamburger → Overlay sidebar öppnas
- ✅ Klicka utanför sidebar → Sidebar stängs
- ✅ Klicka på länk → Sidebar stängs + navigerar

### Verifiering - Mobile Closed
- [ ] Sidebar inte synlig
- [ ] Hamburger-knapp synlig (top-left)
- [ ] Innehåll täcker hela bredden

### Verifiering - Mobile Open
- [ ] Sidebar slides in från vänster (256px bred)
- [ ] Dark overlay visas bakom sidebar
- [ ] Close (X) knapp synlig i sidebar header
- [ ] UserMenu visas fullständigt

### Interaktioner
- [ ] Klicka hamburger → Öppnar sidebar
- [ ] Klicka X → Stänger sidebar
- [ ] Klicka overlay → Stänger sidebar
- [ ] Klicka nav-länk → Stänger sidebar + navigerar
- [ ] Smooth animations

---

## Test 8: User Menu Functionality

### Setup
- Logga in som valfri användare
- Expandad sidebar (desktop)

### Förväntade funktioner
- ✅ Visar user email (eller "User" om email saknas)
- ✅ Visar antal roller
- ✅ Expand/collapse för att visa role badges
- ✅ Role badges color-coded per roll
- ✅ Logout-knapp

### Verifiering - Collapsed User Menu
- [ ] User avatar (circle med User icon)
- [ ] Email visar (trunkerad om för lång)
- [ ] "X roles" count visar
- [ ] Chevron up/down icon
- [ ] Klicka → Expanderar

### Verifiering - Expanded User Menu
- [ ] Role badges visas
- [ ] Rätt färg per roll:
  - RESTAURANT: Blue
  - SELLER: Green
  - IOR: Purple
  - ADMIN: Red
- [ ] Klicka igen → Kollapsar

### Verifiering - Logout
- [ ] Klicka "Logout" → Knapp visar "Logging out..."
- [ ] User utloggad från Supabase
- [ ] Redirectad till `/login`
- [ ] Session cookie borttagen

---

## Test 9: Active Link Highlighting

### Setup
- Logga in och navigera mellan sidor

### Förväntade funktioner
- ✅ Aktuell sida highlightas i sidebar
- ✅ Primary color background
- ✅ White text

### Verifiering
- [ ] `/dashboard/new-request` → "Dashboard" highlighted
- [ ] `/dashboard/requests` → "Requests" highlighted
- [ ] `/dashboard/requests/[id]` → "Requests" highlighted (starts-with match)
- [ ] `/orders` → "Orders" highlighted
- [ ] `/admin` → "Dashboard" (admin) highlighted
- [ ] `/admin/users` → "Users" highlighted

---

## Test 10: Admin Access Control

### Setup A: Non-Admin User
- Logga in som användare **utan** ADMIN roll

### Verifiering
- [ ] Försök besöka `/admin` → Redirectar till `/dashboard/new-request?error=admin_access_denied`
- [ ] Försök besöka `/admin/users` → Redirectar
- [ ] Försök besöka `/admin/pilot` → Redirectar
- [ ] Ingen admin-navigation visas i dashboard sidebar

### Setup B: Admin User
- Logga in som användare **med** ADMIN roll

### Verifiering
- [ ] `/admin` åtkomlig
- [ ] `/admin/users` åtkomlig
- [ ] `/admin/pilot` åtkomlig
- [ ] Admin sidebar visas på admin-sidor
- [ ] Dashboard sidebar visas på dashboard-sidor

---

## Test 11: Edge Cases

### Test 11a: User utan några roller
- [ ] Sidebar visar endast gemensamma menyval (Dashboard, Requests, Orders)
- [ ] Inga role-specifika menyval
- [ ] UserMenu visar "0 roles"

### Test 11b: User utan email
- [ ] UserMenu visar "User" istället för email
- [ ] Systemet fungerar normalt

### Test 11c: Snabb navigation
- [ ] Klicka snabbt mellan flera sidor
- [ ] Active state uppdateras korrekt
- [ ] Ingen flicker eller visual bugs

### Test 11d: Browser back/forward
- [ ] Använd browser back/forward knappar
- [ ] Active state uppdateras korrekt i sidebar

---

## Test 12: Build & Production

### Verifiering
- [ ] `npm run build` → Build succeeds
- [ ] Inga TypeScript errors
- [ ] Inga console warnings om hydration mismatch
- [ ] localStorage fungerar i production build

---

## Checklista - Sammanfattning

### Funktionalitet
- [ ] Alla roller visar rätt menyval
- [ ] Admin-access blockeras för icke-admins
- [ ] Sidebar collapse fungerar med localStorage
- [ ] Mobile hamburger-menu fungerar
- [ ] Active link highlighting fungerar
- [ ] UserMenu visar rätt info och roles
- [ ] Logout fungerar

### Design & UX
- [ ] Smooth transitions
- [ ] Icons renderas korrekt
- [ ] Colors korrekt per roll
- [ ] Responsive design fungerar
- [ ] Tooltips fungerar i collapsed mode
- [ ] Admin sidebar har röd accent

### Tekniskt
- [ ] Build succeeds
- [ ] Inga console errors
- [ ] localStorage fungerar
- [ ] Server-side auth checks fungerar
- [ ] Next.js routing fungerar korrekt

---

## Kända Begränsningar

- **Single Tenant MVP**: Hårdkodad tenant_id i layouts
- **Email Masking**: Email visas omaskat i UserMenu (kan lägga till maskering senare)
- **Navigation Paths**: Vissa paths (t.ex. `/products`, `/ior/orders`) kanske inte finns ännu

---

## Felsökning

### Sidebar visas inte
- Kontrollera att layout.tsx används för rätt routes
- Kolla console för JavaScript errors
- Verifiera att lucide-react är installerat

### Fel menyval visas
- Kontrollera användarens roller via `/api/me/actor`
- Verifiera `actorService.resolveActor()` returnerar rätt roles
- Kolla `navigation.ts` konfiguration

### localStorage fungerar inte
- Kontrollera att JavaScript är aktiverat
- Kolla browser DevTools → Application → Local Storage
- Verifiera att `STORAGE_KEY = 'sidebar-collapsed'` finns

### Admin redirect fungerar inte
- Kontrollera att `adminService.isAdmin()` returnerar korrekt värde
- Verifiera att admin_users tabell har korrekt data
- Kolla att `ADMIN_MODE` env var är satt för dev

---

## Slutsats

När alla tests är gröna är sidebar-navigationen redo för production.
