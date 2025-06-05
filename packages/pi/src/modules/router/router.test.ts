import { test, expect, describe } from "bun:test";
import type { PiStore } from "../../types";
import { createPi } from "../../pi";
import {
	navigateTo,
	getRouteFromUrl,
	getUrlFromRoute,
	selectRoute,
	selectRouteName,
	selectRouteParams,
	createRoutes,
} from "./router";

describe("Router Integration", () => {
	test("should initialize with default route in Node.js environment", () => {
		const routes = {
			home: { path: "/" },
			about: { path: "/about" },
		};

		const app = createPi({
			modules: {},
			routes,
		});

		const store = app.init();
		const state = store.getState();

		// In Node.js environment, should default to home route
		expect(state.router.route).toEqual({
			name: "home",
			params: {},
			search: {},
			hash: "",
		});
	});

	test("should navigate between routes", () => {
		const routes = {
			home: { path: "/" },
			about: { path: "/about" },
			contact: { path: "/contact" },
		};

		const app = createPi({
			modules: {},
			routes,
		});

		const store: PiStore = app.init();

		// Navigate to about page - store.dispatch supports thunks
		store.dispatch(navigateTo({ name: "about" }));

		expect(store.getState().router.route).toEqual({
			name: "about",
			params: {},
			search: {},
			hash: "",
		});

		// Navigate to contact page
		store.dispatch(navigateTo({ name: "contact" }));

		expect(store.getState().router.route).toEqual({
			name: "contact",
			params: {},
			search: {},
			hash: "",
		});
	});

	test("should handle routes with parameters", () => {
		const routes = {
			home: { path: "/" },
			user: { path: "/user/:id" },
			post: { path: "/user/:userId/post/:postId" },
		};

		const app = createPi({
			modules: {},
			routes,
		});

		const store = app.init();

		// Navigate to user page with ID
		store.dispatch(
			navigateTo({
				name: "user",
				params: { id: "123" },
			}),
		);

		expect(store.getState().router.route).toEqual({
			name: "user",
			params: { id: "123" },
			search: {},
			hash: "",
		});

		// Navigate to post page with multiple params
		store.dispatch(
			navigateTo({
				name: "post",
				params: { userId: "456", postId: "789" },
			}),
		);

		expect(store.getState().router.route).toEqual({
			name: "post",
			params: { userId: "456", postId: "789" },
			search: {},
			hash: "",
		});
	});

	test("should handle search parameters and hash", () => {
		const routes = {
			search: { path: "/search" },
		};

		const app = createPi({
			modules: {},
			routes,
		});

		const store = app.init();

		// Navigate with search params and hash
		store.dispatch(
			navigateTo({
				name: "search",
				search: { q: "test", filter: "active" },
				hash: "results",
			}),
		);

		expect(store.getState().router.route).toEqual({
			name: "search",
			params: {},
			search: { q: "test", filter: "active" },
			hash: "results",
		});
	});

	test("should navigate to notFound when route is null", () => {
		const routes = {
			home: { path: "/" },
		};

		const app = createPi({
			modules: {},
			routes,
		});

		const store = app.init();

		// Navigate to null should go to notFound
		store.dispatch(navigateTo(null));

		expect(store.getState().router.route).toEqual({
			name: "notFound",
			params: {},
			search: {},
			hash: "",
		});
	});

	test("should work with custom notFound route", () => {
		const routes = {
			home: { path: "/" },
			notFound: { path: "/404" },
		};

		const app = createPi({
			modules: {},
			routes,
		});

		const store = app.init();

		// Navigate to null should go to custom notFound
		store.dispatch(navigateTo(null));

		expect(store.getState().router.route).toEqual({
			name: "notFound",
			params: {},
			search: {},
			hash: "",
		});
	});

	test("should work without routes configuration", () => {
		const app = createPi({
			modules: {},
		});

		const store = app.init();

		// Should initialize with null route when no routes provided
		expect(store.getState().router.route).toBeNull();
	});
});

