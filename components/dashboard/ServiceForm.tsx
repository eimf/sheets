'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Scissors, DollarSign, User, Calendar, FileText, CreditCard, Building2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { useCreateServiceMutation, useUpdateServiceMutation, type Service } from '@/lib/api';
import { selectAuth } from '@/lib/slices/authSlice';
import { toast } from 'sonner';

const serviceSchema = z.object({
  clientName: z.string().min(1, 'Client name is required'),
  serviceType: z.string().min(1, 'Service type is required'),
  customServiceType: z.string().optional(),
  paymentSource: z.string().min(1, 'Payment source is required'),
  customPaymentSource: z.string().optional(),
  price: z.string().min(1, 'Price is required').refine(
    (val) => !isNaN(parseFloat(val)),
    'Please enter a valid number'
  ),
  tip: z.string().optional().refine(
    (val) => !val || !isNaN(parseFloat(val)),
    'Please enter a valid number'
  ),
  serviceDate: z.string().min(1, 'Service date is required'),
  cycleStartDate: z.string(),
  cycleEndDate: z.string(),
  notes: z.string().optional(),
});

interface ServiceFormData {
  clientName: string;
  serviceType: string;
  customServiceType?: string;
  paymentSource: string;
  customPaymentSource?: string;
  price: string;
  tip?: string;
  serviceDate: string;
  cycleStartDate: string;
  cycleEndDate: string;
  notes?: string;
}

interface ServiceFormProps {
  service?: Service | null;
  onClose: () => void;
}

