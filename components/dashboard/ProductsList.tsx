"use client";

import { useState } from 'react';
import { useGetProductsQuery, useDeleteProductMutation, Product } from '@/lib/api';
import { Button } from '@/components/ui/button';
import ProductForm from './ProductForm';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { toast } from 'sonner';

interface ProductsListProps {
  currentCycleId: string;
}

export default function ProductsList({ currentCycleId }: ProductsListProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  const { data: products, isLoading, isError, error } = useGetProductsQuery(currentCycleId || undefined, {
    skip: !currentCycleId,
  });

  const [deleteProduct, { isLoading: isDeleting }] = useDeleteProductMutation();

  const handleAddProduct = () => {
    setSelectedProduct(null);
    setIsFormOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (productId: string) => {
    setProductToDelete(productId);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    
    try {
      await deleteProduct(productToDelete).unwrap();
      toast.success('Product deleted successfully!');
    } catch (err) {
      toast.error('Failed to delete product.');
      console.error(err);
    } finally {
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setIsDeleteModalOpen(false);
    setProductToDelete(null);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedProduct(null);
  };

  if (!currentCycleId) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>Please select or create a cycle to view products.</p>
      </div>
    );
  }

  if (isLoading) return <p>Loading products...</p>;
  if (isError) return <p>Error loading products: {JSON.stringify(error)}</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Products</h2>
        <Button onClick={handleAddProduct}>Add Product</Button>
      </div>

      {products && products.length > 0 ? (
        <div className="bg-white shadow rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 whitespace-nowrap">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${product.price.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(product.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button variant="ghost" size="sm" onClick={() => handleEditProduct(product)} className="mr-2">Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(product.id)} disabled={isDeleting}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center text-gray-500 py-8 bg-white shadow rounded-lg">
          <p>No products found for this cycle.</p>
          <Button onClick={handleAddProduct} className="mt-4">Add Your First Product</Button>
        </div>
      )}

      <ProductForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        currentCycleId={currentCycleId}
        product={selectedProduct}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone."
        isLoading={isDeleting}
      />
    </div>
  );
}
