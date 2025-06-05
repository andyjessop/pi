import { createSlice, type PayloadAction, type Middleware } from "@reduxjs/toolkit";
import { createModule } from "pi";
import { selectRouteName } from "pi";
import type { RootState } from "../../store";
import { type Product, mockProducts } from "../products-shared";

// Types
export interface ProductsState {
  products: Product[] | null;
  loading: boolean;
  error: string | null;
}

// Re-export shared types
export type { Product } from "../products-shared";

// Initial state - null until route is activated
const initialState: ProductsState = {
  products: null,
  loading: false,
  error: null,
};

// Slice
const productsSlice = createSlice({
  name: "products",
  initialState,
  reducers: {
    initializeProducts: (state) => {
      state.loading = true;
      state.error = null;
    },
    
    setProducts: (state, action: PayloadAction<Product[]>) => {
      state.products = action.payload;
      state.loading = false;
      state.error = null;
    },
    
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },
    
    clearProducts: (state) => {
      state.products = null;
      state.loading = false;
      state.error = null;
    },
  },
});

// Actions
const { initializeProducts, setProducts, clearProducts } = productsSlice.actions;

// Reducer
export const reducer = productsSlice.reducer;

// Selectors
export const selectors = {
  state: (state: RootState) => state.products,
  products: (state: RootState) => state.products.products,
  loading: (state: RootState) => state.products.loading,
  error: (state: RootState) => state.products.error,
  isActive: (state: RootState) => state.products.products !== null,
};

// Middleware
export const middleware: Middleware = (store) => (next) => (action) => {
  const result = next(action);
  
  // Check if this is a router navigation
  if (action && typeof action === 'object' && 'type' in action && action.type === "router/navigateSuccess") {
    const state = store.getState();
    const currentRoute = selectRouteName(state);
    
    // Initialize products when navigating to products route
    if (currentRoute === "products") {
      store.dispatch(initializeProducts());
      
      // Simulate API call
      setTimeout(() => {
        store.dispatch(setProducts(mockProducts));
      }, 500);
    }
    
    // Clear products when navigating away
    if (currentRoute !== "products") {
      store.dispatch(clearProducts());
    }
  }
  
  return result;
};

// Module export for Pi framework
export const module = createModule(reducer, [middleware]);