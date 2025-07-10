"use client";

import { useGetUserCycleStatsQuery } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

interface CycleStatsProps {
  cycleId: string;
}

export default function CycleStats({ cycleId }: CycleStatsProps) {
  const { data: stats, isLoading, error } = useGetUserCycleStatsQuery(
    cycleId,
    { skip: !cycleId }
  );

  if (isLoading) {
    return <div className="animate-pulse p-4 bg-gray-100 rounded-lg h-24"></div>;
  }

  if (error || !stats) {
    return (
      <div className="text-red-500 flex items-center p-4 bg-red-50 rounded-lg">
        <AlertCircle className="mr-2 h-5 w-5" />
        Failed to load cycle statistics
      </div>
    );
  }

  // Find the user's stats from the cycle stats array
  const userStats = stats.length > 0 ? stats[0] : null;
  
  if (!userStats) {
    return (
      <div className="text-gray-500 p-4 bg-gray-50 rounded-lg">
        No statistics available for this cycle yet
      </div>
    );
  }

  // Calculate totals
  const totalServiceEarnings = userStats.total_service_price || 0;
  const totalTips = userStats.total_tips || 0;
  const totalProductEarnings = userStats.total_product_price || 0;

  const totalEarnings = totalServiceEarnings + totalTips + totalProductEarnings;

  // Cards have been removed as requested
  return null;
}
