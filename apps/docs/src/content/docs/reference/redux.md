---
title: Redux Integration
description: Complete reference for Pi's Redux integration patterns, store configuration, and state management
---

This page provides complete reference documentation for Pi's Redux integration, including store configuration, state management patterns, action conventions, and advanced Redux usage with Pi's router system.

## Overview

Pi is built on Redux Toolkit and follows strict Redux conventions to ensure predictable, observable, and debuggable applications. Every piece of application state—routing, domain data, UI state—lives in the Redux store.

## Core Redux Concepts in Pi

### Redux as Application Runtime

In Pi, Redux isn't just state management—it's the application runtime:

- **Navigation state** - Current route, parameters, loading states
- **Domain data** - Entities, collections, relationships
- **UI state** - Modals, forms, loading indicators
- **Error states** - Validation errors, API failures, route errors

### CRUD Action Conventions

All async operations follow consistent naming patterns:

```typescript
// Pattern: {feature}/{operation}{Result}
'users/fetchListRequest'    // Start loading users list
'users/fetchListSuccess'    // Users list loaded successfully
'users/fetchListFailure'    // Users list loading failed

'users/createRequest'       // Start creating user
'users/createSuccess'       // User created successfully
'users/createFailure'       // User creation failed

'users/updateRequest'       // Start updating user
'users/updateSuccess'       // User updated successfully
'users/updateFailure'       // User update failed

'users/deleteRequest'       // Start deleting user
'users/deleteSuccess'       // User deleted successfully
'users/deleteFailure'       // User deletion failed
```

## Store Configuration

### Basic Store Setup

```typescript
// store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { createBrowserRouterMiddleware, routerSlice } from '@pi/router';
import usersReducer from '../features/users/usersSlice';
import postsReducer from '../features/posts/postsSlice';
import uiReducer from '../features/ui/uiSlice';

// Create router middleware
const routerMiddleware = createBrowserRouterMiddleware();

export const store = configureStore({
  reducer: {
    router: routerSlice.reducer,
    users: usersReducer,
    posts: postsReducer,
    ui: uiReducer,
  },
  
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          // Ignore router actions with non-serializable data
          'router/navigationRequest',
          'router/navigationSuccess',
        ],
        ignoredPaths: [
          // Ignore route components in state
          'router.current.component',
          'router.pending.component',
        ],
      },
    }).concat(routerMiddleware),
    
  devTools: process.env.NODE_ENV !== 'production' && {
    name: 'Pi Application Store',
    trace: true,
    traceLimit: 25,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### Enhanced Store Configuration

```typescript
// store/index.ts - Production-ready configuration
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';

// Root reducer
const rootReducer = combineReducers({
  router: routerSlice.reducer,
  users: usersReducer,
  posts: postsReducer,
  ui: uiReducer,
  auth: authReducer,
});

// Persistence configuration
const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth'], // Only persist auth state
  blacklist: ['router'], // Never persist router state
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

// Custom middleware for logging in development
const loggerMiddleware = (store: any) => (next: any) => (action: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Dispatching:', action.type, action.payload);
  }
  return next(action);
};

export const store = configureStore({
  reducer: persistedReducer,
  
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'persist/PERSIST',
          'persist/REHYDRATE',
          'router/navigationRequest',
          'router/navigationSuccess',
        ],
      },
    })
    .concat(routerMiddleware)
    .concat(loggerMiddleware),
    
  preloadedState: undefined, // Set initial state if needed
});

export const persistor = persistStore(store);
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

## State Shape Conventions

### Router State

Pi maintains router state in a predictable shape:

```typescript
interface RouterState {
  current: RouteMatch | null;     // Currently rendered route
  pending: RouteMatch | null;     // Route being resolved
  status: 'idle' | 'loading' | 'error';
  error: string | null;
  history: string[];              // Navigation history
}

interface RouteMatch {
  path: string;                   // Route pattern (e.g., "/users/:id")
  url: string;                    // Actual URL (e.g., "/users/123")
  params: Record<string, string>; // Route parameters
  query: URLSearchParams;         // Query parameters
  matches: RouteMatch[];          // Nested route matches
  component: ComponentType;       // React component to render
}
```

