"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useUpdateCycleMutation } from "@/lib/api";
import { toast } from "sonner";
import { Cycle } from "@/lib/api";

interface CycleNotesDialogProps {
    cycle: Cycle | null;
    isOpen: boolean;
    onClose: () => void;
}

export default function CycleNotesDialog({
    cycle,
    isOpen,
    onClose,
}: CycleNotesDialogProps) {
    const [notes, setNotes] = useState("");
    const [updateCycle, { isLoading }] = useUpdateCycleMutation();

    useEffect(() => {
        if (cycle) {
            setNotes(cycle.notes || "");
        } else {
            setNotes("");
        }
    }, [cycle, isOpen]);

    const handleSave = async () => {
        if (!cycle) return;

        try {
            await updateCycle({
                id: cycle.id,
                notes: notes.trim() || undefined,
            }).unwrap();
            toast.success("Cycle notes updated successfully");
            onClose();
        } catch (err: any) {
            toast.error(err?.data?.error || "Failed to update cycle notes");
        }
    };

    const formatDate = (dateString: string | undefined): string => {
        if (!dateString) return "";
        const date = new Date(`${dateString}T00:00:00`);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    const isFutureCycle = () => {
        if (!cycle?.startDate) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = new Date(`${cycle.startDate}T00:00:00`);
        return startDate > today;
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Edit Cycle Notes</DialogTitle>
                    <DialogDescription>
                        {cycle && (
                            <>
                                {cycle.startDate && cycle.endDate
                                    ? `${formatDate(
                                          cycle.startDate
                                      )} - ${formatDate(cycle.endDate)}`
                                    : cycle.name}
                                {isFutureCycle() && (
                                    <span className="ml-2 text-blue-600 font-medium">
                                        (Future Cycle)
                                    </span>
                                )}
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="notes">
                            Notes{" "}
                            <span className="text-xs text-gray-500">
                                (e.g., future deductions, special instructions)
                            </span>
                        </Label>
                        <Textarea
                            id="notes"
                            placeholder="Add notes about this cycle, such as future deductions, special instructions, etc."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={8}
                            className="resize-none"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        {isLoading ? "Saving..." : "Save Notes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
