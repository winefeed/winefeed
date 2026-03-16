import { config } from 'dotenv';
config({ path: '.env.local' });

// Register path aliases
import { register } from 'tsconfig-paths';
import { readFileSync } from 'fs';
const tsconfig = JSON.parse(readFileSync('./tsconfig.json', 'utf-8'));
register({ baseUrl: '.', paths: tsconfig.compilerOptions.paths || {} });

import { buildDailyDigest } from '../lib/daily-digest-service.js';
import { dailyDigestEmail } from '../lib/email-templates.js';
import { sendEmail, WINEFEED_FROM } from '../lib/email-service.js';

async function main() {
  console.log('Building digest...');
  const data = await buildDailyDigest();
  console.log('Briefing:', data.briefing.substring(0, 200));
  console.log('Wine Intel:', data.wineIntel.substring(0, 200));

  const { subject, html, text } = dailyDigestEmail(data);
  console.log('Subject:', subject);

  const result = await sendEmail({
    to: 'markus@winefeed.se',
    subject,
    html,
    text,
    from: WINEFEED_FROM,
  });
  console.log('Email sent:', result);
}

main().catch(console.error);