### Feature State Pattern

Each feature follows a consistent state pattern:

```typescript
interface FeatureState<T> {
  // Data
  list: T[] | null;
  current: T | null;
  
  // Loading states
  listLoading: boolean;
  currentLoading: boolean;
  creating: boolean;
  updating: string | null;        // ID of item being updated
  deleting: string | null;        // ID of item being deleted
  
  // Error states
  listError: string | null;
  currentError: string | null;
  createError: string | null;
  updateError: string | null;
  deleteError: string | null;
  
  // Metadata
  lastFetch: number | null;       // Timestamp of last fetch
  dirty: boolean;                 // Has unsaved changes
}

// Example: Users feature state
interface UsersState extends FeatureState<User> {
  // Feature-specific additions
  searchQuery: string;
  filters: UserFilters;
  selectedIds: string[];
}
```

## Slice Patterns

### Standard Feature Slice

```typescript
// features/users/usersSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}

interface UsersState {
  list: User[] | null;
  current: User | null;
  listLoading: boolean;
  currentLoading: boolean;
  creating: boolean;
  updating: string | null;
  deleting: string | null;
  listError: string | null;
  currentError: string | null;
  createError: string | null;
  updateError: string | null;
  deleteError: string | null;
  lastFetch: number | null;
  searchQuery: string;
  selectedIds: string[];
}

const initialState: UsersState = {
  list: null,
  current: null,
  listLoading: false,
  currentLoading: false,
  creating: false,
  updating: null,
  deleting: null,
  listError: null,
  currentError: null,
  createError: null,
  updateError: null,
  deleteError: null,
  lastFetch: null,
  searchQuery: '',
  selectedIds: [],
};

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    // List operations
    fetchListRequest: (state) => {
      state.listLoading = true;
      state.listError = null;
    },
    fetchListSuccess: (state, action: PayloadAction<User[]>) => {
      state.listLoading = false;
      state.list = action.payload;
      state.lastFetch = Date.now();
    },
    fetchListFailure: (state, action: PayloadAction<string>) => {
      state.listLoading = false;
      state.listError = action.payload;
    },

    // Current item operations
    fetchCurrentRequest: (state) => {
      state.currentLoading = true;
      state.currentError = null;
    },
    fetchCurrentSuccess: (state, action: PayloadAction<User>) => {
      state.currentLoading = false;
      state.current = action.payload;
    },
    fetchCurrentFailure: (state, action: PayloadAction<string>) => {
      state.currentLoading = false;
      state.currentError = action.payload;
    },

    // Create operations
    createRequest: (state) => {
      state.creating = true;
      state.createError = null;
    },
    createSuccess: (state, action: PayloadAction<User>) => {
      state.creating = false;
      // Optimistically add to list
      if (state.list) {
        state.list.unshift(action.payload);
      }
    },
    createFailure: (state, action: PayloadAction<string>) => {
      state.creating = false;
      state.createError = action.payload;
    },

    // Update operations
    updateRequest: (state, action: PayloadAction<string>) => {
      state.updating = action.payload;
      state.updateError = null;
    },
    updateSuccess: (state, action: PayloadAction<User>) => {
      state.updating = null;
      const user = action.payload;
      
      // Update in list
      if (state.list) {
        const index = state.list.findIndex(u => u.id === user.id);
        if (index >= 0) {
          state.list[index] = user;
        }
      }
      
      // Update current if it matches
      if (state.current?.id === user.id) {
        state.current = user;
      }
    },
    updateFailure: (state, action: PayloadAction<string>) => {
      state.updating = null;
      state.updateError = action.payload;
    },

    // Delete operations
    deleteRequest: (state, action: PayloadAction<string>) => {
      state.deleting = action.payload;
      state.deleteError = null;
    },
    deleteSuccess: (state, action: PayloadAction<string>) => {
      const userId = action.payload;
      state.deleting = null;
      
      // Remove from list
      if (state.list) {
        state.list = state.list.filter(u => u.id !== userId);
      }
      
      // Clear current if it matches
      if (state.current?.id === userId) {
        state.current = null;
      }
      
      // Remove from selected
      state.selectedIds = state.selectedIds.filter(id => id !== userId);
    },
    deleteFailure: (state, action: PayloadAction<string>) => {
      state.deleting = null;
      state.deleteError = action.payload;
    },

    // UI operations
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    toggleSelected: (state, action: PayloadAction<string>) => {
      const userId = action.payload;
      const index = state.selectedIds.indexOf(userId);
      if (index >= 0) {
        state.selectedIds.splice(index, 1);
      } else {
        state.selectedIds.push(userId);
      }
    },
    selectAll: (state) => {
      if (state.list) {
        state.selectedIds = state.list.map(u => u.id);
      }
    },
    clearSelection: (state) => {
      state.selectedIds = [];
    },

    // Cleanup operations
    clearCurrent: (state) => {
      state.current = null;
      state.currentError = null;
    },
    clearErrors: (state) => {
      state.listError = null;
      state.currentError = null;
      state.createError = null;
      state.updateError = null;
      state.deleteError = null;
    },
    reset: () => initialState,
  },
});

export const {
  fetchListRequest,
  fetchListSuccess,
  fetchListFailure,
  fetchCurrentRequest,
  fetchCurrentSuccess,
  fetchCurrentFailure,
  createRequest,
  createSuccess,
  createFailure,
  updateRequest,
  updateSuccess,
  updateFailure,
  deleteRequest,
  deleteSuccess,
  deleteFailure,
  setSearchQuery,
  toggleSelected,
  selectAll,
  clearSelection,
  clearCurrent,
  clearErrors,
  reset,
} = usersSlice.actions;

export default usersSlice.reducer;
```

