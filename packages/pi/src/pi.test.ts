import { expect, test, describe, mock } from "bun:test";
import { configureStore } from "@reduxjs/toolkit";
import {
	routerSlice,
	createHeadlessRouterMiddleware,
	navigateTo,
	waitForState,
	createNavigationMiddleware,
	createRoutes,
	type Route,
	type RouterState,
	type LifecycleCtx,
} from "./pi";

/* ============================================================================
 * Test utilities and setup
 * ========================================================================= */

interface TestState {
	router: RouterState;
}

function createTestStore<const TRoutes extends readonly Route[]>(
	routes: TRoutes,
	initialPath = "/",
) {
	const { navigateTo } = createRoutes(routes);

	const store = configureStore({
		reducer: {
			router: routerSlice.reducer,
		},
		middleware: (getDefault) =>
			getDefault().concat(
				createHeadlessRouterMiddleware(routes, {
					initialPath,
				}),
			),
	});

	return {
		...store,
		navigateTo,
	};
}

const TestComponent = () => "test";

/* ============================================================================
 * Test routes
 * ========================================================================= */

const basicRoutes = [
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
] as const;

/* ============================================================================
 * Basic Navigation Tests
 * ========================================================================= */

describe("Basic Navigation", () => {
	test("should initialize with initial route", async () => {
		const store = createTestStore(basicRoutes, "/about");

		await waitForState(
			store,
			(state: TestState) =>
				state.router.status === "idle" && !!state.router.current,
		);

		const state = store.getState();
		// This would cause a TypeScript error: "/absdfsfosdf" is not a valid path!
		// store.dispatch(store.navigateTo("/invalid-route")); // ❌ TypeScript error works!

		// Verify Redux state is serializable (no functions stored)
		expect(store.navigateTo).toBeDefined();
		expect(state.router.current?.fullPath).toBe("/about");
		expect(state.router.status).toBe("idle");
		expect(state.router.error).toBe(null);
		
		// Verify state is serializable by JSON roundtrip
		const serialized = JSON.stringify(state.router);
		const deserialized = JSON.parse(serialized);
		expect(deserialized).toEqual(state.router);
	});

	test("should navigate to simple route", async () => {
		const store = createTestStore(basicRoutes);

		// Wait for initial navigation
		await waitForState(
			store,
			(state: TestState) =>
				state.router.current?.fullPath === "/" &&
				state.router.status === "idle",
		);

		// Navigate to about page
		store.dispatch(store.navigateTo("/about"));

		await waitForState(
			store,
			(state: TestState) =>
				state.router.current?.fullPath === "/about" &&
				state.router.status === "idle",
		);

		const state = store.getState();
		expect(state.router.current?.fullPath).toBe("/about");
		expect(state.router.current?.params).toEqual({});
		expect(state.router.current?.query).toEqual({});
		expect(state.router.pending).toBe(null);
	});

	test("should navigate with parameters", async () => {
		const store = createTestStore(basicRoutes);

		await waitForState(
			store,
			(state: TestState) => state.router.status === "idle",
		);

		store.dispatch(store.navigateTo("/users/:id", { id: "123" }));

		await waitForState(
			store,
			(state: TestState) =>
				state.router.current?.fullPath === "/users/123" &&
				state.router.status === "idle",
		);

		const state = store.getState();
		expect(state.router.current?.fullPath).toBe("/users/123");
		expect(state.router.current?.params).toEqual({ id: "123" });
	});

	test("should navigate with multiple parameters", async () => {
		const store = createTestStore(basicRoutes);

		await waitForState(
			store,
			(state: TestState) => state.router.status === "idle",
		);

		store.dispatch(
			navigateTo("/posts/:postId/comments/:commentId", {
				postId: "42",
				commentId: "87",
			}),
		);

		await waitForState(
			store,
			(state: TestState) =>
				state.router.current?.fullPath === "/posts/42/comments/87" &&
				state.router.status === "idle",
		);

		const state = store.getState();
		expect(state.router.current?.fullPath).toBe("/posts/42/comments/87");
		expect(state.router.current?.params).toEqual({
			postId: "42",
			commentId: "87",
		});
	});

	test("should navigate with query parameters", async () => {
		const store = createTestStore(basicRoutes);

		await waitForState(
			store,
			(state: TestState) => state.router.status === "idle",
		);

		store.dispatch(
			navigateTo("/users/:id", { id: "123" }, { tab: "profile", edit: true }),
		);

		await waitForState(
			store,
			(state: TestState) => state.router.status === "idle",
		);

		const state = store.getState();
		expect(state.router.current?.query).toEqual({
			tab: "profile",
			edit: "true",
		});
	});
});

