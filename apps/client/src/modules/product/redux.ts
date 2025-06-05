import { createSlice, type PayloadAction, type Middleware } from "@reduxjs/toolkit";
import { createModule } from "pi";
import { selectRouteName, selectRouteParams } from "pi";
import type { RootState } from "../../store";
import { type Product, findProductById } from "../products-shared";

// Types
export interface ProductState {
  product: Product | null;
  loading: boolean;
  error: string | null;
  productId: string | null;
}

// Re-export shared types
export type { Product } from "../products-shared";

// Initial state - null until route is activated
const initialState: ProductState = {
  product: null,
  loading: false,
  error: null,
  productId: null,
};

// Slice
const productSlice = createSlice({
  name: "product",
  initialState,
  reducers: {
    initializeProduct: (state, action: PayloadAction<string>) => {
      state.loading = true;
      state.error = null;
      state.productId = action.payload;
    },
    
    setProduct: (state, action: PayloadAction<Product>) => {
      state.product = action.payload;
      state.loading = false;
      state.error = null;
    },
    
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },
    
    clearProduct: (state) => {
      state.product = null;
      state.loading = false;
      state.error = null;
      state.productId = null;
    },
  },
});

// Actions
const { initializeProduct, setProduct, setError, clearProduct } = productSlice.actions;

// Reducer
export const reducer = productSlice.reducer;

// Selectors
export const selectors = {
  state: (state: RootState) => state.product,
  product: (state: RootState) => state.product.product,
  loading: (state: RootState) => state.product.loading,
  error: (state: RootState) => state.product.error,
  productId: (state: RootState) => state.product.productId,
  isActive: (state: RootState) => state.product.product !== null,
};

// Middleware
export const middleware: Middleware = (store) => (next) => (action) => {
  const result = next(action);
  
  // Check if this is a router navigation
  if (action && typeof action === 'object' && 'type' in action && action.type === "router/navigateSuccess") {
    const state = store.getState();
    const currentRoute = selectRouteName(state);
    const routeParams = selectRouteParams(state);
    
    // Initialize product when navigating to product route
    if (currentRoute === "product" && routeParams?.id) {
      store.dispatch(initializeProduct(routeParams.id));
      
      // Simulate API call
      setTimeout(() => {
        const product = findProductById(routeParams.id);
        if (product) {
          store.dispatch(setProduct(product));
        } else {
          store.dispatch(setError(`Product with ID ${routeParams.id} not found`));
        }
      }, 300);
    }
    
    // Clear product when navigating away
    if (currentRoute !== "product") {
      store.dispatch(clearProduct());
    }
  }
  
  return result;
};

// Module export for Pi framework
export const module = createModule(reducer, [middleware]);