### UI State Slice

Manage global UI state separately:

```typescript
// features/ui/uiSlice.ts
interface UIState {
  // Global loading
  globalLoading: boolean;
  loadingMessage: string | null;
  
  // Notifications
  notifications: Notification[];
  
  // Modals (for non-route modals)
  modalStack: ModalState[];
  
  // Theme and preferences
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  
  // Error handling
  globalError: string | null;
  errorHistory: ErrorEntry[];
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  timeout?: number;
  dismissible: boolean;
}

interface ModalState {
  id: string;
  type: string;
  props: Record<string, any>;
  dismissible: boolean;
}

interface ErrorEntry {
  id: string;
  message: string;
  stack?: string;
  timestamp: number;
  route?: string;
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    globalLoading: false,
    loadingMessage: null,
    notifications: [],
    modalStack: [],
    theme: 'system',
    sidebarCollapsed: false,
    globalError: null,
    errorHistory: [],
  } as UIState,
  reducers: {
    // Loading states
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.globalLoading = action.payload;
    },
    setLoadingMessage: (state, action: PayloadAction<string | null>) => {
      state.loadingMessage = action.payload;
    },

    // Notifications
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id'>>) => {
      const notification = {
        ...action.payload,
        id: `notification-${Date.now()}-${Math.random()}`,
      };
      state.notifications.push(notification);
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },
    clearAllNotifications: (state) => {
      state.notifications = [];
    },

    // Modals (non-route modals)
    pushModal: (state, action: PayloadAction<Omit<ModalState, 'id'>>) => {
      const modal = {
        ...action.payload,
        id: `modal-${Date.now()}-${Math.random()}`,
      };
      state.modalStack.push(modal);
    },
    popModal: (state) => {
      state.modalStack.pop();
    },
    clearModalStack: (state) => {
      state.modalStack = [];
    },

    // Theme and preferences
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },

    // Error handling
    setGlobalError: (state, action: PayloadAction<string>) => {
      state.globalError = action.payload;
      
      // Add to error history
      const errorEntry: ErrorEntry = {
        id: `error-${Date.now()}`,
        message: action.payload,
        timestamp: Date.now(),
        route: window.location.pathname,
      };
      state.errorHistory.unshift(errorEntry);
      
      // Keep only last 10 errors
      if (state.errorHistory.length > 10) {
        state.errorHistory = state.errorHistory.slice(0, 10);
      }
    },
    clearGlobalError: (state) => {
      state.globalError = null;
    },
  },
});

export const {
  setGlobalLoading,
  setLoadingMessage,
  addNotification,
  removeNotification,
  clearAllNotifications,
  pushModal,
  popModal,
  clearModalStack,
  setTheme,
  toggleSidebar,
  setGlobalError,
  clearGlobalError,
} = uiSlice.actions;

export default uiSlice.reducer;
```

