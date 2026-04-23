import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Lighthouse Monitor',
  description: 'Weekly website performance monitoring',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#fafafa', minHeight: '100vh' }}>
        <nav style={{
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
          padding: '0 2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '2rem',
          height: '56px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}>
          <a href="/" style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            🔦 Lighthouse Monitor
          </a>
          <div style={{ display: 'flex', gap: '0.25rem', flex: 1 }}>
            <NavLink href="/projects">Projects</NavLink>
            <NavLink href="/audits">Audits</NavLink>
            <NavLink href="/audits/new">▶ Run Audit</NavLink>
          </div>
        </nav>
        <main style={{ minHeight: 'calc(100vh - 56px)' }}>
          {children}
        </main>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      style={{
        padding: '0.4rem 0.75rem',
        borderRadius: '6px',
        textDecoration: 'none',
        color: '#374151',
        fontSize: '0.875rem',
        fontWeight: 500,
      }}
    >
      {children}
    </a>
  );
}
