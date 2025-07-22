---
title: Router Middleware
description: Complete reference for Pi router middleware functions and patterns
---

This page provides complete reference documentation for Pi's router middleware system, including all available functions, types, lifecycle hooks, and advanced patterns.

## Overview

Pi's router middleware system enables declarative side-effects tied to route transitions. Middleware functions execute during navigation lifecycle events, providing a clean way to manage data loading, authentication, cleanup, and other route-specific behavior.

## Core Functions

### `createNavigationMiddleware()`

Creates middleware that executes during route lifecycle events.

```typescript
function createNavigationMiddleware(
  handlers: NavigationMiddleware
): RouteMiddleware
```

**Parameters:**
- `handlers` - Object containing lifecycle hook functions

**Returns:**
- `RouteMiddleware` - Middleware function for use in route configuration

**Example:**
```typescript
const userDetailMiddleware = createNavigationMiddleware({
  async onEnter({ params, dispatch }) {
    dispatch(fetchUserRequest());
    try {
      const user = await api.getUser(params.id);
      dispatch(fetchUserSuccess(user));
    } catch (error) {
      dispatch(fetchUserFailure(error.message));
    }
  },
  
  onLeave({ dispatch }) {
    dispatch(clearCurrentUser());
  },
  
  onError({ error, dispatch }) {
    dispatch(setGlobalError(error.message));
  },
});
```

## Types

### `NavigationMiddleware`

Interface defining lifecycle hooks for route transitions.

```typescript
interface NavigationMiddleware {
  onEnter?: (ctx: LifecycleContext) => Promise<void> | void;
  onLeave?: (ctx: LifecycleContext) => Promise<void> | void;
  onError?: (ctx: LifecycleContext & { error: unknown }) => void;
}
```

**Properties:**
- `onEnter` - Called when entering a route
- `onLeave` - Called when leaving a route  
- `onError` - Called when middleware throws an error

### `LifecycleContext`

Context object passed to middleware functions containing route information and utilities.

```typescript
interface LifecycleContext {
  params: Record<string, string>;    // Route parameters
  query: URLSearchParams;            // Query string parameters
  dispatch: Dispatch;                // Redux dispatch function
  getState: () => RootState;         // Redux state getter
  signal: AbortSignal;               // Cancellation signal
  route: MatchedRoute;               // Matched route metadata
}
```

**Properties:**
- `params` - Extracted route parameters (e.g., `{ id: "123" }`)
- `query` - Query string as URLSearchParams object
- `dispatch` - Redux dispatch function for actions
- `getState` - Function to get current Redux state
- `signal` - AbortSignal for cancelling async operations
- `route` - Metadata about the matched route

### `RouteMiddleware`

Function signature for route middleware.

```typescript
type RouteMiddleware = (ctx: LifecycleContext) => Promise<void> | void;
```

### `MatchedRoute`

Information about a matched route.

```typescript
interface MatchedRoute {
  path: string;                   // Route path pattern (e.g., "/users/:id")
  url: string;                    // Actual URL that matched
  params: Record<string, string>; // Extracted parameters
  query: URLSearchParams;         // Query parameters
  component: ComponentType;       // React component to render
  middleware?: RouteMiddleware[]; // Attached middleware
}
```

## Lifecycle Hooks

### `onEnter`

Called when navigating to a route. Use for data loading, authentication checks, and setup.

```typescript
onEnter?: (ctx: LifecycleContext) => Promise<void> | void;
```

**Common patterns:**

```typescript
// Data loading
onEnter: async ({ params, dispatch }) => {
  dispatch(fetchDataRequest());
  try {
    const data = await api.getData(params.id);
    dispatch(fetchDataSuccess(data));
  } catch (error) {
    dispatch(fetchDataFailure(error.message));
  }
},

// Authentication check
onEnter: ({ dispatch, getState }) => {
  const { user } = getState().auth;
  if (!user) {
    dispatch(navigateTo('/login'));
  }
},

// Parallel data loading
onEnter: async ({ params, dispatch }) => {
  const [user, posts] = await Promise.all([
    api.getUser(params.userId),
    api.getUserPosts(params.userId),
  ]);
  
  dispatch(fetchUserSuccess(user));
  dispatch(fetchPostsSuccess(posts));
},
```

