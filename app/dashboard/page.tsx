"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/lib/hooks";
import Header from "@/components/dashboard/Header";
import { useState } from "react";
import ServicesList from "@/components/dashboard/ServicesList";
import CycleManager from "@/components/dashboard/CycleManager";

export default function DashboardPage() {
    const router = useRouter();
    const { isAuthenticated, user, loading } = useAppSelector(
        (state) => state.auth
    );
    const [currentCycleId, setCurrentCycleId] = useState<string | null>(null);

    useEffect(() => {
        if (!loading && !isAuthenticated) {
            router.push("/login");
        }
    }, [isAuthenticated, loading, router]);

    if (loading || !isAuthenticated) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p>Loading...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            <Header />
            <main className="flex-1 p-4 sm:p-6 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <CycleManager
                        currentCycleId={currentCycleId}
                        onCycleChange={setCurrentCycleId}
                    />
                    {currentCycleId && (
                        <ServicesList currentCycleId={currentCycleId} />
                    )}
                </div>
            </main>
        </div>
    );
}
