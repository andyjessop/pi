import { useAppSelector, useAppDispatch } from "../../hooks";
import { navigateTo } from "pi";
import { selectors, setSearchQuery, setViewMode, setSortOrder } from "./redux";
import type { Product, ViewMode, SortOrder } from "./redux";

// Format price utility function
function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

// Search Input Component
function SearchInput() {
  const dispatch = useAppDispatch();
  const searchQuery = useAppSelector(selectors.searchQuery);
  
  return (
    <div className="relative">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => dispatch(setSearchQuery(e.target.value))}
        placeholder="Search products..."
        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
    </div>
  );
}

// View Mode Toggle Component
function ViewModeToggle() {
  const dispatch = useAppDispatch();
  const viewMode = useAppSelector(selectors.viewMode);
  
  return (
    <div className="flex border border-gray-300 rounded-lg overflow-hidden">
      <button
        onClick={() => dispatch(setViewMode('grid'))}
        className={`px-3 py-2 text-sm font-medium ${
          viewMode === 'grid' 
            ? 'bg-blue-600 text-white' 
            : 'bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      </button>
      <button
        onClick={() => dispatch(setViewMode('list'))}
        className={`px-3 py-2 text-sm font-medium ${
          viewMode === 'list' 
            ? 'bg-blue-600 text-white' 
            : 'bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      </button>
    </div>
  );
}

// Sort Dropdown Component
function SortDropdown() {
  const dispatch = useAppDispatch();
  const sortOrder = useAppSelector(selectors.sortOrder);
  
  const sortOptions: { value: SortOrder; label: string }[] = [
    { value: 'name-asc', label: 'Name A-Z' },
    { value: 'name-desc', label: 'Name Z-A' },
    { value: 'price-asc', label: 'Price Low-High' },
    { value: 'price-desc', label: 'Price High-Low' },
  ];
  
  return (
    <select
      value={sortOrder}
      onChange={(e) => dispatch(setSortOrder(e.target.value as SortOrder))}
      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
    >
      {sortOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

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
function ProductsList({ products, viewMode }: { products: Product[]; viewMode: ViewMode }) {
  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No products found.</p>
      </div>
    );
  }

  return (
    <div className={viewMode === 'grid' 
      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      : "space-y-4"
    }>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

// Container Component - connects module state to presentation
export function Container() {
  const products = useAppSelector(selectors.products);
  const filteredProducts = useAppSelector(selectors.filteredAndSortedProducts);
  const loading = useAppSelector(selectors.loading);
  const error = useAppSelector(selectors.error);
  const searchQuery = useAppSelector(selectors.searchQuery);
  const viewMode = useAppSelector(selectors.viewMode);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
        </div>
        
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 max-w-md">
            <SearchInput />
          </div>
          <div className="flex gap-3">
            <SortDropdown />
            <ViewModeToggle />
          </div>
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
        
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 max-w-md">
            <SearchInput />
          </div>
          <div className="flex gap-3">
            <SortDropdown />
            <ViewModeToggle />
          </div>
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

  // Success state - render products with controls
  const displayProducts = filteredProducts || [];
  const totalProducts = products.length;
  const hasSearchQuery = searchQuery.trim() !== '';
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Products</h1>
        <div className="text-gray-600">
          {hasSearchQuery ? (
            <span>{displayProducts.length} of {totalProducts} items</span>
          ) : (
            <span>{totalProducts} items</span>
          )}
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 max-w-md">
          <SearchInput />
        </div>
        <div className="flex gap-3">
          <SortDropdown />
          <ViewModeToggle />
        </div>
      </div>
      
      {/* Search results info */}
      {hasSearchQuery && (
        <div className="text-sm text-gray-600">
          {displayProducts.length === 0 ? (
            <span>No products found for "{searchQuery}"</span>
          ) : (
            <span>Found {displayProducts.length} products for "{searchQuery}"</span>
          )}
        </div>
      )}
      
      <ProductsList products={displayProducts} viewMode={viewMode} />
    </div>
  );
}