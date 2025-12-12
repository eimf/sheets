"use client";

import { useEffect, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import {
    useGetCyclesQuery,
    useCreateCycleMutation,
    useDeleteCycleMutation,
    useGetServicesQuery,
    Cycle,
    NewCycle,
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
import CycleNotesDialog from "@/components/dashboard/CycleNotesDialog";
import DeleteConfirmationModal from "@/components/dashboard/DeleteConfirmationModal";
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
    const [isCreateCycleFormOpen, setIsCreateCycleFormOpen] = useState(false);
    const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [addCycle, { isLoading: isAddingCycle }] = useCreateCycleMutation();
    const [deleteCycle, { isLoading: isDeletingCycle }] =
        useDeleteCycleMutation();

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

    const handleDeleteCycle = async () => {
        if (!currentCycleId || !cycles) return;

        const cycleToDelete = cycles.find(
            (c: Cycle) => String(c.id) === String(currentCycleId)
        );
        if (!cycleToDelete) return;

        try {
            await deleteCycle(currentCycleId).unwrap();
            toast.success(
                `Cycle "${
                    cycleToDelete.name ||
                    `${formatDate(cycleToDelete.startDate)} - ${formatDate(
                        cycleToDelete.endDate
                    )}`
                }" deleted successfully!`
            );
            setIsDeleteModalOpen(false);
            // Clear the selection since the cycle no longer exists
            onCycleChange("");
        } catch (err) {
            console.error("Failed to delete cycle:", err);
            const errorMessage =
                (err as any)?.data?.message || "An unexpected error occurred.";
            toast.error(`Error deleting cycle: ${errorMessage}`);
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

    // Automatically select the current cycle for 'user' role (stylish should see the cycle that contains today's date)
    useEffect(() => {
        if (isUserRole && cycles && cycles.length > 0) {
            // Get today's date in CST timezone (America/Chicago)
            // This ensures we're comparing dates correctly regardless of the user's local timezone
            // Use Intl.DateTimeFormat to extract date parts directly, avoiding unreliable string parsing
            const now = new Date();
            const cstFormatter = new Intl.DateTimeFormat("en-US", {
                timeZone: "America/Chicago",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
            });
            const parts = cstFormatter.formatToParts(now);
            const year = parts.find((p) => p.type === "year")?.value || "";
            const month = parts.find((p) => p.type === "month")?.value || "";
            const day = parts.find((p) => p.type === "day")?.value || "";
            const todayDateString = `${year}-${month}-${day}`;

            // Find the cycle that contains today's date (startDate <= today <= endDate)
            const currentCycle = cycles.find((cycle: Cycle) => {
                if (!cycle.startDate || !cycle.endDate) return false;
                // Compare date strings directly (YYYY-MM-DD format allows string comparison)
                return (
                    cycle.startDate <= todayDateString &&
                    cycle.endDate >= todayDateString
                );
            });

            // If no cycle contains today's date, fall back to the latest cycle by start_date
            const cycleToSelect = currentCycle || cycles[0];

            // Only update if the selected cycle is different from the current one
            if (
                cycleToSelect &&
                String(cycleToSelect.id) !== String(currentCycleId)
            ) {
                console.log(
                    `[DEBUG] User role - Selecting ${
                        currentCycle ? "current" : "latest"
                    } cycle: ${cycleToSelect.id} (${
                        cycleToSelect.startDate
                    } - ${
                        cycleToSelect.endDate
                    }), today (CST): ${todayDateString}`
                );
                onCycleChange(cycleToSelect.id);
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

    // Get current cycle for notes display
    const currentCycle = cycles?.find(
        (c: Cycle) => String(c.id) === String(currentCycleId)
    );

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
                {currentCycleId && (
                    <>
                        <Button
                            onClick={() => setIsNotesDialogOpen(true)}
                            variant="outline"
                            className="w-full sm:w-auto"
                        >
                            {currentCycle?.notes ? "Edit Notes" : "Add Notes"}
                        </Button>
                        <Button
                            onClick={() => setIsDeleteModalOpen(true)}
                            variant="destructive"
                            className="w-full sm:w-auto"
                            disabled={isDeletingCycle}
                        >
                            Delete Cycle
                        </Button>
                    </>
                )}
            </div>
            {/* Display cycle notes if they exist */}
            {currentCycle?.notes && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                                Cycle Notes:
                            </h3>
                            <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                                {currentCycle.notes}
                            </p>
                        </div>
                        <Button
                            onClick={() => setIsNotesDialogOpen(true)}
                            variant="ghost"
                            size="sm"
                            className="ml-2 text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100"
                        >
                            Edit
                        </Button>
                    </div>
                </div>
            )}
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
            <CycleNotesDialog
                cycle={currentCycle || null}
                isOpen={isNotesDialogOpen}
                onClose={() => setIsNotesDialogOpen(false)}
            />
            <DeleteConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteCycle}
                title="Delete Cycle"
                description={
                    currentCycle
                        ? `Are you sure you want to delete the cycle "${
                              currentCycle.name ||
                              `${formatDate(
                                  currentCycle.startDate
                              )} - ${formatDate(currentCycle.endDate)}`
                          }"? This will also delete all associated services. This action cannot be undone.`
                        : "Are you sure you want to delete this cycle? This will also delete all associated services. This action cannot be undone."
                }
                isLoading={isDeletingCycle}
            />
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
