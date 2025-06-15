'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/lib/hooks';
import { Scissors, Calendar, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAppSelector((state) => state.auth);

  useEffect(() => {
    // Wait until the initial loading is complete before redirecting
    if (!loading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, loading, router]);

  const features = [
    {
      icon: Calendar,
      title: 'Bi-weekly Cycles',
      description: 'Organize your services into manageable bi-weekly periods',
    },
    {
      icon: TrendingUp,
      title: 'Track Earnings',
      description: 'Monitor your service revenue and commission earnings',
    },
    {
      icon: Users,
      title: 'Client Management',
      description: 'Keep detailed records of all your client services',
    },
    {
      icon: Scissors,
      title: 'Service Types',
      description: 'Support for all salon services from cuts to treatments',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-cream-50 to-rose-100">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <div className="mx-auto w-20 h-20 bg-rose-gold rounded-full flex items-center justify-center mb-8">
              <Scissors className="w-10 h-10 text-white" />
            </div>
            
            <h1 className="text-5xl sm:text-6xl font-bold text-gray-800 mb-6">
              Tableau de <span className="text-rose-gold">Katia</span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Professional salon service management made simple. Track your services, 
              monitor earnings, and manage your business with elegant efficiency.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => router.push('/register')}
                className="bg-rose-gold hover:bg-rose-gold/90 text-white px-8 py-3 h-12 text-lg font-medium"
              >
                Get Started
              </Button>
              <Button
                onClick={() => router.push('/login')}
                variant="outline"
                className="border-rose-gold text-rose-gold hover:bg-rose-gold hover:text-white px-8 py-3 h-12 text-lg font-medium"
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Everything you need to manage your salon
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Designed specifically for salon professionals who want to focus on their craft 
              while keeping track of their business.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => (
              <Card key={feature.title} className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-rose-gold rounded-lg flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            Ready to streamline your salon management?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Join salon professionals who trust Tableau de Katia to manage their services efficiently.
          </p>
          <Button
            onClick={() => router.push('/register')}
            className="bg-rose-gold hover:bg-rose-gold/90 text-white px-8 py-3 h-12 text-lg font-medium"
          >
            Start Your Free Account
          </Button>
        </div>
      </div>
    </div>
  );
}