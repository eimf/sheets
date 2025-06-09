import { MiddlewareAPI } from '@reduxjs/toolkit';
import { loadFromStorage } from '../slices/authSlice';

export const authMiddleware = (store: MiddlewareAPI) => (next: (action: any) => any) => (action: any) => {
  // Load credentials from storage when the store initializes
  if (action.type === '@@redux/INIT') {
    store.dispatch(loadFromStorage());
  }
  return next(action);
};
