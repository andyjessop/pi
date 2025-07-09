import { useAppSelector, useAppDispatch } from "../../hooks";
import { navigateTo } from "pi";
import { selectors } from "./redux";
import type { Product } from "./redux";

// Format price utility function
function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

// Product Details Component
function ProductDetails({ product }: { product: Product }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Product Image Placeholder */}
      <div className="bg-gray-100 aspect-square flex items-center justify-center">
        <div className="text-gray-400 text-center">
          <div className="text-6xl mb-2">📷</div>
          <p>Product Image</p>
        </div>
      </div>
      
      {/* Product Info */}
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
          {product.category && (
            <p className="text-sm text-gray-500 uppercase tracking-wide">{product.category}</p>
          )}
        </div>
        
        <div className="text-3xl font-bold text-blue-600">
          {formatPrice(product.price)}
        </div>
        
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Description</h2>
          <p className="text-gray-600 leading-relaxed">{product.description}</p>
        </div>
        
        {/* Stock Status */}
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            product.inStock !== false ? 'bg-green-500' : 'bg-red-500'
          }`}></div>
          <span className={`text-sm font-medium ${
            product.inStock !== false ? 'text-green-700' : 'text-red-700'
          }`}>
            {product.inStock !== false ? 'In Stock' : 'Out of Stock'}
          </span>
        </div>
        
        {/* Actions */}
        <div className="space-y-3">
          <button 
            className={`w-full py-3 px-6 font-medium transition-colors ${
              product.inStock !== false 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            disabled={product.inStock === false}
          >
            {product.inStock !== false ? 'Add to Cart' : 'Out of Stock'}
          </button>
          
          <button className="w-full border border-gray-300 py-3 px-6 font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Add to Wishlist
          </button>
        </div>
      </div>
    </div>
  );
}

// Back Navigation Component
function BackNavigation() {
  const dispatch = useAppDispatch();
  
  const handleBackToProducts = () => {
    (dispatch as any)(navigateTo({ name: "products" }));
  };
  
  return (
    <button 
      onClick={handleBackToProducts}
      className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 mb-6 transition-colors"
    >
      <span>←</span>
      <span>Back to Products</span>
    </button>
  );
}

// Container Component - connects module state to presentation
export function Container() {
  const product = useAppSelector(selectors.product);
  const loading = useAppSelector(selectors.loading);
  const error = useAppSelector(selectors.error);
  const productId = useAppSelector(selectors.productId);
  
  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <BackNavigation />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-gray-100 aspect-square animate-pulse"></div>
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 animate-pulse"></div>
            <div className="h-6 bg-gray-200 w-1/3 animate-pulse"></div>
            <div className="h-4 bg-gray-200 w-2/3 animate-pulse"></div>
            <div className="h-4 bg-gray-200 w-1/2 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <BackNavigation />
        
        <div className="bg-red-50 border border-red-200 p-6 text-center">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Product Not Found</h2>
          <p className="text-red-600">{error}</p>
          {productId && (
            <p className="text-sm text-red-500 mt-2">Product ID: {productId}</p>
          )}
        </div>
      </div>
    );
  }
  
  // No product loaded
  if (!product) {
    return (
      <div className="space-y-6">
        <BackNavigation />
        
        <div className="text-center py-12">
          <p className="text-gray-500">No product selected.</p>
        </div>
      </div>
    );
  }
  
  // Success state - render product details
  return (
    <div className="space-y-6">
      <BackNavigation />
      <ProductDetails product={product} />
    </div>
  );
}