/*─────────────────────────────────────────────────────────────────────────────┐
│  pi/router ­– type‑safe navigation, slice, and middleware                   │
└─────────────────────────────────────────────────────────────────────────────*/

/* ============================================================================
 *  1  –  Type utilities
 * ========================================================================= */

/** 
 * Manual route path mapping for compile-time type safety
 * Users specify both routes and valid paths explicitly
 */
export interface RouteRegistry<TRoutes extends readonly Route[], TPaths extends string = string> {
	routes: TRoutes;
	/** All valid route paths that can be navigated to */
	validPaths: readonly TPaths[];
}

/** Extract path literals from routes at type level */
type ExtractPaths<T extends readonly Route[], Prefix extends string = ""> = T extends readonly [
	infer Head extends Route,
	...infer Tail extends readonly Route[]
]
	? Head extends { path: infer P extends string; children?: infer C extends readonly Route[] }
		? `${Prefix}${P}` extends ""
			? "/" | ExtractPaths<Tail, Prefix> | (C extends readonly Route[] ? ExtractPaths<C, "/"> : never)
			: `${Prefix}${P}` | ExtractPaths<Tail, Prefix> | (C extends readonly Route[] ? ExtractPaths<C, `${Prefix}${P}/`> : never)
		: ExtractPaths<Tail, Prefix>
	: never;

/** Helper to create routes with compile-time extracted paths */
export function createRoutes<const TRoutes extends readonly Route[]>(
	routes: TRoutes
) {
	// Extract paths from routes at runtime for convenience
	const extractPaths = (routes: readonly Route[], prefix = ""): string[] => {
		const paths: string[] = [];
		for (const route of routes) {
			const fullPath = prefix + route.path;
			const normalizedPath = fullPath === "" ? "/" : fullPath;
			paths.push(normalizedPath);
			
			if (route.children) {
				const childPrefix = normalizedPath === "/" ? "" : normalizedPath;
				paths.push(...extractPaths(route.children, `${childPrefix}/`));
			}
		}
		return paths;
	};

	const validPaths = extractPaths(routes);
	
	// Create registry internally for bound navigateTo
	const paths = validPaths as unknown as readonly ExtractPaths<TRoutes>[];
	const registry = createRouteRegistry(routes, paths);
	
	// Create bound navigateTo function
	const boundNavigateTo = <P extends ExtractPaths<TRoutes>>(
		template: P,
		params?: ParamsOf<P>,
		query?: Record<string, string | number | boolean>,
	) => {
		return navigateTo(registry, template, params, query);
	};

	// Return routes with bound navigateTo and registry helpers for advanced use cases
	return {
		routes,
		validPaths,
		/** Pre-bound navigateTo function with compile-time type safety */
		navigateTo: boundNavigateTo,
		/** Create a strongly typed registry with explicit paths (advanced) */
		withPaths<TPaths extends string>(paths: readonly TPaths[]) {
			return createRouteRegistry(routes, paths);
		},
		/** Create a registry with runtime paths (advanced, less type safety) */
		toRegistry() {
			return { routes, validPaths: validPaths as readonly string[] };
		},
		/** Get the internal strict registry (advanced) */
		getRegistry() {
			return registry;
		}
	};
}

/** Create a strongly typed route registry with explicit path validation */
export function createRouteRegistry<TRoutes extends readonly Route[], TPaths extends string>(
	routes: TRoutes,
	validPaths: readonly TPaths[]
): RouteRegistry<TRoutes, TPaths> {
	return { routes, validPaths };
}

/** Generic component type to avoid React dependency */
type ComponentType<P = Record<string, never>> = {
	(props: P): unknown;
	displayName?: string;
	defaultProps?: Partial<P>;
};

import {
	createSlice,
	type Middleware,
	type PayloadAction,
	type Dispatch,
} from "@reduxjs/toolkit";
import { match as compileMatcher, type MatchFunction } from "path-to-regexp";

/** Navigation middleware interface */
export interface NavigationMiddleware {
	onEnter?: (ctx: LifecycleCtx) => void | Promise<void>;
	onLeave?: (ctx: LifecycleCtx) => void | Promise<void>;
	onError?: (ctx: LifecycleCtx & { error: unknown }) => void | Promise<void>;
}

/** Route‑specific lifecycle middleware (wrapper type for ease of use) */
export type RouteMiddleware = NavigationMiddleware;

/** Internal route match data (contains functions, not serializable) */
interface InternalMatchedRoute {
	/** Full route definition object (contains functions) */
	route: Route;
	/** Params captured for this specific segment */
	params: Record<string, string>;
}

