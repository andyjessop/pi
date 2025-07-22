---
title: Handle Async Operations
description: How-to guide for managing asynchronous operations and side effects in Pi
---

This guide shows you how to handle asynchronous operations in Pi applications. You'll learn how to manage API calls, handle loading states, implement error recovery, and coordinate complex async workflows using Pi's navigation middleware and Redux patterns.

## Core Principles

In Pi, all async operations follow these principles:

1. **Side effects happen in middleware** - Never in React components
2. **CRUD action triplets** - Every async operation has Request/Success/Failure actions
3. **Observable state** - All loading/error states are in Redux
4. **Cancellable operations** - Use AbortSignal for cleanup

## Basic Async Pattern

### API Service Layer

First, create a service layer for your API operations:

```typescript
// services/api.ts
class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

class APIService {
  private baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    signal?: AbortSignal
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new APIError(
        error.message || `HTTP ${response.status}`,
        response.status,
        error.code
      );
    }
    
    return response.json();
  }
  
  // GET operations
  async get<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, signal);
  }
  
  // POST operations
  async post<T>(endpoint: string, data: any, signal?: AbortSignal): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    }, signal);
  }
  
  // PUT operations
  async put<T>(endpoint: string, data: any, signal?: AbortSignal): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, signal);
  }
  
  // DELETE operations
  async delete(endpoint: string, signal?: AbortSignal): Promise<void> {
    await this.request(endpoint, { method: 'DELETE' }, signal);
  }
}

export const api = new APIService();
```

### Feature-Specific API Methods

Create feature-specific API methods:

```typescript
// features/users/usersAPI.ts
import { api } from '../../services/api';
import { User, CreateUserRequest, UpdateUserRequest } from './types';

export const usersAPI = {
  async getList(signal?: AbortSignal): Promise<User[]> {
    return api.get<User[]>('/users', signal);
  },
  
  async getById(id: string, signal?: AbortSignal): Promise<User> {
    return api.get<User>(`/users/${id}`, signal);
  },
  
  async create(data: CreateUserRequest, signal?: AbortSignal): Promise<User> {
    return api.post<User>('/users', data, signal);
  },
  
  async update(data: UpdateUserRequest, signal?: AbortSignal): Promise<User> {
    const { id, ...updateData } = data;
    return api.put<User>(`/users/${id}`, updateData, signal);
  },
  
  async delete(id: string, signal?: AbortSignal): Promise<void> {
    return api.delete(`/users/${id}`, signal);
  },
  
  // Complex operations
  async search(
    query: string, 
    filters: SearchFilters,
    signal?: AbortSignal
  ): Promise<SearchResults> {
    const params = new URLSearchParams({
      q: query,
      ...filters,
    });
    return api.get<SearchResults>(`/users/search?${params}`, signal);
  },
};
```

## Navigation Middleware for Async Operations

### Basic Data Loading

Use navigation middleware to trigger async operations:

```typescript
// features/users/usersMiddleware.ts
import { createNavigationMiddleware } from '@pi/router';
import { usersAPI } from './usersAPI';
import {
  fetchListRequest,
  fetchListSuccess,
  fetchListFailure,
  fetchOneRequest,
  fetchOneSuccess,
  fetchOneFailure,
  clearCurrent,
} from './usersSlice';

export const usersListMiddleware = createNavigationMiddleware({
  async onEnter({ dispatch, signal }) {
    dispatch(fetchListRequest());
    
    try {
      const users = await usersAPI.getList(signal);
      dispatch(fetchListSuccess(users));
    } catch (error) {
      if (error.name === 'AbortError') {
        // Navigation was cancelled, don't dispatch failure
        return;
      }
      dispatch(fetchListFailure((error as Error).message));
    }
  },
});

export const userDetailMiddleware = createNavigationMiddleware({
  async onEnter({ params, dispatch, signal }) {
    dispatch(fetchOneRequest());
    
    try {
      const user = await usersAPI.getById(params.id, signal);
      dispatch(fetchOneSuccess(user));
    } catch (error) {
      if (error.name === 'AbortError') return;
      dispatch(fetchOneFailure((error as Error).message));
    }
  },
  
  onLeave({ dispatch }) {
    dispatch(clearCurrent());
  },
});
```

