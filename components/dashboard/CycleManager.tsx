"use client";

import { useState } from 'react';
import { useGetCyclesQuery, useAddCycleMutation, Cycle } from '@/lib/api';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CycleManagerProps {
    currentCycleId: string | null;
    onCycleChange: (cycleId: string) => void;
}

export default function CycleManager({ currentCycleId, onCycleChange }: CycleManagerProps) {
    const { data: cycles, isLoading, isError, error } = useGetCyclesQuery();
    const [addCycle, { isLoading: isAddingCycle }] = useAddCycleMutation();

    const handleCreateCycle = async () => {
        try {
            const startDate = new Date();
            const cycleName = `Cycle of ${startDate.toLocaleDateString()}`;

            const newCycle = await addCycle({ 
                name: cycleName,
                startDate: startDate.toISOString()
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

    return (
        <div className="flex items-center space-x-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <div className="flex-grow">
                <Select
                    value={currentCycleId || ""}
                    onValueChange={(value) => onCycleChange(value)}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a cycle" />
                    </SelectTrigger>
                    <SelectContent>
                        {cycles && cycles.map((cycle: Cycle) => (
                            <SelectItem key={cycle.id} value={cycle.id}>
                                {cycle.startDate && cycle.endDate
                                    ? `${new Date(cycle.startDate).toLocaleDateString()} - ${new Date(cycle.endDate).toLocaleDateString()}`
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
