import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import type { User } from "../api";
import type { RootState } from "../store"; // Assuming RootState is exported from store.ts in the lib directory

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
    loading: true, // Start with loading: true to check for session
    error: null,
};

// Create async thunk for session refresh
export const refreshSession = createAsyncThunk<
    { user: User; token: string }, // Return type
    string, // Argument type: the token
    { rejectValue: string } // Type for rejectWithValue payload
>("auth/refreshSession", async (token, { dispatch, rejectWithValue }) => {
    try {
        // The token is now passed as an argument.
        if (!token) {
            return rejectWithValue("No token provided");
        }

        // --- Dynamic Base URL Resolution (keep in sync with lib/api.ts) ---
        const isServer = typeof window === "undefined";
        const serverPort = process.env.PORT || 3001;
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL
            ? `${process.env.NEXT_PUBLIC_API_URL}/api`
            : isServer
            ? `http://localhost:${serverPort}/api`
            : "/api";
        const response = await fetch(`${apiBaseUrl}/auth/profile`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        const data = await response.json();
        if (!response.ok) {
            // Don't log expected errors (401 for invalid/expired tokens)
            if (response.status === 401) {
                return rejectWithValue("Invalid or expired session");
            }
            throw new Error(data.error || "Failed to fetch profile");
        }

        // Handle both response formats: { success: true, user: {...} } or just { user: {...} }
        const user = data.user || data;

        if (user && (user.id || user.user_id)) {
            // Normalize user object to match expected format
            // Server returns: { id, username, email, fullName, role }
            // We need: { id, email, stylish, role }
            const normalizedUser = {
                id: String(user.id || user.user_id),
                email: user.email || "",
                stylish: user.stylish || user.username || user.fullName || "",
                role: user.role,
            };

            // The token passed to setCredentials should be the one we used for the request.
            dispatch(setCredentials({ user: normalizedUser, token }));
            return { user: normalizedUser, token };
        } else {
            throw new Error("Invalid user data received from profile");
        }
    } catch (error: any) {
        // Only log unexpected errors, not expected 401s for invalid/expired tokens
        if (error.message !== "Invalid or expired session") {
            console.error("Session refresh error:", error);
        }
        dispatch(logout());
        return rejectWithValue(error.message || "Failed to refresh session");
    }
});

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        setCredentials: (
            state,
            action: PayloadAction<{ user: User; token: string }>
        ) => {
            state.user = action.payload.user;
            state.token = action.payload.token;
            state.isAuthenticated = true;
            state.loading = false;
            state.error = null;
            // Store in localStorage
            if (typeof window !== "undefined") {
                localStorage.setItem("salonToken", action.payload.token);
                localStorage.setItem(
                    "salonUser",
                    JSON.stringify(action.payload.user)
                );
            }
        },
        logout: (state) => {
            state.user = null;
            state.token = null;
            state.isAuthenticated = false;
            state.loading = false;
            state.error = null;
            // Clear localStorage
            if (typeof window !== "undefined") {
                localStorage.removeItem("salonToken");
                localStorage.removeItem("salonUser");
            }
        },
        loadFromStorage: (state) => {
            if (typeof window !== "undefined") {
                const token = localStorage.getItem("salonToken");
                const userStr = localStorage.getItem("salonUser");
                if (token && userStr) {
                    try {
                        state.user = JSON.parse(userStr);
                        state.token = token;
                        state.isAuthenticated = true;
                        // loading remains true until refreshSession completes
                    } catch (error) {
                        console.error("Error parsing stored user data:", error);
                        localStorage.removeItem("salonToken");
                        localStorage.removeItem("salonUser");
                        state.loading = false; // Stop loading, parse error
                    }
                } else {
                    // No token, not logged in, stop loading.
                    state.loading = false;
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
                state.loading = false;
                // The user and token are set by the thunk's dispatch
            })
            .addCase(refreshSession.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload ?? "Failed to refresh session";
                // Also clear user/token from state
                state.user = null;
                state.token = null;
                state.isAuthenticated = false;
            });
    },
});

export const { setCredentials, logout, loadFromStorage } = authSlice.actions;

// Selector to get the auth state
export const selectAuth = (state: RootState) => state.auth;
export default authSlice.reducer;
