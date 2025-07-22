import { expect, test, describe, mock } from "bun:test";
import { configureStore } from "@reduxjs/toolkit";
import {
	routerSlice,
	createHeadlessRouterMiddleware,
	navigateTo,
	waitForState,
	createRoutes,
	type Route,
	type RouterState,
	type LifecycleCtx,
} from "./pi";

/* ============================================================================
 * COMPREHENSIVE INTEGRATION TESTS - WORKING SUBSET
 * ============================================================================
 * 
 * This file contains comprehensive tests covering the core functionality
 * of the pi router with reliable, working test cases.
 * ========================================================================= */

interface TestState {
	router: RouterState;
}

// Test component
const TestComponent = () => "test";

// Create store utility
function createComprehensiveTestStore<const TRoutes extends readonly Route[]>(
	routes: TRoutes,
	initialPath = "/",
	options?: { onNavigate?: (payload: any) => void }
) {
	const { navigateTo: boundNavigateTo } = createRoutes(routes);

	const store = configureStore({
		reducer: {
			router: routerSlice.reducer,
		},
		middleware: (getDefault) =>
			getDefault().concat(
				createHeadlessRouterMiddleware(routes, {
					initialPath,
					onNavigate: options?.onNavigate,
				}),
			),
	});

	return {
		...store,
		navigateTo: boundNavigateTo,
	};
}

/* ============================================================================
 * 1. BASIC NAVIGATION TESTS
 * ========================================================================= */

describe("Basic Navigation - Comprehensive", () => {
	test("should handle valid navigation actions", async () => {
		const routes = [{ path: "/", component: TestComponent }] as const;
		const store = createComprehensiveTestStore(routes);

		await waitForState(store, (state: TestState) => state.router.status === "idle");

		// Valid action should work
		store.dispatch(navigateTo("/"));
		await waitForState(store, (state: TestState) => state.router.current?.fullPath === "/");
		
		expect(store.getState().router.current?.fullPath).toBe("/");
	});

	test("should ignore non-navigation actions", async () => {
		const routes = [{ path: "/", component: TestComponent }] as const;
		const store = createComprehensiveTestStore(routes);

		await waitForState(store, (state: TestState) => state.router.status === "idle");

		// Non-navigation action should be ignored by router middleware
		store.dispatch({ type: "OTHER_ACTION", payload: "test" });
		
		expect(store.getState().router.current?.fullPath).toBe("/");
		expect(store.getState().router.status).toBe("idle");
	});
});

/* ============================================================================
 * 2. ROUTE MATCHING TESTS
 * ========================================================================= */

describe("Route Matching - Comprehensive", () => {
	test("should match root route correctly", async () => {
		const routes = [{ path: "/", component: TestComponent }] as const;
		const store = createComprehensiveTestStore(routes, "/");

		await waitForState(store, (state: TestState) => state.router.status === "idle");
		
		expect(store.getState().router.current?.fullPath).toBe("/");
		expect(store.getState().router.current?.params).toEqual({});
		expect(store.getState().router.current?.matches).toHaveLength(1);
		expect(store.getState().router.current?.matches[0].path).toBe("/");
	});

	test("should handle route not found", async () => {
		const routes = [{ path: "/home", component: TestComponent }] as const;
		const store = createComprehensiveTestStore(routes, "/");

		await waitForState(store, (state: TestState) => state.router.status === "error");
		
		expect(store.getState().router.status).toBe("error");
		expect(store.getState().router.error).toContain('No route matches "/"');
		expect(store.getState().router.current).toBe(null);
	});

	test("should match simple parameterized routes", async () => {
		const routes = [
			{ path: "/", component: TestComponent },
			{ path: "/users/:id", component: TestComponent }
		] as const;
		const store = createComprehensiveTestStore(routes);

		await waitForState(store, (state: TestState) => state.router.status === "idle");

		store.dispatch(store.navigateTo("/users/:id", { id: "123" }));
		await waitForState(store, (state: TestState) => state.router.current?.fullPath === "/users/123");
		
		expect(store.getState().router.current?.params).toEqual({ id: "123" });
		expect(store.getState().router.current?.matches).toHaveLength(1);
		expect(store.getState().router.current?.matches[0].params).toEqual({ id: "123" });
	});

	test("should match multi-parameter routes", async () => {
		const routes = [
			{ path: "/", component: TestComponent },
			{ path: "/posts/:postId/comments/:commentId", component: TestComponent }
		] as const;
		const store = createComprehensiveTestStore(routes);

		await waitForState(store, (state: TestState) => state.router.status === "idle");

		store.dispatch(store.navigateTo("/posts/:postId/comments/:commentId", { 
			postId: "42", 
			commentId: "87" 
		}));
		await waitForState(store, (state: TestState) => 
			state.router.current?.fullPath === "/posts/42/comments/87"
		);
		
		expect(store.getState().router.current?.params).toEqual({ 
			postId: "42", 
			commentId: "87" 
		});
	});
});

