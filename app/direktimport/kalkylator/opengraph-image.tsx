import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Direktimport-kalkylator för vin — Winefeed';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '70px 80px',
          background: 'linear-gradient(135deg, #722F37 0%, #4A1A1F 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex' }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: '#f2e2b6', marginRight: -6 }} />
            <div style={{ width: 28, height: 28, borderRadius: 14, background: '#f1b4b0', marginRight: -6 }} />
            <div style={{ width: 28, height: 28, borderRadius: 14, background: '#ffffff' }} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 2 }}>WINEFEED</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              fontSize: 22,
              textTransform: 'uppercase',
              letterSpacing: 4,
              color: '#f1b4b0',
              fontWeight: 600,
            }}
          >
            Direktimport-kalkylator
          </div>
          <div
            style={{
              fontSize: 88,
              fontWeight: 400,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              maxWidth: 920,
            }}
          >
            Vad kostar vinet{' '}
            <span style={{ fontStyle: 'italic', color: '#f1b4b0' }}>landat i Sverige?</span>
          </div>
          <div style={{ fontSize: 26, color: 'rgba(255,255,255,0.78)', maxWidth: 900, lineHeight: 1.4 }}>
            Producentpris · Frakt · Alkoholskatt · Importörspåslag · Moms
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 20,
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          <span>winefeed.se/direktimport/kalkylator</span>
          <span>Gratis verktyg för restauranger</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
