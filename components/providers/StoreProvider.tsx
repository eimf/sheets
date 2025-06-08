'use client';

import { useRef, useEffect } from 'react';
import { Provider } from 'react-redux';
import { store } from '@/lib/store';
import { loadFromStorage } from '@/lib/slices/authSlice';

export default function StoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      store.dispatch(loadFromStorage());
      initialized.current = true;
    }
  }, []);

  return <Provider store={store}>{children}</Provider>;
}