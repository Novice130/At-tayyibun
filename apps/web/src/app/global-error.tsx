'use client';

export default function GlobalError() {
  return (
    <html>
      <body style={{ margin: 0, background: '#0f0f1a', color: '#ffffff', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '24px', textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '28px' }}>Something went wrong</h1>
          <p style={{ margin: 0, color: '#a0a0b8' }}>
            An unexpected error occurred. Please refresh the page, or return to the home page.
          </p>
          <a
            href="/"
            style={{ display: 'inline-block', marginTop: '8px', padding: '12px 32px', borderRadius: '8px', background: '#D4AF37', color: '#1a1a2e', fontWeight: 700, textDecoration: 'none' }}
          >
            Back to At-Tayyibun
          </a>
        </div>
      </body>
    </html>
  );
}
