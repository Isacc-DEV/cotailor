import type { Metadata } from 'next';
import AuthGate from './AuthGate';
import './globals.css';
import './admin.css';

export const metadata: Metadata = {
  title: 'CoTailor Admin',
  description: 'Manage the CoTailor role taxonomy and certifications.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
