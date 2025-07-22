import { test, expect } from "bun:test";
import {
	createRouteRegistry,
	navigateTo,
	createRoutes,
	type Route,
} from "./pi";

/* ============================================================================
 * Type Safety Tests - These tests validate compile-time type checking
 * ========================================================================= */

const TestComponent = () => "test";

// Define strongly typed routes (without as const to avoid readonly conflicts)
const stronglyTypedRoutes: Route[] = [
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
		path: "/posts/:postId/comments/:commentId",
		component: TestComponent,
	},
	{
		path: "/products/:category",
		component: TestComponent,
		children: [
			{
				path: "details/:productId",
				component: TestComponent,
			},
		],
	},
];

test("should create strongly typed route registry", () => {
	const routeConfig = createRoutes(stronglyTypedRoutes);
	const registry = routeConfig.toRegistry();

	// Verify the registry contains the routes and paths
	expect(registry.routes).toBe(stronglyTypedRoutes);
	expect(Array.from(registry.validPaths)).toEqual([
		"/",
		"/about",
		"/users/:id",
		"/posts/:postId/comments/:commentId",
		"/products/:category",
		"/products/:category/details/:productId",
	]);
});

test("should allow navigation to valid routes with registry", () => {
	// Use separate registries for routes with parameters to avoid type conflicts
	const basicRegistry = createRouteRegistry(stronglyTypedRoutes, [
		"/",
		"/about",
	] as const);
	const userRegistry = createRouteRegistry(stronglyTypedRoutes, [
		"/users/:id",
	] as const);
	const commentRegistry = createRouteRegistry(stronglyTypedRoutes, [
		"/posts/:postId/comments/:commentId",
	] as const);

	// These should compile without errors - valid routes
	const homeAction = navigateTo(basicRegistry, "/");
	const aboutAction = navigateTo(basicRegistry, "/about");
	const userAction = navigateTo(userRegistry, "/users/:id", { id: "123" });
	const commentAction = navigateTo(
		commentRegistry,
		"/posts/:postId/comments/:commentId",
		{
			postId: "42",
			commentId: "87",
		},
	);

	expect(homeAction.type).toBe("@@pi/NAVIGATE");
	expect(aboutAction.payload.fullPath).toBe("/about");
	expect(userAction.payload.fullPath).toBe("/users/123");
	expect(commentAction.payload.fullPath).toBe("/posts/42/comments/87");
});

test("should work with legacy untyped navigation", () => {
	// This should still work for backward compatibility
	const legacyAction = navigateTo("/any/path/:id", { id: "test" });

	expect(legacyAction.type).toBe("@@pi/NAVIGATE");
	expect(legacyAction.payload.fullPath).toBe("/any/path/test");
});

test("should extract route paths correctly", () => {
	// Test that our extracted paths work correctly
	const routeConfig = createRoutes(stronglyTypedRoutes);
	const registry = routeConfig.toRegistry();

	// These paths should be automatically extracted from routes
	expect(Array.from(registry.validPaths)).toEqual([
		"/",
		"/about",
		"/users/:id",
		"/posts/:postId/comments/:commentId",
		"/products/:category",
		"/products/:category/details/:productId",
	]);
});

/* ============================================================================
 * Compile-time error examples (commented out)
 * ========================================================================= */

/*
// The following code should cause TypeScript compilation errors:

test("should demonstrate compile-time type safety", () => {
	const registry = createRouteRegistry(stronglyTypedRoutes);
	
	// ❌ TypeScript Error: Argument of type '"/invalid/route"' is not assignable to parameter
	const invalidAction1 = navigateTo(registry, "/invalid/route");
	
	// ❌ TypeScript Error: Property 'invalidParam' does not exist in type
	const invalidAction2 = navigateTo(registry, "/users/:id", { invalidParam: "test" });
	
	// ❌ TypeScript Error: Property 'id' is missing in type '{}' but required
	const invalidAction3 = navigateTo(registry, "/users/:id", {});
	
	// ❌ TypeScript Error: Argument of type '"typo"' is not assignable
	const invalidAction4 = navigateTo(registry, "/user/:id", { id: "123" }); // typo: /user vs /users
});
*/

