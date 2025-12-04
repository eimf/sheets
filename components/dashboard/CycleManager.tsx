"use client";

import { useEffect } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import {
    useGetCyclesQuery,
    useCreateCycleMutation,
    useGetServicesQuery,
    Cycle,
    NewCycle, // Added NewCycle import
} from "@/lib/api";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import CreateCycleForm from "@/components/dashboard/CreateCycleForm";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import { selectAuth } from "@/lib/slices/authSlice";

interface CycleManagerProps {
    currentCycleId: string | null;
    onCycleChange: (cycleId: string) => void;
    showCreateButton?: boolean;
}

import { useState } from "react"; // Added useState

// ... (other imports remain the same)

export default function CycleManager({
    currentCycleId,
    onCycleChange,
    showCreateButton = true,
}: CycleManagerProps) {
    const [isCreateCycleFormOpen, setIsCreateCycleFormOpen] = useState(false);
    const [addCycle, { isLoading: isAddingCycle }] = useCreateCycleMutation();

    const handleCreateCycle = async (cycleData: Omit<Cycle, "id">) => {
        try {
            const newCycle = await addCycle(cycleData).unwrap();
            toast.success(`Cycle "${newCycle.name}" created successfully!`);
            // Optionally, trigger a re-fetch or update local state if needed
            // For example, if you want to automatically select the new cycle:
            // onCycleChange(newCycle.id);
        } catch (err) {
            console.error("Failed to create cycle:", err);
            const errorMessage =
                (err as any)?.data?.message || "An unexpected error occurred.";
            toast.error(`Error creating cycle: ${errorMessage}`);
        }
    };
    const { data: cycles, isLoading, isError, error } = useGetCyclesQuery();

    // Fetch services for the selected cycle (if any)
    const { data: servicesForCycle } = useGetServicesQuery(
        currentCycleId || undefined,
        { skip: !currentCycleId }
    );

    const auth = useSelector(selectAuth);
    const isUserRole = auth.user?.role === "user";
    const isAdminRole = auth.user?.role === "admin";

    // Validate that the current cycle ID exists in available cycles (for admin)
    useEffect(() => {
        if (isAdminRole && cycles && cycles.length > 0 && currentCycleId) {
            const cycleExists = cycles.some(
                (c: Cycle) => String(c.id) === String(currentCycleId)
            );
            if (!cycleExists) {
                console.log(
                    `[DEBUG] Stored cycle ID ${currentCycleId} not found in available cycles, clearing selection`
                );
                onCycleChange("");
            }
        }
    }, [isAdminRole, cycles, currentCycleId, onCycleChange]);

    const formatDate = (dateString: string | undefined): string => {
        if (!dateString) return "";
        // Appending T00:00:00 ensures the date is parsed in the user's local timezone
        // rather than UTC, which prevents off-by-one day errors.
        const date = new Date(`${dateString}T00:00:00`);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    // Automatically select latest cycle for 'user' role (stylish should always see the latest cycle)
    useEffect(() => {
        if (isUserRole && cycles && cycles.length > 0) {
            // Cycles are ordered by start_date DESC from the API, so cycles[0] is the latest
            const latestCycle = cycles[0];
            
            // Always select the latest cycle for user role, regardless of currentCycleId
            // This ensures stylish users always see the most recent cycle, even if localStorage has an old value
            if (latestCycle && String(latestCycle.id) !== String(currentCycleId)) {
                console.log(
                    `[DEBUG] User role - Selecting latest cycle: ${latestCycle.id} (${latestCycle.startDate} - ${latestCycle.endDate})`
                );
                onCycleChange(latestCycle.id);
            }
        }
    }, [isUserRole, cycles, currentCycleId, onCycleChange]);

    if (isLoading) return <div>Loading cycles...</div>;
    if (isError) {
        console.error("Error fetching cycles:", error);
        return <div>Error loading cycles. Please try again.</div>;
    }

    if (isUserRole) {
        // Display readonly current cycle info (must match the cycle chosen for today)
        const current = cycles?.find(
            (c: Cycle) => String(c.id) === String(currentCycleId)
        );
        const totalPrice =
            currentCycleId && servicesForCycle
                ? servicesForCycle.reduce((sum, s) => sum + s.price, 0)
                : 0;
        const totalTip =
            currentCycleId && servicesForCycle
                ? servicesForCycle.reduce((sum, s) => sum + (s.tip || 0), 0)
                : 0;

        return (
            <div className="bg-white dark:bg-gray-900 shadow rounded-lg px-4 py-2 border-l-4 border-indigo-500">
                {current ? (
                    <div className="font-medium">
                        {current.startDate && current.endDate
                            ? `${formatDate(current.startDate)} - ${formatDate(
                                  current.endDate
                              )}`
                            : current.name}
                    </div>
                ) : (
                    <div>No cycle available.</div>
                )}
                {/* Totals row - matches admin style */}
                {current && currentCycleId && servicesForCycle && (
                    <div className="mt-2 w-full flex flex-nowrap items-center justify-between bg-gray-50 dark:bg-gray-800/50 px-3 py-2 rounded-md">
                        <div className="flex items-center whitespace-nowrap pr-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400 mr-1">
                                Total:
                            </span>
                            <span className="text-sm font-medium">
                                ${totalPrice.toFixed(2)}
                            </span>
                        </div>
                        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-2"></div>
                        <div className="flex items-center whitespace-nowrap pl-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400 mr-1">
                                Tips:
                            </span>
                            <span className="text-sm font-medium">
                                ${totalTip.toFixed(2)}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Admin role UI: Cycle selector and create button
    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg shadow">
                <div className="w-full sm:w-auto">
                    <Select
                        value={currentCycleId ? String(currentCycleId) : ""}
                        onValueChange={onCycleChange}
                        disabled={isLoading || cycles?.length === 0}
                    >
                        <SelectTrigger className="w-full sm:w-[280px] bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                            <SelectValue placeholder="Select a cycle" />
                        </SelectTrigger>
                        <SelectContent>
                            {cycles && cycles.length > 0 ? (
                                cycles.map((cycle: Cycle) => (
                                    <SelectItem
                                        key={cycle.id}
                                        value={String(cycle.id)}
                                    >
                                        {cycle.startDate && cycle.endDate
                                            ? `${formatDate(
                                                  cycle.startDate
                                              )} - ${formatDate(cycle.endDate)}`
                                            : cycle.name}
                                    </SelectItem>
                                ))
                            ) : (
                                <SelectItem value="" disabled>
                                    No cycles available
                                </SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>
                {showCreateButton && (
                    <Button
                        onClick={() => setIsCreateCycleFormOpen(true)}
                        disabled={isAddingCycle}
                        className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        New Cycle
                    </Button>
                )}
            </div>
            {isCreateCycleFormOpen && (
                <CreateCycleForm
                    onSubmit={async (data: NewCycle) => {
                        // Typed data parameter
                        await handleCreateCycle(data);
                        setIsCreateCycleFormOpen(false); // Close form on successful submission
                    }}
                    onCancel={() => setIsCreateCycleFormOpen(false)}
                    isLoading={isAddingCycle}
                />
            )}
            {currentCycleId && servicesForCycle && (
                <div className="mt-2 w-full flex flex-nowrap items-center justify-between bg-gray-50 dark:bg-gray-800/50 px-3 py-2 rounded-md">
                    <div className="flex items-center whitespace-nowrap pr-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400 mr-1">
                            Total:
                        </span>
                        <span className="text-sm font-medium">
                            $
                            {(
                                servicesForCycle?.reduce(
                                    (sum, s) => sum + s.price,
                                    0
                                ) || 0
                            ).toFixed(2)}
                        </span>
                    </div>
                    <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-2"></div>
                    <div className="flex items-center whitespace-nowrap pl-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400 mr-1">
                            Tips:
                        </span>
                        <span className="text-sm font-medium">
                            $
                            {(
                                servicesForCycle?.reduce(
                                    (sum, s) => sum + (s.tip || 0),
                                    0
                                ) || 0
                            ).toFixed(2)}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
