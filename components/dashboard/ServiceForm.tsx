'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Scissors, DollarSign, User, Calendar, FileText } from 'lucide-react';
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
import { useAppSelector } from '@/lib/hooks';
import { useCreateServiceMutation, useUpdateServiceMutation, type Service } from '@/lib/api';
import { toast } from 'sonner';

const serviceSchema = z.object({
  clientName: z.string().min(1, 'Client name is required'),
  serviceType: z.string().min(1, 'Service type is required'),
  price: z.string().min(1, 'Price is required').refine((val) => !isNaN(Number(val)) && Number(val) > 0, 'Price must be a positive number'),
  commission: z.string().optional(),
  serviceDate: z.string().min(1, 'Service date is required'),
  notes: z.string().optional(),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

interface ServiceFormProps {
  service?: Service | null;
  onClose: () => void;
}

export default function ServiceForm({ service, onClose }: ServiceFormProps) {
  const { currentCycle } = useAppSelector((state) => state.services);
  const [createService, { isLoading: isCreating }] = useCreateServiceMutation();
  const [updateService, { isLoading: isUpdating }] = useUpdateServiceMutation();

  const isEditing = !!service;
  const isLoading = isCreating || isUpdating;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      clientName: '',
      serviceType: '',
      price: '',
      commission: '',
      serviceDate: new Date().toISOString().slice(0, 16),
      notes: '',
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (service) {
      setValue('clientName', service.client_name);
      setValue('serviceType', service.service_type);
      setValue('price', service.price.toString());
      setValue('commission', service.commission?.toString() || '');
      setValue('serviceDate', service.service_date.slice(0, 16));
      setValue('notes', service.notes || '');
    }
  }, [service, setValue]);

  const onSubmit = async (data: ServiceFormData) => {
    try {
      const serviceData = {
        clientName: data.clientName,
        serviceType: data.serviceType,
        price: parseFloat(data.price),
        commission: data.commission ? parseFloat(data.commission) : undefined,
        cycleStartDate: currentCycle.startDate,
        cycleEndDate: currentCycle.endDate,
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

  const serviceTypes = [
    'Haircut',
    'Hair Color',
    'Highlights',
    'Balayage',
    'Blowout',
    'Hair Styling',
    'Hair Treatment',
    'Keratin Treatment',
    'Perm',
    'Hair Extensions',
    'Facial',
    'Manicure',
    'Pedicure',
    'Eyebrow Wax',
    'Other',
  ];

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

          <div className="space-y-2">
            <Label htmlFor="serviceType" className="text-sm font-medium text-gray-700 flex items-center">
              <Scissors className="w-4 h-4 mr-2" />
              Service Type
            </Label>
            <Select
              value={watch('serviceType')}
              onValueChange={(value) => setValue('serviceType', value)}
            >
              <SelectTrigger className="h-11 border-gray-200 focus:border-rose-gold focus:ring-rose-gold/20">
                <SelectValue placeholder="Select service type" />
              </SelectTrigger>
              <SelectContent>
                {serviceTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.serviceType && (
              <p className="text-sm text-red-500">{errors.serviceType.message}</p>
            )}
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
              <Label htmlFor="commission" className="text-sm font-medium text-gray-700 flex items-center">
                <DollarSign className="w-4 h-4 mr-2" />
                Commission
              </Label>
              <Input
                id="commission"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00 (optional)"
                className="h-11 border-gray-200 focus:border-rose-gold focus:ring-rose-gold/20"
                {...register('commission')}
              />
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