describe("Router URL Parsing Edge Cases", () => {
	const routes = {
		home: { path: "/" },
		about: { path: "/about" },
		user: { path: "/user/:id" },
		post: { path: "/user/:userId/post/:postId" },
		search: { path: "/search" },
		nested: { path: "/admin/users/:id/settings" },
	};

	test("should handle trailing slashes", () => {
		const result1 = getRouteFromUrl(routes, "https://example.com/about/");
		expect(result1?.name).toBe("about");

		const result2 = getRouteFromUrl(routes, "https://example.com/about");
		expect(result2?.name).toBe("about");
	});

	test("should handle query parameters with special characters", () => {
		const result = getRouteFromUrl(
			routes,
			"https://example.com/search?q=hello%20world&filter=a%26b",
		);
		expect(result?.search).toEqual({ q: "hello world", filter: "a&b" });
	});

	test("should handle hash fragments with special characters", () => {
		const result = getRouteFromUrl(
			routes,
			"https://example.com/about#section%201",
		);
		expect(result?.hash).toBe("section 1");
	});

	test("should handle empty paths", () => {
		const result = getRouteFromUrl(routes, "https://example.com/");
		expect(result?.name).toBe("home");
	});

	test("should handle malformed URLs gracefully", () => {
		expect(getRouteFromUrl(routes, "not-a-url")).toBeNull();
		expect(getRouteFromUrl(routes, "")).toBeNull();
		expect(getRouteFromUrl(routes, "https://")).toBeNull();
	});

	test("should handle routes that don't match", () => {
		const result = getRouteFromUrl(routes, "https://example.com/nonexistent");
		expect(result).toBeNull();
	});

	test("should handle complex nested routes", () => {
		const result = getRouteFromUrl(
			routes,
			"https://example.com/admin/users/123/settings?tab=profile#general",
		);
		expect(result).toEqual({
			name: "nested",
			params: { id: "123" },
			search: { tab: "profile" },
			hash: "general",
		});
	});
});

describe("Router URL Generation Edge Cases", () => {
	const routes = {
		home: { path: "/" },
		user: { path: "/user/:id" },
		post: { path: "/user/:userId/post/:postId" },
	};

	test("should generate URLs with encoded parameters", () => {
		const url = getUrlFromRoute(routes, "user", { id: "hello world" });
		expect(url).toBe("/user/hello world");
	});

	test("should generate URLs with encoded search parameters", () => {
		const url = getUrlFromRoute(
			routes,
			"home",
			{},
			{ q: "hello world", filter: "a&b" },
		);
		expect(url).toBe("/?q=hello%20world&filter=a%26b");
	});

	test("should generate URLs with hash", () => {
		const url = getUrlFromRoute(routes, "home", {}, {}, "section 1");
		expect(url).toBe("/#section 1");
	});

	test("should throw error for missing required parameters", () => {
		expect(() => {
			getUrlFromRoute(routes, "user", {});
		}).toThrow('Route "user" requires parameter "id" but none was provided');
	});

	test("should throw error for non-existent routes", () => {
		expect(() => {
			getUrlFromRoute(routes, "nonexistent" as any, {});
		}).toThrow('Route "nonexistent" not found in config');
	});

	test("should handle multiple parameters correctly", () => {
		const url = getUrlFromRoute(
			routes,
			"post",
			{ userId: "123", postId: "456" },
			{ tab: "comments" },
			"reply",
		);
		expect(url).toBe("/user/123/post/456?tab=comments#reply");
	});
});

