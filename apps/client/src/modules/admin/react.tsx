import { useAppSelector, useAppDispatch } from "../../hooks";
import { selectors, openCreateModal, openEditModal, openDeleteModal, closeCreateModal, closeEditModal, closeDeleteModal, createProduct, updateProduct, deleteProduct, clearFormError } from "./redux";
import { type Product } from "../products";
import { useState, useEffect } from "react";

// Format price utility function
function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

/*
 * =============================================================================
 * Product Form Component (for Create/Edit)
 * =============================================================================
 */

interface ProductFormProps {
  product?: Product | null;
  onSubmit: (product: any) => void;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
}

function ProductForm({ product, onSubmit, onCancel, loading, error }: ProductFormProps) {
  const [formData, setFormData] = useState({
    name: product?.name || "",
    description: product?.description || "",
    price: product?.price || 0,
    category: product?.category || "",
    inStock: product?.inStock ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (product) {
      // Edit mode - include ID
      onSubmit({ ...formData, id: product.id });
    } else {
      // Create mode - no ID
      onSubmit(formData);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked 
             : type === "number" ? parseFloat(value) || 0 
             : value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Product Name *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          value={formData.name}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          value={formData.description}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
          Price *
        </label>
        <input
          type="number"
          id="price"
          name="price"
          required
          min="0"
          step="0.01"
          value={formData.price}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
          Category
        </label>
        <input
          type="text"
          id="category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="inStock"
          name="inStock"
          checked={formData.inStock}
          onChange={handleChange}
          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
        />
        <label htmlFor="inStock" className="ml-2 block text-sm text-gray-900">
          In Stock
        </label>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {loading ? "Saving..." : product ? "Update Product" : "Create Product"}
        </button>
      </div>
    </form>
  );
}

/*
 * =============================================================================
 * Modal Component
 * =============================================================================
 */

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

function Modal({ isOpen, onClose, title, children }: ModalProps) {
  console.log('Modal render:', { isOpen, title });
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50" 
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/*
 * =============================================================================
 * Products Table Component
 * =============================================================================
 */

function ProductsTable() {
  const dispatch = useAppDispatch();
  const products = useAppSelector(selectors.products);
  const loading = useAppSelector(selectors.loading);
  const error = useAppSelector(selectors.error);

  if (loading) {
    return <div className="text-center py-4">Loading products...</div>;
  }

  if (error) {
    return <div className="text-red-600 text-center py-4">Error: {error}</div>;
  }

  if (!products || products.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No products found.</p>
        <button
          onClick={() => dispatch(openCreateModal())}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Create Your First Product
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Product
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Price
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Category
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Stock
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {products.map((product) => (
            <tr key={product.id}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div>
                  <div className="text-sm font-medium text-gray-900">{product.name}</div>
                  {product.description && (
                    <div className="text-sm text-gray-500">{product.description}</div>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {formatPrice(product.price)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {product.category || "—"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  product.inStock 
                    ? "bg-green-100 text-green-800" 
                    : "bg-red-100 text-red-800"
                }`}>
                  {product.inStock ? "In Stock" : "Out of Stock"}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                <button
                  onClick={() => dispatch(openEditModal(product))}
                  className="text-indigo-600 hover:text-indigo-900"
                >
                  Edit
                </button>
                <button
                  onClick={() => dispatch(openDeleteModal(product))}
                  className="text-red-600 hover:text-red-900"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/*
 * =============================================================================
 * Main Admin Container Component
 * =============================================================================
 */

export function Container() {
  const dispatch = useAppDispatch();
  const isCreateModalOpen = useAppSelector(selectors.isCreateModalOpen);
  const isEditModalOpen = useAppSelector(selectors.isEditModalOpen);
  const isDeleteModalOpen = useAppSelector(selectors.isDeleteModalOpen);
  const selectedProduct = useAppSelector(selectors.selectedProduct);
  const formLoading = useAppSelector(selectors.formLoading);
  const formError = useAppSelector(selectors.formError);

  // Clear form error when modals open/close
  useEffect(() => {
    if (isCreateModalOpen || isEditModalOpen || isDeleteModalOpen) {
      dispatch(clearFormError());
    }
  }, [isCreateModalOpen, isEditModalOpen, isDeleteModalOpen, dispatch]);

  const handleCreateProduct = (productData: Omit<Product, "id">) => {
    (dispatch as any)(createProduct(productData));
  };

  const handleUpdateProduct = (productData: Product) => {
    (dispatch as any)(updateProduct(productData));
  };

  const handleDeleteProduct = () => {
    if (selectedProduct) {
      (dispatch as any)(deleteProduct(selectedProduct.id));
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Product Administration</h1>
        <button
          onClick={() => dispatch(openCreateModal())}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Create Product
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ProductsTable />
      </div>

      {/* Create Product Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => dispatch(closeCreateModal())}
        title="Create New Product"
      >
        <ProductForm
          onSubmit={handleCreateProduct}
          onCancel={() => dispatch(closeCreateModal())}
          loading={formLoading}
          error={formError}
        />
      </Modal>

      {/* Edit Product Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => dispatch(closeEditModal())}
        title="Edit Product"
      >
        <ProductForm
          product={selectedProduct}
          onSubmit={handleUpdateProduct}
          onCancel={() => dispatch(closeEditModal())}
          loading={formLoading}
          error={formError}
        />
      </Modal>

      {/* Delete Product Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => dispatch(closeDeleteModal())}
        title="Delete Product"
      >
        <div>
          <p className="text-sm text-gray-500 mb-4">
            Are you sure you want to delete "{selectedProduct?.name}"? This action cannot be undone.
          </p>
          
          {formError && (
            <div className="text-red-600 text-sm mb-4">{formError}</div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => dispatch(closeDeleteModal())}
              disabled={formLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteProduct}
              disabled={formLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              {formLoading ? "Deleting..." : "Delete Product"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default Container;