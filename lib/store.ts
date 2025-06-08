import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { salonApi } from './api';
import authReducer from './slices/authSlice';
import servicesReducer from './slices/servicesSlice';
import { authMiddleware } from './middleware/authMiddleware';

export const store = configureStore({
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

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;