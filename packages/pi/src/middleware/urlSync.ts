import type { Middleware } from "@reduxjs/toolkit";
import { selectRouteSearch } from "../modules/router/router.js";

// Type for the sync function that modules provide
export type StateSyncFunction<TState> = (state: TState) => Record<string, any>;

// Type for the restore function that modules provide
export type StateRestoreFunction<TState> = (params: Record<string, any>) => Partial<TState>;

const serializeValue = (value: any): string => {
	if (value === null || value === undefined) return "";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
};

const deserializeValue = (value: string): any => {
	if (value === "") return null;
	if (value === "true") return true;
	if (value === "false") return false;
	if (!isNaN(Number(value))) return Number(value);

	// Try to parse as JSON
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
};

/**
 * Creates middleware that syncs module state to URL search parameters and restores state from URL
 * @param moduleKey - The key of the module (e.g., "products", "product")
 * @param syncFunction - Function that returns which state values to sync
 * @param restoreFunction - Optional function that takes URL params and returns state updates
 * @returns Redux middleware
 */
export function createUrlSyncMiddleware<TState>(
	moduleKey: string,
	syncFunction: StateSyncFunction<TState>,
	restoreFunction?: StateRestoreFunction<TState>,
): Middleware {
	return (store) => (next) => (action) => {
		const result = next(action);

		// Handle URL restore on navigation (if restore function is provided)
		if (
			restoreFunction &&
			action &&
			typeof action === "object" &&
			"type" in action &&
			action.type === "router/navigateSuccess"
		) {
			const state = store.getState();
			const searchParams = selectRouteSearch(state) || {};

			// Extract parameters for this module
			const moduleParams: Record<string, any> = {};

			for (const [paramKey, value] of Object.entries(searchParams)) {
				if (paramKey.startsWith(`${moduleKey}.`)) {
					const localKey = paramKey.substring(moduleKey.length + 1);
					moduleParams[localKey] = deserializeValue(value as string);
				}
			}

			// If we have parameters for this module, restore state
			if (Object.keys(moduleParams).length > 0) {
				const stateUpdates = restoreFunction(moduleParams);

				// Create a custom action to update module state
				if (Object.keys(stateUpdates).length > 0) {
					setTimeout(() => {
						store.dispatch({
							type: `${moduleKey}/restoreFromUrl`,
							payload: stateUpdates,
						});
					}, 0);
				}
			}
		}

		// Get current state after action has been processed
		const state = store.getState();
		const moduleState = state[moduleKey] as TState;

		if (!moduleState) {
			return result;
		}

		// Perform URL sync for state changes
		// Get current URL search parameters from browser (not router state)
		const currentSearch: Record<string, string> = {};
		if (typeof window !== "undefined") {
			const urlParams = new URLSearchParams(window.location.search);
			for (const [key, value] of urlParams.entries()) {
				currentSearch[key] = value;
			}
		}
		const newSearch = { ...currentSearch };

		// Get values to sync from module state
		const valuesToSync = syncFunction(moduleState);

		// Update search parameters with synced values
		let hasChanges = false;

		for (const [key, value] of Object.entries(valuesToSync)) {
			const paramKey = `${moduleKey}.${key}`;
			const serializedValue = serializeValue(value);

			if (serializedValue === "") {
				// Remove parameter if value is empty/null/undefined
				if (paramKey in newSearch) {
					delete newSearch[paramKey];
					hasChanges = true;
				}
			} else {
				// Update parameter if value has changed
				if (newSearch[paramKey] !== serializedValue) {
					newSearch[paramKey] = serializedValue;
					hasChanges = true;
				}
			}
		}

		// Remove any existing parameters for this module that are no longer synced
		for (const paramKey of Object.keys(currentSearch || {})) {
			if (paramKey.startsWith(`${moduleKey}.`)) {
				const localKey = paramKey.substring(moduleKey.length + 1);
				if (!(localKey in valuesToSync)) {
					delete newSearch[paramKey];
					hasChanges = true;
				}
			}
		}

		// Update URL if there are changes
		if (hasChanges) {
			// Update browser history directly without dispatching router actions
			if (typeof window !== "undefined") {
				// Use setTimeout to avoid updating during current dispatch cycle
				setTimeout(() => {
					const searchStr = Object.entries(newSearch)
						.map(
							([key, value]) =>
								`${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
						)
						.join("&");
					const searchPart = searchStr ? `?${searchStr}` : "";
					
					// Get current pathname and hash from window location
					const pathname = window.location.pathname;
					const currentHash = window.location.hash;
					const url = `${pathname}${searchPart}${currentHash}`;
					
					window.history.replaceState({}, "", url);
				}, 0);
			}
		}

		return result;
	};
}


