"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/lib/hooks";
import Header from "@/components/dashboard/Header";
import CycleManager from "@/components/dashboard/CycleManager";
import { useGetCycleStatsQuery, type CycleStats } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDashboardPage() {
    const router = useRouter();
    const { isAuthenticated, user, loading } = useAppSelector(
        (state) => state.auth
    );
    const [currentCycleId, setCurrentCycleId] = useState<string | null>(null);
    
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
                            showCreateButton={false}
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
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Revenue</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Tips</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Services</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {cycleStats.map((stat: CycleStats) => (
                                            <tr key={stat.stylish}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {stat.stylish}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                                    ${stat.total_price.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                                    ${stat.total_tips.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                                    {stat.service_count}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
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
