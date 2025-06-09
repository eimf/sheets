import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from './store';
import { logout } from './slices/authSlice';

const baseQuery = fetchBaseQuery({
  baseUrl: process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3001/api',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token;
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

const baseQueryWithReauth = async (args: any, api: any, extraOptions: any) => {
  // Try the original request
  let result = await baseQuery(args, api, extraOptions);

  // If we get a 401, try to refresh the session
  if (result.error && result.error.status === 401) {
    try {
      // Get the current token
      const token = (api.getState() as RootState).auth.token;
      if (!token) {
        throw new Error('No token found');
      }

      // Try to refresh session
      const refreshResult = await baseQuery(
        { url: '/auth/profile' },
        api,
        extraOptions
      );

      if (refreshResult.data) {
        // If refresh was successful, retry the original query
        result = await baseQuery(args, api, extraOptions);
      } else {
        // If refresh failed, clear the token and redirect to login
        api.dispatch(logout());
        const router = extraOptions?.router;
        if (router) {
          router.push('/login');
        } else if (typeof window !== 'undefined') {
          // Fallback to window.location if no router is available
          window.location.href = '/login';
        }
      }
    } catch (error) {
      console.error('Session refresh error:', error);
      // Clear token on any refresh error
      api.dispatch(logout());
      const router = extraOptions?.router;
      if (router) {
        router.push('/login');
      } else if (typeof window !== 'undefined') {
        // Fallback to window.location if no router is available
        window.location.href = '/login';
      }
    }
  }

  return result;
};

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  createdAt?: string;
}

export interface Service {
  id: number;
  user_id: number;
  cycle_id: number; // Added cycle_id
  client_name: string;
  service_type: string;
  custom_service_type?: string;
  payment_source: string;
  custom_payment_source?: string;
  price: number;
  tip?: number;
  cycle_start_date: string; // Provided by backend join for convenience
  cycle_end_date: string;   // Provided by backend join for convenience
  service_date: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: User;
  errors?: any[];
}

export interface ServicesResponse {
  success: boolean;
  services: Service[];
  message?: string;
}

export interface ServiceRequest {
  clientName: string;
  serviceType: string;
  customServiceType?: string;
  paymentSource: string;
  customPaymentSource?: string;
  price: number;
  tip?: number;
  cycleStartDate: string;
  cycleEndDate: string;
  serviceDate?: string;
  notes?: string;
}

export const salonApi = createApi({
  reducerPath: 'salonApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['User', 'Service'],
  endpoints: (builder) => ({
    // Auth endpoints
    login: builder.mutation<AuthResponse, { email: string; password: string }>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['User'],
    }),
    register: builder.mutation<AuthResponse, { 
      username: string; 
      email: string; 
      password: string; 
      fullName: string; 
    }>({
      query: (userData) => ({
        url: '/auth/register',
        method: 'POST',
        body: userData,
      }),
      invalidatesTags: ['User'],
    }),
    getProfile: builder.query<{ success: boolean; user: User }, void>({
      query: () => '/auth/profile',
      providesTags: ['User'],
    }),

    // Service endpoints
    getServices: builder.query<ServicesResponse, { userId: number }>({
      query: ({ userId }) => `/services?userId=${userId}`,
      providesTags: ['Service'],
    }),
    getServicesByCycle: builder.query<ServicesResponse, { cycleStartDate: string; cycleEndDate: string }>({ // userId removed from args as it's from session
      query: ({ cycleStartDate, cycleEndDate }) => `/services?cycleStartDate=${cycleStartDate}&cycleEndDate=${cycleEndDate}`, // Corrected endpoint and params
      providesTags: ['Service'],
    }),
    createService: builder.mutation<{ success: boolean; service: Service }, { userId: number } & ServiceRequest>({ // Updated return type
      query: ({ userId, ...service }) => ({
        url: '/services',
        method: 'POST',
        body: { ...service, userId },
      }),
      invalidatesTags: ['Service'],
    }),

    updateService: builder.mutation<{ success: boolean; service: Service }, { userId: number; id: number } & Partial<ServiceRequest>>({ // Updated return type
      query: ({ userId, id, ...service }) => ({
        url: `/services/${id}`,
        method: 'PUT',
        body: { ...service, userId },
      }),
      invalidatesTags: ['Service'],
    }),

    deleteService: builder.mutation<{ success: boolean; message: string }, { userId: number; id: number }>({
      query: ({ userId, id }) => ({
        url: `/services/${id}`,
        method: 'DELETE',
        body: { userId },
      }),
      invalidatesTags: ['Service'],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useGetProfileQuery,
  useGetServicesQuery,
  useGetServicesByCycleQuery,
  useCreateServiceMutation,
  useUpdateServiceMutation,
  useDeleteServiceMutation,
} = salonApi;