---
title: Type Safety
description: Complete reference for Pi's TypeScript type safety features and compile-time route validation
---

This page provides complete reference documentation for Pi's TypeScript type safety features, including compile-time route validation, parameter type checking, and advanced type-safe navigation patterns.

## Overview

Pi provides comprehensive compile-time type safety for navigation through:

- **Route path validation** - Invalid routes are caught at build time
- **Parameter type checking** - Missing or incorrect parameters cause TypeScript errors  
- **Autocomplete support** - IDE suggestions for valid routes and parameters
- **Refactoring safety** - Route changes are automatically reflected in types

## Core Type-Safe Functions

### `createRoutes()`

Creates a type-safe route registry with automatic path extraction and parameter inference.

```typescript
function createRoutes<T extends Record<string, ComponentType>>(
  routes: T
): RouteRegistry<T>
```

**Parameters:**
- `routes` - Object mapping route paths to React components

**Returns:**
- `RouteRegistry<T>` - Type-safe navigation functions and utilities

**Example:**
```typescript
import { createRoutes } from '@pi/router';
import { HomePage, UsersPage, UserDetailPage } from './pages';

const routes = createRoutes({
  '/': HomePage,
  '/users': UsersPage,
  '/users/:id': UserDetailPage,
  '/users/:id/posts/:postId': UserPostPage,
});

// Type-safe navigation functions are generated automatically
const navigateToUser = routes.navigateTo('/users/:id');
dispatch(navigateToUser({ id: '123' })); // ✅ Valid

// These would cause TypeScript errors:
// dispatch(navigateToUser({ userId: '123' })); // ❌ Wrong parameter name
// dispatch(navigateToUser({})); // ❌ Missing required parameter
```

### `createRouteRegistry()`

Alternative API for explicit type-safe route registry creation.

```typescript
function createRouteRegistry<
  TRoutes extends Record<string, ComponentType>
>(
  routes: TRoutes
): {
  navigateTo: NavigateToFunction<TRoutes>;
  paths: ExtractPaths<TRoutes>;
  components: TRoutes;
}
```

**Example:**
```typescript
const registry = createRouteRegistry({
  '/users/:id/edit': EditUserPage,
  '/projects/:projectId/tasks/:taskId': TaskPage,
});

// Generated navigation functions
const editUser = registry.navigateTo('/users/:id/edit');
const viewTask = registry.navigateTo('/projects/:projectId/tasks/:taskId');

// Type-safe usage
dispatch(editUser({ id: '123' }));
dispatch(viewTask({ projectId: 'proj-1', taskId: 'task-1' }));
```

## Type Definitions

### `RouteRegistry<T>`

Generated type for route registries with type-safe navigation functions.

```typescript
type RouteRegistry<T extends Record<string, ComponentType>> = {
  navigateTo: NavigateToFunction<T>;
  paths: ExtractPaths<T>;
  components: T;
}
```

### `NavigateToFunction<T>`

Type-safe navigation function generator.

```typescript
type NavigateToFunction<T> = <K extends keyof T>(
  path: K
) => (params: ExtractParams<K>) => NavigationAction
```

### `ExtractParams<T>`

Extracts parameter types from route path strings.

```typescript
// Automatically infers parameter types from route paths
type UserParams = ExtractParams<'/users/:id'>; 
// Result: { id: string }

type PostParams = ExtractParams<'/users/:userId/posts/:postId'>;
// Result: { userId: string; postId: string }

type NoParams = ExtractParams<'/about'>;
// Result: {} (empty object)
```

### `ExtractPaths<T>`

Extracts all valid paths from a route registry.

```typescript
type ValidPaths = ExtractPaths<{
  '/': HomePage;
  '/users': UsersPage;
  '/users/:id': UserDetailPage;
}>;
// Result: '/' | '/users' | '/users/:id'
```

## Advanced Type Features

### Optional Parameters

Handle optional route segments with conditional types:

```typescript
// Optional segments with '?'
const routes = createRoutes({
  '/products': ProductsPage,
  '/products/:category': CategoryPage,
  '/products/:category?': OptionalCategoryPage, // Optional parameter
});

// Usage
const navigateToCategory = routes.navigateTo('/products/:category?');

// Both are valid:
dispatch(navigateToCategory({})); // No category
dispatch(navigateToCategory({ category: 'electronics' })); // With category
```

### Query Parameter Types

Type-safe query parameter handling:

```typescript
interface SearchParams {
  q?: string;
  page?: number;
  category?: string;
  sort?: 'name' | 'date' | 'price';
}

const searchPage = createTypedRoute('/search', {
  component: SearchPage,
  queryParams: {} as SearchParams,
});

// Type-safe query parameter usage
const navigateToSearch = (params: SearchParams) => 
  navigateTo('/search', undefined, params);

// Usage with autocomplete
dispatch(navigateToSearch({
  q: 'laptop',
  page: 2,
  category: 'electronics',
  sort: 'price', // ✅ Valid enum value
  // invalid: 'value' // ❌ Would cause TypeScript error
}));
```

### Nested Route Types

Handle nested route hierarchies with type safety:

```typescript
type NestedRoutes = {
  '/dashboard': DashboardLayout;
  '/dashboard/': DashboardHome;
  '/dashboard/users': UsersSection;
  '/dashboard/users/:id': UserDetail;
  '/dashboard/settings': SettingsSection;
  '/dashboard/settings/account': AccountSettings;
}

const dashboardRoutes = createRoutes<NestedRoutes>({
  '/dashboard': DashboardLayout,
  '/dashboard/': DashboardHome,
  '/dashboard/users': UsersSection,
  '/dashboard/users/:id': UserDetail,
  '/dashboard/settings': SettingsSection,
  '/dashboard/settings/account': AccountSettings,
});

// All navigation functions are type-safe
const toUserDetail = dashboardRoutes.navigateTo('/dashboard/users/:id');
dispatch(toUserDetail({ id: '123' }));
```

## Runtime Type Validation

### Parameter Validation

Add runtime validation to complement compile-time types:

```typescript
import { z } from 'zod';

const UserParamsSchema = z.object({
  id: z.string().uuid(),
});

const validateUserParams = (params: unknown) => {
  return UserParamsSchema.parse(params);
};

// Use in navigation middleware
const userDetailMiddleware = createNavigationMiddleware({
  async onEnter({ params, dispatch }) {
    try {
      const validatedParams = validateUserParams(params);
      // params.id is now validated as a UUID
      const user = await api.getUser(validatedParams.id);
      dispatch(fetchUserSuccess(user));
    } catch (error) {
      if (error instanceof z.ZodError) {
        dispatch(navigateTo('/404')); // Invalid parameters
      } else {
        dispatch(fetchUserFailure(error.message));
      }
    }
  },
});
```

### Query Parameter Validation

```typescript
const SearchQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  category: z.enum(['electronics', 'clothing', 'books']).optional(),
  sort: z.enum(['name', 'date', 'price']).default('name'),
});

const validateSearchQuery = (query: URLSearchParams) => {
  const params = Object.fromEntries(query.entries());
  return SearchQuerySchema.parse(params);
};
```

## Migration Patterns

### From Untyped to Typed Routes

Gradually migrate existing routes to type-safe navigation:

```typescript
// Step 1: Define routes object (no behavior change)
const routePaths = {
  '/': HomePage,
  '/users': UsersPage,
  '/users/:id': UserDetailPage,
} as const;

// Step 2: Create typed registry
const typedRoutes = createRoutes(routePaths);

// Step 3: Gradually replace navigateTo calls
// Old way:
// dispatch(navigateTo('/users/123'));

// New way:
const toUser = typedRoutes.navigateTo('/users/:id');
dispatch(toUser({ id: '123' }));

// Step 4: Use ESLint rules to enforce typed navigation
// eslint rule: no-direct-navigate-to
```

