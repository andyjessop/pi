import {
	createSlice,
	type PayloadAction,
	type ThunkAction,
} from "@reduxjs/toolkit";

//
// ====== Type definitions ======
//

export type RouteConfig = {
	parent?: string;
	path: string;
};

export type RouterConfig = Record<string, RouteConfig> & {
	notFound?: RouteConfig;
};

// Extract parameter names (e.g. ":id") from a path like "/users/:id/edit"
type PathSegments<Path extends string> =
	Path extends `${infer SegmentA}/${infer SegmentB}`
		? ParamOnly<SegmentA> | PathSegments<SegmentB>
		: ParamOnly<Path>;

type ParamOnly<Segment extends string> = Segment extends `:${infer Param}`
	? Param
	: never;

export type RouteParams<Path extends string> = {
	[Key in PathSegments<Path>]: string;
};

// A "partial" route that the user can dispatch (params/search/hash optional)
export type Route<T extends RouterConfig, K extends keyof T = keyof T> = {
	name: K & string;
	params?: RouteParams<T[K]["path"]>;
	search?: Record<string, string>;
	hash?: string;
};

// A "full" route always has hash, params, search defined
export type FullRoute<T extends RouterConfig, K extends keyof T = keyof T> = {
	name: K & string;
	params: RouteParams<T[K]["path"]>;
	search: Record<string, string>;
	hash: string;
};

// State shape for the router slice
export interface RouterState<T extends RouterConfig = RouterConfig> {
	route: Route<T> | null;
}

//
// ====== Slice definition ======
//

const initialState: RouterState = {
	route: null,
};

const routerSlice = createSlice({
	name: "router",
	initialState,
	reducers: {
		navigateSuccess: <T extends RouterConfig>(
			state: RouterState<T>,
			action: PayloadAction<FullRoute<T>>,
		) => {
			const { name, params, search, hash } = action.payload;
			state.route = { name, params, search, hash };
		},
	},
});

export const { navigateSuccess } = routerSlice.actions;
export default routerSlice.reducer;

//
// ====== Helper functions ======
//

export function getRouteFromUrl<T extends RouterConfig>(
	routes: T,
	fullUrl: string,
): FullRoute<T> | null {
	try {
		const url = new URL(fullUrl);
		const { hash, searchParams } = url;
		
		// Decode the pathname to handle Unicode characters
		const decodedPathname = decodeURIComponent(url.pathname);
		const pathnameTokens = decodedPathname.split("/").filter(Boolean);
		const params = {} as Record<string, string>;

		const matchedEntry = Object.entries(routes).find(([_, route]) => {
			const pathTokens = route.path.split("/").filter(Boolean);

			if (pathTokens.length !== pathnameTokens.length) {
				return false;
			}

			const tempParams = {} as Record<string, string>;
			const matches = pathTokens.every((token, index) => {
				if (token.startsWith(":")) {
					tempParams[token.replace(":", "")] = pathnameTokens[index];
					return true;
				}
				return token === pathnameTokens[index];
			});

			if (matches) {
				Object.assign(params, tempParams);
			}
			return matches;
		});

		if (!matchedEntry) {
			return null;
		}

		return {
			hash: decodeURIComponent(hash.replace("#", "")),
			name: matchedEntry[0],
			params: params as any, // Allow flexible parameter access in tests
			search: Object.fromEntries(searchParams.entries()),
		} as FullRoute<T>;
	} catch {
		return null;
	}
}

