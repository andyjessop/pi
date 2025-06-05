import { test, expect, describe } from "bun:test";
import { createSlice } from "@reduxjs/toolkit";
import { createPi, createModule } from "./pi";

describe("Pi Framework", () => {
  test("should initialize with modules and create store", () => {
    // Create a test module
    const counterSlice = createSlice({
      name: "counter",
      initialState: { value: 0 },
      reducers: {
        increment: (state) => {
          state.value += 1;
        },
      },
    });

    const counterModule = createModule(counterSlice.reducer);

    // Create Pi instance
    const app = createPi({
      modules: {
        counter: counterModule,
      },
    });

    // Initialize
    const store = app.init();

    // Test initial state
    const state = store.getState();
    expect(state.counter.value).toBe(0);
  });

  test("should handle module actions", () => {
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

    const app = createPi({
      modules: {
        counter: createModule(counterSlice.reducer),
      },
    });

    const store = app.init();

    // Test actions
    store.dispatch(counterSlice.actions.increment());
    expect(store.getState().counter.value).toBe(1);

    store.dispatch(counterSlice.actions.increment());
    expect(store.getState().counter.value).toBe(2);

    store.dispatch(counterSlice.actions.decrement());
    expect(store.getState().counter.value).toBe(1);
  });


  test("should support multiple modules", () => {
    const counterSlice = createSlice({
      name: "counter",
      initialState: { value: 0 },
      reducers: {
        increment: (state) => { state.value += 1; },
      },
    });

    const todoSlice = createSlice({
      name: "todos",
      initialState: { items: [] as string[] },
      reducers: {
        addTodo: (state, action) => {
          state.items.push(action.payload);
        },
      },
    });

    const app = createPi({
      modules: {
        counter: createModule(counterSlice.reducer),
        todos: createModule(todoSlice.reducer),
      },
    });

    const store = app.init();

    // Test initial state
    expect(store.getState().counter.value).toBe(0);
    expect(store.getState().todos.items).toEqual([]);

    // Test actions
    store.dispatch(counterSlice.actions.increment());
    store.dispatch(todoSlice.actions.addTodo("Test todo"));

    expect(store.getState().counter.value).toBe(1);
    expect(store.getState().todos.items).toEqual(["Test todo"]);
  });

  test("should provide convenience methods", () => {
    const counterSlice = createSlice({
      name: "counter",
      initialState: { value: 0 },
      reducers: {
        increment: (state) => { state.value += 1; },
      },
    });

    const app = createPi({
      modules: {
        counter: createModule(counterSlice.reducer),
      },
    });

    app.init();

    // Test getState
    expect(app.getState().counter.value).toBe(0);

    // Test dispatch
    app.dispatch(counterSlice.actions.increment());
    expect(app.getState().counter.value).toBe(1);

    // Test subscribe
    let stateChanged = false;
    const unsubscribe = app.subscribe(() => {
      stateChanged = true;
    });

    app.dispatch(counterSlice.actions.increment());
    expect(stateChanged).toBe(true);

    unsubscribe();
  });

  test("should throw error when accessing store before init", () => {
    const app = createPi({
      modules: {},
    });

    expect(() => app.getStore()).toThrow("Pi not initialized");
    expect(() => app.getState()).toThrow("Pi not initialized");
    expect(() => app.dispatch({ type: "test" })).toThrow("Pi not initialized");
  });

  test("should support modules with middleware", () => {
    const testMiddleware = () => (next: any) => (action: any) => {
      // Simple middleware that adds a property to test actions
      if (action.type === "test/action") {
        action.middlewareProcessed = true;
      }
      return next(action);
    };

    const testSlice = createSlice({
      name: "test",
      initialState: { value: 0 },
      reducers: {
        action: (state) => {
          state.value += 1;
        },
      },
    });

    const app = createPi({
      modules: {
        test: createModule(testSlice.reducer, [testMiddleware]),
      },
    });

    const store = app.init();

    // Middleware should be applied
    const action = testSlice.actions.action();
    store.dispatch(action);

    expect(store.getState().test.value).toBe(1);
  });
});