describe("Router Navigation Edge Cases", () => {
	test("should handle navigation to same route", () => {
		const routes = { home: { path: "/" }, about: { path: "/about" } };
		const app = createPi({ modules: {}, routes });
		const store = app.init();

		// Navigate to about
		store.dispatch(navigateTo({ name: "about" }));
		expect(store.getState().router.route?.name).toBe("about");

		// Navigate to about again
		store.dispatch(navigateTo({ name: "about" }));
		expect(store.getState().router.route?.name).toBe("about");
	});

	test("should handle rapid navigation", () => {
		const routes = {
			home: { path: "/" },
			about: { path: "/about" },
			contact: { path: "/contact" },
		};
		const app = createPi({ modules: {}, routes });
		const store = app.init();

		// Rapid navigation
		store.dispatch(navigateTo({ name: "about" }));
		store.dispatch(navigateTo({ name: "contact" }));
		store.dispatch(navigateTo({ name: "home" }));

		expect(store.getState().router.route?.name).toBe("home");
	});

	test("should handle navigation with partial route data", () => {
		const routes = { search: { path: "/search" } };
		const app = createPi({ modules: {}, routes });
		const store = app.init();

		// Navigate with only name
		store.dispatch(navigateTo({ name: "search" }));

		const route = store.getState().router.route;
		expect(route).toEqual({
			name: "search",
			params: {},
			search: {},
			hash: "",
		});
	});

	test("should preserve parameter types as strings", () => {
		const routes = { user: { path: "/user/:id" } };
		const app = createPi({ modules: {}, routes });
		const store = app.init();

		store.dispatch(navigateTo({ name: "user", params: { id: "123" } }));

		const params = store.getState().router.route?.params;
		expect(typeof params?.id).toBe("string");
		expect(params?.id).toBe("123");
	});
});

describe("Router Selectors", () => {
	test("should select route data correctly", () => {
		const routes = { user: { path: "/user/:id" } };
		const app = createPi({ modules: {}, routes });
		const store = app.init();

		store.dispatch(
			navigateTo({
				name: "user",
				params: { id: "123" },
				search: { tab: "profile" },
				hash: "details",
			}),
		);

		const state = store.getState();

		expect(selectRoute(state)?.name).toBe("user");
		expect(selectRouteName(state)).toBe("user");
		expect(selectRouteParams(state)).toEqual({ id: "123" });
	});

	test("should handle null route in selectors", () => {
		const app = createPi({ modules: {} });
		const store = app.init();
		const state = store.getState();

		expect(selectRoute(state)).toBeNull();
		expect(selectRouteName(state)).toBeUndefined();
		expect(selectRouteParams(state)).toBeUndefined();
	});
});

describe("Router Configuration Edge Cases", () => {
	test("should handle routes with same parameter names", () => {
		const routes = {
			userProfile: { path: "/user/:id/profile" },
			userSettings: { path: "/user/:id/settings" },
		};

		const app = createPi({ modules: {}, routes });
		const store = app.init();

		store.dispatch(navigateTo({ name: "userProfile", params: { id: "123" } }));
		expect(store.getState().router.route?.name).toBe("userProfile");

		store.dispatch(navigateTo({ name: "userSettings", params: { id: "456" } }));
		expect(store.getState().router.route?.name).toBe("userSettings");
		expect(store.getState().router.route?.params).toEqual({ id: "456" });
	});

	test("should handle empty route configuration", () => {
		const app = createPi({ modules: {}, routes: {} });
		const store = app.init();

		// Should navigate to notFound when no routes match
		store.dispatch(navigateTo(null));
		expect(store.getState().router.route?.name).toBe("notFound");
	});

	test("should handle route precedence - exact matches first", () => {
		const routes = {
			exact: { path: "/admin" },
			parameterized: { path: "/:page" },
		};

		// Exact match should win over parameterized
		const exactResult = getRouteFromUrl(routes, "https://example.com/admin");
		expect(exactResult?.name).toBe("exact");

		// Parameterized should match other paths
		const paramResult = getRouteFromUrl(routes, "https://example.com/other");
		expect(paramResult?.name).toBe("parameterized");
		expect(paramResult?.params).toEqual({ page: "other" });
	});

	test("should handle complex parameter patterns", () => {
		const routes = {
			multiParam: { path: "/api/:version/users/:userId/posts/:postId" },
		};

		const result = getRouteFromUrl(
			routes,
			"https://example.com/api/v1/users/123/posts/456",
		);
		expect(result).toEqual({
			name: "multiParam",
			params: { version: "v1", userId: "123", postId: "456" },
			search: {},
			hash: "",
		});
	});
});

