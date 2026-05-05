/**
 * Skapar Resend Audience "Winefeed B2B Nurture" för restauranger
 * som tackat nej men kan vara varma längre fram. Idempotent — kollar
 * om den redan finns.
 *
 * Lägger inte till några kontakter — det görs separat per opt-in.
 */
import { config } from 'dotenv';
import { Resend } from 'resend';

config({ path: '.env.local' });

const resend = new Resend(process.env.RESEND_API_KEY);

const NAME = 'Winefeed B2B Nurture';

console.log('🔍 Letar befintlig audience...');
const { data: list, error: listErr } = await resend.audiences.list();
if (listErr) {
  console.error('❌', listErr);
  process.exit(1);
}

const existing = (list?.data || []).find(a => a.name === NAME);
if (existing) {
  console.log(`✓ Finns redan: ${existing.name} (id ${existing.id})`);
} else {
  const { data: created, error: createErr } = await resend.audiences.create({ name: NAME });
  if (createErr) {
    console.error('❌', createErr);
    process.exit(1);
  }
  console.log(`✓ Skapad: ${created.name} (id ${created.id})`);
}

console.log('\nNästa steg: lägg till kontakter via opt-in-mejl per case.');
console.log('Resend Audience används av framtida newsletter-script.');
