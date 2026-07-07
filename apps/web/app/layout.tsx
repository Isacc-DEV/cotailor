import './globals.css';
import type { ReactNode } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Footer } from './components/layout/Footer';
import { SessionProvider } from './context/SessionContext';
import { AuthGate } from './components/AuthGate';
import { ThemeInitializer } from './components/ThemeInitializer';
import { THEME_INIT_SCRIPT } from '@/lib/theme';

export const metadata = {
  title: 'CoTailor',
  description: 'Collaborative AI resume tailoring agent',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the pre-paint script sets data-theme before
    // React hydrates, so the server (no attribute) and client differ by design.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="app-layout">
        <ThemeInitializer />
        <SessionProvider>
          <Sidebar />
          <main className="app-main">
            <AuthGate>{children}</AuthGate>
          </main>
          <Footer />
        </SessionProvider>
      </body>
    </html>
  );
}
