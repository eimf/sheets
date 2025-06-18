"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCreateCycleMutation } from "@/lib/api";

export default function CreateCycleForm({ onSuccess }: { onSuccess?: () => void }) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [createCycle, { isLoading }] = useCreateCycleMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate || !endDate) {
      toast.error("All fields are required.");
      return;
    }
    try {
      await createCycle({ name, startDate, endDate }).unwrap();
      toast.success("Cycle created!");
      setName("");
      setStartDate("");
      setEndDate("");
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.data?.error || "Failed to create cycle.");
    }
  };

  return (
    <form className="space-y-4 p-4 bg-white rounded shadow max-w-md mx-auto" onSubmit={handleSubmit}>
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
      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? "Creating..." : "Create Cycle"}
      </Button>
    </form>
  );
}
