'use client';

import { useState } from 'react';
import { Search, Filter, Edit2, Trash2, DollarSign, User, Calendar, Plus } from 'lucide-react';
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
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { setSearchTerm, setFilterType } from '@/lib/slices/servicesSlice';
import { useGetServicesByCycleQuery, useDeleteServiceMutation } from '@/lib/api';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import ServiceForm from './ServiceForm';

export default function ServicesList() {
  const dispatch = useAppDispatch();
  const { currentCycle, searchTerm, filterType } = useAppSelector((state) => state.services);
  
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingService, setEditingService] = useState<any>(null);
  const [showServiceForm, setShowServiceForm] = useState(false);

  const { data, error, isLoading } = useGetServicesByCycleQuery({
    cycleStart: currentCycle.startDate,
    cycleEnd: currentCycle.endDate,
  });

  const [deleteService] = useDeleteServiceMutation();

  const services = data?.services || [];

  // Filter services based on search term and filter type
  const filteredServices = services.filter((service) => {
    const matchesSearch = 
      service.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.service_type.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterType === 'all') return matchesSearch;
    return matchesSearch && service.service_type.toLowerCase().includes(filterType.toLowerCase());
  });

  // Calculate totals
  const totalEarnings = filteredServices.reduce((sum, service) => sum + service.price, 0);
  const totalCommission = filteredServices.reduce((sum, service) => sum + (service.commission || 0), 0);

  const handleDelete = async (id: number) => {
    try {
      await deleteService(id).unwrap();
      toast.success('Service deleted successfully');
      setDeleteId(null);
    } catch (error) {
      toast.error('Failed to delete service');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM d, h:mm a');
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

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Total Earnings</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(totalEarnings)}</p>
              </div>
              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Commission</p>
                <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalCommission)}</p>
              </div>
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-pink-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Total Services</p>
                <p className="text-2xl font-bold text-purple-700">{filteredServices.length}</p>
              </div>
              <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search clients or services..."
                  value={searchTerm}
                  onChange={(e) => dispatch(setSearchTerm(e.target.value))}
                  className="pl-10 h-10 border-gray-200 focus:border-rose-gold focus:ring-rose-gold/20"
                />
              </div>

              <Select value={filterType} onValueChange={(value) => dispatch(setFilterType(value))}>
                <SelectTrigger className="w-full sm:w-48 h-10 border-gray-200">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  <SelectItem value="haircut">Haircuts</SelectItem>
                  <SelectItem value="color">Hair Color</SelectItem>
                  <SelectItem value="style">Styling</SelectItem>
                  <SelectItem value="treatment">Treatments</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => setShowServiceForm(true)}
              className="bg-rose-gold hover:bg-rose-gold/90 text-white h-10"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Service
            </Button>
          </div>
        </CardContent>
      </Card>

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
                        {service.commission && (
                          <span className="ml-2 text-blue-600">
                            (Commission: {formatCurrency(service.commission)})
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