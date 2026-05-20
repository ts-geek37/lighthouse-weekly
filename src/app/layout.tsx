import type { Metadata } from 'next';
import './globals.css';

interface RootLayoutProps {
  children: React.ReactNode;
}

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
}

export const metadata: Metadata = {
  title: 'Lighthouse Monitor',
  description: 'Weekly website performance monitoring',
};

const RootLayout = ({ children }: RootLayoutProps) => {
  return (
    <html lang="en">
      <body className="m-0 min-h-screen bg-[#f5f6f8] font-sans antialiased">
        <nav className="sticky top-0 z-[100] flex h-14 items-center gap-6 border-b border-gray-200 bg-white px-4 sm:px-8">
          <a href="/" className="flex shrink-0 items-center gap-1.5 text-[0.95rem] font-bold text-gray-900 no-underline">
            🔦 Lighthouse Monitor
          </a>
          <div className="flex flex-1 items-center gap-1">
            <NavLink href="/projects">Projects</NavLink>
            <NavLink href="/audits">Audits</NavLink>
          </div>
          <a
            href="/audits/new"
            className="shrink-0 rounded-md bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white no-underline transition hover:bg-blue-700"
          >
            ▶ Run Audit
          </a>
        </nav>
        <main className="min-h-[calc(100vh-56px)]">
          {children}
        </main>
      </body>
    </html>
  );
};

const NavLink = ({ href, children }: NavLinkProps) => {
  return (
    <a
      href={href}
      className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 no-underline transition hover:bg-gray-100 hover:text-gray-950"
    >
      {children}
    </a>
  );
};

export default RootLayout;
