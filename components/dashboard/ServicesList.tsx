"use client";

import { useState } from 'react';
import { useGetServicesQuery, useDeleteServiceMutation, Service } from '@/lib/api';
import { Button } from '@/components/ui/button';
import ServiceForm from './ServiceForm';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { toast } from 'sonner';

interface ServicesListProps {
  currentCycleId: string;
}

export default function ServicesList({ currentCycleId }: ServicesListProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);

  const { data: services, isLoading, isError, error } = useGetServicesQuery(currentCycleId || undefined, {
    skip: !currentCycleId,
  });

  const [deleteService, { isLoading: isDeleting }] = useDeleteServiceMutation();

  const handleAddService = () => {
    setSelectedService(null);
    setIsFormOpen(true);
  };

  const handleEditService = (service: Service) => {
    setSelectedService(service);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (serviceId: string) => {
    setServiceToDelete(serviceId);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!serviceToDelete) return;
    
    try {
      await deleteService(serviceToDelete).unwrap();
      toast.success('Service deleted successfully!');
    } catch (err) {
      toast.error('Failed to delete service.');
      console.error(err);
    } finally {
      setIsDeleteModalOpen(false);
      setServiceToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setIsDeleteModalOpen(false);
    setServiceToDelete(null);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedService(null);
  };

  if (!currentCycleId) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>Please select or create a cycle to view services.</p>
      </div>
    );
  }

  if (isLoading) return <p>Loading services...</p>;
  if (isError) return <p>Error loading services: {JSON.stringify(error)}</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Services</h2>
        <Button onClick={handleAddService}>Add Service</Button>
      </div>

      {services && services.length > 0 ? (
        <div className="bg-white shadow rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 whitespace-nowrap">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tip</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {services.map((service) => (
                <tr key={service.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{service.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{service.customer || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${service.price.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${(service.tip || 0).toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(service.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button variant="ghost" size="sm" onClick={() => handleEditService(service)} className="mr-2">Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(service.id)} disabled={isDeleting}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center text-gray-500 py-8 bg-white shadow rounded-lg">
          <p>No services found for this cycle.</p>
          <Button onClick={handleAddService} className="mt-4">Add Your First Service</Button>
        </div>
      )}

      <ServiceForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        currentCycleId={currentCycleId}
        service={selectedService}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Delete Service"
        description="Are you sure you want to delete this service? This action cannot be undone."
        isLoading={isDeleting}
      />
    </div>
  );
}
