---
title: Configure Navigation
description: How-to guide for setting up and configuring navigation in Pi applications
---

This guide shows you how to configure navigation in your Pi application, from basic route setup to advanced patterns like nested routes, middleware composition, and dynamic routing.

## Basic Navigation Setup

### Define Your Routes

Start by defining your application's route structure:

```typescript
// src/routes.ts
import { Route } from '@pi/router';
import { 
  HomePage, 
  AboutPage, 
  UsersPage, 
  UserDetailPage,
  NotFoundPage 
} from './pages';

export const routes: Route[] = [
  {
    path: "/",
    component: HomePage,
  },
  {
    path: "/about",
    component: AboutPage,
  },
  {
    path: "/users",
    component: UsersPage,
    middleware: [usersListMiddleware],
  },
  {
    path: "/users/:id",
    component: UserDetailPage,
    middleware: [userDetailMiddleware],
  },
  {
    path: "*", // Catch-all for 404
    component: NotFoundPage,
  },
];
```

### Initialize Router

Set up the router in your main app file:

```typescript
// src/App.tsx
import { initializeRouter, Outlet } from '@pi/router';
import { routes } from './routes';

// Initialize router with your routes
initializeRouter(routes);

function App() {
  return (
    <div className="app">
      <Navigation />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
```

### Create Navigation Component

Build a navigation component using Pi's navigation actions:

```typescript
// src/components/Navigation.tsx
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { navigateTo, selectCurrentRoute } from '@pi/router';

export const Navigation: React.FC = () => {
  const dispatch = useDispatch();
  const currentRoute = useSelector(selectCurrentRoute);
  
  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/about', label: 'About' },
    { path: '/users', label: 'Users' },
  ];
  
  return (
    <nav className="navigation">
      {navItems.map(item => (
        <button
          key={item.path}
          onClick={() => dispatch(navigateTo(item.path))}
          className={currentRoute?.url === item.path ? 'active' : ''}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
};
```

## Nested Routes

Create hierarchical navigation structures with nested routes:

```typescript
// Nested route configuration
export const routes: Route[] = [
  {
    path: "/",
    component: Shell,
    children: [
      {
        path: "",
        component: HomePage,
      },
      {
        path: "dashboard",
        component: DashboardPage,
        middleware: [authMiddleware],
        children: [
          {
            path: "",
            component: DashboardOverview,
          },
          {
            path: "analytics",
            component: AnalyticsPage,
            middleware: [analyticsMiddleware],
          },
          {
            path: "settings",
            component: SettingsPage,
            children: [
              {
                path: "",
                component: GeneralSettings,
              },
              {
                path: "account",
                component: AccountSettings,
              },
              {
                path: "billing",
                component: BillingSettings,
                middleware: [billingMiddleware],
              },
            ],
          },
        ],
      },
    ],
  },
];
```

### Breadcrumb Navigation

Build breadcrumbs from the current route:

```typescript
// components/Breadcrumbs.tsx
import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { navigateTo, selectCurrentRoute } from '@pi/router';

export const Breadcrumbs: React.FC = () => {
  const dispatch = useDispatch();
  const currentRoute = useSelector(selectCurrentRoute);
  
  if (!currentRoute) return null;
  
  // Build breadcrumb trail from nested matches
  const breadcrumbs = currentRoute.matches.map((match, index) => {
    const isLast = index === currentRoute.matches.length - 1;
    const url = match.url;
    
    return {
      label: getBreadcrumbLabel(match.path, match.params),
      url,
      isLast,
    };
  });
  
  return (
    <nav className="breadcrumbs">
      {breadcrumbs.map((crumb, index) => (
        <span key={crumb.url} className="breadcrumb">
          {index > 0 && <span className="separator"> / </span>}
          {crumb.isLast ? (
            <span className="current">{crumb.label}</span>
          ) : (
            <button
              onClick={() => dispatch(navigateTo(crumb.url))}
              className="breadcrumb-link"
            >
              {crumb.label}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
};

function getBreadcrumbLabel(path: string, params: Record<string, string>): string {
  // Map paths to human-readable labels
  const labelMap: Record<string, string> = {
    '/': 'Home',
    '/dashboard': 'Dashboard',
    '/dashboard/analytics': 'Analytics',
    '/dashboard/settings': 'Settings',
    '/users': 'Users',
    '/users/:id': `User ${params.id}`,
  };
  
  return labelMap[path] || path;
}
```

## Route Parameters

Handle dynamic route parameters:

