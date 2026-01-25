/**
 * FIX IOR ACCESS
 *
 * Diagnostiserar och fixar IOR-behörighet för en användare.
 *
 * Usage: npx ts-node scripts/fix-ior-access.ts [user_email]
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const ORG_NUMBER = '556789-1234'; // Standard org_number for IOR matching

async function main() {
  const userEmail = process.argv[2];

  console.log('════════════════════════════════════════');
  console.log('🔧 IOR Access Diagnostic & Fix');
  console.log('════════════════════════════════════════\n');

  // Step 1: Find user
  console.log('📍 Step 1: Finding user...');
  let userId: string | null = null;

  if (userEmail) {
    const { data: user, error } = await supabase.auth.admin.listUsers();
    const found = user?.users?.find(u => u.email === userEmail);
    if (found) {
      userId = found.id;
      console.log(`   ✓ Found user: ${found.email} (${userId})`);
    } else {
      console.log(`   ✗ User with email ${userEmail} not found`);
      console.log('   Listing all users:');
      user?.users?.forEach(u => console.log(`     - ${u.email} (${u.id})`));
    }
  } else {
    console.log('   No email provided, listing all users:');
    const { data: users } = await supabase.auth.admin.listUsers();
    users?.users?.forEach(u => console.log(`   - ${u.email} (${u.id})`));
    console.log('\n   Usage: npx ts-node scripts/fix-ior-access.ts <user_email>');
    return;
  }

  if (!userId) return;

  // Step 2: Check supplier_users
  // Note: supplier_users.id = auth.users.id (not user_id column)
  console.log('\n📍 Step 2: Checking supplier_users...');
  const { data: supplierUser } = await supabase
    .from('supplier_users')
    .select('*, suppliers(*)')
    .eq('id', userId)
    .single();

  if (supplierUser) {
    console.log(`   ✓ User is SELLER for: ${(supplierUser as any).suppliers?.namn}`);
    console.log(`   Supplier ID: ${supplierUser.supplier_id}`);
    console.log(`   Org Number: ${(supplierUser as any).suppliers?.org_number || 'SAKNAS!'}`);
  } else {
    console.log('   ✗ User is NOT a SELLER (not in supplier_users)');
    console.log('   → Behöver läggas till som leverantörsanvändare');
  }

  // Step 3: Check importers
  console.log('\n📍 Step 3: Checking importers...');
  const { data: importers } = await supabase
    .from('importers')
    .select('*')
    .eq('tenant_id', TENANT_ID);

  if (importers && importers.length > 0) {
    console.log(`   Found ${importers.length} importer(s):`);
    importers.forEach(imp => {
      console.log(`   - ${imp.legal_name} (org: ${imp.org_number})`);
    });
  } else {
    console.log('   ✗ No importers found');
  }

  // Step 4: Check org_number matching
  console.log('\n📍 Step 4: Checking org_number matching...');
  if (supplierUser && (supplierUser as any).suppliers?.org_number) {
    const supplierOrg = (supplierUser as any).suppliers.org_number;
    const matchingImporter = importers?.find(i => i.org_number === supplierOrg);

    if (matchingImporter) {
      console.log(`   ✓ MATCH! Supplier org ${supplierOrg} = Importer ${matchingImporter.legal_name}`);
      console.log('   → User should have IOR role!');
    } else {
      console.log(`   ✗ No matching importer for org_number: ${supplierOrg}`);
    }
  } else {
    console.log('   ✗ Cannot check - supplier has no org_number');
  }

  // Step 5: Offer to fix
  console.log('\n════════════════════════════════════════');
  console.log('🔧 FIX OPTIONS');
  console.log('════════════════════════════════════════\n');

  if (!supplierUser) {
    console.log('Option A: Create supplier_user mapping');
    console.log('─────────────────────────────────────────');

    // Find a supplier with org_number
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id, namn, org_number')
      .not('org_number', 'is', null)
      .limit(5);

    if (suppliers && suppliers.length > 0) {
      console.log('Available suppliers with org_number:');
      suppliers.forEach(s => console.log(`  - ${s.namn} (${s.id})`));
      console.log('\nRun this SQL to add user as seller:');
      console.log(`INSERT INTO supplier_users (user_id, supplier_id) VALUES ('${userId}', '<supplier_id>');`);
    } else {
      console.log('No suppliers with org_number found. Need to create one first.');
    }
  }

  if (supplierUser && !(supplierUser as any).suppliers?.org_number) {
    console.log('Option B: Add org_number to supplier');
    console.log('─────────────────────────────────────────');
    console.log(`UPDATE suppliers SET org_number = '${ORG_NUMBER}' WHERE id = '${supplierUser.supplier_id}';`);
  }

  if (!importers || importers.length === 0) {
    console.log('\nOption C: Create importer');
    console.log('─────────────────────────────────────────');
    console.log(`INSERT INTO importers (tenant_id, legal_name, org_number, license_number, contact_name, contact_email)`);
    console.log(`VALUES ('${TENANT_ID}', 'Winefeed Import AB', '${ORG_NUMBER}', 'LIC-001', 'Admin', 'admin@winefeed.se');`);
  }

  console.log('\n════════════════════════════════════════');
  console.log('Run with --fix to apply changes automatically');
  console.log('════════════════════════════════════════\n');

  // Auto-fix if --fix flag
  if (process.argv.includes('--fix')) {
    console.log('🔧 APPLYING FIXES...\n');
    await applyFixes(userId, supplierUser, importers || []);
  }
}

async function applyFixes(userId: string, supplierUser: any, importers: any[]) {
  // Strategy: Find or create supplier with matching org_number to an importer
  // This gives the user IOR role via org_number matching

  // 1. Get existing importer's org_number, or create an importer
  let targetOrgNumber: string;
  let importerId: string;

  if (importers && importers.length > 0) {
    targetOrgNumber = importers[0].org_number;
    importerId = importers[0].id;
    console.log(`   Using existing importer: ${importers[0].legal_name} (org: ${targetOrgNumber})`);
  } else {
    // Create new importer
    console.log('Creating importer...');
    const { data: newImporter, error } = await supabase
      .from('importers')
      .insert({
        tenant_id: TENANT_ID,
        legal_name: 'Winefeed Import AB',
        org_number: ORG_NUMBER,
        license_number: 'LIC-2026-001',
        contact_name: 'Admin',
        contact_email: 'admin@winefeed.se'
      })
      .select()
      .single();

    if (error) {
      console.log(`   ✗ Failed to create importer: ${error.message}`);
      return;
    }
    console.log(`   ✓ Created importer: ${newImporter.legal_name}`);
    targetOrgNumber = ORG_NUMBER;
    importerId = newImporter.id;
  }

  // 2. Find or setup supplier with matching org_number
  let supplierId: string;

  if (supplierUser) {
    supplierId = supplierUser.supplier_id;
    const currentOrg = (supplierUser as any).suppliers?.org_number;

    // Update org_number to match importer if different
    if (currentOrg !== targetOrgNumber) {
      const { error } = await supabase
        .from('suppliers')
        .update({ org_number: targetOrgNumber })
        .eq('id', supplierId);

      if (error) {
        console.log(`   ✗ Failed to update supplier org_number: ${error.message}`);
      } else {
        console.log(`   ✓ Updated supplier org_number: ${currentOrg || 'null'} → ${targetOrgNumber}`);
      }
    } else {
      console.log(`   ✓ Supplier already has matching org_number: ${targetOrgNumber}`);
    }
  } else {
    // User is not a seller - find supplier with matching org_number or update one
    const { data: matchingSupplier } = await supabase
      .from('suppliers')
      .select('id, namn')
      .eq('org_number', targetOrgNumber)
      .single();

    if (matchingSupplier) {
      supplierId = matchingSupplier.id;
      console.log(`   Using supplier with matching org: ${matchingSupplier.namn}`);
    } else {
      // Find any supplier and update its org_number
      const { data: anySupplier } = await supabase
        .from('suppliers')
        .select('id, namn')
        .limit(1)
        .single();

      if (anySupplier) {
        supplierId = anySupplier.id;
        const { error } = await supabase
          .from('suppliers')
          .update({ org_number: targetOrgNumber })
          .eq('id', supplierId);

        if (error) {
          console.log(`   ✗ Failed to update supplier: ${error.message}`);
          return;
        }
        console.log(`   ✓ Updated ${anySupplier.namn} org_number to ${targetOrgNumber}`);
      } else {
        // No suppliers exist - create one
        const { data: newSupplier, error } = await supabase
          .from('suppliers')
          .insert({
            tenant_id: TENANT_ID,
            namn: 'IOR Demo Supplier',
            org_number: targetOrgNumber,
            type: 'SWEDISH_IMPORTER',
            kontakt_email: 'ior@winefeed.se',
            is_active: true
          })
          .select()
          .single();

        if (error) {
          console.log(`   ✗ Failed to create supplier: ${error.message}`);
          return;
        }
        supplierId = newSupplier.id;
        console.log(`   ✓ Created supplier: ${newSupplier.namn}`);
      }
    }

    // Create supplier_user mapping (id = user's auth.users id)
    const { error: mapError } = await supabase
      .from('supplier_users')
      .upsert({
        id: userId,  // Primary key = auth.users.id
        supplier_id: supplierId
      });

    if (mapError) {
      console.log(`   ✗ Failed to map user to supplier: ${mapError.message}`);
    } else {
      console.log(`   ✓ Mapped user to supplier`);
    }
  }

  console.log('\n════════════════════════════════════════');
  console.log('✅ DONE! User should now have IOR access.');
  console.log('════════════════════════════════════════\n');
}

main().catch(console.error);
