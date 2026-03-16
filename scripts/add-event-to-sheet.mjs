/**
 * Add event to Google Sheets via Apps Script
 *
 * Usage: node scripts/add-event-to-sheet.mjs
 *
 * Requires GOOGLE_EVENT_SHEET_URL in .env.local
 */

import 'dotenv/config';

const SHEET_URL = process.env.GOOGLE_EVENT_SHEET_URL;

if (!SHEET_URL) {
  console.error('Missing GOOGLE_EVENT_SHEET_URL in .env.local');
  process.exit(1);
}

// Event data — edit this or pass via stdin
const event = JSON.parse(process.argv[2] || '{}');

if (!event.titel) {
  console.error('Usage: node scripts/add-event-to-sheet.mjs \'{"titel":"...","vard":"...",...}\'');
  process.exit(1);
}

const res = await fetch(SHEET_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(event),
});

const result = await res.json();
console.log(result.success ? `✓ Event "${event.titel}" added to sheet` : `✗ Error: ${result.error}`);
