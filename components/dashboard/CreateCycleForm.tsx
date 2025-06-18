"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { NewCycle } from "@/lib/api"; // Import NewCycle type

interface CreateCycleFormProps {
  onSubmit: (data: NewCycle) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export default function CreateCycleForm({ onSubmit, onCancel, isLoading }: CreateCycleFormProps) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate || !endDate) {
      toast.error("All fields are required. Start date and end date must be provided.");
      return;
    }
    // Ensure dates are in YYYY-MM-DD format if necessary, though type="date" usually handles this.
    await onSubmit({ name, startDate, endDate });
    // Clearing fields can be done here if onSubmit doesn't navigate away or if it's desired UX
    // setName("");
    // setStartDate("");
    // setEndDate("");
  };

  return (
    <form className="space-y-4 p-4 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-md max-w-md mx-auto" onSubmit={handleSubmit}>
      <div>
        <label className="block text-sm font-medium mb-1">Cycle Name</label>
        <input
          type="text"
          className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-300"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <input
            type="date"
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-300"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            required
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">End Date</label>
          <input
            type="date"
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-300"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="flex justify-end space-x-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          {isLoading ? "Creating..." : "Create Cycle"}
        </Button>
      </div>
    </form>
  );
}