### Legacy Support

Maintain backward compatibility while adopting type safety:

```typescript
// Support both typed and untyped navigation
const legacyNavigateTo = (path: string, params?: Record<string, string>) => {
  console.warn('Using legacy navigation. Consider migrating to typed routes.');
  return navigateTo(path, params);
};

// Gradual migration helper
const createMigrationHelper = <T extends Record<string, ComponentType>>(
  routes: T
) => {
  const typedRegistry = createRoutes(routes);
  
  return {
    // New typed API
    typed: typedRegistry,
    
    // Legacy API with warnings
    legacy: legacyNavigateTo,
    
    // Migration utility
    migrate: (path: string) => {
      if (path in routes) {
        console.info(`Consider using typed navigation for: ${path}`);
      }
      return legacyNavigateTo(path);
    },
  };
};
```

## Error Prevention

### Common TypeScript Errors

Pi's type system prevents common navigation errors:

```typescript
const routes = createRoutes({
  '/users/:id': UserDetailPage,
  '/posts/:postId/comments/:commentId': CommentPage,
});

// ❌ These will cause TypeScript compilation errors:

// Wrong path
const invalid1 = routes.navigateTo('/user/:id'); // Path doesn't exist

// Wrong parameter name
const invalid2 = routes.navigateTo('/users/:id');
dispatch(invalid2({ userId: '123' })); // Should be 'id', not 'userId'

// Missing parameter
const invalid3 = routes.navigateTo('/users/:id');
dispatch(invalid3({})); // Missing required 'id' parameter

// Extra parameters
const invalid4 = routes.navigateTo('/users/:id');
dispatch(invalid4({ id: '123', extra: 'value' })); // 'extra' is not valid

// ✅ These are valid:
const valid = routes.navigateTo('/users/:id');
dispatch(valid({ id: '123' }));
```

### ESLint Integration

Configure ESLint to enforce type-safe navigation:

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    // Custom rule to prevent direct navigateTo usage
    'no-direct-navigate-to': 'error',
    
    // Ensure all route parameters are typed
    '@typescript-eslint/explicit-function-return-type': 'error',
  },
  
  // Custom rule implementation
  plugins: ['custom-pi-rules'],
};
```

```typescript
// Custom ESLint rule example
const rule = {
  name: 'no-direct-navigate-to',
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.name === 'navigateTo' && node.arguments.length > 0) {
          const firstArg = node.arguments[0];
          if (firstArg.type === 'Literal') {
            context.report({
              node,
              message: 'Use typed navigation instead of direct navigateTo calls',
              suggest: [
                {
                  desc: 'Convert to typed navigation',
                  fix: (fixer) => {
                    // Auto-fix implementation
                  },
                },
              ],
            });
          }
        }
      },
    };
  },
};
```

## Testing Type Safety

### Compile-Time Tests

Use TypeScript's type system to test navigation types:

```typescript
// type-tests.ts - These should compile without errors
import { createRoutes } from '@pi/router';

const routes = createRoutes({
  '/': HomePage,
  '/users/:id': UserDetailPage,
  '/posts/:postId/comments/:commentId': CommentPage,
});

// Test parameter extraction
type UserParams = Parameters<ReturnType<typeof routes.navigateTo<'/users/:id'>>>[0];
type ExpectedUserParams = { id: string };
type UserParamsTest = UserParams extends ExpectedUserParams ? true : false;
const userParamsTest: UserParamsTest = true; // Should be true

// Test multiple parameters
type CommentParams = Parameters<ReturnType<typeof routes.navigateTo<'/posts/:postId/comments/:commentId'>>>[0];
type ExpectedCommentParams = { postId: string; commentId: string };
type CommentParamsTest = CommentParams extends ExpectedCommentParams ? true : false;
const commentParamsTest: CommentParamsTest = true; // Should be true