```typescript
// Extract and use route parameters
export const UserDetailPage: React.FC = () => {
  const dispatch = useDispatch();
  const params = useSelector(selectRouteParams);
  const { current, loading } = useSelector((state: RootState) => state.users);
  
  // params.id is automatically extracted from /users/:id
  const userId = params.id;
  
  const handleEdit = () => {
    dispatch(navigateTo(`/users/${userId}/edit`));
  };
  
  if (loading) return <div>Loading user {userId}...</div>;
  if (!current) return <div>User not found</div>;
  
  return (
    <div>
      <h1>{current.name}</h1>
      <button onClick={handleEdit}>Edit User</button>
    </div>
  );
};
```

### Multiple Parameters

Handle routes with multiple parameters:

```typescript
// Route: /projects/:projectId/tasks/:taskId
export const TaskDetailPage: React.FC = () => {
  const params = useSelector(selectRouteParams);
  const { projectId, taskId } = params;
  
  // Both parameters are available
  const breadcrumbPath = `/projects/${projectId}/tasks/${taskId}`;
  
  return (
    <div>
      <h1>Task {taskId} in Project {projectId}</h1>
    </div>
  );
};
```

## Query Parameters

Work with query string parameters:

```typescript
// Handle query parameters
export const SearchPage: React.FC = () => {
  const dispatch = useDispatch();
  const currentRoute = useSelector(selectCurrentRoute);
  const query = currentRoute?.query;
  
  // Get query parameters
  const searchTerm = query?.get('q') || '';
  const page = parseInt(query?.get('page') || '1');
  const category = query?.get('category') || 'all';
  
  const updateSearch = (newTerm: string) => {
    const newQuery = new URLSearchParams(query || '');
    newQuery.set('q', newTerm);
    newQuery.set('page', '1'); // Reset to first page
    
    dispatch(navigateTo(`/search?${newQuery.toString()}`));
  };
  
  const updatePage = (newPage: number) => {
    const newQuery = new URLSearchParams(query || '');
    newQuery.set('page', newPage.toString());
    
    dispatch(navigateTo(`/search?${newQuery.toString()}`));
  };
  
  return (
    <div>
      <SearchInput value={searchTerm} onChange={updateSearch} />
      <CategoryFilter value={category} onChange={updateCategory} />
      <SearchResults term={searchTerm} page={page} category={category} />
      <Pagination page={page} onPageChange={updatePage} />
    </div>
  );
};
```

## Navigation Middleware

Configure middleware for route-specific behavior:

### Authentication Middleware

```typescript
// middleware/authMiddleware.ts
import { createNavigationMiddleware } from '@pi/router';

export const authMiddleware = createNavigationMiddleware({
  async onEnter({ dispatch, getState }) {
    const { user, token } = getState().auth;
    
    if (!token) {
      // Redirect to login
      dispatch(navigateTo('/login'));
      return;
    }
    
    if (!user) {
      // Load user data if we have token but no user
      dispatch(loadCurrentUser());
    }
  },
});
```

### Data Loading Middleware

```typescript
// middleware/dataMiddleware.ts
export const usersListMiddleware = createNavigationMiddleware({
  async onEnter({ dispatch, getState }) {
    const { list, lastFetch } = getState().users;
    
    // Only fetch if we don't have data or it's stale
    const isStale = !lastFetch || Date.now() - lastFetch > 5 * 60 * 1000; // 5 minutes
    
    if (!list || isStale) {
      dispatch(fetchUsersRequest());
      try {
        const users = await api.getUsers();
        dispatch(fetchUsersSuccess(users));
      } catch (error) {
        dispatch(fetchUsersFailure(error.message));
      }
    }
  },
});
```

### Middleware Composition

Combine multiple middleware functions:

```typescript
// Compose middleware for complex routes
const adminUserMiddleware = createNavigationMiddleware({
  onEnter: async (ctx) => {
    // Run auth check first
    await authMiddleware.onEnter?.(ctx);
    
    // Then check admin permissions
    const { user } = ctx.getState().auth;
    if (!user?.isAdmin) {
      ctx.dispatch(navigateTo('/forbidden'));
      return;
    }
    
    // Finally load admin-specific data
    await adminDataMiddleware.onEnter?.(ctx);
  },
});
```

## Programmatic Navigation

Navigate programmatically in response to user actions:

```typescript
// Form submission with navigation
export const CreateUserForm: React.FC = () => {
  const dispatch = useDispatch();
  const { saving } = useSelector(state => state.users);
  
  const handleSubmit = async (userData: CreateUserRequest) => {
    try {
      const newUser = await dispatch(createUser(userData)).unwrap();
      
      // Navigate to the new user's detail page
      dispatch(navigateTo(`/users/${newUser.id}`));
      
    } catch (error) {
      // Stay on form and show error
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
    </form>
  );
};
```

### Conditional Navigation

Navigate based on application state:

```typescript
// Navigate based on user role
export const DashboardRedirect: React.FC = () => {
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  
  useEffect(() => {
    if (!user) return;
    
    // Redirect based on user role
    if (user.role === 'admin') {
      dispatch(navigateTo('/admin/dashboard'));
    } else if (user.role === 'manager') {
      dispatch(navigateTo('/manager/dashboard'));
    } else {
      dispatch(navigateTo('/user/dashboard'));
    }
  }, [user, dispatch]);
  
  return <div>Redirecting...</div>;
};
```

## Navigation Guards

Implement navigation guards to control route access:

```typescript
// Route guard middleware
export const createRouteGuard = (
  predicate: (state: RootState) => boolean,
  redirectTo: string
) => createNavigationMiddleware({
  onEnter({ getState, dispatch }) {
    if (!predicate(getState())) {
      dispatch(navigateTo(redirectTo));
    }
  },
});

// Usage
const adminGuard = createRouteGuard(
  (state) => state.auth.user?.role === 'admin',
  '/forbidden'
);

const authGuard = createRouteGuard(
  (state) => !!state.auth.token,
  '/login'
);
```

## Route Transitions

Handle loading states during navigation:

```typescript
// Loading component that shows during navigation
export const NavigationLoader: React.FC = () => {
  const routerState = useSelector(selectRouteState);
  
  if (routerState.status !== 'loading') return null;
  
  return (
    <div className="navigation-loader">
      <div className="loader-overlay">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    </div>
  );
};

// Use in your app
function App() {
  return (
    <div className="app">
      <Navigation />
      <main>
        <Outlet />
      </main>
      <NavigationLoader />
    </div>
  );
}
```

## Error Handling

Handle navigation errors gracefully:

```typescript
// Error boundary for navigation errors
export const NavigationErrorBoundary: React.FC = () => {
  const routerState = useSelector(selectRouteState);
  const dispatch = useDispatch();
  
  if (routerState.status !== 'error') return <Outlet />;
  
  const handleRetry = () => {
    // Retry current navigation
    const currentPath = window.location.pathname;
    dispatch(navigateTo(currentPath));
  };
  
  const handleGoHome = () => {
    dispatch(navigateTo('/'));
  };
  
  return (
    <div className="navigation-error">
      <h2>Navigation Error</h2>
      <p>{routerState.error}</p>
      <div className="error-actions">
        <button onClick={handleRetry}>Retry</button>
        <button onClick={handleGoHome}>Go Home</button>
      </div>
    </div>
  );
};
```

## Type-Safe Navigation

Use Pi's type-safe navigation features:

```typescript
// Create typed navigation functions
import { createRoutes } from '@pi/router';

const routes = createRoutes({
  '/': HomePage,
  '/users': UsersPage,
  '/users/:id': UserDetailPage,
  '/users/:id/edit': EditUserPage,
});

// Type-safe navigation - these will fail at compile time if invalid
const navigateToUser = routes.navigateTo('/users/:id');
dispatch(navigateToUser({ id: '123' })); // ✅ Valid

// This would cause a TypeScript error:
// dispatch(navigateToUser({ userId: '123' })); // ❌ Wrong parameter name
// dispatch(navigateToUser({})); // ❌ Missing required parameter
```

## Testing Navigation

Test your navigation logic:

```typescript
// navigation.test.ts
import { store } from '../store';
import { navigateTo, waitForAction } from '@pi/router';

test('navigates to user detail page', async () => {
  store.dispatch(navigateTo('/users/123'));
  
  // Wait for navigation to complete
  await waitForAction(store, 'router/navigationSuccess');
  
  const state = store.getState();
  expect(state.router.current?.path).toBe('/users/:id');
  expect(state.router.current?.params.id).toBe('123');
});

test('loads user data on navigation', async () => {
  store.dispatch(navigateTo('/users/123'));
  
  // Wait for user data to load
  await waitForAction(store, 'users/fetchOneSuccess');
  
  const state = store.getState();
  expect(state.users.current?.id).toBe('123');
});
```

## Common Patterns

### Back Button Handling

```typescript
// Handle browser back button
export const useBackButton = () => {
  const dispatch = useDispatch();
  
  return () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      dispatch(navigateTo('/'));
    }
  };
};
```

### Route-Based Code Splitting

```typescript
// Lazy load route components
const LazyUserDetailPage = React.lazy(() => import('./pages/UserDetailPage'));

export const routes: Route[] = [
  {
    path: "/users/:id",
    component: LazyUserDetailPage,
    middleware: [userDetailMiddleware],
  },
];

// Wrap with Suspense
function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Outlet />
    </Suspense>
  );
}
```

This guide covers the essential patterns for configuring navigation in Pi applications. The key is to leverage Pi's Redux-first approach for predictable, observable navigation behavior.

## Next Steps

- [**Handle Async Operations**](/guides/async-operations/) - Managing side effects in middleware
- [**Test Your Routes**](/guides/testing/) - Testing navigation and middleware
- [**API Reference**](/reference/api/) - Complete navigation API documentation