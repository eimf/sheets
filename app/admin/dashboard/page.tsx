"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/lib/hooks";
import Header from "@/components/dashboard/Header";
import CycleManager from "@/components/dashboard/CycleManager";
import {
    useGetCycleStatsQuery,
    useGetServicesForUserQuery,
    useGetProductsForUserQuery,
    type CycleStats,
    type Service,
    type Product,
    type PaymentDetail,
} from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { skipToken } from "@reduxjs/toolkit/query";

export default function AdminDashboardPage() {
    const router = useRouter();
    const { isAuthenticated, user, loading } = useAppSelector(
        (state) => state.auth
    );
    const [currentCycleId, setCurrentCycleId] = useState<string | null>(null);
    const [selectedStylist, setSelectedStylist] = useState<{ id: string; name: string } | null>(null);
    const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);

    // Fetch services for the selected stylist within the current cycle
    const {
        data: stylistServices = [],
        isLoading: isLoadingStylistServices,
    } = useGetServicesForUserQuery(
        selectedStylist && currentCycleId
            ? { cycleId: currentCycleId, userId: selectedStylist.id }
            : skipToken
    );

    // Fetch products for the selected stylist within the current cycle
    const {
        data: stylistProducts = [],
        isLoading: isLoadingStylistProducts,
    } = useGetProductsForUserQuery(
        selectedStylist && currentCycleId
            ? { cycleId: currentCycleId, userId: selectedStylist.id }
            : skipToken
    );
    
    const { data: cycleStats, isLoading: isLoadingStats } = useGetCycleStatsQuery(
        currentCycleId || '',
        { skip: !currentCycleId }
    );

    useEffect(() => {
        if (!loading && !isAuthenticated) {
            router.push("/login");
        } else if (!loading && isAuthenticated && user?.role !== 'admin') {
            router.push("/dashboard");
        }
    }, [isAuthenticated, loading, router, user]);

    if (loading || !isAuthenticated) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p>Loading...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50">
            <Header />
            <main className="flex-1 px-4 sm:px-6 md:px-8 py-6">
                <div className="max-w-6xl mx-auto space-y-6">
                    <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                    <div className="bg-white rounded-lg shadow p-6">
                        <CycleManager
                            currentCycleId={currentCycleId}
                            onCycleChange={setCurrentCycleId}
                            showCreateButton={true}
                        />
                        
                        {isLoadingStats && currentCycleId && (
                            <div className="mt-6 space-y-4">
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                            </div>
                        )}

                        {!isLoadingStats && cycleStats && cycleStats.length > 0 && (
                            <div className="mt-6 overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stylist</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total of Services</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total of Products</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Tips</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"># of Services</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"># of Products</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {cycleStats
                                            .filter((stat: CycleStats) => stat.service_count > 0 || stat.product_count > 0)
                                            .map((stat: CycleStats) => (
                                            <tr key={stat.user_id} className="cursor-pointer hover:bg-gray-100" onClick={() => setSelectedStylist({ id: String(stat.user_id), name: stat.stylish })}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {stat.stylish}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                                    ${(stat.total_service_price || 0).toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                                    ${(stat.total_product_price || 0).toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                                    ${stat.total_tips.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                                    {stat.service_count}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                                    {stat.product_count || 0}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Services for selected stylist */}
                        {selectedStylist && (
                            <div className="mt-10">
                                <h2 className="text-xl font-semibold mb-4">Services for {selectedStylist.name}</h2>
                                {isLoadingStylistServices && <p>Loading services...</p>}
                                {!isLoadingStylistServices && stylistServices && stylistServices.length > 0 && (
                                    <div className="overflow-x-auto bg-white shadow rounded-lg">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tip</th>
                                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {stylistServices.map((svc: Service) => (
                                                    <Fragment key={svc.id}>
                                                        <tr
                                                            className="cursor-pointer hover:bg-gray-50"
                                                            onClick={() =>
                                                                setExpandedServiceId((prev) =>
                                                                    prev === svc.id ? null : svc.id
                                                                )
                                                            }
                                                        >
                                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                                                {svc.name}
                                                            </td>
                                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                                                {svc.customer || "-"}
                                                            </td>
                                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                                                                ${svc.price.toFixed(2)}
                                                            </td>
                                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                                                                ${(svc.tip || 0).toFixed(2)}
                                                            </td>
                                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                                                {new Date(svc.date).toLocaleDateString()}
                                                            </td>
                                                        </tr>

                                                        {expandedServiceId === svc.id && (
                                                            <tr className="bg-gray-50">
                                                                <td colSpan={5} className="px-4 py-4 text-sm text-gray-700">
                                                                    <div className="space-y-2">
                                                                        <div>
                                                                            <span className="font-medium">Notes:</span>{" "}
                                                                            {svc.notes || "—"}
                                                                        </div>
                                                                        <div>
                                                                            <span className="font-medium">Payments:</span>
                                                                            {svc.payments && svc.payments.length > 0 ? (
                                                                                <ul className="list-disc list-inside ml-4 mt-1">
                                                                                    {svc.payments.map((p: PaymentDetail, idx: number) => (
                                                                                        <li key={idx}>
                                                                                            {p.method}: ${p.amount.toFixed(2)}{" "}
                                                                                            {p.label ? `(${p.label})` : ""}
                                                                                        </li>
                                                                                    ))}
                                                                                </ul>
                                                                            ) : (
                                                                                <span> —</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </Fragment>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                {!isLoadingStylistServices && stylistServices && stylistServices.length === 0 && (
                                    <p className="text-gray-500">No services found for this stylist in this cycle.</p>
                                )}
                                 
                                 {/* Products for selected stylist */}
                                 <h2 className="text-xl font-semibold mb-4 mt-8">Products for {selectedStylist.name}</h2>
                                 {isLoadingStylistProducts && <p>Loading products...</p>}
                                 {!isLoadingStylistProducts && stylistProducts && stylistProducts.length > 0 && (
                                     <div className="overflow-x-auto bg-white shadow rounded-lg">
                                         <table className="min-w-full divide-y divide-gray-200">
                                             <thead className="bg-gray-50">
                                                 <tr>
                                                     <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                                     <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                                                     <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                                 </tr>
                                             </thead>
                                             <tbody className="bg-white divide-y divide-gray-200">
                                                 {stylistProducts.map((product: Product) => (
                                                     <Fragment key={product.id}>
                                                         <tr
                                                             className="cursor-pointer hover:bg-gray-50"
                                                             onClick={() =>
                                                                 setExpandedServiceId((prev) =>
                                                                     prev === product.id ? null : product.id
                                                                 )
                                                             }
                                                         >
                                                             <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                                                 {product.name}
                                                             </td>
                                                             <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                                                                 ${product.price.toFixed(2)}
                                                             </td>
                                                             <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                                                 {new Date(product.date).toLocaleDateString()}
                                                             </td>
                                                         </tr>

                                                         {expandedServiceId === product.id && (
                                                             <tr className="bg-gray-50">
                                                                 <td colSpan={3} className="px-4 py-4 text-sm text-gray-700">
                                                                     <div className="space-y-2">
                                                                         <div>
                                                                             <span className="font-medium">Notes:</span>{" "}
                                                                             {product.notes || "—"}
                                                                         </div>
                                                                         <div>
                                                                             <span className="font-medium">Payments:</span>
                                                                             {product.payments && product.payments.length > 0 ? (
                                                                                 <ul className="list-disc list-inside ml-4 mt-1">
                                                                                     {product.payments.map((p: PaymentDetail, idx: number) => (
                                                                                         <li key={idx}>
                                                                                             {p.method}: ${p.amount.toFixed(2)}{" "}
                                                                                             {p.label ? `(${p.label})` : ""}
                                                                                         </li>
                                                                                     ))}
                                                                                 </ul>
                                                                             ) : (
                                                                                 <span> —</span>
                                                                             )}
                                                                         </div>
                                                                     </div>
                                                                 </td>
                                                             </tr>
                                                         )}
                                                     </Fragment>
                                                 ))}
                                             </tbody>
                                         </table>
                                     </div>
                                 )}
                                 {!isLoadingStylistProducts && stylistProducts && stylistProducts.length === 0 && (
                                     <p className="text-gray-500">No products found for this stylist in this cycle.</p>
                                 )}
                             </div>
                         )}

                        {!isLoadingStats && cycleStats && cycleStats.length === 0 && (
                            <div className="mt-6 text-center text-gray-500">
                                No services found for this cycle.
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
