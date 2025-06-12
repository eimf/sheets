"use client";

import { useEffect } from "react";
import { useGetCyclesQuery, useAddCycleMutation, useGetServicesForCycleQuery, Cycle } from "@/lib/api";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import { selectAuth } from "@/lib/slices/authSlice";

interface CycleManagerProps {
    currentCycleId: string | null;
    onCycleChange: (cycleId: string) => void;
}

export default function CycleManager({
    currentCycleId,
    onCycleChange,
}: CycleManagerProps) {
    const { data: cycles, isLoading, isError, error } = useGetCyclesQuery();
    const [addCycle, { isLoading: isAddingCycle }] = useAddCycleMutation();

    // Fetch services for the selected cycle (if any)
    const { data: servicesForCycle } = useGetServicesForCycleQuery(currentCycleId!, {
        skip: !currentCycleId,
    });

    const auth = useSelector(selectAuth);
    const isUserRole = auth.user?.role === "user";

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

    // Automatically select closest cycle for 'user' role
    useEffect(() => {
        if (isUserRole && cycles && cycles.length > 0 && !currentCycleId) {
            onCycleChange(cycles[0].id);
        }
    }, [isUserRole, cycles, currentCycleId, onCycleChange]);

    const handleCreateCycle = async () => {
        if (isUserRole) return; // extra guard
        try {
            const startDate = new Date();
            const cycleName = `Cycle of ${startDate.toLocaleDateString()}`;

            const newCycle = await addCycle({
                name: cycleName,
                startDate: startDate.toISOString(),
            }).unwrap();

            toast.success("New cycle created successfully!");
            onCycleChange(newCycle.id);
        } catch (err) {
            console.error("Failed to create cycle:", err);
            toast.error("Failed to create new cycle.");
        }
    };

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
        <div className="flex items-center space-x-4 bg-white dark:bg-gray-900 shadow rounded-lg p-6 border-l-4 border-indigo-500">
            <div className="flex-grow">
                <Select
                    value={currentCycleId || ""}
                    onValueChange={(value) => onCycleChange(value)}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a cycle" />
                    </SelectTrigger>
                    <SelectContent>
                        {cycles &&
                            cycles.map((cycle: Cycle) => (
                                <SelectItem key={cycle.id} value={cycle.id}>
                                    {cycle.startDate && cycle.endDate
                                        ? `${formatDate(
                                              cycle.startDate
                                          )} - ${formatDate(cycle.endDate)}`
                                        : cycle.name}
                                </SelectItem>
                            ))}
                    </SelectContent>
                </Select>
            </div>
            <Button onClick={handleCreateCycle} disabled={isAddingCycle}>
                {isAddingCycle ? "Creating..." : "Create New Cycle"}
            </Button>
        </div>
    );
}
