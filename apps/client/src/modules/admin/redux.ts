import { createSlice, createAsyncThunk, type Middleware } from "@reduxjs/toolkit";
import { createModule, createUrlSyncMiddleware } from "pi";
import { selectRouteName } from "pi";
import type { RootState } from "../../store";
import { type Product, productClient } from "../products";

/*
 * =============================================================================
 * Admin module for managing products (CRUD operations)
 * =============================================================================
 */

export interface AdminState {
  products: Product[] | null;
  loading: boolean;
  error: string | null;
  // Modal state
  isCreateModalOpen: boolean;
  isEditModalOpen: boolean;
  isDeleteModalOpen: boolean;
  selectedProduct: Product | null;
  // Form state
  formLoading: boolean;
  formError: string | null;
}

const initialState: AdminState = {
  products: null,
  loading: false,
  error: null,
  isCreateModalOpen: false,
  isEditModalOpen: false,
  isDeleteModalOpen: false,
  selectedProduct: null,
  formLoading: false,
  formError: null,
};

/*
 * =============================================================================
 * Async Thunks
 * =============================================================================
 */

// Load all products for admin table
export const loadAdminProducts = createAsyncThunk<Product[], void, { rejectValue: string }>(
  "admin/loadProducts",
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

// Create a new product
export const createProduct = createAsyncThunk<Product, Omit<Product, "id">, { rejectValue: string }>(
  "admin/createProduct",
  async (productData, { rejectWithValue }) => {
    try {
      const newProduct = await productClient.create(productData);
      return newProduct;
    } catch (err) {
      return rejectWithValue(
        err instanceof Error ? err.message : "Failed to create product"
      );
    }
  }
);

// Update an existing product
export const updateProduct = createAsyncThunk<Product, Product, { rejectValue: string }>(
  "admin/updateProduct",
  async (productData, { rejectWithValue }) => {
    try {
      const updatedProduct = await productClient.update(productData);
      return updatedProduct;
    } catch (err) {
      return rejectWithValue(
        err instanceof Error ? err.message : "Failed to update product"
      );
    }
  }
);

// Delete a product
export const deleteProduct = createAsyncThunk<string, string, { rejectValue: string }>(
  "admin/deleteProduct",
  async (productId, { rejectWithValue }) => {
    try {
      await productClient.delete(productId);
      return productId;
    } catch (err) {
      return rejectWithValue(
        err instanceof Error ? err.message : "Failed to delete product"
      );
    }
  }
);

/*
 * =============================================================================
 * Slice
 * =============================================================================
 */

const adminSlice = createSlice({
  name: "admin",
  initialState,
  reducers: {
    clearAdmin: (state) => {
      state.products = null;
      state.loading = false;
      state.error = null;
      state.isCreateModalOpen = false;
      state.isEditModalOpen = false;
      state.isDeleteModalOpen = false;
      state.selectedProduct = null;
      state.formLoading = false;
      state.formError = null;
    },
    // Modal actions
    openCreateModal: (state) => {
      state.isCreateModalOpen = true;
      state.selectedProduct = null;
      state.formError = null;
    },
    openEditModal: (state, action) => {
      state.isEditModalOpen = true;
      state.selectedProduct = action.payload;
      state.formError = null;
    },
    openDeleteModal: (state, action) => {
      state.isDeleteModalOpen = true;
      state.selectedProduct = action.payload;
      state.formError = null;
    },
    closeCreateModal: (state) => {
      state.isCreateModalOpen = false;
      state.selectedProduct = null;
      state.formError = null;
    },
    closeEditModal: (state) => {
      state.isEditModalOpen = false;
      state.selectedProduct = null;
      state.formError = null;
    },
    closeDeleteModal: (state) => {
      state.isDeleteModalOpen = false;
      state.selectedProduct = null;
      state.formError = null;
    },
    clearFormError: (state) => {
      state.formError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Load products
      .addCase(loadAdminProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadAdminProducts.fulfilled, (state, action) => {
        state.products = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(loadAdminProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create product
      .addCase(createProduct.pending, (state) => {
        state.formLoading = true;
        state.formError = null;
      })
      .addCase(createProduct.fulfilled, (state, action) => {
        state.formLoading = false;
        state.formError = null;
        state.isCreateModalOpen = false;
        // Add new product to the list
        if (state.products) {
          state.products.push(action.payload);
        }
      })
      .addCase(createProduct.rejected, (state, action) => {
        state.formLoading = false;
        state.formError = action.payload as string;
      })
      // Update product
      .addCase(updateProduct.pending, (state) => {
        state.formLoading = true;
        state.formError = null;
      })
      .addCase(updateProduct.fulfilled, (state, action) => {
        state.formLoading = false;
        state.formError = null;
        state.isEditModalOpen = false;
        state.selectedProduct = null;
        // Update product in the list
        if (state.products) {
          const index = state.products.findIndex(p => p.id === action.payload.id);
          if (index !== -1) {
            state.products[index] = action.payload;
          }
        }
      })
      .addCase(updateProduct.rejected, (state, action) => {
        state.formLoading = false;
        state.formError = action.payload as string;
      })
      // Delete product
      .addCase(deleteProduct.pending, (state) => {
        state.formLoading = true;
        state.formError = null;
      })
      .addCase(deleteProduct.fulfilled, (state, action) => {
        state.formLoading = false;
        state.formError = null;
        state.isDeleteModalOpen = false;
        state.selectedProduct = null;
        // Remove product from the list
        if (state.products) {
          state.products = state.products.filter(p => p.id !== action.payload);
        }
      })
      .addCase(deleteProduct.rejected, (state, action) => {
        state.formLoading = false;
        state.formError = action.payload as string;
      });
  },
});

// Export actions
export const {
  clearAdmin,
  openCreateModal,
  openEditModal,
  openDeleteModal,
  closeCreateModal,
  closeEditModal,
  closeDeleteModal,
  clearFormError,
} = adminSlice.actions;

// Export reducer
export const reducer = adminSlice.reducer;

/*
 * =============================================================================
 * Selectors
 * =============================================================================
 */

export const selectors = {
  state: (state: RootState) => state.admin,
  products: (state: RootState) => state.admin.products,
  loading: (state: RootState) => state.admin.loading,
  error: (state: RootState) => state.admin.error,
  isCreateModalOpen: (state: RootState) => state.admin.isCreateModalOpen,
  isEditModalOpen: (state: RootState) => state.admin.isEditModalOpen,
  isDeleteModalOpen: (state: RootState) => state.admin.isDeleteModalOpen,
  selectedProduct: (state: RootState) => state.admin.selectedProduct,
  formLoading: (state: RootState) => state.admin.formLoading,
  formError: (state: RootState) => state.admin.formError,
  isActive: (state: RootState) => state.admin.products !== null,
};

/*
 * =============================================================================
 * Middleware
 * =============================================================================
 */

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

    // Load products when navigating to admin route
    if (currentRoute === "admin") {
      (store.dispatch as any)(loadAdminProducts());
    }

    // Clear admin state when navigating away
    if (currentRoute !== "admin") {
      store.dispatch(clearAdmin());
    }
  }

  return result;
};

// URL sync middleware - sync modal state to URL (but not loading/error states)
const urlSyncMiddleware = createUrlSyncMiddleware<AdminState>(
  "admin",
  (state) => ({
    create: state.isCreateModalOpen ? "true" : null,
    edit: state.isEditModalOpen && state.selectedProduct ? state.selectedProduct.id : null,
    delete: state.isDeleteModalOpen && state.selectedProduct ? state.selectedProduct.id : null,
    // Don't sync loading/error states - they're transient and shouldn't be in URL
  })
);

// Module export for Pi framework
export const module = createModule("admin", reducer, [middleware, urlSyncMiddleware]);