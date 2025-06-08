'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/lib/hooks';
import Header from '@/components/dashboard/Header';
import CycleSelector from '@/components/dashboard/CycleSelector';
import ServicesList from '@/components/dashboard/ServicesList';

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAppSelector((state) => state.auth);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  useEffect(() => {
    // Wait for initial check to be done before checking auth
    if (initialCheckDone && !isAuthenticated && !loading) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router, initialCheckDone]);

  // Set initial check done after first render
  useEffect(() => {
    setInitialCheckDone(true);
  }, []);

  // Show loading state while checking auth
  if (!initialCheckDone) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 via-white to-rose-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Service Dashboard</h1>
            <p className="text-gray-600">Track and manage your salon services by bi-weekly cycles</p>
          </div>
          
          <CycleSelector />
          <ServicesList />
        </div>
      </main>
    </div>
  );
}