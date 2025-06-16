// Root layout is a Server Component (no "use client")
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import StoreProvider from '@/components/providers/StoreProvider';
import { AuthLoadProvider } from '@/components/providers/AuthLoadProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Tableau de Katia - Salon Management',
  description: 'Professional salon service logging and management system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <StoreProvider>
          <AuthLoadProvider>
            {children}
            <Toaster />
          </AuthLoadProvider>
        </StoreProvider>
      </body>
    </html>
  );
}