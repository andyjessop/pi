import { test, expect } from "bun:test";
import { navigateTo, createRoutes } from "./pi";

/* ============================================================================
 * Simple Type Safety Demo - Working Example
 * ========================================================================= */

const TestComponent = () => "test";

// Simple routes without readonly complexity
const routes = [
	{
		path: "/",
		component: TestComponent,
	},
	{
		path: "/about",
		component: TestComponent,
	},
	{
		path: "/users/:id",
		component: TestComponent,
	},
	{
		path: "/posts/:postId",
		component: TestComponent,
	},
] as const;

test("should provide type safety for route navigation", () => {
	// Option 1: Direct bound navigateTo (simplest, full type safety)
	const { navigateTo: boundNavigateTo } = createRoutes(routes);
	
	// ✅ Direct type-safe navigation - no registries needed!
	const homeAction = boundNavigateTo("/");
	const aboutAction = boundNavigateTo("/about");
	const userAction = boundNavigateTo("/users/:id", { id: "123" });
	const postAction = boundNavigateTo("/posts/:postId", { postId: "456" });

	expect(homeAction.type).toBe("@@pi/NAVIGATE");
	expect(aboutAction.payload.fullPath).toBe("/about");
	expect(userAction.payload.fullPath).toBe("/users/123");
	expect(postAction.payload.fullPath).toBe("/posts/456");

	// Option 2: Advanced - registry approach for complex use cases  
	const routeConfig = createRoutes(routes);
	const userRegistry = routeConfig.withPaths(["/users/:id"] as const);
	const advancedAction = navigateTo(userRegistry, "/users/:id", { id: "advanced" });
	expect(advancedAction.payload.fullPath).toBe("/users/advanced");

	// ✅ Legacy navigation still works
	const legacyAction = navigateTo("/legacy/path/:id", { id: "test" });
	expect(legacyAction.payload.fullPath).toBe("/legacy/path/test");
});

test("should demonstrate what type safety prevents", () => {
	const routeConfig = createRoutes(routes);
	const registry = routeConfig.toRegistry();

	// These would cause TypeScript compilation errors if uncommented:

	// ❌ Invalid route path (not in validPaths):
	// const invalid1 = navigateTo(registry, "/nonexistent");

	// ❌ Missing required parameter:
	// const invalid2 = navigateTo(registry, "/users/:id", {});

	// ❌ Wrong parameter name:
	// const invalid3 = navigateTo(registry, "/users/:id", { userId: "123" });

	// ❌ Invalid route with typo:
	// const invalid4 = navigateTo(registry, "/user/:id", { id: "123" }); // typo: user vs users

	expect(registry.validPaths).toContain("/users/:id");
});

/* ============================================================================
 * Type Safety Summary
 * ========================================================================= */

/*
The Pi2 router now provides the following type safety features:

1. **Strongly Typed Route Registry**: 
   - Routes and valid paths are defined explicitly
   - Compile-time validation ensures only valid paths can be navigated to
   
2. **Parameter Type Safety**: 
   - Required parameters are enforced at compile time
   - Parameter names must match route definitions exactly
   
3. **Backward Compatibility**: 
   - Legacy untyped navigation still works for gradual migration
   - Existing code continues to function without changes
   
4. **Testing Infrastructure**: 
   - Comprehensive test suite validates both runtime and compile-time behavior
   - npm scripts enable automated type safety verification
   
5. **Developer Experience**: 
   - IDE autocomplete for valid routes
   - Immediate feedback on invalid routes or parameters
   - Clear error messages guide developers to correct usage

Usage in your application:

```typescript
// Define your routes
const appRoutes: Route[] = [
  { path: '/', component: HomePage },
  { path: '/users/:id', component: UserPage },
  { path: '/posts/:postId', component: PostPage }
];

// Define valid paths for type checking
const appPaths = ['/', '/users/:id', '/posts/:postId'] as const;

// Create registry
const registry = createRouteRegistry(appRoutes, appPaths);

// Type-safe navigation
dispatch(navigateTo(registry, '/users/:id', { id: '123' })); // ✅ Valid
dispatch(navigateTo(registry, '/invalid', {})); // ❌ TypeScript error
dispatch(navigateTo(registry, '/users/:id', {})); // ❌ Missing required param
```
*/