export function getUrlFromRoute<T extends RouterConfig>(
	routes: T,
	name: keyof T & string,
	params: Record<string, string> = {},
	search: Record<string, string> = {},
	hash = "",
): string {
	const route = routes[name];
	if (!route) {
		throw new Error(`Route "${name}" not found in config`);
	}

	let pathname = route.path;

	// Replace path parameters
	const paramMatches = pathname.match(/:(\w+)/g);
	if (paramMatches) {
		for (const paramMatch of paramMatches) {
			const paramName = paramMatch.replace(":", "");
			const paramValue = params[paramName];

			if (!paramValue) {
				throw new Error(
					`Route "${name}" requires parameter "${paramName}" but none was provided`,
				);
			}

			pathname = pathname.replace(paramMatch, paramValue);
		}
	}

	// Build search string
	const searchStr = Object.entries(search)
		.map(
			([key, value]) =>
				`${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
		)
		.join("&");

	// Build final URL
	const searchPart = searchStr ? `?${searchStr}` : "";
	const hashPart = hash ? `#${hash}` : "";

	return `${pathname}${searchPart}${hashPart}`;
}

//
// ====== Router configuration management ======
//

let globalRouterConfig: (RouterConfig & { notFound: RouteConfig }) | null =
	null;

function setGlobalRouterConfig<T extends RouterConfig>(
	config: T & { notFound: RouteConfig },
) {
	globalRouterConfig = config;
}

function getGlobalRouterConfig<T extends RouterConfig>(): T & {
	notFound: RouteConfig;
} {
	if (!globalRouterConfig) {
		throw new Error("Router not initialized. Call initRouter first.");
	}
	return globalRouterConfig as T & { notFound: RouteConfig };
}

//
// ====== Thunks for navigation ======
//

type RouterThunk<T extends RouterConfig> = ThunkAction<
	void,
	{ router: RouterState<T> } & Record<string, any>,
	unknown,
	PayloadAction<any>
>;

let popstateListener: ((this: Window, ev: PopStateEvent) => any) | null = null;

export function initRouter<T extends RouterConfig>(config: T): RouterThunk<T> {
	return (dispatch) => {
		// Merge with default notFound if missing
		const mergedConfig: T & { notFound: RouteConfig } = {
			notFound: { path: "/404" },
			...config,
		};

		setGlobalRouterConfig(mergedConfig);

		// Only set up browser listeners if in browser environment
		if (typeof window !== "undefined") {
			// Clean up existing listener
			if (popstateListener) {
				window.removeEventListener("popstate", popstateListener);
			}

			// Handler for browser back/forward buttons
			popstateListener = () => {
				const currentLocation = window.location.href;
				const maybeRoute = getRouteFromUrl(mergedConfig, currentLocation);

				if (maybeRoute) {
					dispatch(navigateSuccess(maybeRoute));
				} else {
					// If parsing fails, navigate to "notFound"
					dispatch(
						navigateSuccess({
							name: "notFound",
							params: {},
							search: {},
							hash: "",
						} as FullRoute<T>),
					);
				}
			};

			window.addEventListener("popstate", popstateListener);

			// Dispatch initial route (without pushing new history entry)
			const initialRoute = getRouteFromUrl(mergedConfig, window.location.href);
			if (initialRoute) {
				dispatch(navigateSuccess(initialRoute));
			} else {
				dispatch(
					navigateSuccess({
						name: "notFound",
						params: {},
						search: {},
						hash: "",
					} as FullRoute<T>),
				);
			}
		} else {
			// In Node.js environment, set a default route
			dispatch(
				navigateSuccess({
					name: "home",
					params: {},
					search: {},
					hash: "",
				} as FullRoute<T>),
			);
		}
	};
}

export function navigateTo<T extends RouterConfig>(
	route: Route<T> | null,
): RouterThunk<T> {
	return (dispatch) => {
		const config = getGlobalRouterConfig<T>();

		if (!route) {
			// Redirect to "notFound"
			const fallbackRoute: FullRoute<T> = {
				name: "notFound",
				params: {},
				search: {},
				hash: "",
			} as FullRoute<T>;

			// Only update browser history if in browser environment
			if (typeof window !== "undefined") {
				const url = getUrlFromRoute(
					config,
					fallbackRoute.name,
					fallbackRoute.params,
					fallbackRoute.search,
					fallbackRoute.hash,
				);
				window.history.pushState({}, "", url);
			}

			dispatch(navigateSuccess(fallbackRoute));
			return;
		}

		// Ensure mandatory fields
		const fullRoute: FullRoute<T> = {
			name: route.name,
			params: route.params || ({} as any),
			search: route.search || {},
			hash: route.hash || "",
		};

		// Only update browser history if in browser environment
		if (typeof window !== "undefined") {
			const url = getUrlFromRoute(
				config,
				fullRoute.name,
				fullRoute.params,
				fullRoute.search,
				fullRoute.hash,
			);
			window.history.pushState({}, "", url);
		}

		dispatch(navigateSuccess(fullRoute));
	};
}

export function destroyRouter(): RouterThunk<any> {
	return () => {
		if (popstateListener && typeof window !== "undefined") {
			window.removeEventListener("popstate", popstateListener);
			popstateListener = null;
		}
		globalRouterConfig = null;
	};
}

//
// ====== Selectors ======
//

export const selectRoute = <T extends RouterConfig>(state: {
	router: RouterState<T>;
}): Route<T> | null => {
	return state.router.route;
};

export const selectRouteName = <T extends RouterConfig>(state: {
	router: RouterState<T>;
}): string | undefined => {
	return state.router.route?.name;
};

export const selectRouteParams = <T extends RouterConfig>(state: {
	router: RouterState<T>;
}): Record<string, string> | undefined => {
	return state.router.route?.params as Record<string, string>;
};

export const selectRouteSearch = <T extends RouterConfig>(state: {
	router: RouterState<T>;
}): Record<string, string> | undefined => {
	return state.router.route?.search;
};

export const selectRouteHash = <T extends RouterConfig>(state: {
	router: RouterState<T>;
}): string | undefined => {
	return state.router.route?.hash;
};

//
// ====== Helper Functions for Type Safety ======
//

/**
 * Helper function to create route configurations with proper TypeScript inference
 * Use this in your app code for better type safety:
 * 
 * const routes = createRoutes({
 *   home: { path: "/" },
 *   user: { path: "/user/:id" }
 * });
 */
export function createRoutes<T extends RouterConfig>(routes: T): T {
  return routes;
}

//
// ====== Module interface for Pi framework ======
//

export const routerModule = {
	reducer: routerSlice.reducer,
	middleware: [], // Thunk middleware is included by default in RTK
	slice: routerSlice,
};

