/**
 * Skickar preview-mejl till Corentin (Brasri) om planen för Mario / Pontus.
 * Använder Winefeed-brandmall så Corentin ser samma format som Mario får.
 */
import { config } from 'dotenv';
import { Resend } from 'resend';

config({ path: '.env.local' });

const resend = new Resend(process.env.RESEND_API_KEY);

const TO = 'corentin@brasri.com';
const BCC = 'markus@winefeed.se';
const FROM = 'Markus på Winefeed <markus@winefeed.se>';
const REPLY_TO = 'markus@winefeed.se';
const SUBJECT = 'Plan for Mario / Pontus — old Bordeaux list preview';

function brandHeader() {
  return `<div style="max-width:600px;margin:0 auto;"><div style="background:linear-gradient(135deg,#722F37 0%,#8B3A42 100%);padding:28px 20px;text-align:center;border-radius:8px 8px 0 0;"><div style="display:inline-block;"><span style="display:inline-block;width:10px;height:10px;background:#E8DFC4;transform:rotate(45deg);margin-right:-3px;opacity:0.85;"></span><span style="display:inline-block;width:12px;height:12px;background:#E8B4B8;transform:rotate(45deg);margin-right:-3px;opacity:0.8;"></span><span style="display:inline-block;width:10px;height:10px;background:rgba(255,255,255,0.9);transform:rotate(45deg);margin-right:10px;"></span><span style="font-size:26px;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;vertical-align:middle;"><span style="font-weight:700;">wine</span><span style="font-weight:300;">feed</span></span></div><p style="color:rgba(255,255,255,0.5);margin:5px 0 0 0;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;">SOURCE &amp; SERVE</p></div><div style="height:3px;background:linear-gradient(90deg,#E8DFC4 0%,#E8B4B8 50%,#722F37 100%);"></div><div style="background:white;padding:30px;font-family:'Plus Jakarta Sans',sans-serif;color:#161412;line-height:1.6;font-size:15px;">`;
}
function brandFooter() {
  return `</div><div style="background:#E8DFC4;padding:20px;text-align:center;border-radius:0 0 8px 8px;"><p style="margin:0;color:#722F37;font-size:12px;font-weight:500;">Winefeed – Din B2B-marknadsplats för vin</p></div></div>`;
}

const tableRows = [
  ['Tour Calon', '1958', '750 ml', 'Bordeaux AOC', '229 kr'],
  ['Tour Calon', '1982', '750 ml', 'Bordeaux AOC', '309 kr'],
  ['Tour Calon', '1989', '1500 ml', 'Bordeaux AOC', '789 kr'],
  ['Tour Calon', '2005', '750 ml', 'Bordeaux AOC', '309 kr'],
  ['Bonalgue Bel-Air', '1989', '750 ml', 'Pomerol', '529 kr'],
  ['Bonalgue Bel-Air', '2000', '750 ml', 'Pomerol', '479 kr'],
  ['Lateyron', 'NV', '750 ml', 'Bordeaux AOC', '150 kr'],
  ['La Serenite', '2001', '750 ml', 'Pessac-Léognan', '500 kr'],
  ['Climens', '2005', '750 ml', 'Barsac', '1 200 kr'],
  ['Coutet', '2005', '750 ml', 'Barsac', '490 kr'],
  ['Gruaud Larose', '2003', '750 ml', 'Saint-Julien', '1 060 kr'],
  ['Haut Brion', '2001', '750 ml', 'Pessac-Léognan', '6 310 kr'],
  ['Cheval Blanc', '1999', '750 ml', 'Saint-Émilion GC', '7 380 kr'],
  ['Lafite Rothschild', '1982', '6000 ml (Imperial)', 'Pauillac', '473 060 kr'],
  ['Petrus', '1988', '1500 ml (Magnum)', 'Pomerol', '73 710 kr'],
  ['Petrus', '2003', '3000 ml (Jeroboam)', 'Pomerol', '436 560 kr'],
  ['Le Pin', '2005', '750 ml', 'Pomerol', '48 700 kr'],
  ['Mouton-Rothschild', '05/09/14 mixed case', '6×750 ml', 'Pauillac', '33 230 kr'],
];

const tableHtml = `<table style="border-collapse:collapse;width:100%;font-size:13px;margin:8px 0 18px 0;">
  <thead><tr style="background:#f4f0e8;">
    <th style="text-align:left;padding:8px 10px;border-bottom:1px solid #d8d4d3;">Producer</th>
    <th style="text-align:left;padding:8px 10px;border-bottom:1px solid #d8d4d3;">Vintage</th>
    <th style="text-align:left;padding:8px 10px;border-bottom:1px solid #d8d4d3;">Format</th>
    <th style="text-align:left;padding:8px 10px;border-bottom:1px solid #d8d4d3;">Region</th>
    <th style="text-align:right;padding:8px 10px;border-bottom:1px solid #d8d4d3;">Price ex VAT</th>
  </tr></thead>
  <tbody>${tableRows.map(r => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;">${r[0]}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;">${r[1]}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;">${r[2]}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;">${r[3]}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-variant-numeric:tabular-nums;">${r[4]}</td></tr>`).join('')}</tbody>