## Selectors

### Basic Selectors

```typescript
// features/users/usersSelectors.ts
import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../../store';

// Base selectors
export const selectUsersState = (state: RootState) => state.users;
export const selectUsersList = (state: RootState) => state.users.list;
export const selectCurrentUser = (state: RootState) => state.users.current;
export const selectUsersLoading = (state: RootState) => state.users.listLoading;
export const selectUsersError = (state: RootState) => state.users.listError;

// Computed selectors
export const selectUsersCount = createSelector(
  [selectUsersList],
  (users) => users?.length ?? 0
);

export const selectFilteredUsers = createSelector(
  [selectUsersList, (state: RootState) => state.users.searchQuery],
  (users, searchQuery) => {
    if (!users || !searchQuery) return users;
    
    const query = searchQuery.toLowerCase();
    return users.filter(user => 
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  }
);

export const selectSelectedUsers = createSelector(
  [selectUsersList, (state: RootState) => state.users.selectedIds],
  (users, selectedIds) => {
    if (!users || selectedIds.length === 0) return [];
    return users.filter(user => selectedIds.includes(user.id));
  }
);

export const selectUserById = (id: string) => createSelector(
  [selectUsersList],
  (users) => users?.find(user => user.id === id)
);

// Loading state selectors
export const selectIsUserOperationPending = createSelector(
  [(state: RootState) => state.users],
  (users) => 
    users.listLoading || 
    users.currentLoading || 
    users.creating || 
    users.updating !== null || 
    users.deleting !== null
);

export const selectUserErrors = createSelector(
  [(state: RootState) => state.users],
  (users) => ({
    list: users.listError,
    current: users.currentError,
    create: users.createError,
    update: users.updateError,
    delete: users.deleteError,
  })
);
```

### Memoized Selectors for Performance

```typescript
// Performance-optimized selectors
export const selectUsersGroupedByRole = createSelector(
  [selectFilteredUsers],
  (users) => {
    if (!users) return { admin: [], user: [] };
    
    return users.reduce((groups, user) => {
      groups[user.role].push(user);
      return groups;
    }, { admin: [] as User[], user: [] as User[] });
  }
);

export const selectUserStatistics = createSelector(
  [selectUsersList],
  (users) => {
    if (!users) return null;
    
    const totalUsers = users.length;
    const adminCount = users.filter(u => u.role === 'admin').length;
    const userCount = users.filter(u => u.role === 'user').length;
    const recentlyActive = users.filter(u => 
      Date.now() - new Date(u.updatedAt).getTime() < 24 * 60 * 60 * 1000
    ).length;
    
    return {
      total: totalUsers,
      admins: adminCount,
      users: userCount,
      recentlyActive,
      adminPercentage: totalUsers > 0 ? (adminCount / totalUsers) * 100 : 0,
    };
  }
);
```

## Thunks and Async Logic

### Standard Async Thunks

