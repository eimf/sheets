"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { NewCycle } from "@/lib/api"; // Import NewCycle type

interface CreateCycleFormProps {
    onSubmit: (data: NewCycle) => Promise<void>;
    onCancel: () => void;
    isLoading: boolean;
}

// Format date to match the display format used in CycleManager
const formatDate = (dateString: string): string => {
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

export default function CreateCycleForm({
    onSubmit,
    onCancel,
    isLoading,
}: CreateCycleFormProps) {
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [notes, setNotes] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!startDate || !endDate) {
            toast.error("Start date and end date must be provided.");
            return;
        }
        // Generate name from dates in the format: "MMM DD, YYYY - MMM DD, YYYY"
        const name = `${formatDate(startDate)} - ${formatDate(endDate)}`;
        await onSubmit({
            name,
            startDate,
            endDate,
            notes: notes.trim() || undefined,
        });
    };

    return (
        <form
            className="space-y-4 p-4 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-md max-w-md mx-auto"
            onSubmit={handleSubmit}
        >
            <div className="flex gap-4">
                <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">
                        Start Date
                    </label>
                    <input
                        type="date"
                        className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-300"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                    />
                </div>
                <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">
                        End Date
                    </label>
                    <input
                        type="date"
                        className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-300"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                    />
                </div>
            </div>
            <div>
                <Label
                    htmlFor="notes"
                    className="block text-sm font-medium mb-1"
                >
                    Notes{" "}
                    <span className="text-xs text-gray-500">
                        (optional - e.g., future deductions)
                    </span>
                </Label>
                <Textarea
                    id="notes"
                    placeholder="Add notes about this cycle, such as future deductions, special instructions, etc."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="resize-none"
                />
            </div>
            <div className="flex justify-end space-x-3">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={isLoading}
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    disabled={isLoading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                    {isLoading ? "Creating..." : "Create Cycle"}
                </Button>
            </div>
        </form>
    );
}
