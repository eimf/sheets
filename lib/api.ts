import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

// --- Type Definitions ---

export interface User {
    id: string;
    email: string;
    stylish: string;
    role?: string;
}

export interface AuthResponse {
    token: string;
    user: User;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
    stylish: string;
}

export interface Cycle {
    id: string;
    name: string;
    startDate?: string;
    endDate?: string;
}

export interface CycleStats {
    user_id: string;

    stylish: string;
    total_price: number;
    total_tips: number;
    service_count: number;
}

export interface NewCycle {
    name: string;
    startDate?: string;
    endDate?: string;
}

export interface Service {
    id: string;
    name: string;
    customer?: string;
    notes?: string;
    payments?: PaymentDetail[];
    price: number;
    tip?: number;
    date: string;
    cycleId: string;
    userId: string;
}

export interface NewService {
    name: string;
    customer?: string;
    notes?: string;
    payments?: PaymentDetail[];
    price: number;
    tip?: number;
    date: string;
    cycleId: string;
}

export interface PaymentDetail {
    method: 'card' | 'cash' | 'cashapp' | 'zelle' | 'other';
    amount: number;
    label?: string;
}

// --- Base Query Setup ---
const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
const baseQuery = fetchBaseQuery({
    baseUrl: `${baseUrl}/api`,
    credentials: 'include',
    prepareHeaders: (headers) => {
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('salonToken');
            if (token) {
                headers.set('authorization', `Bearer ${token}`);
            }
        }
        return headers;
    },
});

// --- API Slice Definition ---
export const apiSlice = createApi({
    reducerPath: 'api',
    baseQuery,
    tagTypes: ['User', 'Cycle', 'Service'],
    endpoints: (builder) => ({
        // Auth endpoints
        login: builder.mutation<AuthResponse, LoginRequest>({
            query: (credentials) => ({
                url: '/auth/login',
                method: 'POST',
                body: credentials,
            }),
            invalidatesTags: ['User'],
        }),
        register: builder.mutation<AuthResponse, RegisterRequest>({
            query: (userData) => ({
                url: '/auth/register',
                method: 'POST',
                body: userData,
            }),
        }),
        getProfile: builder.query<User, void>({
            query: () => '/auth/profile',
            providesTags: ['User'],
        }),
        
        // Cycle endpoints
        getCycles: builder.query<Cycle[], void>({
            query: () => '/cycles',
            providesTags: (result) =>
                result
                    ? [...result.map(({ id }) => ({ type: 'Cycle' as const, id })), 'Cycle']
                    : ['Cycle']
        }),
        getCycle: builder.query<Cycle, string>({
            query: (id) => `/cycles/${id}`,
            providesTags: (result, error, id) => [{ type: 'Cycle', id }],
        }),
        createCycle: builder.mutation<Cycle, NewCycle>({
            query: (cycle) => ({
                url: '/cycles',
                method: 'POST',
                body: cycle,
            }),
            invalidatesTags: ['Cycle'],
        }),
        updateCycle: builder.mutation<Cycle, Partial<Cycle> & Pick<Cycle, 'id'>>({
            query: ({ id, ...updates }) => ({
                url: `/cycles/${id}`,
                method: 'PATCH',
                body: updates,
            }),
            invalidatesTags: (result, error, { id }) => [{ type: 'Cycle', id }],
        }),
        deleteCycle: builder.mutation<void, string>({
            query: (id) => ({
                url: `/cycles/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Cycle'],
        }),
        
        // Admin endpoints
        getAdminCycles: builder.query<Cycle[], void>({
            query: () => '/admin/cycles',
        }),
        getCycleStats: builder.query<CycleStats[], string>({
            query: (cycleId) => `/admin/cycles/${cycleId}/stats`,
        }),
        
        // Service endpoints
        getServicesForUser: builder.query<Service[], { cycleId: string; userId: string }>({
            query: ({ cycleId, userId }) => `/cycles/${cycleId}/services?userId=${userId}`,
        }),
        getServices: builder.query<Service[], string | void>({
            query: (cycleId) => ({
                url: cycleId ? `/cycles/${cycleId}/services` : '/services'
            }),
            providesTags: (result) =>
                result
                    ? [...result.map(({ id }) => ({ type: 'Service' as const, id })), 'Service']
                    : ['Service']
        }),
        getService: builder.query<Service, string>({
            query: (id) => `/services/${id}`,
            providesTags: (result, error, id) => [{ type: 'Service', id }],
        }),
        createService: builder.mutation<Service, Omit<NewService, 'cycleId'> & { cycleId: string }>({
            query: ({ cycleId, ...service }) => ({
                url: `/cycles/${cycleId}/services`,
                method: 'POST',
                body: service,
            }),
            invalidatesTags: ['Service', 'Cycle'],
        }),
        updateService: builder.mutation<Service, Partial<Service> & Pick<Service, 'id'>>({
            query: ({ id, ...updates }) => ({
                url: `/services/${id}`,
                method: 'PATCH',
                body: updates,
            }),
            invalidatesTags: (result, error, { id }) => [
                { type: 'Service', id },
                'Cycle',
            ],
        }),
        deleteService: builder.mutation<void, string>({
            query: (id) => ({
                url: `/services/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Service', 'Cycle'],
        }),
    }),
});

// Export hooks for usage in UI components
export const {
    // Auth
    useLoginMutation,
    useRegisterMutation,
    useGetProfileQuery,
    // Cycles
    useGetCyclesQuery,
    useGetCycleQuery,
    useCreateCycleMutation,
    useUpdateCycleMutation,
    useDeleteCycleMutation,
    // Admin
    useGetAdminCyclesQuery,
    useGetCycleStatsQuery,
    useGetServicesForUserQuery,
    // Services
    useGetServicesQuery,
    useGetServiceQuery,
    useCreateServiceMutation,
    useUpdateServiceMutation,
    useDeleteServiceMutation,
} = apiSlice;
