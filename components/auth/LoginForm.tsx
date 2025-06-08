'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLoginMutation } from '@/lib/api';
import { useAppDispatch } from '@/lib/hooks';
import { setCredentials } from '@/lib/slices/authSlice';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginData = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [login, { isLoading }] = useLoginMutation();
  const dispatch = useAppDispatch();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginData) => {
    try {
      const result = await login(data).unwrap();
      console.log('Login result:', result);
      
      if (result.success && result.token && result.user) {
        // Validate token format
        if (!result.token || typeof result.token !== 'string' || result.token.length !== 36) {
          console.error('Invalid token received from server:', result.token);
          toast.error('Invalid token received from server');
          return;
        }

        // Validate user data
        if (!result.user || typeof result.user !== 'object') {
          console.error('Invalid user data received from server:', result.user);
          toast.error('Invalid user data received from server');
          return;
        }

        dispatch(setCredentials({
          user: result.user,
          token: result.token,
        }));
        toast.success('Welcome back! Login successful.');
        router.push('/dashboard');
      } else {
        console.error('Login failed:', result);
        toast.error(result.message || 'Login failed');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.data?.message || 'An error occurred during login');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-cream-50 to-rose-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="text-center pb-8">
          <div className="mx-auto w-16 h-16 bg-rose-gold rounded-full flex items-center justify-center mb-4">
            <Scissors className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-800">
            Welcome Back
          </CardTitle>
          <CardDescription className="text-gray-600">
            Sign in to Tablea de Katia salon management
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                className="h-11 border-gray-200 focus:border-rose-gold focus:ring-rose-gold/20"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  className="h-11 pr-10 border-gray-200 focus:border-rose-gold focus:ring-rose-gold/20"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-rose-gold hover:bg-rose-gold/90 text-white font-medium transition-colors"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <button
                onClick={() => router.push('/register')}
                className="text-rose-gold hover:text-rose-gold/80 font-medium transition-colors"
              >
                Sign up here
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}