'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '@/lib/store';
import { TypedUseSelectorHook, useDispatch as useReduxDispatch, useSelector as useReduxSelector } from 'react-redux';
import { refreshSession, loadFromStorage } from '@/lib/slices/authSlice';
import type { RootState } from '@/lib/store';

const useAppDispatch = () => useReduxDispatch<AppDispatch>();
const useAppSelector: TypedUseSelectorHook<RootState> = useReduxSelector;

export function AuthLoadProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const { token, loading } = useAppSelector((state: RootState) => state.auth);

  useEffect(() => {
    // Load auth state from storage on mount
    dispatch(loadFromStorage());

    // Set up session refresh if we have a token
    if (token) {
      // Refresh session periodically
      const interval = setInterval(() => {
        dispatch(refreshSession(token));
      }, 300000); // Refresh every 5 minutes

      // Refresh on mount
      dispatch(refreshSession(token));

      return () => clearInterval(interval);
    }
  }, [dispatch, token]);

  // Return null while loading to prevent auth checks
  if (loading) {
    return null;
  }

  return <>{children}</>;
}