/** Lifecycle context API */
export interface LifecycleCtx {
	params: Record<string, string>;
	query: Record<string, string>;
	dispatch: Dispatch;
	getState: () => unknown;
	signal: AbortSignal;
	route: InternalMatchedRoute;
}

/** Route definition interface */
export interface Route {
	/** Path fragment – may contain `:params`, may be `''` (index route)          */
	readonly path: string;
	/** React component shown when this segment is active                         */
	readonly component: ComponentType<unknown>;
	/** Descendants (nested routes)                                               */
	readonly children?: readonly Route[];
	/** Optional lifecycle middleware for this segment                            */
	readonly middleware?: readonly RouteMiddleware[];
}

/** ---------------------------------------------------------------------------
 *  Extract the  `:param`  names from a path template (e.g. "videos/:id")
 *  and build the corresponding params object type.
 * ------------------------------------------------------------------------ */
type ExtractParamNames<S extends string> =
	S extends `${string}:${infer P}/${infer R}`
		? P | ExtractParamNames<R>
		: S extends `${string}:${infer P}`
			? P
			: never;

export type ParamsOf<Path extends string> =
	ExtractParamNames<Path> extends never
		? Record<string, never>
		: { [K in ExtractParamNames<Path>]: string };

/* ============================================================================
 *  2  –  Public navigation API
 * ========================================================================= */

/** Action type constant (avoids “magic strings”) */
export const NAVIGATE = "@@pi/NAVIGATE" as const;

/** Payload – every key is serialisable for Redux DevTools */
export interface NavigatePayload<P extends string = string> {
	/** Raw template that appears in the route definition, e.g. `"videos/:id"` */
	template: P;
	/** Substituted, fully‑qualified path pushed into history */
	fullPath: string;
	/** Params object used for template interpolation and `onEnter` */
	params: ParamsOf<P>;
	/** Parsed query string as plain object for Redux serialization */
	query: Record<string, string>;
}

/** Discriminated action (no `any`) */
export interface NavigateAction<P extends string = string> {
	readonly type: typeof NAVIGATE;
	readonly payload: NavigatePayload<P>;
	/** Index signature to make compatible with Redux UnknownAction */
	[key: string]: unknown;
}

/** Helper – interpolate `:params` in a template */
function interpolatePath(
	template: string,
	params: Record<string, string>,
): string {
	return template
		.split("/")
		.map((seg) =>
			seg.startsWith(":")
				? params[seg.slice(1)] || seg
				: seg,
		)
		.join("/");
}

/**
 * `navigateTo()` – strongly typed navigation with route registry.
 * Only allows navigation to routes that exist in the registry.
 *
 * ```ts
 * const registry = createRouteRegistry([
 *   { path: '/videos/:id', component: VideoPage }
 * ] as const, ['/videos/:id'] as const);
 * 
 * dispatch(navigateTo(registry, '/videos/:id', { id: '42' }));
 * ```
 */
export function navigateTo<TRoutes extends readonly Route[], TPaths extends string>(
	registry: RouteRegistry<TRoutes, TPaths>,
	template: TPaths,
	params?: ParamsOf<TPaths>,
	query?: Record<string, string | number | boolean>,
): NavigateAction<TPaths>;

/**
 * `navigateTo()` – legacy untyped navigation (for backward compatibility).
 * Accepts any string path without compile-time validation.
 *
 * ```ts
 * dispatch(navigateTo('/videos/:id', { id: '42' }));
 * ```
 */
export function navigateTo<P extends string>(
	template: P,
	params?: ParamsOf<P>,
	query?: Record<string, string | number | boolean>,
): NavigateAction<P>;

// Implementation
export function navigateTo(
	registryOrTemplate: unknown,
	templateOrParams?: unknown,
	paramsOrQuery?: unknown,
	queryArg?: unknown,
): NavigateAction {
	// Check if first argument is a registry (has validPaths property)
	if (registryOrTemplate && typeof registryOrTemplate === 'object' && 'validPaths' in registryOrTemplate) {
		// Strongly typed overload: navigateTo(registry, template, params, query)
		const template = templateOrParams as string;
		const params = (paramsOrQuery || {}) as Record<string, string>;
		const query = (queryArg || {}) as Record<string, string | number | boolean>;
		
		const fullPath = interpolatePath(template, params);
		const queryObj = Object.fromEntries(
			Object.entries(query).map(([k, v]) => [k, String(v)]),
		);
		
		return {
			type: NAVIGATE,
			payload: { template, fullPath, params: params as any, query: queryObj },
		};
	}
	
	// Legacy overload: navigateTo(template, params, query)  
	const template = registryOrTemplate as string;
	const params = (templateOrParams || {}) as Record<string, string>;
	const query = (paramsOrQuery || {}) as Record<string, string | number | boolean>;
	
	const fullPath = interpolatePath(template, params);
	const queryObj = Object.fromEntries(
		Object.entries(query).map(([k, v]) => [k, String(v)]),
	);
	
	return {
		type: NAVIGATE,
		payload: { template, fullPath, params: params as any, query: queryObj },
	};
}

