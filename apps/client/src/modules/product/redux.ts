import { createSlice, createAsyncThunk, type Middleware } from "@reduxjs/toolkit";
import { createModule } from "pi";
import { selectRouteName, selectRouteParams } from "pi";
import type { RootState } from "../../store";
import { type Product, productClient } from "../products";

// Types
export interface ProductState {
  product: Product | null;
  loading: boolean;
  error: string | null;
  productId: string | null;
}

// Re-export shared types
export type { Product } from "../products";

// Initial state - null until route is activated
const initialState: ProductState = {
  product: null,
  loading: false,
  error: null,
  productId: null,
};

// Async thunks
export const loadProduct = createAsyncThunk(
  "product/loadProduct",
  async (productId: string, { rejectWithValue }) => {
    try {
      const product = await productClient.getOne(productId);
      return { product, productId };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : "Failed to load product");
    }
  }
);

// Slice
const productSlice = createSlice({
  name: "product",
  initialState,
  reducers: {
    clearProduct: (state) => {
      state.product = null;
      state.loading = false;
      state.error = null;
      state.productId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadProduct.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.productId = action.meta.arg; // Store the productId being loaded
      })
      .addCase(loadProduct.fulfilled, (state, action) => {
        state.product = action.payload.product;
        state.productId = action.payload.productId;
        state.loading = false;
        state.error = null;
      })
      .addCase(loadProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        // Keep productId to show which product failed to load
      });
  },
});

// Actions
const { clearProduct } = productSlice.actions;

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
    
    // Load product when navigating to product route
    if (currentRoute === "product" && routeParams?.id) {
      (store.dispatch as any)(loadProduct(routeParams.id));
    }
    
    // Clear product when navigating away
    if (currentRoute !== "product") {
      store.dispatch(clearProduct());
    }
  }
  
  return result;
};

// Module export for Pi framework - no URL sync needed since product ID comes from route params
export const module = createModule("product", reducer, [middleware]);