```typescript
// features/users/usersThunks.ts
import { createAsyncThunk } from '@reduxjs/toolkit';
import { usersAPI } from './usersAPI';
import { RootState, AppDispatch } from '../../store';

// Fetch users list
export const fetchUsers = createAsyncThunk(
  'users/fetchList',
  async (_, { dispatch, rejectWithValue }) => {
    dispatch(fetchListRequest());
    try {
      const users = await usersAPI.getList();
      dispatch(fetchListSuccess(users));
      return users;
    } catch (error) {
      const message = (error as Error).message;
      dispatch(fetchListFailure(message));
      return rejectWithValue(message);
    }
  }
);

// Fetch single user
export const fetchUser = createAsyncThunk(
  'users/fetchCurrent',
  async (id: string, { dispatch, rejectWithValue }) => {
    dispatch(fetchCurrentRequest());
    try {
      const user = await usersAPI.getById(id);
      dispatch(fetchCurrentSuccess(user));
      return user;
    } catch (error) {
      const message = (error as Error).message;
      dispatch(fetchCurrentFailure(message));
      return rejectWithValue(message);
    }
  }
);

// Create user
export const createUser = createAsyncThunk<
  User,
  CreateUserRequest,
  { state: RootState; dispatch: AppDispatch; rejectValue: string }
>(
  'users/create',
  async (userData, { dispatch, rejectWithValue }) => {
    dispatch(createRequest());
    try {
      const user = await usersAPI.create(userData);
      dispatch(createSuccess(user));
      
      // Show success notification
      dispatch(addNotification({
        type: 'success',
        title: 'User Created',
        message: `${user.name} has been created successfully.`,
        timeout: 3000,
        dismissible: true,
      }));
      
      return user;
    } catch (error) {
      const message = (error as Error).message;
      dispatch(createFailure(message));
      return rejectWithValue(message);
    }
  }
);

// Complex thunk with multiple operations
export const deleteUserWithConfirmation = createAsyncThunk<
  void,
  { id: string; confirmed?: boolean },
  { state: RootState }
>(
  'users/deleteWithConfirmation',
  async ({ id, confirmed = false }, { dispatch, getState, rejectWithValue }) => {
    const state = getState();
    const user = selectUserById(id)(state);
    
    if (!user) {
      return rejectWithValue('User not found');
    }
    
    // Show confirmation modal if not already confirmed
    if (!confirmed) {
      dispatch(pushModal({
        type: 'confirmation',
        props: {
          title: 'Delete User',
          message: `Are you sure you want to delete ${user.name}? This cannot be undone.`,
          onConfirm: () => {
            dispatch(popModal());
            dispatch(deleteUserWithConfirmation({ id, confirmed: true }));
          },
          onCancel: () => dispatch(popModal()),
        },
        dismissible: true,
      }));
      return;
    }
    
    // Proceed with deletion
    dispatch(deleteRequest(id));
    try {
      await usersAPI.delete(id);
      dispatch(deleteSuccess(id));
      
      dispatch(addNotification({
        type: 'success',
        title: 'User Deleted',
        message: `${user.name} has been deleted.`,
        timeout: 3000,
        dismissible: true,
      }));
    } catch (error) {
      const message = (error as Error).message;
      dispatch(deleteFailure(message));
      return rejectWithValue(message);
    }
  }
);
```

## Component Integration

### Using Redux with Pi Components