### `onLeave`

Called when leaving a route. Use for cleanup, saving state, and teardown.

```typescript
onLeave?: (ctx: LifecycleContext) => Promise<void> | void;
```

**Common patterns:**

```typescript
// State cleanup
onLeave: ({ dispatch }) => {
  dispatch(clearCurrentData());
},

// Save draft data
onLeave: async ({ dispatch, getState }) => {
  const { draft } = getState().editor;
  if (draft && draft.hasChanges) {
    await api.saveDraft(draft);
    dispatch(draftSaved());
  }
},

// Confirmation dialog
onLeave: ({ getState }) => {
  const { form } = getState();
  if (form.isDirty && !form.saved) {
    const shouldLeave = window.confirm('You have unsaved changes. Are you sure?');
    if (!shouldLeave) {
      // Note: This pattern requires additional router configuration
      throw new Error('Navigation cancelled by user');
    }
  }
},
```

### `onError`

Called when middleware functions throw errors. Use for error handling and recovery.

```typescript
onError?: (ctx: LifecycleContext & { error: unknown }) => void;
```

**Common patterns:**

```typescript
// Global error handling
onError: ({ error, dispatch }) => {
  console.error('Navigation error:', error);
  dispatch(setGlobalError(error.message));
},

// Redirect on error
onError: ({ error, dispatch }) => {
  if (error.status === 404) {
    dispatch(navigateTo('/404'));
  } else if (error.status === 403) {
    dispatch(navigateTo('/forbidden'));
  } else {
    dispatch(navigateTo('/error'));
  }
},

// Retry logic
onError: ({ error, dispatch, route }) => {
  if (error.isRetryable) {
    setTimeout(() => {
      dispatch(navigateTo(route.url)); // Retry navigation
    }, 1000);
  }
},
```

## Advanced Patterns

### Middleware Composition

Combine multiple middleware functions into one:

```typescript
function composeMiddleware(...middlewares: NavigationMiddleware[]): NavigationMiddleware {
  return {
    async onEnter(ctx) {
      for (const middleware of middlewares) {
        await middleware.onEnter?.(ctx);
      }
    },
    
    async onLeave(ctx) {
      // Execute in reverse order for cleanup
      for (const middleware of middlewares.reverse()) {
        await middleware.onLeave?.(ctx);
      }
    },
    
    onError(ctx & { error }) {
      // Execute error handlers until one handles it
      for (const middleware of middlewares) {
        try {
          middleware.onError?.(ctx);
          break; // Stop after first successful handler
        } catch {
          continue; // Try next handler
        }
      }
    },
  };
}

// Usage
const composedMiddleware = composeMiddleware(
  authMiddleware,
  dataLoadingMiddleware,
  analyticsMiddleware
);
```

### Conditional Middleware

Execute middleware based on conditions:

```typescript
function createConditionalMiddleware(
  condition: (ctx: LifecycleContext) => boolean,
  middleware: NavigationMiddleware
): NavigationMiddleware {
  return {
    async onEnter(ctx) {
      if (condition(ctx)) {
        await middleware.onEnter?.(ctx);
      }
    },
    
    async onLeave(ctx) {
      if (condition(ctx)) {
        await middleware.onLeave?.(ctx);
      }
    },
    
    onError(ctx) {
      if (condition(ctx)) {
        middleware.onError?.(ctx);
      }
    },
  };
}

// Usage
const adminOnlyMiddleware = createConditionalMiddleware(
  ({ getState }) => getState().auth.user?.role === 'admin',
  adminDataMiddleware
);
```

### Retry Middleware

Automatically retry failed operations:

```typescript
function createRetryMiddleware(
  middleware: NavigationMiddleware,
  maxRetries: number = 3,
  delay: number = 1000
): NavigationMiddleware {
  return {
    async onEnter(ctx) {
      let lastError: unknown;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          await middleware.onEnter?.(ctx);
          return; // Success, exit retry loop
        } catch (error) {
          lastError = error;
          
          if (attempt === maxRetries) {
            throw error; // Final attempt failed
          }
          
          // Wait before retry with exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, delay * Math.pow(2, attempt))
          );
        }
      }
    },
    
    onLeave: middleware.onLeave,
    onError: middleware.onError,
  };
}
```

### Caching Middleware

Cache data to avoid unnecessary refetches:

```typescript
function createCachingMiddleware(
  cacheKey: (ctx: LifecycleContext) => string,
  ttl: number = 5 * 60 * 1000 // 5 minutes
): NavigationMiddleware {
  const cache = new Map<string, { data: any; timestamp: number }>();
  
  return {
    async onEnter({ params, dispatch, getState }) {
      const key = cacheKey({ params, dispatch, getState, /* ... */ });
      const cached = cache.get(key);
      
      // Use cached data if fresh
      if (cached && Date.now() - cached.timestamp < ttl) {
        dispatch(fetchDataSuccess(cached.data));
        return;
      }
      
      // Fetch fresh data
      dispatch(fetchDataRequest());
      try {
        const data = await api.getData(params.id);
        
        // Cache the result
        cache.set(key, { data, timestamp: Date.now() });
        dispatch(fetchDataSuccess(data));
      } catch (error) {
        dispatch(fetchDataFailure(error.message));
      }
    },
  };
}
```

## Error Handling

### Error Types

Common error scenarios in middleware:

```typescript
// Network errors
class NetworkError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'NetworkError';
  }
}

// Validation errors
class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Authorization errors
class AuthorizationError extends Error {
  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
  }
}
```

### Centralized Error Handling

```typescript
const createErrorHandler = () => ({
  onError({ error, dispatch, route }: LifecycleContext & { error: unknown }) {
    console.error(`Navigation error on ${route.path}:`, error);
    
    if (error instanceof NetworkError) {
      if (error.status === 404) {
        dispatch(navigateTo('/404'));
      } else if (error.status >= 500) {
        dispatch(setGlobalError('Server error. Please try again.'));
      }
    } else if (error instanceof AuthorizationError) {
      dispatch(navigateTo('/login'));
    } else if (error instanceof ValidationError) {
      dispatch(setFormError(error.field, error.message));
    } else {
      dispatch(setGlobalError('An unexpected error occurred.'));
    }
  },
});
```

## Cancellation and Cleanup

### Using AbortSignal

Properly handle request cancellation:

```typescript
const dataLoadingMiddleware = createNavigationMiddleware({
  async onEnter({ params, dispatch, signal }) {
    dispatch(fetchDataRequest());
    
    try {
      // Pass signal to API call
      const data = await api.getData(params.id, { signal });
      
      // Check if cancelled before dispatching success
      if (!signal.aborted) {
        dispatch(fetchDataSuccess(data));
      }
    } catch (error) {
      // Don't dispatch failure if request was cancelled
      if (error.name !== 'AbortError') {
        dispatch(fetchDataFailure(error.message));
      }
    }
  },
});
```

### Cleanup Resources

```typescript
const resourceMiddleware = createNavigationMiddleware({
  onEnter({ dispatch }) {
    // Start resource (e.g., WebSocket connection, interval)
    const resource = startResource();
    
    // Store resource reference for cleanup
    dispatch(setActiveResource(resource));
  },
  
  onLeave({ dispatch, getState }) {
    // Clean up resource
    const resource = getState().resources.active;
    if (resource) {
      resource.cleanup();
      dispatch(clearActiveResource());
    }
  },
});
```

## Testing Middleware

### Unit Testing

