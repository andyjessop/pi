import { configureStore, type EnhancedStore } from "@reduxjs/toolkit";
import { routerModule, initRouter } from "./modules/router/router.js";
import type {
	PiConfig,
	PiModules,
	InferStoreState,
	PiModule,
	PiStore,
} from "./types.js";

//
// ====== Pi Framework Core ======
//

export class Pi<TModules extends PiModules = PiModules> {
	private store: EnhancedStore | null = null;
	private config: PiConfig<TModules> | null = null;

	constructor(config: PiConfig<TModules>) {
		this.config = config;
	}

	/**
	 * Initialize the Pi framework with modules and routes
	 */
	init(): PiStore<InferStoreState<TModules & { router: PiModule }>> {
		if (!this.config) {
			throw new Error("Pi not configured. Pass config to constructor.");
		}

		// Always include router module
		const allModules = {
			...this.config.modules,
			router: routerModule,
		};

		// Extract reducers and middleware from modules
		const reducers: Record<string, any> = {};
		const middleware: any[] = [];

		for (const [key, module] of Object.entries(allModules)) {
			reducers[key] = module.reducer;
			if (module.middleware) {
				middleware.push(...module.middleware);
			}
		}

		// Create Redux store
		this.store = configureStore({
			reducer: reducers,
			middleware: (getDefaultMiddleware) =>
				getDefaultMiddleware({
					serializableCheck: {
						ignoredActions: ["router/navigateSuccess"],
					},
					// Thunk middleware is included by default
				}).concat(middleware),
		});

		// Initialize router if routes are provided
		if (this.config.routes) {
			this.store.dispatch(initRouter(this.config.routes));
		}

		return this.store as PiStore<
			InferStoreState<TModules & { router: PiModule }>
		>;
	}

	/**
	 * Get the Redux store (must call init() first)
	 */
	getStore(): PiStore<InferStoreState<TModules & { router: PiModule }>> {
		if (!this.store) {
			throw new Error("Pi not initialized. Call init() first.");
		}
		return this.store as EnhancedStore<
			InferStoreState<TModules & { router: PiModule }>
		>;
	}

	/**
	 * Get the current state (must call init() first)
	 */
	getState(): InferStoreState<TModules & { router: PiModule }> {
		return this.getStore().getState();
	}

	/**
	 * Dispatch an action (supports thunks)
	 */
	dispatch(action: any) {
		return this.getStore().dispatch(action);
	}

	/**
	 * Subscribe to state changes
	 */
	subscribe(listener: () => void) {
		return this.getStore().subscribe(listener);
	}
}

//
// ====== Factory Function ======
//

export function createPi<TModules extends PiModules>(
	config: PiConfig<TModules>,
): Pi<TModules> {
	return new Pi(config);
}

//
// ====== Helper for creating modules ======
//

export function createModule<TState>(
	reducer: PiModule<TState>["reducer"],
	middleware: PiModule<TState>["middleware"] = [],
): PiModule<TState> {
	return {
		reducer,
		middleware,
	};
}

//
// ====== Re-exports ======
//

export * from "./types.js";
export * from "./modules/router/router.js";