// Test no parameters
type RootParams = Parameters<ReturnType<typeof routes.navigateTo<'/'>>>[0];
type ExpectedRootParams = {};
type RootParamsTest = RootParams extends ExpectedRootParams ? true : false;
const rootParamsTest: RootParamsTest = true; // Should be true
```

### Runtime Type Testing

Test that runtime behavior matches TypeScript types:

```typescript
// runtime-type-tests.test.ts
describe('Navigation Type Safety', () => {
  test('enforces required parameters', () => {
    const routes = createRoutes({
      '/users/:id': UserDetailPage,
    });

    const navigateToUser = routes.navigateTo('/users/:id');
    
    // This should work
    expect(() => navigateToUser({ id: '123' })).not.toThrow();
    
    // TypeScript prevents this at compile time, but we can test runtime behavior
    // Note: This test would only run if TypeScript checks are bypassed
  });

  test('parameter types match expectations', () => {
    const routes = createRoutes({
      '/posts/:postId/comments/:commentId': CommentPage,
    });

    const navigateToComment = routes.navigateTo('/posts/:postId/comments/:commentId');
    const action = navigateToComment({ postId: 'post-1', commentId: 'comment-1' });
    
    expect(action.type).toBe('router/navigationRequest');
    expect(action.payload.path).toBe('/posts/post-1/comments/comment-1');
  });
});
```

## IDE Integration

### VSCode Configuration

Enhance the development experience with VSCode settings:

```json
// .vscode/settings.json
{
  "typescript.preferences.includePackageJsonAutoImports": "auto",
  "typescript.suggest.autoImports": true,
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  },
  "typescript.inlayHints.parameterNames.enabled": "all",
  "typescript.inlayHints.parameterTypes.enabled": true
}
```

### Auto-Import Configuration

Configure automatic imports for Pi navigation:

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/routes": ["src/routes"],
      "@/navigation": ["src/navigation"]
    }
  }
}
```

## Performance Considerations

### Build-Time Type Checking

Type-safe navigation has minimal runtime overhead:

- **Compile time**: Type checking adds to build time but catches errors early
- **Runtime**: Generated navigation functions have zero overhead
- **Bundle size**: No additional runtime code for types

### Type Complexity

Manage complex route types efficiently:

```typescript
// For large applications, consider splitting route registries
const publicRoutes = createRoutes({
  '/': HomePage,
  '/about': AboutPage,
  '/contact': ContactPage,
});

const userRoutes = createRoutes({
  '/dashboard': DashboardPage,
  '/profile': ProfilePage,
  '/settings': SettingsPage,
});

const adminRoutes = createRoutes({
  '/admin': AdminDashboard,
  '/admin/users': AdminUsers,
  '/admin/settings': AdminSettings,
});

// Combine when needed
const allRoutes = {
  ...publicRoutes.components,
  ...userRoutes.components,
  ...adminRoutes.components,
};
```

## Best Practices

1. **Start with types early**: Define route types from the beginning
2. **Use strict TypeScript**: Enable strict mode for better type checking
3. **Validate at boundaries**: Add runtime validation for external data
4. **Test your types**: Include compile-time type tests
5. **Document complex types**: Add comments for complex route hierarchies
6. **Gradual migration**: Migrate legacy code incrementally
7. **Leverage tooling**: Use ESLint rules and IDE features
8. **Keep types simple**: Avoid overly complex type gymnastics

This reference provides comprehensive coverage of Pi's type safety features. The type system ensures that navigation errors are caught at compile time rather than runtime, significantly improving developer productivity and application reliability.

## Related Topics

- [**API Reference**](/reference/api/) - Complete Pi API documentation
- [**Navigation Guide**](/guides/navigation/) - Practical navigation patterns
- [**Testing Guide**](/guides/testing/) - Testing type-safe navigation
- [**Quick Start**](/getting-started/quick-start/) - Getting started with Pi