import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// It's good practice to define RootState in your store configuration
// and import it here for type safety with getState.
// Example: import type { RootState } from '../store';

// --- Type Definitions ---

export interface User {
  id: string;
  email: string;
  stylish: string; // Reflects removal of username and rename of full_name
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
  startDate?: string; // ISO date string
  endDate?: string;   // ISO date string
  userId: string;
}

export interface NewCycle {
  name: string;
  startDate?: string;
  endDate?: string;
  // userId is typically inferred by the backend from the authenticated user
}

export interface Service {
  id: string;
  name: string;
  price: number;
  date: string; // ISO date string
  userId: string;
  cycleId: string; // Services are associated with a user and a cycle
}

export interface NewService {
  name: string;
  price: number;
  date: string; // ISO date string
  // cycleId will be part of the URL path when adding a new service
  // userId is typically inferred by the backend
}

// --- Base Query Setup ---

const baseQuery = fetchBaseQuery({
  baseUrl: 'http://localhost:3001/api', // Absolute path to the backend API
  prepareHeaders: (headers, { getState }) => {
    // TODO: Replace `any` with your actual `RootState` type for type safety.
    // This assumes your auth token is stored in `state.auth.token`.
    const token = (getState() as any).auth?.token;
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

// --- API Slice Definition ---

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Profile', 'User', 'Cycle', 'Service'],
  endpoints: (builder) => ({
    // Authentication Endpoints
    login: builder.mutation<AuthResponse, LoginRequest>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: [{ type: 'Profile', id: 'CURRENT' }],
    }),
    register: builder.mutation<AuthResponse, RegisterRequest>({
      query: (userInfo) => ({
        url: '/auth/register',
        method: 'POST',
        body: userInfo,
      }),
      invalidatesTags: [{ type: 'Profile', id: 'CURRENT' }],
    }),
    getProfile: builder.query<User, void>({
      query: () => '/auth/profile',
      providesTags: (result) =>
        result ? [{ type: 'Profile', id: 'CURRENT' }, { type: 'User', id: result.id }] : [{ type: 'Profile', id: 'CURRENT' }],
    }),

    // Cycle Endpoints
    getCycles: builder.query<Cycle[], void>({
      query: () => '/cycles', // Assumes backend filters cycles for the authenticated user
      providesTags: (result = []) => [
        ...result.map(({ id }) => ({ type: 'Cycle' as const, id })),
        { type: 'Cycle', id: 'LIST' },
      ],
    }),
    getCycleById: builder.query<Cycle, string>({
      query: (id) => `/cycles/${id}`,
      providesTags: (result, error, id) => [{ type: 'Cycle', id }],
    }),
    addCycle: builder.mutation<Cycle, NewCycle>({
      query: (newCycle) => ({
        url: '/cycles',
        method: 'POST',
        body: newCycle,
      }),
      invalidatesTags: [{ type: 'Cycle', id: 'LIST' }],
    }),
    updateCycle: builder.mutation<Cycle, Partial<Cycle> & { id: string }>({
      query: ({ id, ...patch }) => ({
        url: `/cycles/${id}`,
        method: 'PUT',
        body: patch,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Cycle', id }, { type: 'Cycle', id: 'LIST' }],
    }),
    deleteCycle: builder.mutation<{ success: boolean; id?: string }, string>({
      query: (id) => ({
        url: `/cycles/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Cycle', id }, { type: 'Cycle', id: 'LIST' }],
    }),

    // Service Endpoints (associated with Cycles)
    getServicesForCycle: builder.query<Service[], string>({ // Argument is cycleId
      query: (cycleId) => `/cycles/${cycleId}/services`,
      providesTags: (result = [], error, cycleId) => [
        ...result.map(({ id }) => ({ type: 'Service' as const, id })),
        { type: 'Service', id: 'LIST' }, // General list tag
        { type: 'Service', id: `CYCLE_SERVICES_${cycleId}` }, // Cycle-specific list tag
      ],
    }),
    addServiceToCycle: builder.mutation<Service, { cycleId: string; serviceDetails: NewService }>({
      query: ({ cycleId, serviceDetails }) => ({
        url: `/cycles/${cycleId}/services`,
        method: 'POST',
        body: serviceDetails,
      }),
      invalidatesTags: (result, error, { cycleId }) => [
        { type: 'Service', id: 'LIST' },
        { type: 'Service', id: `CYCLE_SERVICES_${cycleId}` },
      ],
    }),
    getServiceById: builder.query<Service, string>({ // Assumes service IDs are globally unique
      query: (serviceId) => `/services/${serviceId}`,
      providesTags: (result, error, serviceId) => [{ type: 'Service', id: serviceId }],
    }),
    updateService: builder.mutation<Service, Partial<Service> & { id: string }>({
      query: ({ id, ...patch }) => ({
        url: `/services/${id}`,
        method: 'PUT',
        body: patch,
      }),
      invalidatesTags: (result, error, { id }) =>
        result ? [
          { type: 'Service', id },
          { type: 'Service', id: 'LIST' },
          { type: 'Service', id: `CYCLE_SERVICES_${result.cycleId}` }, // Assumes result contains cycleId
        ] : [],
    }),
    deleteService: builder.mutation<{ success: boolean; id?: string }, { serviceId: string; cycleId: string }>({
      query: ({ serviceId }) => ({
        url: `/services/${serviceId}`,
        method: 'DELETE',
      }),
      // cycleId is passed in args to correctly invalidate the cache for that cycle's services
      invalidatesTags: (result, error, { serviceId, cycleId }) => [
        { type: 'Service', id: serviceId },
        { type: 'Service', id: 'LIST' },
        { type: 'Service', id: `CYCLE_SERVICES_${cycleId}` },
      ],
    }),
  }),
});

// Export hooks for usage in UI components
export const {
  useLoginMutation,
  useRegisterMutation,
  useGetProfileQuery,
  useGetCyclesQuery,
  useGetCycleByIdQuery,
  useAddCycleMutation,
  useUpdateCycleMutation,
  useDeleteCycleMutation,
  useGetServicesForCycleQuery,
  useAddServiceToCycleMutation,
  useGetServiceByIdQuery,
  useUpdateServiceMutation,
  useDeleteServiceMutation,
} = apiSlice;