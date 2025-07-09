"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/lib/hooks";
import Header from "@/components/dashboard/Header";
import { useState } from "react";
import ServicesList from "@/components/dashboard/ServicesList";
import ProductsList from "@/components/dashboard/ProductsList";
import CycleManager from "@/components/dashboard/CycleManager";

export default function DashboardPage() {
    const router = useRouter();
    const { isAuthenticated, user, loading } = useAppSelector(
        (state) => state.auth
    );
    const [currentCycleId, setCurrentCycleId] = useState<string | null>(null);

    useEffect(() => {
        if (!loading && !isAuthenticated) {
            router.replace("/login");
        } else if (!loading && user?.role === "admin") {
            router.replace("/admin/dashboard");
        }
    }, [isAuthenticated, loading, router, user]);

    if (loading || !isAuthenticated || user?.role === "admin") {
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
                    <CycleManager
                        currentCycleId={currentCycleId}
                        onCycleChange={setCurrentCycleId}
                        showCreateButton={false}
                    />
                    {currentCycleId && (
                        <div className="space-y-8">
                            <ServicesList currentCycleId={currentCycleId} />
                            <ProductsList currentCycleId={currentCycleId} />
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
