import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import type { User } from '../api';
import type { RootState } from '../store'; // Assuming RootState is exported from store.ts in the lib directory

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: false,
  error: null,
};

// Create async thunk for session refresh
export const refreshSession = createAsyncThunk(
  'auth/refreshSession',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return rejectWithValue('No token found');
      }

      const response = await fetch('/api/auth/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const user = await response.json();
      if (!response.ok) {
        throw new Error(user.error || 'Failed to fetch profile');
      }

      if (user && user.id && user.stylish) {
        dispatch(setCredentials({ user, token }));
        return { user, token };
      } else {
        throw new Error('Invalid user data received from profile');
      }
    } catch (error: any) {
      console.error('Session refresh error:', error);
      dispatch(logout());
      return rejectWithValue(error.message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ user: User; token: string }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.loading = false;
      state.error = null;
      // Store in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('salonToken', action.payload.token);
        localStorage.setItem('salonUser', JSON.stringify(action.payload.user));
      }
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
      // Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('salonToken');
        localStorage.removeItem('salonUser');
      }
    },
    loadFromStorage: (state) => {
      if (typeof window !== 'undefined') {
        console.log('Attempting to load auth from storage');
        
        const token = localStorage.getItem('salonToken');
        const userStr = localStorage.getItem('salonUser');
        
        console.log('Stored token:', token);
        console.log('Stored user:', userStr);
        
        if (!token) {
          console.log('No token found in storage');
          return;
        }
        
        if (!userStr) {
          console.log('No user data found in storage');
          return;
        }
        
        try {
          const user = JSON.parse(userStr);
          if (!user || typeof user !== 'object') {
            console.error('Invalid user data format in storage');
            return;
          }
          
          // Validate token format (accept any non-empty string)
          if (!token || typeof token !== 'string' || token.length < 10) {
            console.error('Invalid token format:', token);
            return;
          }

          state.user = user;
          state.token = token;
          state.isAuthenticated = true;
          state.loading = false;
          state.error = null;
          console.log('Auth loaded from storage successfully');
        } catch (error) {
          console.error('Error parsing stored user data:', error);
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(refreshSession.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(refreshSession.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.loading = false;
      })
      .addCase(refreshSession.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setCredentials, logout, loadFromStorage } = authSlice.actions;

// Selector to get the auth state
export const selectAuth = (state: RootState) => state.auth;
export default authSlice.reducer;