</table>`;

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${SUBJECT}</title></head><body style="margin:0;padding:0;background:#f9fafb;">
${brandHeader()}
<p style="margin:0 0 18px 0;">Hi Corentin,</p>
<p style="margin:0 0 18px 0;">Thanks for the intro to Mario! Before I reach out, here's how I'm planning to do it so you can give me feedback if anything feels off.</p>
<p style="margin:0 0 12px 0;"><strong>The plan:</strong></p>
<ol style="margin:0 0 18px 0;padding-left:22px;">
  <li style="margin-bottom:6px;">Set up Pontus Frithiof city venues as a restaurant account on Winefeed (org 556600-5293)</li>
  <li style="margin-bottom:6px;">Create a login for Mario with a temp password</li>
  <li style="margin-bottom:6px;">Pre-prepare a search query "old French Bordeaux ≤ 2005, all price tiers" so when he logs in he lands on a ready-made results page</li>
  <li style="margin-bottom:6px;">Email him the link + login details — one click and he sees 91 vintages from 26 producers, with prices, stock and MOQ visible (since he's logged in as a verified restaurant)</li>
</ol>
<p style="margin:0 0 8px 0;"><strong>Sample of what he'll see</strong> (excerpt — full list is 91 entries):</p>
${tableHtml}
<p style="margin:0 0 18px 0;"><strong>26 producers in total</strong>, from affordable Tour-Calon stretches across 1958–2005 (149–309 kr) all the way up to Petrus, Lafite Imperial, Le Pin and Mouton-Rothschild collector cases. Roughly half the catalogue is in the 150–600 kr range — solid story-bottles for menu use — the rest are trophy bottles for cellar / by-the-glass at fine-dining tier.</p>
<p style="margin:0 0 12px 0;">A few things I want to check with you before sending:</p>
<ol style="margin:0 0 18px 0;padding-left:22px;">
  <li style="margin-bottom:6px;">Is the price level OK to share at this stage, or do you want me to share a narrower range first?</li>
  <li style="margin-bottom:6px;">Anything Mario should know about provenance / cellar conditions for the older bottles? I noticed he's interested in 30+ year stuff — are these all from the same cellar as Tour-Calon, or mixed sources?</li>
  <li style="margin-bottom:6px;">Any specific producers you'd push or de-emphasise based on what you know about Pontus' restaurants?</li>
</ol>
<p style="margin:0 0 18px 0;">I'll wait for your green light before reaching out to Mario.</p>
<p style="margin:24px 0 4px 0;">Best,</p>
<p style="margin:0;"><strong>Markus</strong></p>
<p style="margin:4px 0 0 0;"><a href="https://winefeed.se" style="color:#722F37;text-decoration:underline;">winefeed.se</a></p>
${brandFooter()}
</body></html>`;

const text = `Hi Corentin,

Thanks for the intro to Mario! Before I reach out, here's how I'm planning to do it so you can give me feedback if anything feels off.

THE PLAN:
1. Set up Pontus Frithiof city venues as a restaurant account on Winefeed (org 556600-5293)
2. Create a login for Mario with a temp password
3. Pre-prepare a search query "old French Bordeaux ≤ 2005, all price tiers" so when he logs in he lands on a ready-made results page
4. Email him the link + login details — one click and he sees 91 vintages from 26 producers, with prices, stock and MOQ visible (since he's logged in as a verified restaurant)

SAMPLE OF WHAT HE'LL SEE (excerpt — full list is 91 entries):

${tableRows.map(r => `- ${r[0]} ${r[1]} ${r[2]} ${r[3]} — ${r[4]} ex VAT`).join('\n')}

26 producers in total, from affordable Tour-Calon stretches across 1958–2005 (149–309 kr) all the way up to Petrus, Lafite Imperial, Le Pin and Mouton-Rothschild collector cases. Roughly half the catalogue is in the 150–600 kr range — solid story-bottles for menu use — the rest are trophy bottles for cellar / by-the-glass at fine-dining tier.

A few things I want to check with you before sending:
1. Is the price level OK to share at this stage, or do you want me to share a narrower range first?
2. Anything Mario should know about provenance / cellar conditions for the older bottles? I noticed he's interested in 30+ year stuff — are these all from the same cellar as Tour-Calon, or mixed sources?
3. Any specific producers you'd push or de-emphasise based on what you know about Pontus' restaurants?

I'll wait for your green light before reaching out to Mario.

Best,
Markus
winefeed.se`;

console.log('📧 Skickar preview till Corentin');
console.log(`   To: ${TO}`);
console.log(`   BCC: ${BCC}`);
console.log(`   Subject: ${SUBJECT}`);

const { data, error } = await resend.emails.send({ from: FROM, to: TO, bcc: BCC, reply_to: REPLY_TO, subject: SUBJECT, html, text });
if (error) { console.error('❌', error); process.exit(1); }
console.log(`✅ Skickat. Resend ID: ${data.id}`);
