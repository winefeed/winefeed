/**
 * NAVIGATION VERIFICATION SCRIPT
 *
 * Prints out navigation configuration for different role combinations
 * to verify that role-based filtering works correctly
 *
 * Usage: npx tsx scripts/verify-navigation.ts
 */

import { getMainNavigation, getAdminNavigation, MAIN_NAVIGATION, ADMIN_NAVIGATION } from '../lib/navigation';
import type { ActorRole } from '../lib/actor-service';

// Test role combinations
const testCases: { name: string; roles: ActorRole[] }[] = [
  { name: 'No Roles', roles: [] },
  { name: 'RESTAURANT Only', roles: ['RESTAURANT'] },
  { name: 'SELLER Only', roles: ['SELLER'] },
  { name: 'IOR Only', roles: ['IOR'] },
  { name: 'ADMIN Only', roles: ['ADMIN'] },
  { name: 'RESTAURANT + SELLER', roles: ['RESTAURANT', 'SELLER'] },
  { name: 'RESTAURANT + SELLER + IOR', roles: ['RESTAURANT', 'SELLER', 'IOR'] },
  { name: 'All Roles', roles: ['RESTAURANT', 'SELLER', 'IOR', 'ADMIN'] },
];

console.log('═══════════════════════════════════════════════════════════');
console.log('NAVIGATION CONFIGURATION VERIFICATION');
console.log('═══════════════════════════════════════════════════════════\n');

// Print full navigation config
console.log('📋 FULL NAVIGATION CONFIG\n');
console.log('MAIN_NAVIGATION:');
MAIN_NAVIGATION.forEach((section, idx) => {
  if (section.title) {
    console.log(`\n  Section ${idx + 1}: ${section.title}`);
  } else {
    console.log(`\n  Section ${idx + 1}:`);
  }
  section.items.forEach((item) => {
    const roles = item.roles ? `[${item.roles.join(', ')}]` : '[All users]';
    console.log(`    - ${item.label} → ${item.href} ${roles}`);
  });
});

console.log('\n\nADMIN_NAVIGATION:');
ADMIN_NAVIGATION.forEach((section, idx) => {
  if (section.title) {
    console.log(`\n  Section ${idx + 1}: ${section.title}`);
  } else {
    console.log(`\n  Section ${idx + 1}:`);
  }
  section.items.forEach((item) => {
    console.log(`    - ${item.label} → ${item.href}`);
  });
});

console.log('\n\n═══════════════════════════════════════════════════════════');
console.log('ROLE-BASED FILTERING TEST\n');

// Test each role combination
testCases.forEach(({ name, roles }) => {
  console.log(`\n🧪 Test Case: ${name}`);
  console.log(`   Roles: [${roles.join(', ') || 'None'}]\n`);

  // Get main navigation
  const mainNav = getMainNavigation(roles);
  console.log('   Dashboard Navigation:');
  if (mainNav.length === 0) {
    console.log('     (No menu items)');
  } else {
    mainNav.forEach((section) => {
      section.items.forEach((item) => {
        console.log(`     ✓ ${item.label}`);
      });
    });
  }

  // Get admin navigation
  const adminNav = getAdminNavigation(roles);
  console.log('\n   Admin Navigation:');
  if (adminNav.length === 0) {
    console.log('     (Access Denied - Not Admin)');
  } else {
    adminNav.forEach((section) => {
      section.items.forEach((item) => {
        console.log(`     ✓ ${item.label}`);
      });
    });
  }

  console.log('');
});

console.log('═══════════════════════════════════════════════════════════');
console.log('VERIFICATION SUMMARY\n');

// Count items per role
const itemCounts = testCases.map(({ name, roles }) => {
  const mainNav = getMainNavigation(roles);
  const adminNav = getAdminNavigation(roles);
  const mainCount = mainNav.reduce((sum, section) => sum + section.items.length, 0);
  const adminCount = adminNav.reduce((sum, section) => sum + section.items.length, 0);
  return { name, roles, mainCount, adminCount };
});

console.log('Menu Item Counts:\n');
itemCounts.forEach(({ name, mainCount, adminCount }) => {
  console.log(`  ${name}:`);
  console.log(`    Dashboard: ${mainCount} items`);
  console.log(`    Admin: ${adminCount} items`);
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log('✅ Verification Complete\n');