/* ============================================================================
 *  3  –  Router slice (state & reducers)
 * ========================================================================= */

/** Serializable route match data for Redux state */
export interface MatchedRoute {
	/** Path pattern from the route (serializable) */
	path: string;
	/** Params captured for this specific segment */
	params: Record<string, string>;
}

/** Internal route match data with full route objects (for middleware) */
interface InternalRouteMatch {
	fullPath: string;
	params: Record<string, string>;
	query: Record<string, string>;
	matches: InternalMatchedRoute[];
}

/** Serializable route match data for Redux state */
export interface RouteMatch {
	/** Fully qualified path visited by the user (no query‑string) */
	fullPath: string;
	/** Merged params from every segment (`/videos/:id/edit`) */
	params: Record<string, string>;
	/** Search parameters as plain object for Redux serialization */
	query: Record<string, string>;
	/** Matched segments from root → leaf (serializable) */
	matches: MatchedRoute[];
}

export interface RouterState {
	current: RouteMatch | null;
	pending: RouteMatch | null;
	status: "idle" | "loading" | "error";
	error: string | null;
}

const initialState: RouterState = {
	current: null,
	pending: null,
	status: "idle",
	error: null,
};

export const routerSlice = createSlice({
	name: "router",
	initialState,
	reducers: {
		/** Internal – middleware sets `pending` and flips status */
		navigationStart: (s, a: PayloadAction<RouteMatch>) => {
			s.pending = a.payload;
			s.status = "loading";
			s.error = null;
		},
		/** Internal – called once *all* `onEnter` hooks resolve */
		navigationSuccess: (s) => {
			s.current = s.pending;
			s.pending = null;
			s.status = "idle";
		},
		/** Internal – middleware caught an error */
		navigationFailure: (s, a: PayloadAction<string>) => {
			s.pending = null;
			s.status = "error";
			s.error = a.payload;
		},
	},
});

export const { navigationStart, navigationSuccess, navigationFailure } =
	routerSlice.actions;

/* ============================================================================
 *  4  –  Helper factory functions
 * ========================================================================= */

/**
 * Tiny factory – keeps authors from having to specify the `type` each time
 */
export function createNavigationMiddleware(
	handlers: NavigationMiddleware,
): RouteMiddleware {
	return handlers;
}

/* ============================================================================
 *  5  –  Matching engine
 * ========================================================================= */

/** Cache compiled matcher functions for efficiency */
interface CompiledRoute {
	route: Route;
	/** var‑safe path-to-regexp matcher */
	matcher: MatchFunction<Record<string, string>>;
	/** Pre‑built composite child matchers */
	children: CompiledRoute[];
}

/** Recursively compile the route tree once at start‑up */
function compileRoutes(routes: readonly Route[]): CompiledRoute[] {
	return routes.map((r) => ({
		route: r,
		matcher: compileMatcher<Record<string, string>>(r.path, {
			end: !r.children,
		}),
		children: r.children ? compileRoutes(r.children) : [],
	}));
}

/**
 * Attempt to match a path against the compiled tree.
 *
 * Returns an array `[root, …, leaf]` or `null` if no match exists.
 */
function matchPath(
	path: string,
	compiled: CompiledRoute[],
): InternalMatchedRoute[] | null {
	for (const c of compiled) {
		const res = c.matcher(path);
		if (!res) continue;

		const { path: matchedPart, params } = res;

		// No children or perfectly matched
		if (c.children.length === 0 || matchedPart.length === path.length) {
			return [{ route: c.route, params }];
		}

		// Recurse on the remaining fragment (without leading "/")
		const remainder = path.slice(matchedPart.length).replace(/^\/+/, "");
		const childMatches = matchPath(remainder, c.children);
		if (childMatches) {
			return [{ route: c.route, params }, ...childMatches];
		}
	}
	return null;
}

/* ============================================================================
 *  6  –  Core router middleware (shared logic)
 * ========================================================================= */


