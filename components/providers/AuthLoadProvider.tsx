"use client";

import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch } from "@/lib/store";
import {
    TypedUseSelectorHook,
    useDispatch as useReduxDispatch,
    useSelector as useReduxSelector,
} from "react-redux";
import { refreshSession, loadFromStorage } from "@/lib/slices/authSlice";
import type { RootState } from "@/lib/store";

const useAppDispatch = () => useReduxDispatch<AppDispatch>();
const useAppSelector: TypedUseSelectorHook<RootState> = useReduxSelector;

export function AuthLoadProvider({ children }: { children: React.ReactNode }) {
    const dispatch = useAppDispatch();
    const { token, loading } = useAppSelector((state: RootState) => state.auth);
    const hasInitialized = useRef(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Load auth state from storage on mount
        dispatch(loadFromStorage());
        // We will refresh session after loading from storage in a separate effect
    }, [dispatch]);

    // Separate effect to refresh session if token is present after loading from storage
    useEffect(() => {
        if (!token) {
            // Clear interval if token is removed
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            hasInitialized.current = false;
            return;
        }

        // Prevent duplicate calls on initial mount (React Strict Mode)
        if (!hasInitialized.current) {
            hasInitialized.current = true;
            // Refresh on mount
            dispatch(refreshSession(token));
        }

        // Set up interval for periodic refresh
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        intervalRef.current = setInterval(() => {
            if (token) {
                dispatch(refreshSession(token));
            }
        }, 1800000); // 30 minutes

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [dispatch, token]);

    // Return null while loading to prevent auth checks
    if (loading) {
        return null;
    }

    return <>{children}</>;
}