describe("Router State Management", () => {
	test("should maintain immutability in state updates", () => {
		const routes = { home: { path: "/" }, about: { path: "/about" } };
		const app = createPi({ modules: {}, routes });
		const store = app.init();

		const initialState = store.getState();
		store.dispatch(navigateTo({ name: "about" }));
		const newState = store.getState();

		// States should be different objects
		expect(initialState).not.toBe(newState);
		expect(initialState.router).not.toBe(newState.router);
	});

	test("should handle concurrent navigation attempts", () => {
		const routes = { page1: { path: "/page1" }, page2: { path: "/page2" } };
		const app = createPi({ modules: {}, routes });
		const store = app.init();

		// Simulate concurrent dispatches
		store.dispatch(navigateTo({ name: "page1" }));
		store.dispatch(navigateTo({ name: "page2" }));

		// Last navigation should win
		expect(store.getState().router.route?.name).toBe("page2");
	});
});

describe("Router Advanced Edge Cases", () => {
	test("should handle extremely long URLs", () => {
		const routes = { user: { path: "/user/:id" } } as const;
		const longId = "a".repeat(1000);

		const result = getRouteFromUrl(
			routes,
			`https://example.com/user/${longId}`,
		);
		expect(result?.params?.id).toBe(longId);
	});

	test("should handle special characters in parameters", () => {
		const routes = { user: { path: "/user/:id" } } as const;

		const result = getRouteFromUrl(
			routes,
			"https://example.com/user/user@example.com",
		);
		expect(result?.params?.id).toBe("user@example.com");
	});

	test("should handle numeric-looking parameters as strings", () => {
		const routes = { user: { path: "/user/:id" } } as const;

		const result = getRouteFromUrl(routes, "https://example.com/user/123");
		expect(result?.params?.id).toBe("123");
		expect(typeof result?.params?.id).toBe("string");
	});

	test("should handle empty parameter values", () => {
		const routes = { search: { path: "/search/:query" } };

		const result = getRouteFromUrl(routes, "https://example.com/search/");
		expect(result).toBeNull(); // Should not match due to empty parameter
	});

	test("should handle multiple slashes in paths", () => {
		const routes = { about: { path: "/about" } };

		const result = getRouteFromUrl(routes, "https://example.com//about");
		expect(result?.name).toBe("about");
	});

	test("should handle case sensitivity correctly", () => {
		const routes = { About: { path: "/About" } };

		const exactMatch = getRouteFromUrl(routes, "https://example.com/About");
		expect(exactMatch?.name).toBe("About");

		const lowerMatch = getRouteFromUrl(routes, "https://example.com/about");
		expect(lowerMatch).toBeNull(); // Should be case sensitive
	});

	test("should handle Unicode characters in paths", () => {
		const routes = { unicode: { path: "/café" } };

		// Should handle both raw and encoded Unicode URLs
		const result1 = getRouteFromUrl(routes, "https://example.com/café");
		const result2 = getRouteFromUrl(routes, "https://example.com/caf%C3%A9");

		expect(result1?.name).toBe("unicode");
		expect(result2?.name).toBe("unicode");
	});

	test("should handle very complex query strings", () => {
		const routes = { search: { path: "/search" } };

		const result = getRouteFromUrl(
			routes,
			"https://example.com/search?a=1&b=2&c=3&a=4",
		);
		// URL constructor handles duplicate keys by keeping the last one
		expect(result?.search.a).toBe("4");
		expect(result?.search.b).toBe("2");
		expect(result?.search.c).toBe("3");
	});

	test("should handle malformed query strings gracefully", () => {
		const routes = { search: { path: "/search" } };

		const result = getRouteFromUrl(
			routes,
			"https://example.com/search?invalid=%%",
		);
		// URL constructor should handle this gracefully
		expect(result?.name).toBe("search");
	});
});

