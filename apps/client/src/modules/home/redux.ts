import { createSlice } from "@reduxjs/toolkit";
import { createModule } from "pi";
import type { RootState } from "../../store";

// Types
export interface HomeState {
  initialized: boolean;
}

// Initial state
const initialState: HomeState = {
  initialized: false,
};

// Slice
const homeSlice = createSlice({
  name: "home",
  initialState,
  reducers: {
    initialize: (state) => {
      state.initialized = true;
    },
  },
});

// Actions (unused for static modules)
// const { initialize } = homeSlice.actions;

// Reducer
export const reducer = homeSlice.reducer;

// Selectors
export const selectors = {
  state: (state: RootState) => state.home,
  initialized: (state: RootState) => state.home.initialized,
};

// Middleware (minimal for static pages)
export const middleware = () => (next: any) => (action: any) => {
  return next(action);
};

// Module export for Pi framework
export const module = createModule("home", reducer, [middleware]);