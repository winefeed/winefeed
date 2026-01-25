# Tenant Isolation Strategy

## Översikt

Winefeed använder en **single-tenant MVP-arkitektur** med förberedelser för framtida multi-tenancy. Alla tabeller har `tenant_id` kolumner och RLS-policies, men tenant-ID är för närvarande hårdkodat.

---

## Nuvarande Implementation

### 1. Middleware (`middleware.ts`)

```typescript
// MVP: Hårdkodat tenant-ID
const tenantId = '00000000-0000-0000-0000-000000000001';

// Sätts på alla autentiserade requests
requestHeaders.set('x-tenant-id', tenantId);
requestHeaders.set('x-user-id', user.id);
```

**Flöde:**
1. Användare autentiseras via Supabase
2. Middleware sätter `x-tenant-id` och `x-user-id` headers
3. Alla API-routes läser dessa headers
4. Databasfrågor filtrerar på tenant_id

### 2. API-endpoints

Alla endpoints extraherar tenant-kontext:

```typescript
const tenantId = request.headers.get('x-tenant-id');
const userId = request.headers.get('x-user-id');

if (!tenantId || !userId) {
  return NextResponse.json({ error: 'Missing auth context' }, { status: 401 });
}

// Alla queries inkluderar tenant_id
const { data } = await supabase
  .from('orders')
  .select('*')
  .eq('tenant_id', tenantId);
```

### 3. Actor Service (`lib/actor-service.ts`)

Löser användarens roller inom en tenant:

```typescript
const actor = await actorService.resolveActor({
  user_id: userId,
  tenant_id: tenantId
});

// actor innehåller:
// - roles: ['RESTAURANT', 'SELLER', 'IOR', 'ADMIN']
// - restaurant_id (om RESTAURANT-roll)
// - supplier_id (om SELLER-roll)
// - importer_id (om IOR-roll)
```

---

## Databas-isolation

### Tabeller med tenant_id

| Tabell | Beskrivning |
|--------|-------------|
| restaurants | Restauranger |
| offers | Offerter |
| offer_lines | Offertrader |
| orders | Ordrar |
| order_lines | Orderrader |
| importers | Importörer (IOR) |
| imports | Importärenden |
| invites | Användarinbjudningar |
| admin_users | Admin-mappningar |
| direct_delivery_locations | DDL för Skatteverket |
| wine_masters | Vinmasters |
| supplier_wines | Leverantörsviner |

### Row Level Security (RLS)

Alla tabeller har RLS aktiverat med följande mönster:

```sql
-- 1. Aktivera RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 2. Service role får full access (för API-routes)
CREATE POLICY "Service role full access" ON orders
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- 3. Tenant-isolation för direkt klient-access
CREATE POLICY "Tenant isolation" ON orders
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

---

## Säkerhetsmodell

### Lager av skydd

```
┌─────────────────────────────────────────────┐
│  1. Middleware (autentisering)              │
│     - Verifiera Supabase-session            │
│     - Sätt x-tenant-id, x-user-id           │
├─────────────────────────────────────────────┤
│  2. API Route (auktorisering)               │
│     - Validera headers finns                │
│     - ActorService för rollkontroll         │
│     - Verifiera access till resurs          │
├─────────────────────────────────────────────┤
│  3. Service Layer (affärslogik)             │
│     - Inkludera tenant_id i alla queries    │
│     - Validera relationer                   │
├─────────────────────────────────────────────┤
│  4. Database (RLS)                          │
│     - Row Level Security aktiverat          │
│     - Service role bypass för API           │
│     - Tenant-policies för direkt access     │
└─────────────────────────────────────────────┘
```

### Rollhierarki

```
ADMIN
  └── Full access till tenant

RESTAURANT
  └── Access till egen restaurang + dess requests/orders

SELLER
  └── Access till egen leverantör + tilldelade requests

IOR (Importer of Record)
  └── Access till importärenden där org_number matchar
```

---

## Multi-tenancy: Framtida Implementation

### Vad som behövs

1. **Dynamisk tenant-tilldelning i middleware**
   ```typescript
   // Framtida: Hämta tenant från user metadata
   const tenantId = user.user_metadata?.tenant_id;
   ```

2. **User-tenant mappning i databas**
   ```sql
   CREATE TABLE tenant_users (
     user_id UUID REFERENCES auth.users(id),
     tenant_id UUID REFERENCES tenants(id),
     role TEXT,
     PRIMARY KEY (user_id, tenant_id)
   );
   ```

3. **JWT claims med tenant**
   ```typescript
   // Supabase custom claims
   await supabase.auth.updateUser({
     data: { tenant_id: selectedTenantId }
   });
   ```

4. **Tenant-switch för multi-tenant users**
   - UI för att byta tenant
   - Session-hantering för aktiv tenant

### Nuvarande begränsningar

| Begränsning | Påverkan | Lösning |
|-------------|----------|---------|
| Hårdkodat tenant_id | Alla users delar data | Refaktor middleware |
| Ingen tenant-tabell | Kan ej lista tenants | Skapa tenants-tabell |
| JWT saknar tenant | RLS policies begränsade | Custom JWT claims |

---

## Best Practices

### 1. Alltid inkludera tenant_id

```typescript
// RÄTT
const { data } = await supabase
  .from('orders')
  .select('*')
  .eq('tenant_id', tenantId)
  .eq('status', 'CONFIRMED');

// FEL - data läcker mellan tenants!
const { data } = await supabase
  .from('orders')
  .select('*')
  .eq('status', 'CONFIRMED');
```

### 2. Använd ActorService för rollkontroll

```typescript
// Verifiera access
const actor = await actorService.resolveActor({ user_id, tenant_id });

if (!actorService.hasRole(actor, 'ADMIN')) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### 3. Validera resurs-ägande

```typescript
// Verifiera att resursen tillhör användaren
const { data: order } = await supabase
  .from('orders')
  .select('*, restaurants(tenant_id)')
  .eq('id', orderId)
  .single();

if (order.restaurants.tenant_id !== tenantId) {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
```

---

## Relaterade filer

- `middleware.ts` - Tenant-kontext sätts
- `lib/actor-service.ts` - Rollupplösning
- `lib/admin-service.ts` - Admin-kontroll
- `supabase/migrations/*_enable_rls_*.sql` - RLS-policies

---

*Dokumentet uppdaterat: 2026-01-25*
