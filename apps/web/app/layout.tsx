import './globals.css';
import type { ReactNode } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Footer } from './components/layout/Footer';
import { SessionProvider } from './context/SessionContext';
import { AuthGate } from './components/AuthGate';

export const metadata = {
  title: 'CoTailor',
  description: 'Collaborative AI resume tailoring agent',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="app-layout">
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
