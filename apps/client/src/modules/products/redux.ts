import { createSlice, createAsyncThunk, type Middleware } from "@reduxjs/toolkit";
import { createModule, createUrlSyncMiddleware, createClient, defaultClient } from "pi";
import { selectRouteName } from "pi";
import type { RootState } from "../../store";
import { z } from "zod";

/*
 * =============================================================================
 * 1. Zod schema definition for `Product`
 * =============================================================================
 */
export const ProductSchema = z.object({
  id: z.string().uuid(),              // Each product has a UUID
  name: z.string().min(1),            // Non‐empty name
  description: z.string().optional(), // Optional description
  price: z.number().nonnegative(),    // Non‐negative price
  category: z.string().optional(),    // Optional category
  inStock: z.boolean().default(true), // Whether the product is in stock
});

export type Product = z.infer<typeof ProductSchema>;

/*
 * =============================================================================
 * 2. Create typed client using Pi library
 * =============================================================================
 */
export const productClient = createClient(ProductSchema, "products", defaultClient);

/*
 * =============================================================================
 * 3. Redux slice and async thunks
 * =============================================================================
 */
export type ViewMode = "grid" | "list";
export type SortOrder = "name-asc" | "name-desc" | "price-asc" | "price-desc";

export interface ProductsState {
  products: Product[] | null;
  loading: boolean;
  error: string | null;
  // UI state that should sync to URL
  searchQuery: string;
  viewMode: ViewMode;
  sortOrder: SortOrder;
}

const initialState: ProductsState = {
  products: null,
  loading: false,
  error: null,
  searchQuery: "",
  viewMode: "grid",
  sortOrder: "name-asc",
};

// Async thunk using the typed client
export const loadProducts = createAsyncThunk<Product[], void, { rejectValue: string }>(
  "products/loadProducts",
  async (_, { rejectWithValue }) => {
    try {
      const products = await productClient.getAll();
      return products;
    } catch (err) {
      return rejectWithValue(
        err instanceof Error ? err.message : "Failed to load products"
      );
    }
  }
);

const productsSlice = createSlice({
  name: "products",
  initialState,
  reducers: {
    clearProducts: (state) => {
      state.products = null;
      state.loading = false;
      state.error = null;
      state.searchQuery = "";
      state.viewMode = "grid";
      state.sortOrder = "name-asc";
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    setViewMode: (state, action) => {
      state.viewMode = action.payload;
    },
    setSortOrder: (state, action) => {
      state.sortOrder = action.payload;
    },
    restoreFromUrl: (state, action) => {
      const { searchQuery, viewMode, sortOrder } = action.payload;
      if (searchQuery !== undefined) state.searchQuery = searchQuery || "";
      if (viewMode !== undefined) state.viewMode = viewMode || "grid";
      if (sortOrder !== undefined) state.sortOrder = sortOrder || "name-asc";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadProducts.fulfilled, (state, action) => {
        state.products = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(loadProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

// Export slice actions
const { clearProducts, setSearchQuery, setViewMode, setSortOrder } = productsSlice.actions;
export { setSearchQuery, setViewMode, setSortOrder };

// Reducer
export const reducer = productsSlice.reducer;

// Helper functions for filtering and sorting
const filterProducts = (products: Product[], searchQuery: string): Product[] => {
  if (!searchQuery.trim()) return products;
  const query = searchQuery.toLowerCase();
  return products.filter(
    (product) =>
      product.name.toLowerCase().includes(query) ||
      (product.description?.toLowerCase() ?? "").includes(query)
  );
};

const sortProducts = (products: Product[], sortOrder: SortOrder): Product[] => {
  const sorted = [...products];
  switch (sortOrder) {
    case "name-asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case "price-asc":
      return sorted.sort((a, b) => a.price - b.price);
    case "price-desc":
      return sorted.sort((a, b) => b.price - a.price);
    default:
      return sorted;
  }
};

// Selectors
export const selectors = {
  state: (state: RootState) => state.products,
  products: (state: RootState) => state.products.products,
  loading: (state: RootState) => state.products.loading,
  error: (state: RootState) => state.products.error,
  searchQuery: (state: RootState) => state.products.searchQuery,
  viewMode: (state: RootState) => state.products.viewMode,
  sortOrder: (state: RootState) => state.products.sortOrder,
  isActive: (state: RootState) => state.products.products !== null,
  filteredAndSortedProducts: (state: RootState) => {
    const { products, searchQuery, sortOrder } = state.products;
    if (!products) return null;
    const filtered = filterProducts(products, searchQuery);
    return sortProducts(filtered, sortOrder);
  },
};

// Middleware
export const middleware: Middleware = (store) => (next) => (action) => {
  const result = next(action);

  if (
    action &&
    typeof action === "object" &&
    "type" in action &&
    action.type === "router/navigateSuccess"
  ) {
    const state = store.getState();
    const currentRoute = selectRouteName(state);

    if (currentRoute === "products") {
      (store.dispatch as any)(loadProducts());
    }

    if (currentRoute !== "products") {
      store.dispatch(clearProducts());
    }
  }

  return result;
};

// URL sync middleware - only sync user preferences, not transient states
const urlSyncMiddleware = createUrlSyncMiddleware<ProductsState>(
  "products",
  (state) => ({
    search: state.searchQuery || null,
    view: state.viewMode !== "grid" ? state.viewMode : null,
    sort: state.sortOrder !== "name-asc" ? state.sortOrder : null,
    // Don't sync loading/error states - they're transient and shouldn't be in URL
  }),
  (params) => ({
    searchQuery: params.search,
    viewMode: params.view,
    sortOrder: params.sort,
  })
);

// Module export for Pi framework
export const module = createModule("products", reducer, [middleware, urlSyncMiddleware]);