import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { salonApi } from './api';
import authReducer from './slices/authSlice';
import servicesReducer from './slices/servicesSlice';
import { authMiddleware } from './middleware/authMiddleware';
import { ThunkAction } from 'redux-thunk';
import { AnyAction } from '@reduxjs/toolkit';

// Create store instance first
const storeInstance = configureStore({
  reducer: {
    [salonApi.reducerPath]: salonApi.reducer,
    auth: authReducer,
    services: servicesReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [salonApi.util.resetApiState.type],
      },
    }).concat(salonApi.middleware, authMiddleware),
});

setupListeners(storeInstance.dispatch);

// Export types that depend on store
export type RootState = ReturnType<typeof storeInstance.getState>;
export type AppDispatch = typeof storeInstance.dispatch;
export type AppThunk = ThunkAction<void, RootState, null, AnyAction>;

// Export store
export const store = storeInstance;