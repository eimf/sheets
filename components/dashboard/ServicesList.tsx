'use client';

import { useState } from 'react';
import { Search, Filter, Edit2, Trash2, DollarSign, User, Calendar, Plus } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { useGetServicesByCycleQuery, useDeleteServiceMutation } from '@/lib/api';
import { Service } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import ServiceForm from './ServiceForm';
import { format } from 'date-fns';
import { setSearchTerm, setFilterType } from '@/lib/slices/servicesSlice';

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export default function ServicesList() {
  // Forcing a recompile
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { currentCycle, searchTerm, filterType } = useAppSelector((state) => state.services);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showServiceForm, setShowServiceForm] = useState(false);

  const { data, isLoading, error } = useGetServicesByCycleQuery({
    userId: user?.id || 0,
    cycleStart: currentCycle.startDate,
    cycleEnd: currentCycle.endDate,
  });

  const [deleteService] = useDeleteServiceMutation();

  const handleDelete = async (id: number) => {
    try {
      if (!user?.id) {
        throw new Error('User ID is required');
      }
      await deleteService({ userId: user.id, id }).unwrap();
      toast.success('Service deleted successfully');
      setDeleteId(null);
    } catch (error) {
      toast.error('Failed to delete service');
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, h:mm a');
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6 text-center">
          <p className="text-red-600">Failed to load services. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  const services = data?.services || [];

  // Filter services based on search term and filter type
  const filteredServices = services.filter((service: Service) => {
    const matchesSearch = 
      service.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.service_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || 
      (filterType === 'with-tips' && (service.tip ?? 0) > 0) ||
      (filterType === 'no-tips' && (!service.tip || service.tip === 0));
    return matchesSearch && matchesFilter;
  });

  // Calculate totals
  const totalRevenue = filteredServices.reduce((sum: number, service: Service) => sum + service.price, 0);
  const totalTips = filteredServices.reduce((sum: number, service: Service) => sum + (service.tip ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tips</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalTips)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Services</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredServices.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Service List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Input
              placeholder="Search services..."
              value={searchTerm}
              onChange={(e) => dispatch(setSearchTerm(e.target.value))}
              className="max-w-sm"
            />
            <Select
              value={filterType}
              onValueChange={(value) => dispatch(setFilterType(value as 'all' | 'with-tips' | 'no-tips'))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by tips" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                <SelectItem value="with-tips">With Tips</SelectItem>
                <SelectItem value="no-tips">Without Tips</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setEditingService(null)}>
            <Plus className="mr-2 h-4 w-4" />
            New Service
          </Button>
        </div>

        <div className="rounded-md border">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="p-4 text-left">Client</th>
                <th className="p-4 text-left">Service</th>
                <th className="p-4 text-left">Payment Source</th>
                <th className="p-4 text-left">Price</th>
                <th className="p-4 text-left">Tip</th>
                <th className="p-4 text-left">Date</th>
                <th className="p-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.map((service) => (
                <tr key={service.id} className="border-b">
                  <td className="p-4">{service.client_name}</td>
                  <td className="p-4">{service.service_type}</td>
                  <td className="p-4">{service.payment_source}</td>
                  <td className="p-4">{formatCurrency(service.price)}</td>
                  <td className="p-4">{formatCurrency(service.tip ?? 0)}</td>
                  <td className="p-4">{formatDate(service.service_date)}</td>
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingService(service)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(service.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => open ? setDeleteId(deleteId) : setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete Service
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this service? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDelete(deleteId!)} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>



      {/* Services List */}
      <div className="space-y-4">
        {filteredServices.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No services found</h3>
              <p className="text-gray-500 mb-6">
                {services.length === 0 
                  ? "You haven't logged any services for this cycle yet."
                  : "No services match your current search criteria."
                }
              </p>
              <Button
                onClick={() => setShowServiceForm(true)}
                className="bg-rose-gold hover:bg-rose-gold/90 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Service
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredServices.map((service) => (
            <Card key={service.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-3">
                      <h3 className="text-lg font-semibold text-gray-800">{service.client_name}</h3>
                      <span className="px-3 py-1 bg-rose-gold/10 text-rose-gold text-sm font-medium rounded-full">
                        {service.service_type}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div className="flex items-center">
                        <DollarSign className="w-4 h-4 mr-2 text-green-500" />
                        <span className="font-medium">{formatCurrency(service.price)}</span>
                        {service.tip && (
                          <span className="ml-2 text-blue-600">
                            (Tip: {formatCurrency(service.tip)})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                        <span>{formatDate(service.service_date)}</span>
                      </div>
                      {service.notes && (
                        <div className="sm:col-span-1">
                          <span className="text-gray-500">Notes: {service.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingService(service)}
                      className="h-8 w-8 p-0 border-gray-200 hover:bg-gray-50"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteId(service.id)}
                      className="h-8 w-8 p-0 border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Service Form Modal */}
      {(showServiceForm || editingService) && (
        <ServiceForm
          service={editingService}
          onClose={() => {
            setShowServiceForm(false);
            setEditingService(null);
          }}
        />
      )}
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this service? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}