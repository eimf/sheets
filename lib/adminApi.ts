import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// Define Cycle type
export interface Cycle {
    id: string | number;
    name: string;
    startDate?: string;
    endDate?: string;
}

export interface CycleStats {
    stylish: string;
    total_price: number;
    total_tips: number;
    service_count: number;
}

// Create a base query with the API base URL
const baseQuery = fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers) => {
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('token'); // Or 'salonToken' to be consistent
            if (token) {
                headers.set('authorization', `Bearer ${token}`);
            }
        }
        return headers;
    },
});

// Create API slice
export const adminApi = createApi({
    reducerPath: 'adminApi',
    baseQuery,
    tagTypes: ['Cycle'],
    endpoints: (builder) => ({
        // Get all cycles for admin
        getAdminCycles: builder.query<Cycle[], void>({
            query: () => '/admin/cycles',
            providesTags: (result) => {
                if (!result) return [{ type: 'Cycle' as const, id: 'LIST' }];
                return [
                    ...result.map((cycle) => ({
                        type: 'Cycle' as const,
                        id: String(cycle.id),
                    })),
                    { type: 'Cycle' as const, id: 'LIST' },
                ];
            },
        }),
        
        // Get stats for a specific cycle
        getCycleStats: builder.query<CycleStats[], string>({
            query: (cycleId) => `/admin/cycles/${cycleId}/stats`,
            providesTags: (result, error, cycleId) => [
                { type: 'Cycle' as const, id: String(cycleId) },
                { type: 'Cycle' as const, id: 'STATS' },
            ],
        }),
    }),
});

export const {
    useGetAdminCyclesQuery,
    useGetCycleStatsQuery,
} = adminApi;