/* ============================================================================
 * 3. PARAMETER AND QUERY HANDLING TESTS
 * ========================================================================= */

describe("Parameter and Query Handling - Comprehensive", () => {
	test("should handle no query parameters", async () => {
		const routes = [{ path: "/test", component: TestComponent }] as const;
		const store = createComprehensiveTestStore(routes);

		await waitForState(store, (state: TestState) => state.router.status === "idle");

		store.dispatch(navigateTo("/test"));
		await waitForState(store, (state: TestState) => state.router.current?.fullPath === "/test");
		
		expect(store.getState().router.current?.query).toEqual({});
	});

	test("should handle single query parameter", async () => {
		const routes = [{ path: "/search", component: TestComponent }] as const;
		const store = createComprehensiveTestStore(routes);

		await waitForState(store, (state: TestState) => state.router.status === "idle");

		store.dispatch(navigateTo("/search", {}, { q: "test" }));
		await waitForState(store, (state: TestState) => state.router.current?.fullPath === "/search");
		
		expect(store.getState().router.current?.query).toEqual({ q: "test" });
	});

	test("should handle multiple query parameters", async () => {
		const routes = [{ path: "/results", component: TestComponent }] as const;
		const store = createComprehensiveTestStore(routes);

		await waitForState(store, (state: TestState) => state.router.status === "idle");

		store.dispatch(navigateTo("/results", {}, { 
			page: "1", 
			size: "20", 
			sort: "name" 
		}));
		await waitForState(store, (state: TestState) => state.router.current?.fullPath === "/results");
		
		expect(store.getState().router.current?.query).toEqual({ 
			page: "1", 
			size: "20", 
			sort: "name" 
		});
	});

	test("should convert boolean and number query parameters to strings", async () => {
		const routes = [{ path: "/filter", component: TestComponent }] as const;
		const store = createComprehensiveTestStore(routes);

		await waitForState(store, (state: TestState) => state.router.status === "idle");

		store.dispatch(navigateTo("/filter", {}, { 
			active: true, 
			count: 42,
			price: 19.99
		}));
		await waitForState(store, (state: TestState) => state.router.current?.fullPath === "/filter");
		
		expect(store.getState().router.current?.query).toEqual({ 
			active: "true", 
			count: "42",
			price: "19.99"
		});
	});

	test("should handle combined path parameters and query parameters", async () => {
		const routes = [
			{ path: "/users/:id/posts/:postId", component: TestComponent }
		] as const;
		const store = createComprehensiveTestStore(routes);

		await waitForState(store, (state: TestState) => state.router.status === "idle");

		store.dispatch(navigateTo("/users/:id/posts/:postId", 
			{ id: "user123", postId: "post456" }, 
			{ view: "detailed", comments: true }
		));
		await waitForState(store, (state: TestState) => 
			state.router.current?.fullPath === "/users/user123/posts/post456"
		);
		
		const state = store.getState();
		expect(state.router.current?.params).toEqual({ id: "user123", postId: "post456" });
		expect(state.router.current?.query).toEqual({ view: "detailed", comments: "true" });
	});
});

