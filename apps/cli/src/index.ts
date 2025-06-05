import { logger } from "../../../packages/logger/src/logger";
import { createPi, createModule } from "../../../packages/pi/src/pi";
import { createSlice } from "@reduxjs/toolkit";

// Example counter module
const counterSlice = createSlice({
  name: "counter",
  initialState: { value: 0 },
  reducers: {
    increment: (state) => {
      state.value += 1;
    },
    decrement: (state) => {
      state.value -= 1;
    },
  },
});

const counterModule = createModule(counterSlice.reducer);

// Example routes
const routes = {
  home: { path: "/" },
  about: { path: "/about" },
  user: { path: "/user/:id" },
};

// Create Pi app
const app = createPi({
  modules: {
    counter: counterModule,
  },
  routes,
});

// Initialize
const store = app.init();

logger.info("Pi framework initialized!");
logger.info("Initial state:", store.getState());

// Test counter
store.dispatch(counterSlice.actions.increment());
logger.info("After increment:", store.getState().counter);

// Test router (if in browser environment)
if (typeof window !== "undefined") {
  logger.info("Router state:", store.getState().router);
}
