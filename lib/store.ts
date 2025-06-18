import { configureStore, combineReducers, AnyAction } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { apiSlice } from './api';
import { adminApi } from './adminApi';
import authReducer from './slices/authSlice';
import servicesReducer from './slices/servicesSlice';
import { authMiddleware } from './middleware/authMiddleware';
import { ThunkAction } from 'redux-thunk';

// Combine all reducers into a single app reducer
const appReducer = combineReducers({
  [apiSlice.reducerPath]: apiSlice.reducer,
  [adminApi.reducerPath]: adminApi.reducer,
  auth: authReducer,
  services: servicesReducer,
});

// Create a root reducer that delegates to the appReducer, but with a twist:
// when a 'auth/logout' action is dispatched, it resets the state to its initial value.
const rootReducer = (state: ReturnType<typeof appReducer> | undefined, action: AnyAction) => {
  if (action.type === 'auth/logout') {
    // This will reset the state of all slices, including the API slice cache.
    return appReducer(undefined, action);
  }

  return appReducer(state, action);
};

// Create store instance
const storeInstance = configureStore({
  reducer: rootReducer, // Use the root reducer
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [apiSlice.util.resetApiState.type, adminApi.util.resetApiState.type],
      },
    }).concat(apiSlice.middleware, adminApi.middleware, authMiddleware),
});

// Setup listeners for all API slices
setupListeners(storeInstance.dispatch);

// Export types that depend on store
export type RootState = ReturnType<typeof storeInstance.getState>;
export type AppDispatch = typeof storeInstance.dispatch;
export type AppThunk = ThunkAction<void, RootState, null, AnyAction>;

// Export store
export const store = storeInstance;