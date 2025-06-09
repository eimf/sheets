'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Scissors, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRegisterMutation } from '@/lib/api';
import { useAppDispatch } from '@/lib/hooks';
import { setCredentials } from '@/lib/slices/authSlice';
import { toast } from 'sonner';

const registerSchema = z.object({
  stylish: z.string().min(2, 'Stylish name must be at least 2 characters'), // Renamed from fullName, username removed
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterData = z.infer<typeof registerSchema>;

export default function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [register, { isLoading }] = useRegisterMutation();
  const dispatch = useAppDispatch();
  const router = useRouter();

  const {
    register: registerField,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterData) => {
    try {
      const result = await register({
        stylish: data.stylish, // Renamed from fullName, username removed
        email: data.email,
        password: data.password,
      }).unwrap();
      
      if (result.success && result.token && result.user) {
        dispatch(setCredentials({
          user: result.user,
          token: result.token,
        }));
        toast.success('Account created successfully! Welcome to Tablea de Katia.');
        router.push('/dashboard');
      } else {
        toast.error(result.message || 'Registration failed');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.data?.message || 'An error occurred during registration');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-cream-50 to-rose-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="text-center pb-8">
          <div className="mx-auto w-16 h-16 bg-rose-gold rounded-full flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-800">
            Join Tablea de Katia
          </CardTitle>
          <CardDescription className="text-gray-600">
            Create your stylist account to get started
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="stylish" className="text-sm font-medium text-gray-700">
                Stylish
              </Label>
              <Input
                id="stylish"
                type="text"
                placeholder="Enter your stylish name"
                className="h-11 border-gray-200 focus:border-rose-gold focus:ring-rose-gold/20"
                {...registerField('stylish')}
              />
              {errors.stylish && (
                <p className="text-sm text-red-500">{errors.stylish.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                className="h-11 border-gray-200 focus:border-rose-gold focus:ring-rose-gold/20"
                {...registerField('email')}
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
                  placeholder="Create a password"
                  className="h-11 pr-10 border-gray-200 focus:border-rose-gold focus:ring-rose-gold/20"
                  {...registerField('password')}
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                Confirm Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  className="h-11 pr-10 border-gray-200 focus:border-rose-gold focus:ring-rose-gold/20"
                  {...registerField('confirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-rose-gold hover:bg-rose-gold/90 text-white font-medium transition-colors"
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <button
                onClick={() => router.push('/login')}
                className="text-rose-gold hover:text-rose-gold/80 font-medium transition-colors"
              >
                Sign in here
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}