'use client';

import { ChevronLeft, ChevronRight, Calendar, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { goToPreviousCycle, goToNextCycle, goToCurrentCycle } from '@/lib/slices/servicesSlice';
import { format, parseISO } from 'date-fns';

export default function CycleSelector() {
  const dispatch = useAppDispatch();
  const { currentCycle } = useAppSelector((state) => state.services);

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  const isCurrentCycle = () => {
    const today = new Date();
    const cycleStart = parseISO(currentCycle.startDate);
    const cycleEnd = parseISO(currentCycle.endDate);
    return today >= cycleStart && today <= cycleEnd;
  };

  return (
    <Card className="shadow-sm border-0 bg-gradient-to-r from-rose-50 to-cream-50">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-rose-gold rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Current Cycle</h2>
              <p className="text-sm text-gray-600">
                {formatDate(currentCycle.startDate)} - {formatDate(currentCycle.endDate)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => dispatch(goToPreviousCycle())}
              className="h-9 border-gray-200 hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => dispatch(goToCurrentCycle())}
              className="h-9 border-gray-200 hover:bg-gray-50"
              disabled={isCurrentCycle()}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => dispatch(goToNextCycle())}
              className="h-9 border-gray-200 hover:bg-gray-50"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {isCurrentCycle() && (
          <div className="mt-4 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700 font-medium flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              You're viewing the current active cycle
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}