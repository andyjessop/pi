import { createSlice } from "@reduxjs/toolkit";
import { createModule } from "pi";
import type { RootState } from "../../store";

// Types
export interface AboutState {
  initialized: boolean;
}

// Initial state
const initialState: AboutState = {
  initialized: false,
};

// Slice
const aboutSlice = createSlice({
  name: "about",
  initialState,
  reducers: {
    initialize: (state) => {
      state.initialized = true;
    },
  },
});

// Actions (unused for static modules)
// const { initialize } = aboutSlice.actions;

// Reducer
export const reducer = aboutSlice.reducer;

// Selectors
export const selectors = {
  state: (state: RootState) => state.about,
  initialized: (state: RootState) => state.about.initialized,
};

// Middleware (minimal for static pages)
export const middleware = () => (next: any) => (action: any) => {
  return next(action);
};

// Module export for Pi framework
export const module = createModule(reducer, [middleware]);