/* ============================================================================
 * Lifecycle Hook Tests
 * ========================================================================= */

describe("Lifecycle Hooks", () => {
	test("should call onEnter hook", async () => {
		const onEnterMock = mock(() => {});

		const routesWithHooks = [
			{
				path: "/",
				component: TestComponent,
			},
			{
				path: "/profile",
				component: TestComponent,
				middleware: [
					createNavigationMiddleware({
						onEnter: onEnterMock,
					}),
				],
			},
		] as const;

		const store = createTestStore(routesWithHooks);

		await waitForState(
			store,
			(state: TestState) => state.router.status === "idle",
		);

		store.dispatch(navigateTo("/profile"));

		await waitForState(
			store,
			(state: TestState) =>
				state.router.current?.fullPath === "/profile" &&
				state.router.status === "idle",
		);

		expect(onEnterMock).toHaveBeenCalledTimes(1);
		expect(onEnterMock).toHaveBeenCalledWith(
			expect.objectContaining({
				params: {},
				query: {},
				dispatch: expect.any(Function),
				getState: expect.any(Function),
				signal: expect.any(AbortSignal),
				route: expect.objectContaining({
					route: expect.objectContaining({ path: "/profile" }),
					params: {},
				}),
			}),
		);
	});

	test("should call onLeave hook", async () => {
		const onLeaveMock = mock(() => {});

		const routesWithHooks = [
			{
				path: "/",
				component: TestComponent,
				middleware: [
					createNavigationMiddleware({
						onLeave: onLeaveMock,
					}),
				],
			},
			{
				path: "/about",
				component: TestComponent,
			},
		] as const;

		const store = createTestStore(routesWithHooks);

		await waitForState(
			store,
			(state: TestState) => state.router.status === "idle",
		);

		// Navigate away from home (which has onLeave hook)
		store.dispatch(navigateTo("/about"));

		await waitForState(
			store,
			(state: TestState) =>
				state.router.current?.fullPath === "/about" &&
				state.router.status === "idle",
		);

		expect(onLeaveMock).toHaveBeenCalledTimes(1);
	});

	test("should call onError hook when middleware throws", async () => {
		const onErrorMock = mock(() => {});
		const onEnterError = mock(() => {
			throw new Error("Navigation failed");
		});

		const routesWithHooks = [
			{
				path: "/",
				component: TestComponent,
			},
			{
				path: "/error",
				component: TestComponent,
				middleware: [
					createNavigationMiddleware({
						onEnter: onEnterError,
						onError: onErrorMock,
					}),
				],
			},
		] as const;

		const store = createTestStore(routesWithHooks);

		await waitForState(
			store,
			(state: TestState) => state.router.status === "idle",
		);

		store.dispatch(navigateTo("/error"));

		await waitForState(
			store,
			(state: TestState) => state.router.status === "error",
		);

		const state = store.getState();
		expect(state.router.status).toBe("error");
		expect(state.router.error).toBe("Navigation failed");
		expect(onEnterError).toHaveBeenCalledTimes(1);
		expect(onErrorMock).toHaveBeenCalledTimes(1);
		expect(onErrorMock).toHaveBeenCalledWith(
			expect.objectContaining({
				error: expect.any(Error),
			}),
		);
	});

	test("should handle async lifecycle hooks", async () => {
		const asyncOnEnter = mock(async (_ctx: LifecycleCtx) => {
			// Simulate async operation
			await new Promise((resolve) => setTimeout(resolve, 50));
		});

		const routesWithHooks = [
			{
				path: "/",
				component: TestComponent,
			},
			{
				path: "/async",
				component: TestComponent,
				middleware: [
					createNavigationMiddleware({
						onEnter: asyncOnEnter,
					}),
				],
			},
		] as const;

		const store = createTestStore(routesWithHooks);

		await waitForState(
			store,
			(state: TestState) => state.router.status === "idle",
		);

		store.dispatch(navigateTo("/async"));

		// Should be loading
		await waitForState(
			store,
			(state: TestState) => state.router.status === "loading",
		);

		expect(store.getState().router.pending?.fullPath).toBe("/async");

		// Wait for completion
		await waitForState(
			store,
			(state: TestState) =>
				state.router.current?.fullPath === "/async" &&
				state.router.status === "idle",
		);

		expect(asyncOnEnter).toHaveBeenCalledTimes(1);
		expect(store.getState().router.pending).toBe(null);
	});
});