export default function ServiceForm({ service, onClose }: ServiceFormProps) {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { currentCycle } = useAppSelector((state) => state.services);
  const [createService, { isLoading: isCreating }] = useCreateServiceMutation();
  const [updateService, { isLoading: isUpdating }] = useUpdateServiceMutation();

  const isEditing = !!service;
  const isLoading = isCreating || isUpdating;

  const form = useForm({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      clientName: '',
      serviceType: '',
      customServiceType: '',
      paymentSource: '',
      customPaymentSource: '',
      price: '',
      tip: '',
      serviceDate: new Date().toISOString().slice(0, 16),
      cycleStartDate: currentCycle.startDate,
      cycleEndDate: currentCycle.endDate,
      notes: '',
    },
    mode: 'onChange',
  });

  const { register, handleSubmit, formState: { errors }, setValue, watch } = form;

  useEffect(() => {
    if (!isEditing) {
      setValue('cycleStartDate', currentCycle.startDate);
      setValue('cycleEndDate', currentCycle.endDate);
    }
  }, [currentCycle, setValue, isEditing]);

  // Populate form when editing
  useEffect(() => {
    if (service) {
      setValue('clientName', service.client_name);
      setValue('serviceType', service.service_type);
      setValue('customServiceType', service.custom_service_type || '');
      setValue('paymentSource', service.payment_source);
      setValue('customPaymentSource', service.custom_payment_source || '');
      setValue('price', service.price.toString());
      setValue('tip', service.tip?.toString() || '');
      setValue('serviceDate', service.service_date.slice(0, 16));
      setValue('notes', service.notes || '');
      setValue('cycleStartDate', service.cycle_start_date);
      setValue('cycleEndDate', service.cycle_end_date);
    }
  }, [service, setValue]);

  const onSubmit = async (data: ServiceFormData) => {
    try {
      if (!user?.id) {
        throw new Error('User ID is required');
      }

      const serviceData = {
        userId: user.id,
        clientName: data.clientName,
        serviceType: data.serviceType,
        customServiceType: data.customServiceType,
        paymentSource: data.paymentSource,
        customPaymentSource: data.customPaymentSource,
        price: parseFloat(data.price),
        tip: data.tip ? parseFloat(data.tip) : undefined,
        cycleStartDate: data.cycleStartDate,
        cycleEndDate: data.cycleEndDate,
        serviceDate: data.serviceDate,
        notes: data.notes || undefined,
      };

      if (isEditing && service) {
        await updateService({ id: service.id, ...serviceData }).unwrap();
        toast.success('Service updated successfully');
      } else {
        await createService(serviceData).unwrap();
        toast.success('Service created successfully');
      }

      onClose();
    } catch (error: any) {
      toast.error(error.data?.message || `Failed to ${isEditing ? 'update' : 'create'} service`);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-rose-gold rounded-lg flex items-center justify-center">
              <Scissors className="w-4 h-4 text-white" />
            </div>
            <span>{isEditing ? 'Edit Service' : 'Add New Service'}</span>
          </DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the service details below.' : 'Enter the details for the new service.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="clientName" className="text-sm font-medium text-gray-700 flex items-center">
              <User className="w-4 h-4 mr-2" />
              Client Name
            </Label>
            <Input
              id="clientName"
              placeholder="Enter client's name"
              className="h-11 border-gray-200 focus:border-rose-gold focus:ring-rose-gold/20"
              {...register('clientName')}
            />
            {errors.clientName && (
              <p className="text-sm text-red-500">{errors.clientName.message}</p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="serviceType">Service Type</Label>
              <Select {...register('serviceType')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="haircut">Haircut</SelectItem>
                  <SelectItem value="shave">Shave</SelectItem>
                  <SelectItem value="beard">Beard</SelectItem>
                  <SelectItem value="haircut_and_shave">Haircut & Shave</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {watch('serviceType') === 'other' && (
                <div className="mt-2">
                  <Label htmlFor="customServiceType">Custom Service Type</Label>
                  <Input {...register('customServiceType')} placeholder="Enter custom service type" />
                  {errors.customServiceType && (
                    <p className="mt-1 text-sm text-red-500">{errors.customServiceType.message}</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="paymentSource">Payment Source</Label>
              <Select {...register('paymentSource')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cashapp">CashApp</SelectItem>
                  <SelectItem value="zelle">Zelle</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {watch('paymentSource') === 'other' && (
                <div className="mt-2">
                  <Label htmlFor="customPaymentSource">Custom Payment Source</Label>
                  <Input {...register('customPaymentSource')} placeholder="Enter custom payment type" />
                  {errors.customPaymentSource && (
                    <p className="mt-1 text-sm text-red-500">{errors.customPaymentSource.message}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price" className="text-sm font-medium text-gray-700 flex items-center">
                <DollarSign className="w-4 h-4 mr-2" />
                Price
              </Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="h-11 border-gray-200 focus:border-rose-gold focus:ring-rose-gold/20"
                {...register('price')}
              />
              {errors.price && (
                <p className="text-sm text-red-500">{errors.price.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tip" className="text-sm font-medium text-gray-700 flex items-center">
                <DollarSign className="w-4 h-4 mr-2" />
                Tip
              </Label>
              <Input
                id="tip"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00 (optional)"
                className="h-11 border-gray-200 focus:border-rose-gold focus:ring-rose-gold/20"
                {...register('tip')}
              />
              {errors.tip && (
                <p className="text-sm text-red-500">{errors.tip.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="serviceDate" className="text-sm font-medium text-gray-700 flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              Service Date & Time
            </Label>
            <Input
              id="serviceDate"
              type="datetime-local"
              className="h-11 border-gray-200 focus:border-rose-gold focus:ring-rose-gold/20"
              {...register('serviceDate')}
            />
            {errors.serviceDate && (
              <p className="text-sm text-red-500">{errors.serviceDate.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium text-gray-700 flex items-center">
              <FileText className="w-4 h-4 mr-2" />
              Notes
            </Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes about this service..."
              className="min-h-20 border-gray-200 focus:border-rose-gold focus:ring-rose-gold/20"
              {...register('notes')}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-rose-gold hover:bg-rose-gold/90 text-white"
            >
              {isLoading 
                ? (isEditing ? 'Updating...' : 'Creating...') 
                : (isEditing ? 'Update Service' : 'Create Service')
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}