### Parallel Data Loading

Load multiple resources in parallel:

```typescript
// Load user and their posts together
export const userProfileMiddleware = createNavigationMiddleware({
  async onEnter({ params, dispatch, signal }) {
    dispatch(fetchUserRequest());
    dispatch(fetchUserPostsRequest());
    
    try {
      // Load both in parallel
      const [user, posts] = await Promise.all([
        usersAPI.getById(params.id, signal),
        postsAPI.getByUserId(params.id, signal),
      ]);
      
      dispatch(fetchUserSuccess(user));
      dispatch(fetchUserPostsSuccess(posts));
    } catch (error) {
      if (error.name === 'AbortError') return;
      
      // Handle partial failures
      dispatch(fetchUserFailure((error as Error).message));
      dispatch(fetchUserPostsFailure((error as Error).message));
    }
  },
});
```

### Conditional Data Loading

Load data only when needed:

```typescript
// Smart data loading with caching
export const smartUsersListMiddleware = createNavigationMiddleware({
  async onEnter({ dispatch, getState, signal }) {
    const { list, lastFetch, error } = getState().users;
    
    // Don't refetch if we have fresh data
    const isFresh = lastFetch && Date.now() - lastFetch < 5 * 60 * 1000; // 5 minutes
    
    if (list && isFresh && !error) {
      return; // Use cached data
    }
    
    dispatch(fetchListRequest());
    
    try {
      const users = await usersAPI.getList(signal);
      dispatch(fetchListSuccess(users));
    } catch (error) {
      if (error.name === 'AbortError') return;
      dispatch(fetchListFailure((error as Error).message));
    }
  },
});
```

## Complex Async Workflows

### Multi-Step Operations

Handle complex workflows with multiple API calls:

```typescript
// Complex user creation workflow
export const createUserWorkflow = (userData: CreateUserRequest) => 
  async (dispatch: any, getState: any) => {
    try {
      // Step 1: Validate user data
      dispatch(validateUserRequest());
      await usersAPI.validateUserData(userData);
      dispatch(validateUserSuccess());
      
      // Step 2: Create user account
      dispatch(createUserRequest());
      const newUser = await usersAPI.create(userData);
      dispatch(createUserSuccess(newUser));
      
      // Step 3: Send welcome email
      dispatch(sendWelcomeEmailRequest());
      await emailAPI.sendWelcomeEmail(newUser.email);
      dispatch(sendWelcomeEmailSuccess());
      
      // Step 4: Create user profile
      dispatch(createProfileRequest());
      const profile = await profilesAPI.create({
        userId: newUser.id,
        ...userData.profile,
      });
      dispatch(createProfileSuccess(profile));
      
      return newUser;
      
    } catch (error) {
      // Handle failures at any step
      const errorMessage = (error as Error).message;
      
      if (getState().users.validating) {
        dispatch(validateUserFailure(errorMessage));
      } else if (getState().users.creating) {
        dispatch(createUserFailure(errorMessage));
      } else if (getState().users.sendingEmail) {
        dispatch(sendWelcomeEmailFailure(errorMessage));
      } else if (getState().users.creatingProfile) {
        dispatch(createProfileFailure(errorMessage));
      }
      
      throw error;
    }
  };
```

### Optimistic Updates

Implement optimistic updates for better UX:

```typescript
// Optimistic update pattern
export const updateUserOptimistic = (userId: string, updates: Partial<User>) =>
  async (dispatch: any, getState: any) => {
    const originalUser = getState().users.current;
    
    // Apply optimistic update immediately
    dispatch(updateUserOptimistic({ id: userId, updates }));
    
    try {
      // Perform actual update
      const updatedUser = await usersAPI.update({ id: userId, ...updates });
      dispatch(updateUserSuccess(updatedUser));
    } catch (error) {
      // Revert optimistic update on failure
      dispatch(updateUserFailure((error as Error).message));
      if (originalUser) {
        dispatch(revertUserUpdate(originalUser));
      }
    }
  };

// In your slice
const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    updateUserOptimistic: (state, action) => {
      const { id, updates } = action.payload;
      if (state.current?.id === id) {
        state.current = { ...state.current, ...updates };
      }
      if (state.list) {
        const index = state.list.findIndex(user => user.id === id);
        if (index >= 0) {
          state.list[index] = { ...state.list[index], ...updates };
        }
      }
    },
    revertUserUpdate: (state, action) => {
      const originalUser = action.payload;
      if (state.current?.id === originalUser.id) {
        state.current = originalUser;
      }
      if (state.list) {
        const index = state.list.findIndex(user => user.id === originalUser.id);
        if (index >= 0) {
          state.list[index] = originalUser;
        }
      }
    },
  },
});
```