function createCoreRouterMiddleware(
	/** Root route definition array (`routes.ts`) */
	routes: readonly Route[],
	/** Optional callback when navigation succeeds */
	onNavigationSuccess?: (payload: NavigatePayload) => void,
): Middleware<Record<string, never>, unknown> {
	const compiled = compileRoutes(routes);

	/* Single abort controller to cancel stale navigation */
	let inflight: { controller: AbortController; match: InternalRouteMatch } | null =
		null;

	return (store) =>
		(next) =>
		async (action): Promise<unknown> => {
			if (
				!action ||
				typeof action !== "object" ||
				!("type" in action) ||
				action.type !== NAVIGATE
			) {
				return next(action);
			}

			const { dispatch, getState } = store;
			const payload: NavigatePayload = (action as NavigateAction).payload;

			/* 1. Resolve route match */
			const matchedSegments = matchPath(
				payload.fullPath, // Keep full path for matching
				compiled,
			);
			if (!matchedSegments) {
				dispatch(navigationFailure(`No route matches "${payload.fullPath}"`));
				return;
			}

			/* Build consolidated RouteMatch */
			const mergedParams = matchedSegments.reduce<Record<string, string>>(
				(acc, m) => Object.assign(acc, m.params),
				{},
			);
			
			// Internal route match (with functions for middleware)
			const internalRouteMatch: InternalRouteMatch = {
				fullPath: payload.fullPath,
				params: mergedParams,
				query: payload.query,
				matches: matchedSegments,
			};
			
			// Serializable route match (for Redux state, no functions)
			const serializableMatches: MatchedRoute[] = matchedSegments.map(match => ({
				path: match.route.path,
				params: match.params,
			}));
			
			const routeMatch: RouteMatch = {
				fullPath: payload.fullPath,
				params: mergedParams,
				query: payload.query,
				matches: serializableMatches,
			};

			/* 2. Abort any running navigation and run onLeave hooks */
			if (inflight) {
				const currentInflight = inflight;
				currentInflight.controller.abort();
				const { matches: prevSegments } = currentInflight.match;
				const leaveList = prevSegments.filter(
					(prev) => !matchedSegments.includes(prev),
				);
				await Promise.all(
					leaveList.map((seg) =>
						seg.route.middleware?.flatMap(
							(mw: RouteMiddleware) =>
								mw.onLeave?.({
									params: mergedParams,
									query: payload.query,
									dispatch,
									getState,
									signal: currentInflight.controller.signal,
									route: seg,
								}) ?? [],
						),
					),
				);
			}

			/* 3. Kick off new navigation */
			const controller = new AbortController();
			inflight = { controller, match: internalRouteMatch };
			dispatch(navigationStart(routeMatch));

			try {
				/* 3.a Run onEnter hooks depth‑first (root → leaf) */
				for (const seg of matchedSegments) {
					const mws = seg.route.middleware ?? [];
					for (const mw of mws) {
						if (controller.signal.aborted) throw new DOMException("aborted");
						await mw.onEnter?.({
							params: mergedParams,
							query: payload.query,
							dispatch,
							getState,
							signal: controller.signal,
							route: seg,
						});
					}
				}

				/* 4. Success – commit new location in slice */
				dispatch(navigationSuccess());
				onNavigationSuccess?.(payload);
				inflight = null;
			} catch (err: unknown) {
				/* 5. Error – run onError hooks for segments that declared it */
				for (const seg of matchedSegments) {
					if (seg.route.middleware) {
						for (const mw of seg.route.middleware) {
							mw.onError?.({
								params: mergedParams,
								query: payload.query,
								dispatch,
								getState,
								signal: controller.signal,
								route: seg,
								error: err,
							});
						}
					}
				}
				dispatch(
					navigationFailure(err instanceof Error ? err.message : String(err)),
				);
				inflight = null;
			}

			/* Finally pass the NAVIGATE action down the chain */
			return next(action);
		};
}

/* ============================================================================
 *  7  –  Root‑level types (lightweight stubs; replace in your app)
 * ========================================================================= */

/**
 * These two lines intentionally reference *your* application store so that the
 * router/middleware is entirely type‑safe and side‑effect free.
 *
 * Replace the imports with your actual  `configureStore()`  location.
 */
// eslint‑disable‑next‑line @typescript-eslint/consistent-type‑definitions
// export type RootState = ReturnType<typeof import("./store").rootReducer>;
// eslint‑disable‑next‑line @typescript-eslint/consistent-type‑definitions
// export type AppDispatch = ThunkDispatch<
// RootState,
// unknown,
// NavigateAction | PayloadAction<unknown>
// >;

/* ============================================================================
 *  7  –  Browser & Headless Router Middlewares
 * ========================================================================= */

/**
 * Browser router middleware - handles actual browser navigation
 * - Updates browser history with pushState/replaceState
 * - Listens for popstate events (back/forward buttons)
 * - Resolves initial route on page load
 */