```typescript
// components/UsersList.tsx
import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { navigateTo } from '@pi/router';
import { RootState } from '../store';
import {
  selectFilteredUsers,
  selectUsersLoading,
  selectUsersError,
  selectUsersCount,
} from '../features/users/usersSelectors';
import { fetchUsers, deleteUserWithConfirmation } from '../features/users/usersThunks';
import { setSearchQuery, toggleSelected } from '../features/users/usersSlice';

export const UsersList: React.FC = () => {
  const dispatch = useDispatch();
  
  // Select data from store
  const users = useSelector(selectFilteredUsers);
  const loading = useSelector(selectUsersLoading);
  const error = useSelector(selectUsersError);
  const totalCount = useSelector(selectUsersCount);
  const searchQuery = useSelector((state: RootState) => state.users.searchQuery);
  const selectedIds = useSelector((state: RootState) => state.users.selectedIds);
  
  // Load users on mount (if not already loaded by middleware)
  useEffect(() => {
    if (!users && !loading) {
      dispatch(fetchUsers());
    }
  }, [users, loading, dispatch]);
  
  // Event handlers
  const handleSearch = (query: string) => {
    dispatch(setSearchQuery(query));
  };
  
  const handleUserClick = (userId: string) => {
    dispatch(navigateTo(`/users/${userId}`));
  };
  
  const handleUserSelect = (userId: string) => {
    dispatch(toggleSelected(userId));
  };
  
  const handleUserDelete = (userId: string) => {
    dispatch(deleteUserWithConfirmation({ id: userId }));
  };
  
  const handleCreateUser = () => {
    dispatch(navigateTo('/users/create'));
  };
  
  // Render loading state
  if (loading && !users) {
    return (
      <div className="users-list">
        <div className="loading-spinner">Loading users...</div>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="users-list">
        <div className="error-message">
          <h3>Error Loading Users</h3>
          <p>{error}</p>
          <button onClick={() => dispatch(fetchUsers())}>
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  // Render empty state
  if (!users || users.length === 0) {
    return (
      <div className="users-list">
        <div className="empty-state">
          <h3>No Users Found</h3>
          {searchQuery ? (
            <p>No users match your search for "{searchQuery}"</p>
          ) : (
            <p>Get started by creating your first user.</p>
          )}
          <button onClick={handleCreateUser}>
            Create User
          </button>
        </div>
      </div>
    );
  }
  
  // Render users list
  return (
    <div className="users-list">
      <div className="users-header">
        <h2>Users ({totalCount})</h2>
        <div className="users-actions">
          <input
            type="search"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <button onClick={handleCreateUser}>
            Create User
          </button>
        </div>
      </div>
      
      <div className="users-grid">
        {users.map((user) => (
          <UserCard
            key={user.id}
            user={user}
            selected={selectedIds.includes(user.id)}
            onClick={() => handleUserClick(user.id)}
            onSelect={() => handleUserSelect(user.id)}
            onDelete={() => handleUserDelete(user.id)}
          />
        ))}
      </div>
    </div>
  );
};
```

### Custom Hooks for Redux

```typescript
// hooks/useUsers.ts
import { useSelector, useDispatch } from 'react-redux';
import { useCallback, useMemo } from 'react';
import {
  selectUsersState,
  selectFilteredUsers,
  selectSelectedUsers,
} from '../features/users/usersSelectors';
import {
  setSearchQuery,
  toggleSelected,
  selectAll,
  clearSelection,
} from '../features/users/usersSlice';
import { fetchUsers, createUser, updateUser, deleteUser } from '../features/users/usersThunks';

export const useUsers = () => {
  const dispatch = useDispatch();
  const usersState = useSelector(selectUsersState);
  const filteredUsers = useSelector(selectFilteredUsers);
  const selectedUsers = useSelector(selectSelectedUsers);
  
  // Actions
  const actions = useMemo(() => ({
    fetch: () => dispatch(fetchUsers()),
    create: (userData: CreateUserRequest) => dispatch(createUser(userData)),
    update: (id: string, updates: Partial<User>) => dispatch(updateUser({ id, ...updates })),
    delete: (id: string) => dispatch(deleteUser(id)),
    
    // Selection actions
    toggleSelected: (id: string) => dispatch(toggleSelected(id)),
    selectAll: () => dispatch(selectAll()),
    clearSelection: () => dispatch(clearSelection()),
    
    // Search actions
    setSearchQuery: (query: string) => dispatch(setSearchQuery(query)),
  }), [dispatch]);
  
  // Computed values
  const computed = useMemo(() => ({
    hasUsers: Boolean(filteredUsers?.length),
    selectedCount: selectedUsers.length,
    isAllSelected: filteredUsers ? selectedUsers.length === filteredUsers.length : false,
    hasSelection: selectedUsers.length > 0,
  }), [filteredUsers, selectedUsers]);
  
  return {
    // State
    ...usersState,
    filteredUsers,
    selectedUsers,
    
    // Actions
    ...actions,
    
    // Computed
    ...computed,
  };
};
```

## Testing Redux Logic

### Testing Slices

