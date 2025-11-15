"use client";

import { useGetUserCycleStatsQuery, useGetProfileQuery } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

interface CycleStatsProps {
  cycleId: string;
}

export default function CycleStats({ cycleId }: CycleStatsProps) {
  // Get the current user's profile to get the userId
  const { data: user } = useGetProfileQuery();
  const userId = user?.id;

  // Use the userId and cycleId to fetch the user's stats for this cycle
  const { data: stats, isLoading, error } = useGetUserCycleStatsQuery(
    { userId: userId || '', cycleId },
    { skip: !cycleId || !userId }
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

  // Since we're querying for a specific user, we don't need to find the user in an array
  const userStats = stats;

  // Calculate totals
  const totalServiceEarnings = userStats.total_service_price || 0;
  const totalTips = userStats.total_tips || 0;
  const totalProductEarnings = userStats.total_product_price || 0;

  const totalEarnings = totalServiceEarnings + totalTips + totalProductEarnings;

  // Return an empty container instead of null to maintain consistent hook execution
  return <div className="hidden"></div>;
}
