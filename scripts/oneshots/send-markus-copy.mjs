import { Resend } from 'resend';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const resend = new Resend(env.RESEND_API_KEY);

// Fetch the original email's HTML/text from Resend
const r = await fetch('https://api.resend.com/emails/c609dbe0-2b01-497d-87f7-a50f9fe27681', {
  headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` }
});
const orig = await r.json();

const { data, error } = await resend.emails.send({
  from: 'Winefeed <noreply@winefeed.se>',
  to: ['markus@winefeed.se', 'markus_nilsson@hotmail.com'],
  subject: 'KOPIA av sänt mail: ' + orig.subject,
  html: `<div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
    <div style="background: #f5f5f5; padding: 12px; border-radius: 6px; font-size: 13px; margin-bottom: 20px; color: #555;">
      <strong>Detta är en kopia av mailet du skickade idag kl 21:28</strong><br>
      Skickat: 2026-05-07 19:28 UTC<br>
      Till: ${orig.to.join(', ')}<br>
      CC: ${orig.cc.join(', ')}<br>
      Resend-id: ${orig.id} · status: ${orig.last_event}
    </div>
    ${orig.html}
  </div>`,
  text: `KOPIA av sänt mail (id ${orig.id}, status ${orig.last_event})\nTill: ${orig.to.join(', ')}\nCC: ${orig.cc.join(', ')}\n\n---\n\n${orig.text || '(no text version)'}`,
});
if (error) { console.error(error); process.exit(1); }
console.log('Copy sent to markus@winefeed.se + markus_nilsson@hotmail.com:', data.id);
