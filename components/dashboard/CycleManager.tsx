"use client";

import { useEffect } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { 
  useGetCyclesQuery, 
  useCreateCycleMutation, 
  useGetServicesQuery, 
  Cycle 
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

export default function CycleManager({
    currentCycleId,
    onCycleChange,
    showCreateButton = true,
}: CycleManagerProps) {
    // ...existing hooks and state

    // Placeholder handler for "New Cycle" button
    const handleCreateCycle = () => {
        // TODO: Implement logic to create a new cycle
        console.log('Create Cycle button clicked');
    }
    const { data: cycles, isLoading, isError, error } = useGetCyclesQuery();
    const [addCycle, { isLoading: isAddingCycle }] = useCreateCycleMutation();

    // Fetch services for the selected cycle (if any)
    const { data: servicesForCycle } = useGetServicesQuery(
        currentCycleId || undefined,
        { skip: !currentCycleId }
    );

    const auth = useSelector(selectAuth);
    const isUserRole = auth.user?.role === "user";
    const isAdminRole = auth.user?.role === "admin";

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

    // Automatically select cycle for today for 'user' role
    useEffect(() => {
        if (isUserRole && cycles && cycles.length > 0 && !currentCycleId) {
            const today = new Date();
            const todayStr = today.toISOString().slice(0, 10); // YYYY-MM-DD
            const found = cycles.find(
                (c: Cycle) =>
                    c.startDate !== undefined &&
                    c.endDate !== undefined &&
                    c.startDate <= todayStr &&
                    c.endDate >= todayStr
            );
            if (found) {
                onCycleChange(found.id);
            } else {
                // If no cycle matches today, do not select any (or fallback logic)
                onCycleChange("");
            }
        }
    }, [isUserRole, cycles, currentCycleId, onCycleChange]);


    if (isLoading) return <div>Loading cycles...</div>;
    if (isError) {
        console.error("Error fetching cycles:", error);
        return <div>Error loading cycles. Please try again.</div>;
    }

    if (isUserRole) {
        // Display readonly current cycle info
        const current = cycles && cycles[0];
        const totalPrice = servicesForCycle?.reduce((sum, s) => sum + s.price, 0) || 0;
        const totalTip = servicesForCycle?.reduce((sum, s) => sum + (s.tip || 0), 0) || 0;
        return (
            <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6 border-l-4 border-indigo-500">
                {current ? (
                    <span className="font-medium">
                        {current.startDate && current.endDate
                            ? `${formatDate(current.startDate)} - ${formatDate(
                                  current.endDate
                              )}`
                            : current.name}
                    </span>
                ) : (
                    <span>No cycle available.</span>
                )}
                {showCreateButton && (
                    <Button
                        onClick={handleCreateCycle}
                        disabled={isAddingCycle}
                        variant="outline"
                    >
                        New Cycle
                    </Button>
                )}


                {/* Totals Section */}
                {currentCycleId && (
                    <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="mr-4">Total: ${totalPrice.toFixed(2)}</span>
                        <span>Tips: ${totalTip.toFixed(2)}</span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <Select
                value={currentCycleId ?? ""}
                onValueChange={onCycleChange}
            >
                <SelectTrigger className="w-full max-w-xs">
                    <SelectValue placeholder="Select a cycle" />
                </SelectTrigger>
                <SelectContent>
                    {cycles?.map((cycle: Cycle) => (
                        <SelectItem key={cycle.id} value={cycle.id}>
                            {cycle.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {showCreateButton && isAdminRole && (
                <div className="mt-4">
                  <h2 className="text-lg font-semibold mb-2">Create New Cycle</h2>
                  <CreateCycleForm onSuccess={() => {}} />
                </div>
            )}
        </div>
    );
}