```typescript
// middleware.test.ts
import { userDetailMiddleware } from './userDetailMiddleware';
import { usersAPI } from './usersAPI';

jest.mock('./usersAPI');
const mockedUsersAPI = usersAPI as jest.Mocked<typeof usersAPI>;

describe('userDetailMiddleware', () => {
  let mockContext: LifecycleContext;
  let mockDispatch: jest.Mock;
  let mockGetState: jest.Mock;

  beforeEach(() => {
    mockDispatch = jest.fn();
    mockGetState = jest.fn();
    
    mockContext = {
      params: { id: '123' },
      query: new URLSearchParams(),
      dispatch: mockDispatch,
      getState: mockGetState,
      signal: new AbortController().signal,
      route: { path: '/users/:id', url: '/users/123' },
    };
  });

  test('loads user data successfully', async () => {
    const mockUser = { id: '123', name: 'John Doe' };
    mockedUsersAPI.getById.mockResolvedValue(mockUser);

    await userDetailMiddleware.onEnter!(mockContext);

    expect(mockDispatch).toHaveBeenCalledWith(fetchUserRequest());
    expect(mockDispatch).toHaveBeenCalledWith(fetchUserSuccess(mockUser));
  });

  test('handles API errors', async () => {
    const error = new Error('User not found');
    mockedUsersAPI.getById.mockRejectedValue(error);

    await userDetailMiddleware.onEnter!(mockContext);

    expect(mockDispatch).toHaveBeenCalledWith(fetchUserFailure('User not found'));
  });

  test('cleans up on leave', () => {
    userDetailMiddleware.onLeave!(mockContext);

    expect(mockDispatch).toHaveBeenCalledWith(clearCurrentUser());
  });
});
```

### Integration Testing

```typescript
// Integration test with real store
import { createStore } from '@reduxjs/toolkit';
import { navigateTo } from '@pi/router';

test('middleware integration', async () => {
  const store = createStore(/* ... */);
  
  // Trigger navigation that uses middleware
  store.dispatch(navigateTo('/users/123'));
  
  // Wait for middleware to complete
  await waitForAction(store, 'users/fetchUserSuccess');
  
  // Assert final state
  const state = store.getState();
  expect(state.users.current?.id).toBe('123');
});
```

## Performance Considerations

### Avoiding Common Pitfalls

1. **Don't block navigation**: Keep middleware fast
2. **Handle errors gracefully**: Always catch exceptions
3. **Clean up resources**: Use onLeave for cleanup
4. **Cancel requests**: Use AbortSignal properly
5. **Cache appropriately**: Avoid redundant requests

### Performance Monitoring

```typescript
const performanceMiddleware = createNavigationMiddleware({
  async onEnter(ctx) {
    const start = performance.now();
    
    try {
      await actualMiddleware.onEnter?.(ctx);
    } finally {
      const duration = performance.now() - start;
      console.log(`Middleware took ${duration}ms for ${ctx.route.path}`);
      
      // Report to analytics
      analytics.timing('middleware.duration', duration, {
        route: ctx.route.path,
      });
    }
  },
});
```

## Best Practices

1. **Keep middleware focused**: One responsibility per middleware
2. **Handle all error cases**: Network, validation, authorization
3. **Use TypeScript**: Leverage type safety for context and actions
4. **Test thoroughly**: Unit and integration tests
5. **Monitor performance**: Track middleware execution time
6. **Document dependencies**: Clear about what data middleware loads
7. **Compose thoughtfully**: Order matters in middleware composition

This reference covers all aspects of Pi's router middleware system. For practical examples and patterns, see the [navigation guide](/guides/navigation/) and [async operations guide](/guides/async-operations/).

## Related Topics

- [**Navigation Guide**](/guides/navigation/) - Practical navigation patterns
- [**Async Operations Guide**](/guides/async-operations/) - Managing side effects
- [**API Reference**](/reference/api/) - Complete Pi API documentation
- [**Testing Guide**](/guides/testing/) - Testing middleware and navigation