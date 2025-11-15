import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

// --- Type Definitions ---

export interface User {
    id: string;
    email: string;
    stylish: string;
    role?: string;
}

export interface Location {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radius: number;
    created_at?: string;
    updated_at?: string;
}

export interface CheckIn {
    id: string;
    user_id: string;
    cycle_id: string;
    location_id: string;
    check_in_time: string;
    check_out_time?: string;
    notes?: string;
    created_at?: string;
    updated_at?: string;
    user_name?: string;
    location_name?: string;
}

export interface CheckInStatus {
    active: boolean;
    checkIn?: CheckIn;
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
    total_service_price: number;
    total_product_price: number;
    total_tips: number;
    service_count: number;
    product_count: number;
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

export interface Product {
    id: string;
    name: string;
    customer?: string;
    notes?: string;
    payments?: PaymentDetail[];
    price: number;
    date: string;
    cycleId: string;
    userId: string;
}

export interface NewProduct {
    name: string;
    customer?: string;
    notes?: string;
    payments?: PaymentDetail[];
    price: number;
    date: string;
    cycleId: string;
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
    tagTypes: ['User', 'Cycle', 'Service', 'Product', 'Location', 'CheckIn'],
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
            providesTags: ['Cycle']
        }),
        getUserCycleStats: builder.query<CycleStats, { userId: string; cycleId: string }>({
            query: ({ userId, cycleId }) => `/admin/users/${userId}/cycles/${cycleId}/stats`,
            providesTags: ['Cycle']
        }),
        getServicesForUser: builder.query<Service[], { userId: string; cycleId: string }>({
            query: ({ userId, cycleId }) => `/admin/users/${userId}/cycles/${cycleId}/services`,
            providesTags: ['Service']
        }),
        getServices: builder.query<Service[], string | void>({
            query: (cycleId) => cycleId ? `/cycles/${cycleId}/services` : '/services',
            providesTags: ['Service'],
        }),
        getService: builder.query<Service, string>({
            query: (id) => `/services/${id}`,
            providesTags: (result, error, id) => [{ type: 'Service', id }],
        }),
        createService: builder.mutation<Service, Omit<Service, 'id' | 'created_at' | 'updated_at'>>({  
            query: (service) => ({
                url: '/services',
                method: 'POST',
                body: service,
            }),
            invalidatesTags: ['Service'],
        }),
        updateService: builder.mutation<Service, Partial<Service> & Pick<Service, 'id'>>({  
            query: ({ id, ...updates }) => ({
                url: `/services/${id}`,
                method: 'PUT',
                body: updates,
            }),
            invalidatesTags: (result, error, { id }) => [{ type: 'Service', id }],
        }),
        deleteService: builder.mutation<{ message: string }, string>({
            query: (id) => ({
                url: `/services/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Service'],
        }),

        // Product endpoints
        getProductsForUser: builder.query<Product[], { userId: string; cycleId: string }>({
            query: ({ userId, cycleId }) => `/admin/users/${userId}/cycles/${cycleId}/products`,
            providesTags: ['Product'],
        }),
        getProducts: builder.query<Product[], string | void>({
            query: (cycleId) => cycleId ? `/cycles/${cycleId}/products` : '/products',
            providesTags: ['Product'],
        }),
        getProduct: builder.query<Product, string>({
            query: (id) => `/products/${id}`,
            providesTags: (result, error, id) => [{ type: 'Product', id }],
        }),
        createProduct: builder.mutation<Product, Omit<Product, 'id' | 'created_at' | 'updated_at'>>({  
            query: (product) => ({
                url: '/products',
                method: 'POST',
                body: product,
            }),
            invalidatesTags: ['Product'],
        }),
        updateProduct: builder.mutation<Product, Partial<Product> & Pick<Product, 'id'>>({  
            query: ({ id, ...updates }) => ({
                url: `/products/${id}`,
                method: 'PUT',
                body: updates,
            }),
            invalidatesTags: (result, error, { id }) => [{ type: 'Product', id }],
        }),
        deleteProduct: builder.mutation<{ message: string }, string>({
            query: (id) => ({
                url: `/products/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Product'],
        }),
        
        // Location endpoints
        getLocations: builder.query<Location[], void>({  
            query: () => '/locations',
            providesTags: ['Location']
        }),
        getLocation: builder.query<Location, string>({
            query: (id) => `/locations/${id}`,
            providesTags: (result, error, id) => [{ type: 'Location', id }]
        }),
        createLocation: builder.mutation<Location, Omit<Location, 'id' | 'created_at' | 'updated_at'>>({  
            query: (location) => ({
                url: '/locations',
                method: 'POST',
                body: location,
            }),
            invalidatesTags: ['Location']
        }),
        updateLocation: builder.mutation<Location, Partial<Location> & Pick<Location, 'id'>>({  
            query: ({ id, ...updates }) => ({
                url: `/locations/${id}`,
                method: 'PUT',
                body: updates,
            }),
            invalidatesTags: (result, error, { id }) => [{ type: 'Location', id }]
        }),
        deleteLocation: builder.mutation<{ message: string }, string>({  
            query: (id) => ({
                url: `/locations/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Location']
        }),

        // Check-in endpoints
        getCheckIns: builder.query<CheckIn[], string | void>({  
            query: (cycleId) => cycleId ? `/check-ins?cycleId=${cycleId}` : '/check-ins',
            providesTags: ['CheckIn']
        }),
        getCheckInStatus: builder.query<CheckInStatus, void>({  
            query: () => '/check-ins/status',
            providesTags: ['CheckIn']
        }),
        createCheckIn: builder.mutation<CheckIn, { cycleId: string; locationId: string; latitude: number; longitude: number; notes?: string }>({  
            query: (checkIn) => ({
                url: '/check-ins',
                method: 'POST',
                body: checkIn,
            }),
            invalidatesTags: ['CheckIn']
        }),
        checkOut: builder.mutation<CheckIn, { checkInId: string; latitude: number; longitude: number; notes?: string }>({  
            query: ({ checkInId, ...data }) => ({
                url: `/check-ins/${checkInId}/checkout`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['CheckIn']
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
    useGetUserCycleStatsQuery,
    useGetServicesForUserQuery,
    // Services
    useGetServicesQuery,
    useGetServiceQuery,
    useCreateServiceMutation,
    useUpdateServiceMutation,
    useDeleteServiceMutation,
    // Products
    useGetProductsForUserQuery,
    useGetProductsQuery,
    useGetProductQuery,
    useCreateProductMutation,
    useUpdateProductMutation,
    useDeleteProductMutation,
    // Locations
    useGetLocationsQuery,
    useGetLocationQuery,
    useCreateLocationMutation,
    useUpdateLocationMutation,
    useDeleteLocationMutation,
    // Check-ins
    useGetCheckInsQuery,
    useGetCheckInStatusQuery,
    useCreateCheckInMutation,
    useCheckOutMutation,
} = apiSlice;