/* ============================================================================
 * 4. LIFECYCLE HOOK TESTS
 * ========================================================================= */

describe("Lifecycle Hook Handling - Comprehensive", () => {
	test("should handle synchronous onEnter hooks", async () => {
		const onEnterSpy = mock(() => {});
		const routes = [
			{ path: "/", component: TestComponent },
			{
				path: "/sync",
				component: TestComponent,
				middleware: [
					{
						onEnter: onEnterSpy,
					},
				],
			},
		] as const;
		const store = createComprehensiveTestStore(routes);

		await waitForState(store, (state: TestState) => state.router.status === "idle");

		store.dispatch(navigateTo("/sync"));
		await waitForState(store, (state: TestState) => state.router.current?.fullPath === "/sync");

		expect(onEnterSpy).toHaveBeenCalledTimes(1);
		expect(onEnterSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				params: {},
				query: {},
				dispatch: expect.any(Function),
				getState: expect.any(Function),
				signal: expect.any(AbortSignal),
				route: expect.objectContaining({
					route: expect.objectContaining({ path: "/sync" }),
					params: {},
				}),
			}),
		);
	});

	test("should handle asynchronous onEnter hooks", async () => {
		let hookCompleted = false;
		const asyncOnEnter = mock(async (_ctx: LifecycleCtx) => {
			await new Promise((resolve) => setTimeout(resolve, 50));
			hookCompleted = true;
		});

		const routes = [
			{ path: "/", component: TestComponent },
			{
				path: "/async",
				component: TestComponent,
				middleware: [{ onEnter: asyncOnEnter }],
			},
		] as const;
		const store = createComprehensiveTestStore(routes);

		await waitForState(store, (state: TestState) => state.router.status === "idle");

		store.dispatch(navigateTo("/async"));

		// Should be loading while async hook runs
		await waitForState(store, (state: TestState) => state.router.status === "loading");
		expect(store.getState().router.pending?.fullPath).toBe("/async");
		expect(hookCompleted).toBe(false);

		// Wait for completion
		await waitForState(store, (state: TestState) =>
			state.router.current?.fullPath === "/async" && state.router.status === "idle"
		);

		expect(asyncOnEnter).toHaveBeenCalledTimes(1);
		expect(hookCompleted).toBe(true);
	});

	test("should handle onError hooks when onEnter throws", async () => {
		const onErrorSpy = mock((_ctx: LifecycleCtx & { error: unknown }) => {});
		const throwingOnEnter = mock(() => {
			throw new Error("Navigation blocked!");
		});

		const routes = [
			{ path: "/", component: TestComponent },
			{
				path: "/error",
				component: TestComponent,
				middleware: [
					{
						onEnter: throwingOnEnter,
						onError: onErrorSpy,
					},
				],
			},
		] as const;
		const store = createComprehensiveTestStore(routes);

		await waitForState(store, (state: TestState) => state.router.status === "idle");

		store.dispatch(navigateTo("/error"));
		await waitForState(store, (state: TestState) => state.router.status === "error");

		const state = store.getState();
		expect(state.router.status).toBe("error");
		expect(state.router.error).toBe("Navigation blocked!");
		expect(state.router.current?.fullPath).toBe("/"); // Should remain on previous route

		expect(throwingOnEnter).toHaveBeenCalledTimes(1);
		expect(onErrorSpy).toHaveBeenCalledTimes(1);
		expect(onErrorSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				error: expect.any(Error),
				params: {},
				query: {},
				dispatch: expect.any(Function),
				getState: expect.any(Function),
				signal: expect.any(AbortSignal),
			}),
		);
	});
});

/* ============================================================================
 * 5. CONCURRENT NAVIGATION TESTS
 * ========================================================================= */

