---
title: API Reference
description: Complete API documentation for Pi router functions and types
---

This page provides complete API documentation for all Pi router functions, types, and utilities.

## Core Functions

### `navigateTo()`

Dispatches a navigation action to change the current route.

```typescript
function navigateTo(
  path: string, 
  params?: Record<string, string | number>
): ThunkAction
```

**Parameters:**
- `path` - The target route path (e.g., `/users/:id`)  
- `params` - Optional parameters to interpolate into the path

**Examples:**

```typescript
// Simple navigation
dispatch(navigateTo('/users'));

// Navigation with parameters
dispatch(navigateTo('/users/:id', { id: '123' }));

// Relative navigation
dispatch(navigateTo('../settings'));
```

### `createNavigationMiddleware()`

Creates middleware that executes during route lifecycle events.

```typescript
function createNavigationMiddleware(
  handlers: NavigationMiddleware
): RouteMiddleware
```

**Parameters:**
- `handlers` - Object containing lifecycle hook functions

**Example:**

```typescript
export const userDetailMiddleware = createNavigationMiddleware({
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

### `createRoutes()`

Creates a type-safe route registry from route definitions.

```typescript
function createRoutes<T extends Record<string, ComponentType>>(
  routes: T
): RouteRegistry<T>
```

**Parameters:**
- `routes` - Object mapping route paths to React components

**Example:**

```typescript
const routes = createRoutes({
  '/': HomePage,
  '/users': UsersPage, 
  '/users/:id': UserDetailPage,
  '/users/:id/edit': EditUserModal,
});

// Type-safe navigation
const navigateToUser = routes.navigateTo('/users/:id');
dispatch(navigateToUser({ id: '123' }));
```

### Router Middleware

#### `createBrowserRouterMiddleware()`

Creates router middleware for browser environments with HTML5 History API.

```typescript
function createBrowserRouterMiddleware(
  options?: BrowserRouterOptions
): Middleware
```

**Options:**
```typescript
interface BrowserRouterOptions {
  basename?: string;           // Base URL path
  forceRefresh?: boolean;      // Force full page refresh on navigation
  keyLength?: number;          // Length of location.key
  getUserConfirmation?: (     // Custom confirmation dialog
    message: string, 
    callback: (ok: boolean) => void
  ) => void;
}
```

#### `createHeadlessRouterMiddleware()`

Creates router middleware for testing environments without browser APIs.

```typescript
function createHeadlessRouterMiddleware(
  initialPath?: string
): Middleware
```

**Parameters:**
- `initialPath` - Starting route path (defaults to `/`)

## Types

### `Route`

Defines a single route configuration.

```typescript
interface Route {
  path: string;                    // Path pattern with optional parameters
  component: ComponentType;        // React component to render
  children?: Route[];              // Nested child routes
  middleware?: RouteMiddleware[];  // Navigation middleware functions
}
```

### `NavigationMiddleware`

Defines lifecycle hooks for route transitions.

```typescript
interface NavigationMiddleware {
  onEnter?: (ctx: LifecycleContext) => Promise<void> | void;
  onLeave?: (ctx: LifecycleContext) => Promise<void> | void;  
  onError?: (ctx: LifecycleContext & { error: unknown }) => void;
}
```

### `LifecycleContext`

Context object passed to middleware functions.

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

### `RouterState`

Shape of the router slice in Redux store.

```typescript
interface RouterState {
  current: RouteMatch | null;     // Currently rendered route
  pending: RouteMatch | null;     // Route being resolved
  status: 'idle' | 'loading' | 'error';
  error: string | null;
}
```

### `RouteMatch`

Information about a matched route.

```typescript
interface RouteMatch {
  path: string;                   // Matched path pattern
  url: string;                    // Actual URL that matched
  params: Record<string, string>; // Extracted parameters
  query: URLSearchParams;         // Query parameters
  matches: RouteMatch[];          // Nested route matches
}
```

## Selectors

### `selectRouteState()`

Selects the current router state.

```typescript
const selectRouteState = (state: RootState): RouterState => state.router;
```

### `selectCurrentRoute()`

Selects the currently active route match.

```typescript
const selectCurrentRoute = (state: RootState): RouteMatch | null => 
  state.router.current;
```

### `selectRouteParams()`

Selects route parameters from current route.

```typescript
const selectRouteParams = (state: RootState): Record<string, string> =>
  state.router.current?.params ?? {};
```

### `selectRouteStatus()`

Selects the current navigation status.

```typescript
const selectRouteStatus = (state: RootState): 'idle' | 'loading' | 'error' =>
  state.router.status;
```

## Components

### `<Outlet />`

Renders the component for the currently matched route.

```typescript
function Outlet(props: {
  fallback?: ReactNode;  // Rendered when no route matches
}): ReactElement | null
```

**Example:**

```typescript
function App() {
  return (
    <div>
      <Navigation />
      <main>
        <Outlet fallback={<div>Page not found</div>} />
      </main>
    </div>
  );
}
```

## Testing Utilities

### `waitForState()`

Waits for Redux state to match a predicate function.

```typescript
function waitForState<T>(
  store: Store,
  predicate: (state: T) => boolean,
  timeout?: number
): Promise<T>
```

### `waitForAction()`

Waits for a specific Redux action to be dispatched.

```typescript
function waitForAction(
  store: Store,
  actionType: string,
  timeout?: number  
): Promise<Action>
```

**Example:**

```typescript
// Test navigation completion
test('navigates to user detail', async () => {
  store.dispatch(navigateTo('/users/123'));
  
  await waitForAction(store, 'users/fetchUserSuccess');
  
  const state = store.getState();
  expect(state.users.current?.id).toBe('123');
});
```

## Error Types

### `NavigationError`

Thrown when navigation fails.

```typescript
class NavigationError extends Error {
  constructor(
    message: string,
    public path: string,
    public cause?: Error
  );
}
```

### `RouteNotFoundError`

Thrown when no route matches the given path.

```typescript
class RouteNotFoundError extends NavigationError {
  constructor(path: string);
}
```

### `MiddlewareError`

Thrown when navigation middleware fails.

```typescript  
class MiddlewareError extends NavigationError {
  constructor(
    message: string,
    public middlewareName: string,
    public phase: 'enter' | 'leave' | 'error',
    cause?: Error
  );
}
```

## Advanced Configuration

### Custom Route Matching

You can provide custom route matching logic:

```typescript
interface RouteMatcherOptions {
  caseSensitive?: boolean;     // Case-sensitive path matching
  exact?: boolean;             // Exact path matching only
  strict?: boolean;            // Strict trailing slash matching
}

function createCustomMatcher(options: RouteMatcherOptions): RouteMatcher;
```

### Middleware Composition

Combine multiple middleware functions:

```typescript
const composedMiddleware = createNavigationMiddleware({
  onEnter: compose([
    authMiddleware.onEnter,
    dataMiddleware.onEnter,
    analyticsMiddleware.onEnter,
  ]),
});
```

This API reference covers all the essential functions and types needed to work effectively with Pi. For implementation examples and best practices, see the [tutorials](/tutorials/first-app/) and [how-to guides](/guides/navigation/).