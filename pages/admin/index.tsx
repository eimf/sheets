import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useGetProfileQuery } from '@/lib/api';
import { useGetAdminCyclesQuery, useGetCycleStatsQuery, CycleStats } from '@/lib/adminApi';
import { formatCurrency } from '@/lib/utils';

interface Cycle {
    id: string | number;
    name: string;
    startDate?: string;
    endDate?: string;
}

const AdminDashboard = () => {
    const router = useRouter();
    const [selectedCycleId, setSelectedCycleId] = useState<string>('');
    
    // Check if user is admin
    const { data: user, isLoading: isLoadingUser, isError } = useGetProfileQuery();
    const { data: cycles = [], isLoading: isLoadingCycles } = useGetAdminCyclesQuery(undefined, {
        skip: !user || user.role !== 'admin',
    });
    const { data: stats = [], isLoading: isLoadingStats } = useGetCycleStatsQuery(selectedCycleId, {
        skip: !selectedCycleId,
    });

    // Redirect non-admin users
    useEffect(() => {
        if (!isLoadingUser && user?.role !== 'admin') {
            router.push('/dashboard');
        }
    }, [user, isLoadingUser, router]);

    // Set the latest cycle as selected by default
    useEffect(() => {
        if (cycles.length > 0 && !selectedCycleId) {
            setSelectedCycleId(cycles[0].id.toString());
        }
    }, [cycles, selectedCycleId]);

    if (isLoadingUser || isLoadingCycles) {
        return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
    }

    if (isError || user?.role !== 'admin') {
        return <div className="flex items-center justify-center min-h-screen">Access Denied</div>;
    }

    const selectedCycle = cycles.find((cycle: Cycle) => cycle.id.toString() === selectedCycleId);

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
            
            <div className="mb-6">
                <label htmlFor="cycle-select" className="block text-sm font-medium text-gray-700 mb-2">
                    Select Cycle:
                </label>
                <select
                    id="cycle-select"
                    value={selectedCycleId}
                    onChange={(e) => setSelectedCycleId(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                    {cycles.map((cycle: Cycle) => (
                        <option key={cycle.id} value={cycle.id}>
                            {cycle.name}
                        </option>
                    ))}
                </select>
            </div>

            {selectedCycle && (
                <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">
                        {selectedCycle.name} - Statistics
                    </h2>
                    
                    {isLoadingStats ? (
                        <div>Loading statistics...</div>
                    ) : stats.length === 0 ? (
                        <div>No data available for this cycle</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stylist</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Services</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Revenue</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Tips</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {stats.map((stat: CycleStats, index: number) => (
                                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {stat.stylish}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                                {stat.service_count}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                                {formatCurrency(stat.total_price)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                                {formatCurrency(stat.total_tips)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                                                {formatCurrency(stat.total_price + stat.total_tips)}
                                            </td>
                                        </tr>
                                    ))}
                                    {/* Totals row */}
                                    {stats.length > 0 && (
                                        <tr className="bg-gray-50 font-semibold">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                Totals
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                                {stats.reduce((sum: number, stat: CycleStats) => sum + stat.service_count, 0)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                                {formatCurrency(stats.reduce((sum: number, stat: CycleStats) => sum + stat.total_price, 0))}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                                {formatCurrency(stats.reduce((sum: number, stat: CycleStats) => sum + stat.total_tips, 0))}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                                                {formatCurrency(
                                                    stats.reduce((sum: number, stat: CycleStats) => sum + stat.total_price + stat.total_tips, 0)
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