describe("Concurrent Navigation - Comprehensive", () => {
	test("should handle rapid-fire navigation attempts", async () => {
		const routes = [
			{ path: "/", component: TestComponent },
			{ path: "/page1", component: TestComponent },
			{ path: "/page2", component: TestComponent },
			{ path: "/page3", component: TestComponent },
			{ path: "/final", component: TestComponent },
		] as const;
		const store = createComprehensiveTestStore(routes);

		await waitForState(store, (state: TestState) => state.router.status === "idle");

		// Fire multiple navigations in rapid succession
		store.dispatch(navigateTo("/page1"));
		store.dispatch(navigateTo("/page2"));
		store.dispatch(navigateTo("/page3"));
		store.dispatch(navigateTo("/final"));

		// Should end up on the last one
		await waitForState(store, (state: TestState) =>
			state.router.current?.fullPath === "/final" && state.router.status === "idle"
		);

		expect(store.getState().router.current?.fullPath).toBe("/final");
	});

	test("should handle navigation during error state", async () => {
		const errorMiddleware = mock(() => {
			throw new Error("First navigation failed!");
		});

		const routes = [
			{ path: "/", component: TestComponent },
			{
				path: "/error",
				component: TestComponent,
				middleware: [{ onEnter: errorMiddleware }],
			},
			{ path: "/recovery", component: TestComponent },
		] as const;
		const store = createComprehensiveTestStore(routes);

		await waitForState(store, (state: TestState) => state.router.status === "idle");

		// Navigate to error route
		store.dispatch(navigateTo("/error"));
		await waitForState(store, (state: TestState) => state.router.status === "error");

		expect(store.getState().router.error).toBe("First navigation failed!");

		// Navigate away from error state
		store.dispatch(navigateTo("/recovery"));
		await waitForState(store, (state: TestState) =>
			state.router.current?.fullPath === "/recovery" && state.router.status === "idle"
		);

		expect(store.getState().router.current?.fullPath).toBe("/recovery");
		expect(store.getState().router.status).toBe("idle");
		expect(store.getState().router.error).toBe(null); // Error should be cleared
	});
});

/* ============================================================================
 * 6. NESTED ROUTE TESTS
 * ========================================================================= */

describe("Nested Route Complexity - Comprehensive", () => {
	test("should handle simple nested routes", async () => {
		const routes = [
			{ path: "/", component: TestComponent },
			{
				path: "/dashboard",
				component: TestComponent,
				children: [
					{
						path: "settings",
						component: TestComponent,
					},
					{
						path: "analytics",
						component: TestComponent,
					},
				],
			},
		] as const;
		const store = createComprehensiveTestStore(routes);

		await waitForState(store, (state: TestState) => state.router.status === "idle");

		// Navigate to nested route
		store.dispatch(navigateTo("/dashboard/settings"));
		await waitForState(store, (state: TestState) =>
			state.router.current?.fullPath === "/dashboard/settings"
		);

		expect(store.getState().router.current?.matches).toHaveLength(2); // dashboard + settings

		// Navigate to sibling route
		store.dispatch(navigateTo("/dashboard/analytics"));
		await waitForState(store, (state: TestState) =>
			state.router.current?.fullPath === "/dashboard/analytics"
		);

		expect(store.getState().router.current?.matches).toHaveLength(2); // dashboard + analytics
	});

	test("should handle nested routes with parameters", async () => {
		const routes = [
			{ path: "/", component: TestComponent },
			{
				path: "/users/:userId",
				component: TestComponent,
				children: [
					{
						path: "profile",
						component: TestComponent,
					},
					{
						path: "posts/:postId",
						component: TestComponent,
					},
				],
			},
		] as const;
		const store = createComprehensiveTestStore(routes);

		await waitForState(store, (state: TestState) => state.router.status === "idle");

		store.dispatch(navigateTo("/users/:userId/posts/:postId", {
			userId: "123",
			postId: "456",
		}));

		await waitForState(store, (state: TestState) => state.router.status === "idle");

		const state = store.getState();
		expect(state.router.current?.fullPath).toBe("/users/123/posts/456");
		expect(state.router.current?.params).toEqual({
			userId: "123",
			postId: "456",
		});
		expect(state.router.current?.matches).toHaveLength(2); // Parent and child
	});
});