export function createBrowserRouterMiddleware(
	/** Root route definition array (`routes.ts`) */
	routes: readonly Route[],
	/** Optional configuration */
	options: {
		/** Base path for the application (default: "") */
		basePath?: string;
		/** Whether to replace current history entry instead of pushing (default: false) */
		replace?: boolean;
	} = {},
): Middleware<Record<string, never>, unknown> {
	const { basePath = "", replace = false } = options;

	let isInitialized = false;

	const middleware = createCoreRouterMiddleware(routes, (payload) => {
		// Update browser URL when navigation succeeds
		const fullUrl = basePath + payload.fullPath;
		const queryString = new URLSearchParams(payload.query).toString();
		const urlWithQuery = queryString ? `${fullUrl}?${queryString}` : fullUrl;

		if (replace) {
			window.history.replaceState(null, "", urlWithQuery);
		} else {
			window.history.pushState(null, "", urlWithQuery);
		}
	});

	// Wrap the middleware to add popstate handling
	return (store) => {
		const next = middleware(store);

		// Initialize popstate listener once
		if (!isInitialized && typeof window !== "undefined") {
			isInitialized = true;

			const handlePopstate = () => {
				const currentPath =
					window.location.pathname.replace(basePath, "") || "/";
				const queryParams = Object.fromEntries(
					new URLSearchParams(window.location.search),
				);

				// Find matching route template (simplified - you might want more sophisticated logic)
				(store.dispatch as Dispatch)(
					navigateTo(currentPath, {} as never, queryParams),
				);
			};

			window.addEventListener("popstate", handlePopstate);

			// Resolve initial route
			handlePopstate();
		}

		return next;
	};
}

/**
 * Headless router middleware - for testing and Node.js environments
 * - No browser history integration
 * - Tracks navigation state in memory only
 * - Perfect for unit tests, SSR, and Node.js environments
 */
export function createHeadlessRouterMiddleware(
	/** Root route definition array (`routes.ts`) */
	routes: readonly Route[],
	/** Optional configuration */
	options: {
		/** Initial path to start with (default: "/") */
		initialPath?: string;
		/** Initial query parameters (default: {}) */
		initialQuery?: Record<string, string>;
		/** Callback fired on each navigation for testing assertions */
		onNavigate?: (payload: NavigatePayload) => void;
	} = {},
): Middleware<Record<string, never>, unknown> {
	const { initialPath = "/", initialQuery = {}, onNavigate } = options;

	const middleware = createCoreRouterMiddleware(routes, (payload) => {
		onNavigate?.(payload);
	});

	// Wrap the middleware to handle initial navigation
	return (store) => {
		const next = middleware(store);

		// Trigger initial navigation immediately
		// Use queueMicrotask to ensure it happens after store setup
		queueMicrotask(() => {
			(store.dispatch as Dispatch)(
				navigateTo(initialPath, {} as never, initialQuery),
			);
		});

		return next;
	};
}

/* ============================================================================
 *  8  –  Testing utilities
 * ========================================================================= */

/**
 * Wait for a specific state condition to be met
 * Useful for testing async navigation and lifecycle hooks
 */
export function waitForState<T>(
	store: { getState: () => T },
	predicate: (state: T) => boolean,
	timeoutMs = 5000,
): Promise<T> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error(`waitForState timeout after ${timeoutMs}ms`));
		}, timeoutMs);

		const checkState = () => {
			const state = store.getState();
			if (predicate(state)) {
				clearTimeout(timeout);
				resolve(state);
				return;
			}
			setTimeout(checkState, 10);
		};

		checkState();
	});
}

/**
 * Wait for a specific action to be dispatched
 * Returns a promise that resolves with the action payload
 */
export function waitForAction<A extends { type: string }>(
	store: {
		dispatch: (action: unknown) => unknown;
		subscribe: (listener: () => void) => () => void;
	},
	actionType: string,
	timeoutMs = 5000,
): Promise<A> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error(`waitForAction timeout after ${timeoutMs}ms for ${actionType}`));
		}, timeoutMs);

		let capturedAction: A | null = null;

		// Intercept dispatch to capture actions
		const originalDispatch = store.dispatch;
		store.dispatch = (action: unknown) => {
			const result = originalDispatch(action);
			if (
				action &&
				typeof action === "object" &&
				"type" in action &&
				action.type === actionType
			) {
				capturedAction = action as A;
				clearTimeout(timeout);
				// Restore original dispatch
				store.dispatch = originalDispatch;
				resolve(capturedAction);
			}
			return result;
		};
	});
}