## Error Handling Strategies

### Retry Logic

Implement automatic retry for transient failures:

```typescript
// Utility for retry logic
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on certain errors
      if (error instanceof APIError && error.status >= 400 && error.status < 500) {
        throw error; // Client errors shouldn't be retried
      }
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
    }
  }
  
  throw lastError!;
}

// Use in middleware
export const resilientUsersListMiddleware = createNavigationMiddleware({
  async onEnter({ dispatch, signal }) {
    dispatch(fetchListRequest());
    
    try {
      const users = await withRetry(() => usersAPI.getList(signal));
      dispatch(fetchListSuccess(users));
    } catch (error) {
      if (error.name === 'AbortError') return;
      dispatch(fetchListFailure((error as Error).message));
    }
  },
});
```

### Circuit Breaker Pattern

Implement circuit breaker for failing services:

```typescript
// Circuit breaker implementation
class CircuitBreaker {
  private failures = 0;
  private lastFailure?: number;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private maxFailures: number = 5,
    private resetTimeout: number = 60000 // 1 minute
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - (this.lastFailure || 0) > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    
    if (this.failures >= this.maxFailures) {
      this.state = 'open';
    }
  }
}

// Use circuit breaker
const userServiceBreaker = new CircuitBreaker();

export const protectedUsersAPI = {
  async getList(signal?: AbortSignal): Promise<User[]> {
    return userServiceBreaker.execute(() => usersAPI.getList(signal));
  },
};
```

## Loading State Management

### Granular Loading States

Track loading states for different operations:

```typescript
// Detailed loading state management
interface UsersState {
  // Data
  list: User[] | null;
  current: User | null;
  
  // Loading states
  listLoading: boolean;
  currentLoading: boolean;
  creating: boolean;
  updating: string | null; // ID of user being updated
  deleting: string | null; // ID of user being deleted
  
  // Error states
  listError: string | null;
  currentError: string | null;
  createError: string | null;
  updateError: string | null;
  deleteError: string | null;
}

// Loading indicators in components
export const UsersList: React.FC = () => {
  const { list, listLoading, creating, deleting } = useSelector(
    (state: RootState) => state.users
  );
  
  return (
    <div>
      {listLoading && <div>Loading users...</div>}
      {creating && <div>Creating new user...</div>}
      
      {list?.map(user => (
        <UserCard
          key={user.id}
          user={user}
          isDeleting={deleting === user.id}
        />
      ))}
    </div>
  );
};
```

### Global Loading State

Coordinate loading states across features:

```typescript
// Global loading coordinator
interface LoadingState {
  operations: Record<string, boolean>;
  count: number;
}

const loadingSlice = createSlice({
  name: 'loading',
  initialState: { operations: {}, count: 0 } as LoadingState,
  reducers: {
    startOperation: (state, action: PayloadAction<string>) => {
      if (!state.operations[action.payload]) {
        state.operations[action.payload] = true;
        state.count++;
      }
    },
    endOperation: (state, action: PayloadAction<string>) => {
      if (state.operations[action.payload]) {
        delete state.operations[action.payload];
        state.count--;
      }
    },
  },
});

// Use in middleware
export const trackingUsersListMiddleware = createNavigationMiddleware({
  async onEnter({ dispatch, signal }) {
    const operationId = 'users/fetchList';
    
    dispatch(startOperation(operationId));
    dispatch(fetchListRequest());
    
    try {
      const users = await usersAPI.getList(signal);
      dispatch(fetchListSuccess(users));
    } catch (error) {
      if (error.name === 'AbortError') return;
      dispatch(fetchListFailure((error as Error).message));
    } finally {
      dispatch(endOperation(operationId));
    }
  },
});
```

## Testing Async Operations

### Mock API Responses

Test async middleware with mocked APIs:

```typescript
// usersMiddleware.test.ts
import { createStore } from '@reduxjs/toolkit';
import { usersAPI } from './usersAPI';
import { usersListMiddleware } from './usersMiddleware';

// Mock the API
jest.mock('./usersAPI');
const mockedUsersAPI = usersAPI as jest.Mocked<typeof usersAPI>;

describe('Users List Middleware', () => {
  let store: ReturnType<typeof createStore>;
  
  beforeEach(() => {
    store = createStore(usersSlice.reducer);
    jest.clearAllMocks();
  });
  
  test('loads users successfully', async () => {
    const mockUsers = [
      { id: '1', name: 'John Doe' },
      { id: '2', name: 'Jane Smith' },
    ];
    
    mockedUsersAPI.getList.mockResolvedValue(mockUsers);
    
    // Create mock context
    const context = {
      dispatch: store.dispatch,
      getState: store.getState,
      signal: new AbortController().signal,
      params: {},
      query: new URLSearchParams(),
      route: {},
    };
    
    await usersListMiddleware.onEnter!(context);
    
    const state = store.getState();
    expect(state.list).toEqual(mockUsers);
    expect(state.listLoading).toBe(false);
    expect(state.listError).toBeNull();
  });
  
  test('handles API errors', async () => {
    const error = new Error('Network error');
    mockedUsersAPI.getList.mockRejectedValue(error);
    
    const context = {
      dispatch: store.dispatch,
      getState: store.getState,
      signal: new AbortController().signal,
      params: {},
      query: new URLSearchParams(),
      route: {},
    };
    
    await usersListMiddleware.onEnter!(context);
    
    const state = store.getState();
    expect(state.list).toBeNull();
    expect(state.listLoading).toBe(false);
    expect(state.listError).toBe('Network error');
  });
  
  test('handles cancellation', async () => {
    const abortController = new AbortController();
    const error = new DOMException('Operation aborted', 'AbortError');
    
    mockedUsersAPI.getList.mockRejectedValue(error);
    
    const context = {
      dispatch: store.dispatch,
      getState: store.getState,
      signal: abortController.signal,
      params: {},
      query: new URLSearchParams(),
      route: {},
    };
    
    abortController.abort();
    await usersListMiddleware.onEnter!(context);
    
    // Should not dispatch failure action on abort
    const state = store.getState();
    expect(state.listError).toBeNull();
  });
});
```

## Performance Optimization

### Request Deduplication

Prevent duplicate requests:

```typescript
// Request deduplication
class RequestDeduplicator {
  private pending: Map<string, Promise<any>> = new Map();
  
  async execute<T>(key: string, operation: () => Promise<T>): Promise<T> {
    if (this.pending.has(key)) {
      return this.pending.get(key);
    }
    
    const promise = operation().finally(() => {
      this.pending.delete(key);
    });
    
    this.pending.set(key, promise);
    return promise;
  }
}

const deduplicator = new RequestDeduplicator();

export const deduplicatedUsersAPI = {
  async getById(id: string, signal?: AbortSignal): Promise<User> {
    return deduplicator.execute(
      `user:${id}`,
      () => usersAPI.getById(id, signal)
    );
  },
};
```

### Background Refresh

Implement background data refresh:

```typescript
// Background refresh pattern
export const backgroundRefreshMiddleware = createNavigationMiddleware({
  onEnter({ dispatch, getState }) {
    const { list, lastFetch } = getState().users;
    
    // Show stale data immediately
    if (list) {
      // Data is already displayed
    }
    
    // Refresh in background if stale
    const isStale = !lastFetch || Date.now() - lastFetch > 30 * 1000; // 30 seconds
    
    if (isStale) {
      // Silent refresh without loading states
      usersAPI.getList()
        .then(users => dispatch(fetchListSuccess(users)))
        .catch(() => {
          // Silent failure - keep existing data
        });
    }
  },
});
```

This guide covers the essential patterns for handling async operations in Pi applications. The key is to leverage navigation middleware for side effects while maintaining predictable Redux state management.

## Next Steps

- [**Test Your Routes**](/guides/testing/) - Testing async operations and middleware
- [**Debug with Redux DevTools**](/guides/debugging/) - Debugging async workflows  
- [**API Reference**](/reference/middleware/) - Complete middleware API documentation