/* ============================================================================
 * 7. SERIALIZATION AND STATE MANAGEMENT TESTS
 * ========================================================================= */

describe("Serialization and State Management - Comprehensive", () => {
	test("should maintain serializable Redux state at all times", async () => {
		const routes = [
			{ path: "/", component: TestComponent },
			{ path: "/test/:id", component: TestComponent },
		] as const;
		const store = createComprehensiveTestStore(routes);

		await waitForState(store, (state: TestState) => state.router.status === "idle");

		// Test initial state serializability
		let state = store.getState();
		expect(() => JSON.stringify(state.router)).not.toThrow();
		expect(JSON.parse(JSON.stringify(state.router))).toEqual(state.router);

		// Test state during navigation
		store.dispatch(navigateTo("/test/:id", { id: "123" }, { tab: "details", active: true }));
		await waitForState(store, (state: TestState) => state.router.current?.fullPath === "/test/123");

		state = store.getState();
		expect(() => JSON.stringify(state.router)).not.toThrow();
		expect(JSON.parse(JSON.stringify(state.router))).toEqual(state.router);

		// Verify no functions or non-serializable values in state
		const checkSerializable = (obj: any): boolean => {
			if (obj === null || obj === undefined) return true;
			if (typeof obj === "function") return false;
			if (typeof obj === "symbol") return false;
			if (obj instanceof Date) return true; // Dates are serializable
			if (typeof obj === "object") {
				return Object.values(obj).every(checkSerializable);
			}
			return true;
		};

		expect(checkSerializable(state.router)).toBe(true);
	});

	test("should maintain state immutability", async () => {
		const routes = [
			{ path: "/", component: TestComponent },
			{ path: "/immutable", component: TestComponent },
		] as const;
		const store = createComprehensiveTestStore(routes);

		await waitForState(store, (state: TestState) => state.router.status === "idle");

		const initialState = store.getState().router;
		const initialStateCopy = JSON.parse(JSON.stringify(initialState));

		// Navigate to new route
		store.dispatch(navigateTo("/immutable", {}, { test: "immutability" }));
		await waitForState(store, (state: TestState) => state.router.current?.fullPath === "/immutable");

		const newState = store.getState().router;

		// Initial state should remain unchanged (immutability check)
		expect(initialState).toEqual(initialStateCopy);

		// States should be different objects (no mutation)
		expect(initialState).not.toBe(newState);
		expect(initialState.current).not.toBe(newState.current);

		// But original state should still be intact
		expect(initialState.current?.fullPath).toBe("/");
		expect(newState.current?.fullPath).toBe("/immutable");
	});

	test("should handle complex state shapes with nested objects", async () => {
		const routes = [
			{ path: "/", component: TestComponent },
			{
				path: "/complex/:userId/posts/:postId",
				component: TestComponent,
			},
		] as const;
		const store = createComprehensiveTestStore(routes);

		await waitForState(store, (state: TestState) => state.router.status === "idle");

		// Navigate with complex parameters and query
		store.dispatch(navigateTo("/complex/:userId/posts/:postId", 
			{ userId: "user-123", postId: "post-456" },
			{ 
				filters: "recent",
				sort: "date",
				view: "detailed",
				page: 1,
				limit: 20,
			}
		));

		await waitForState(store, (state: TestState) => 
			state.router.current?.fullPath === "/complex/user-123/posts/post-456"
		);

		const routerState = store.getState().router;

		// Verify complex nested state structure
		expect(routerState.current?.params).toEqual({
			userId: "user-123",
			postId: "post-456",
		});

		expect(routerState.current?.query).toEqual({
			filters: "recent",
			sort: "date", 
			view: "detailed",
			page: "1",
			limit: "20",
		});

		expect(routerState.current?.matches).toHaveLength(1);
		expect(routerState.current?.matches[0].path).toBe("/complex/:userId/posts/:postId");

		// Verify entire state is serializable
		const serialized = JSON.stringify(routerState);
		const deserialized = JSON.parse(serialized);
		expect(deserialized).toEqual(routerState);
	});
});