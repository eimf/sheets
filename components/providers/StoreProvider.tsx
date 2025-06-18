'use client';

import { useRef, useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { store } from '@/lib/store';
import { loadFromStorage } from '@/lib/slices/authSlice';

export default function StoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialized = useRef(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (!store) {
      console.error("CRITICAL: Redux store is null or undefined in StoreProvider useEffect.");
      // Potentially throw an error here or handle it more gracefully
      // This indicates a fundamental issue with store initialization.
    } else if (!initialized.current) {
      store.dispatch(loadFromStorage());
      initialized.current = true;
    }
  }, []); // Empty dependency array ensures this runs once on mount

  if (!isMounted) {
    // While not mounted, you can return null or a loading spinner
    // Returning null ensures children (and thus Redux-dependent components) don't render prematurely
    return null;
  }

  if (!store) {
    // This check is crucial. If store is not available even after mount, something is very wrong.
    console.error("CRITICAL: Redux store is null or undefined before rendering Provider.");
    // Render children without Provider, or a fallback UI, or throw an error.
    // Forcing an error here might give a more direct clue if this path is hit.
    // throw new Error("Redux store is not available in StoreProvider!"); 
    return <>{children}</>; // Or some error boundary / fallback
  }

  return <Provider store={store}>{children}</Provider>;
}