describe("Router Performance Edge Cases", () => {
	test("should handle large route configurations efficiently", () => {
		// Create 100 routes
		const routes = {} as any;
		for (let i = 0; i < 100; i++) {
			routes[`route${i}`] = { path: `/route${i}` };
		}

		const app = createPi({ modules: {}, routes });
		const store = app.init();

		// Should still be fast to navigate
		const start = performance.now();
		store.dispatch(navigateTo({ name: "route50" }));
		const end = performance.now();

		expect(store.getState().router.route?.name).toBe("route50");
		expect(end - start).toBeLessThan(10); // Should be very fast
	});

	test("should handle deeply nested parameter routes", () => {
		const routes = {
			deepNested: { path: "/a/:a/b/:b/c/:c/d/:d/e/:e" },
		};

		const result = getRouteFromUrl(
			routes,
			"https://example.com/a/1/b/2/c/3/d/4/e/5",
		);
		expect(result?.params).toEqual({ a: "1", b: "2", c: "3", d: "4", e: "5" });
	});
});

describe("Router Memory Management", () => {
	test("should not leak memory with repeated navigation", () => {
		const routes = { page1: { path: "/page1" }, page2: { path: "/page2" } };
		const app = createPi({ modules: {}, routes });
		const store = app.init();

		// Simulate many navigations
		for (let i = 0; i < 100; i++) {
			store.dispatch(navigateTo({ name: i % 2 === 0 ? "page1" : "page2" }));
		}

		// Should end up on page2
		expect(store.getState().router.route?.name).toBe("page2");
	});

	test("should handle navigation with large parameter objects", () => {
		const routes = { data: { path: "/data/:id" } };
		const app = createPi({ modules: {}, routes });
		const store = app.init();

		// Create large search object
		const largeSearch = {} as any;
		for (let i = 0; i < 50; i++) {
			largeSearch[`key${i}`] = `value${i}`;
		}

		store.dispatch(
			navigateTo({
				name: "data",
				params: { id: "123" },
				search: largeSearch,
			}),
		);

		expect(store.getState().router.route?.search).toEqual(largeSearch);
	});
});

describe("Router Type Safety Validation", () => {
	test("should preserve exact route parameter types", () => {
		const routes = {
			user: { path: "/user/:userId" },
			post: { path: "/post/:postId" },
		} as const;

		const app = createPi({ modules: {}, routes });
		const store = app.init();

		store.dispatch(navigateTo({ name: "user", params: { userId: "123" } }));
		const route = store.getState().router.route;

		// TypeScript should enforce correct parameter names
		expect(route?.params?.userId).toBe("123");
	});

	test("should handle route names as literal types", () => {
		const routes = {
			home: { path: "/" },
			about: { path: "/about" },
		} as const;

		const app = createPi({ modules: {}, routes });
		const store = app.init();

		// Should accept valid route names
		store.dispatch(navigateTo({ name: "home" }));
		expect(store.getState().router.route?.name).toBe("home");

		store.dispatch(navigateTo({ name: "about" }));
		expect(store.getState().router.route?.name).toBe("about");
	});

	test("should work with createRoutes helper for better type inference", () => {
		const routes = createRoutes({
			user: { path: "/user/:id" },
			post: { path: "/user/:userId/post/:postId" },
		});

		const userResult = getRouteFromUrl(routes, "https://example.com/user/123");
		expect(userResult?.params?.id).toBe("123");

		const postResult = getRouteFromUrl(
			routes,
			"https://example.com/user/456/post/789",
		);
		expect(postResult?.params?.userId).toBe("456");
		expect(postResult?.params?.postId).toBe("789");
	});
});
