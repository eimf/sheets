import { Middleware } from '@reduxjs/toolkit';
import { loadFromStorage, setCredentials, logout, refreshSession } from '../slices/authSlice';

// Define a minimal type for the state parts authMiddleware needs
interface AuthMiddlewareState {
  auth: {
    token: string | null;
    loading: boolean;
    // Add other fields from AuthState if needed by the middleware
  };
  // Add other slices if the middleware ever needs them
}

import { AnyAction, MiddlewareAPI, Dispatch, ThunkDispatch } from '@reduxjs/toolkit'; // Import necessary types

// ... (interface AuthMiddlewareState remains the same)

let refreshTimeoutId: NodeJS.Timeout | null = null;

// Define a more specific type for the dispatch if needed, or use a general one that supports thunks.
// AppDispatch would be ideal but causes circular dependency.
// ThunkDispatch<AuthMiddlewareState, undefined, AnyAction> could be an option.
// Using 'action: any' to bypass signature compatibility issues for now.
export const authMiddleware: Middleware<{}, AuthMiddlewareState> = (storeAPI) => (next) => (action: any) => {
  const result = next(action);

  if (action.type === '@@redux/INIT') {
    storeAPI.dispatch(loadFromStorage());
    // After loading, check if we have a token and if we should refresh
    // This logic assumes loadFromStorage is synchronous in its state update for the token
    // or refreshSession thunk handles its own loading state appropriately.
    const initialToken = (storeAPI.getState() as AuthMiddlewareState).auth.token;
    if (initialToken) {
      // Dispatching a thunk. The ThunkDispatch type should handle this.
      (storeAPI.dispatch as ThunkDispatch<AuthMiddlewareState, undefined, AnyAction>)(refreshSession(initialToken));
    }
  }

  if (setCredentials.match(action)) {
    const { token } = action.payload;
    if (token) {
      // Clear any existing refresh timeout
      if (refreshTimeoutId) {
        clearTimeout(refreshTimeoutId);
        refreshTimeoutId = null;
      }
      // TODO: If your token has an expiry, decode it and set a timeout to refresh it before it expires.
      // For now, we're not implementing automatic refresh based on expiry time here.
      // Example: storeAPI.dispatch(refreshSession(token)); // dispatch refresh immediately or based on expiry
    }
  }

  if (logout.match(action)) {
    if (refreshTimeoutId) {
      clearTimeout(refreshTimeoutId);
      refreshTimeoutId = null;
    }
  }
  
  // Example: Handling refreshSession success to schedule next refresh (if token has expiry)
  // if (refreshSession.fulfilled.match(action)) {
  //   const { token } = action.payload; 
  //   // Decode token, get expiry, schedule refreshTimeoutId = setTimeout(...)
  // }

  return result;
};
