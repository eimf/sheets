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
    notes?: string;
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
    notes?: string;
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
    method: "card" | "cash" | "cashapp" | "zelle" | "other";
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
const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
const baseQueryWithAuth = fetchBaseQuery({
    baseUrl: `${baseUrl}/api`,
    credentials: "include",
    prepareHeaders: (headers) => {
        if (typeof window !== "undefined") {
            const token = localStorage.getItem("salonToken");
            if (token) {
                headers.set("authorization", `Bearer ${token}`);
            }
        }
        return headers;
    },
});

// Wrap baseQuery to handle 401s gracefully for auth endpoints
const baseQuery = async (args: any, api: any, extraOptions: any) => {
    const result = await baseQueryWithAuth(args, api, extraOptions);

    // For auth/profile endpoint, 401 is expected when not authenticated
    // Don't treat it as an error to avoid console noise
    if (
        result.error &&
        result.error.status === 401 &&
        typeof args === "object" &&
        args.url === "/auth/profile"
    ) {
        // Return a result that won't trigger error handling
        return {
            error: {
                status: 401,
                data: { error: "Unauthorized" },
            },
        };
    }

    return result;
};

// --- API Slice Definition ---
export const apiSlice = createApi({
    reducerPath: "api",
    baseQuery,
    tagTypes: ["User", "Cycle", "Service", "Product"],
    endpoints: (builder) => ({
        // Auth endpoints
        login: builder.mutation<AuthResponse, LoginRequest>({
            query: (credentials) => ({
                url: "/auth/login",
                method: "POST",
                body: credentials,
            }),
            invalidatesTags: ["User"],
        }),
        register: builder.mutation<AuthResponse, RegisterRequest>({
            query: (userData) => ({
                url: "/auth/register",
                method: "POST",
                body: userData,
            }),
        }),
        getProfile: builder.query<User, void>({
            query: () => "/auth/profile",
            providesTags: ["User"],
        }),

        // Cycle endpoints
        getCycles: builder.query<Cycle[], void>({
            query: () => "/cycles",
            providesTags: (result) =>
                result
                    ? [
                          ...result.map(({ id }) => ({
                              type: "Cycle" as const,
                              id,
                          })),
                          "Cycle",
                      ]
                    : ["Cycle"],
        }),
        getCycle: builder.query<Cycle, string>({
            query: (id) => `/cycles/${id}`,
            providesTags: (result, error, id) => [{ type: "Cycle", id }],
        }),
        createCycle: builder.mutation<Cycle, NewCycle>({
            query: (cycle) => ({
                url: "/cycles",
                method: "POST",
                body: cycle,
            }),
            invalidatesTags: ["Cycle"],
        }),
        updateCycle: builder.mutation<
            Cycle,
            Partial<Cycle> & Pick<Cycle, "id">
        >({
            query: ({ id, ...updates }) => ({
                url: `/cycles/${id}`,
                method: "PATCH",
                body: updates,
            }),
            invalidatesTags: (result, error, { id }) => [{ type: "Cycle", id }],
        }),
        deleteCycle: builder.mutation<void, string>({
            query: (id) => ({
                url: `/cycles/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["Cycle"],
        }),

        // Admin endpoints
        getAdminCycles: builder.query<Cycle[], void>({
            query: () => "/admin/cycles",
        }),
        getCycleStats: builder.query<CycleStats[], string>({
            query: (cycleId) => `/admin/cycles/${cycleId}/stats`,
            providesTags: (result, error, cycleId) => [
                { type: "Cycle", id: `STATS-${cycleId}` },
                "Cycle", // Also provide general Cycle tag for broader invalidation
            ],
        }),
        getUserCycleStats: builder.query<CycleStats[], string>({
            query: (cycleId) => `/cycles/${cycleId}/stats`,
        }),

        // Service endpoints
        getServicesForUser: builder.query<
            Service[],
            { cycleId: string; userId: string }
        >({
            query: ({ cycleId, userId }) =>
                `/cycles/${cycleId}/services?userId=${userId}`,
            providesTags: (result) =>
                result
                    ? [
                          ...result.map(({ id }) => ({
                              type: "Service" as const,
                              id,
                          })),
                          "Service",
                      ]
                    : ["Service"],
        }),
        getServices: builder.query<Service[], string | void>({
            query: (cycleId) => ({
                url: cycleId ? `/cycles/${cycleId}/services` : "/services",
            }),
            providesTags: (result) =>
                result
                    ? [
                          ...result.map(({ id }) => ({
                              type: "Service" as const,
                              id,
                          })),
                          "Service",
                      ]
                    : ["Service"],
        }),
        getService: builder.query<Service, string>({
            query: (id) => `/services/${id}`,
            providesTags: (result, error, id) => [{ type: "Service", id }],
        }),
        createService: builder.mutation<
            Service,
            Omit<NewService, "cycleId"> & { cycleId: string }
        >({
            query: ({ cycleId, ...service }) => ({
                url: `/cycles/${cycleId}/services`,
                method: "POST",
                body: service,
            }),
            invalidatesTags: ["Service", "Cycle"],
        }),
        updateService: builder.mutation<
            Service,
            Partial<Service> & Pick<Service, "id">
        >({
            query: ({ id, ...updates }) => ({
                url: `/services/${id}`,
                method: "PATCH",
                body: updates,
            }),
            async onQueryStarted(
                { id, cycleId },
                { dispatch, queryFulfilled, getState }
            ) {
                // Try to get the old cycleId from the service in cache
                let oldCycleId: string | undefined;

                if (cycleId !== undefined && getState) {
                    try {
                        // Try to get the service from the cache
                        const state = getState() as any;
                        const cachedData =
                            apiSlice.endpoints.getService.select(id)(state);
                        if (cachedData?.data) {
                            oldCycleId = cachedData.data.cycleId;
                        }
                    } catch (error) {
                        // If we can't get it from cache, that's okay
                    }
                }

                // Wait for the update to complete
                const updateResult = await queryFulfilled;
                const newCycleId = updateResult.data?.cycleId || cycleId;

                // Invalidate tags for both old and new cycles
                const tagsToInvalidate: Array<
                    | {
                          type: "Cycle" | "User" | "Service" | "Product";
                          id?: string;
                      }
                    | "Cycle"
                    | "User"
                    | "Service"
                    | "Product"
                > = [
                    { type: "Service" as const, id },
                    "Cycle" as const, // This invalidates all cycle stats since getCycleStats provides "Cycle" tag
                ];

                // Also invalidate specific cycle stats for both old and new cycles
                if (newCycleId) {
                    tagsToInvalidate.push({
                        type: "Cycle" as const,
                        id: `STATS-${newCycleId}`,
                    });
                }
                if (oldCycleId && oldCycleId !== newCycleId) {
                    tagsToInvalidate.push({
                        type: "Cycle" as const,
                        id: `STATS-${oldCycleId}`,
                    });
                }

                dispatch(apiSlice.util.invalidateTags(tagsToInvalidate));
            },
            invalidatesTags: (result, error, arg) => {
                // Fallback invalidation
                const tags: Array<
                    | {
                          type: "Cycle" | "User" | "Service" | "Product";
                          id?: string;
                      }
                    | "Cycle"
                    | "User"
                    | "Service"
                    | "Product"
                > = [
                    { type: "Service" as const, id: arg.id },
                    "Cycle" as const,
                ];

                // Invalidate stats for the cycleId in the update (new cycle)
                if (arg.cycleId) {
                    tags.push({
                        type: "Cycle" as const,
                        id: `STATS-${arg.cycleId}`,
                    });
                }

                // Invalidate stats for the cycleId in the result (new cycle after update)
                if (result?.cycleId) {
                    tags.push({
                        type: "Cycle" as const,
                        id: `STATS-${result.cycleId}`,
                    });
                }

                return tags;
            },
        }),
        deleteService: builder.mutation<void, string>({
            query: (id) => ({
                url: `/services/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["Service", "Cycle"],
        }),

        // Product endpoints
        getProductsForUser: builder.query<
            Product[],
            { cycleId: string; userId: string }
        >({
            query: ({ cycleId, userId }) =>
                `/cycles/${cycleId}/products?userId=${userId}`,
        }),
        getProducts: builder.query<Product[], string | void>({
            query: (cycleId) => ({
                url: cycleId ? `/cycles/${cycleId}/products` : "/products",
            }),
            providesTags: (result) =>
                result
                    ? [
                          ...result.map(({ id }) => ({
                              type: "Product" as const,
                              id,
                          })),
                          "Product",
                      ]
                    : ["Product"],
        }),
        getProduct: builder.query<Product, string>({
            query: (id) => `/products/${id}`,
            providesTags: (result, error, id) => [{ type: "Product", id }],
        }),
        createProduct: builder.mutation<
            Product,
            Omit<NewProduct, "cycleId"> & { cycleId: string }
        >({
            query: ({ cycleId, ...product }) => ({
                url: `/cycles/${cycleId}/products`,
                method: "POST",
                body: product,
            }),
            invalidatesTags: ["Product", "Cycle"],
        }),
        updateProduct: builder.mutation<
            Product,
            Partial<Product> & Pick<Product, "id">
        >({
            query: ({ id, ...updates }) => ({
                url: `/products/${id}`,
                method: "PUT",
                body: updates,
            }),
            invalidatesTags: (result, error, { id }) => [
                { type: "Product", id },
                "Cycle",
            ],
        }),
        deleteProduct: builder.mutation<void, string>({
            query: (id) => ({
                url: `/products/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["Product", "Cycle"],
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
} = apiSlice;
