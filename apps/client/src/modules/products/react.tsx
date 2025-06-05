import { useAppSelector, useAppDispatch } from "../../hooks";
import { navigateTo } from "pi";
import { selectors } from "./redux";
import { formatPrice } from "../products-shared";
import type { Product } from "./redux";

// Product Card Component
function ProductCard({ product }: { product: Product }) {
  const dispatch = useAppDispatch();
  
  const handleViewProduct = () => {
    (dispatch as any)(navigateTo({ name: "product", params: { id: product.id } }));
  };
  
  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation when clicking Add to Cart
    // TODO: Implement add to cart functionality
    console.log(`Added ${product.name} to cart`);
  };
  
  return (
    <div 
      className="bg-white border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
      onClick={handleViewProduct}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors">
          {product.name}
        </h3>
        <span className="text-xl font-bold text-blue-600">
          {formatPrice(product.price)}
        </span>
      </div>
      
      {product.category && (
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{product.category}</p>
      )}
      
      <p className="text-gray-600 mb-4 line-clamp-2">{product.description}</p>
      
      {/* Stock indicator */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            product.inStock !== false ? 'bg-green-500' : 'bg-red-500'
          }`}></div>
          <span className={`text-sm ${
            product.inStock !== false ? 'text-green-700' : 'text-red-700'
          }`}>
            {product.inStock !== false ? 'In Stock' : 'Out of Stock'}
          </span>
        </div>
        <span className="text-sm text-gray-500">View Details →</span>
      </div>
      
      <button 
        onClick={handleAddToCart}
        className={`w-full py-2 px-4 font-medium transition-colors ${
          product.inStock !== false 
            ? 'bg-blue-600 text-white hover:bg-blue-700' 
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
        disabled={product.inStock === false}
      >
        {product.inStock !== false ? 'Add to Cart' : 'Out of Stock'}
      </button>
    </div>
  );
}

// Products List Component
function ProductsList({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No products available.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

// Container Component - connects module state to presentation
export function Container() {
  const products = useAppSelector(selectors.products);
  const loading = useAppSelector(selectors.loading);
  const error = useAppSelector(selectors.error);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
        </div>
        
        <div className="flex justify-center py-12">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 w-32"></div>
            <div className="h-4 bg-gray-200 w-24"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
        </div>
        
        <div className="bg-red-50 border border-red-200 p-4">
          <p className="text-red-800">Error loading products: {error}</p>
        </div>
      </div>
    );
  }

  // Route not active or no data
  if (!products) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
        </div>
        
        <div className="text-center py-12">
          <p className="text-gray-500">Products not available.</p>
        </div>
      </div>
    );
  }

  // Success state - render products
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Products</h1>
        <p className="text-gray-600">{products.length} items</p>
      </div>
      
      <ProductsList products={products} />
    </div>
  );
}