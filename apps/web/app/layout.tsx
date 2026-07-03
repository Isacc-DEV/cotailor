import './globals.css';
import type { ReactNode } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Footer } from './components/layout/Footer';
import { SessionProvider } from './context/SessionContext';

export const metadata = {
  title: 'CoTailor',
  description: 'Collaborative AI resume tailoring agent',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="app-layout">
        <SessionProvider>
          <Header />
          <Sidebar />
          <main className="app-main">{children}</main>
          <Footer />
        </SessionProvider>
      </body>
    </html>
  );
}
