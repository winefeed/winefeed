/**
 * Test script: Run daily digest manually
 * Usage: npx tsx scripts/test-daily-digest.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

async function main() {
  // Dynamic imports to ensure env is loaded first
  const { buildDailyDigest } = await import('../lib/daily-digest-service');
  const { dailyDigestEmail } = await import('../lib/email-templates');
  const { sendEmail, WINEFEED_FROM } = await import('../lib/email-service');

  console.log('Building daily digest...');
  const data = await buildDailyDigest();

  console.log('\n--- DIGEST DATA ---');
  console.log(JSON.stringify({
    newOrders: data.newOrders.length,
    newOffers: data.newOffers.length,
    newRequests: data.newRequests.length,
    newWines: data.newWines.length,
    newSuppliers: data.newSuppliers.length,
    newRestaurants: data.newRestaurants.length,
    actions: data.actions.length,
    totals: data.totals,
  }, null, 2));

  if (data.actions.length > 0) {
    console.log('\n--- ACTIONS ---');
    for (const a of data.actions) {
      console.log(`  [${a.type}] ${a.message}`);
    }
  }

  const { subject, html, text } = dailyDigestEmail(data);
  console.log(`\nSubject: ${subject}`);

  console.log('\nSending email to markus@winefeed.se...');
  const result = await sendEmail({
    to: 'markus@winefeed.se',
    subject,
    html,
    text,
    from: WINEFEED_FROM,
  });

  console.log('Result:', result);
  process.exit(0);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