/* ============================================================================
 * Error Handling Tests
 * ========================================================================= */

describe("Error Handling", () => {
	test("should handle route not found", async () => {
		const store = createTestStore(basicRoutes);

		await waitForState(
			store,
			(state: TestState) => state.router.status === "idle",
		);

		store.dispatch(navigateTo("/nonexistent"));

		await waitForState(
			store,
			(state: TestState) => state.router.status === "error",
		);

		const state = store.getState();
		expect(state.router.status).toBe("error");
		expect(state.router.error).toContain('No route matches "/nonexistent"');
		expect(state.router.current?.fullPath).toBe("/"); // Should remain on previous route
	});

	test("should cancel previous navigation when new one starts", async () => {
		const slowOnEnter = mock(async (_ctx: LifecycleCtx) => {
			await new Promise((resolve) => setTimeout(resolve, 100));
		});

		const routesWithHooks = [
			{
				path: "/",
				component: TestComponent,
			},
			{
				path: "/slow",
				component: TestComponent,
				middleware: [
					createNavigationMiddleware({
						onEnter: slowOnEnter,
					}),
				],
			},
			{
				path: "/fast",
				component: TestComponent,
			},
		] as const;

		const store = createTestStore(routesWithHooks);

		await waitForState(
			store,
			(state: TestState) => state.router.status === "idle",
		);

		// Start slow navigation
		store.dispatch(navigateTo("/slow"));

		await waitForState(
			store,
			(state: TestState) => state.router.status === "loading",
		);

		// Immediately start fast navigation (should cancel the first)
		store.dispatch(navigateTo("/fast"));

		await waitForState(
			store,
			(state: TestState) =>
				state.router.current?.fullPath === "/fast" &&
				state.router.status === "idle",
		);

		// Should end up on the fast route
		expect(store.getState().router.current?.fullPath).toBe("/fast");
	});
});

/* ============================================================================
 * Nested Route Tests
 * ========================================================================= */

describe("Nested Routes", () => {
	test("should handle nested routes with parameters", async () => {
		const nestedRoutes = [
			{
				path: "/",
				component: TestComponent,
			},
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

		const store = createTestStore(nestedRoutes);

		await waitForState(
			store,
			(state: TestState) => state.router.status === "idle",
		);

		store.dispatch(
			navigateTo("/users/:userId/posts/:postId", {
				userId: "123",
				postId: "456",
			}),
		);

		await waitForState(
			store,
			(state: TestState) => state.router.status === "idle",
		);

		const state = store.getState();
		expect(state.router.current?.fullPath).toBe("/users/123/posts/456");
		expect(state.router.current?.params).toEqual({
			userId: "123",
			postId: "456",
		});
		expect(state.router.current?.matches).toHaveLength(2); // Parent and child
	});
});