```typescript
// features/users/usersSlice.test.ts
import usersReducer, {
  fetchListRequest,
  fetchListSuccess,
  fetchListFailure,
  createSuccess,
  updateSuccess,
  deleteSuccess,
  initialState,
} from './usersSlice';

describe('users slice', () => {
  test('should handle initial state', () => {
    expect(usersReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  test('should handle fetchListRequest', () => {
    const actual = usersReducer(initialState, fetchListRequest());
    expect(actual.listLoading).toBe(true);
    expect(actual.listError).toBe(null);
  });

  test('should handle fetchListSuccess', () => {
    const users = [
      { id: '1', name: 'John', email: 'john@example.com', role: 'user' },
    ];

    const loadingState = { ...initialState, listLoading: true };
    const actual = usersReducer(loadingState, fetchListSuccess(users));

    expect(actual.listLoading).toBe(false);
    expect(actual.list).toEqual(users);
    expect(actual.lastFetch).toBeGreaterThan(0);
  });

  test('should handle optimistic updates', () => {
    const existingUsers = [
      { id: '1', name: 'John', email: 'john@example.com', role: 'user' },
    ];
    
    const newUser = { id: '2', name: 'Jane', email: 'jane@example.com', role: 'user' };

    const stateWithUsers = { ...initialState, list: existingUsers };
    const actual = usersReducer(stateWithUsers, createSuccess(newUser));

    expect(actual.list).toHaveLength(2);
    expect(actual.list?.[0]).toEqual(newUser); // Added to beginning
  });
});
```

### Testing Selectors

```typescript
// features/users/usersSelectors.test.ts
import {
  selectFilteredUsers,
  selectUsersCount,
  selectUserById,
} from './usersSelectors';

const mockState = {
  users: {
    list: [
      { id: '1', name: 'John Doe', email: 'john@example.com', role: 'admin' },
      { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'user' },
    ],
    searchQuery: 'john',
    // ... other state
  },
  // ... other slices
};

describe('users selectors', () => {
  test('selectFilteredUsers filters by search query', () => {
    const result = selectFilteredUsers(mockState);
    expect(result).toHaveLength(1);
    expect(result?.[0].name).toBe('John Doe');
  });

  test('selectUsersCount returns correct count', () => {
    const count = selectUsersCount(mockState);
    expect(count).toBe(2);
  });

  test('selectUserById finds correct user', () => {
    const user = selectUserById('1')(mockState);
    expect(user?.name).toBe('John Doe');
  });
});
```

### Testing Thunks

```typescript
// features/users/usersThunks.test.ts
import { createUser } from './usersThunks';
import { usersAPI } from './usersAPI';
import { createStore } from '../../test-utils/createTestStore';

jest.mock('./usersAPI');
const mockedUsersAPI = usersAPI as jest.Mocked<typeof usersAPI>;

describe('users thunks', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
    jest.clearAllMocks();
  });

  test('createUser dispatches correct actions on success', async () => {
    const userData = { name: 'John', email: 'john@example.com' };
    const createdUser = { id: '1', role: 'user', ...userData };
    
    mockedUsersAPI.create.mockResolvedValue(createdUser);

    await store.dispatch(createUser(userData));

    const state = store.getState();
    expect(state.users.creating).toBe(false);
    expect(state.users.list).toContain(createdUser);
  });

  test('createUser handles API errors', async () => {
    const userData = { name: 'John', email: 'invalid-email' };
    const error = new Error('Invalid email format');
    
    mockedUsersAPI.create.mockRejectedValue(error);

    const result = await store.dispatch(createUser(userData));

    expect(result.type).toBe('users/create/rejected');
    expect(result.payload).toBe('Invalid email format');
    
    const state = store.getState();
    expect(state.users.creating).toBe(false);
    expect(state.users.createError).toBe('Invalid email format');
  });
});
```

This comprehensive Redux integration reference covers all aspects of using Redux with Pi, from basic setup to advanced patterns and testing strategies. The key is maintaining consistency in action naming, state shape, and following Pi's Redux-first principles.

## Related Topics

- [**API Reference**](/reference/api/) - Complete Pi API documentation
- [**Navigation Guide**](/guides/navigation/) - Redux-integrated navigation patterns
- [**Testing Guide**](/guides/testing/) - Testing Redux logic and components
- [**Quick Start**](/getting-started/quick-start/) - Getting started with Pi and Redux