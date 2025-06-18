import type { AppProps } from 'next/app';
import StoreProvider from '@/components/providers/StoreProvider';
import { AuthLoadProvider } from '@/components/providers/AuthLoadProvider';
import { Toaster } from '@/components/ui/sonner';
import '@/app/globals.css'; // Assuming your global styles are here

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <StoreProvider>
      <AuthLoadProvider>
        <Component {...pageProps} />
        <Toaster />
      </AuthLoadProvider>
    </StoreProvider>
  );
}

export default MyApp;
