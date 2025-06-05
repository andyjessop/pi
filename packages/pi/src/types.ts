import type { Reducer, Middleware, ThunkDispatch, UnknownAction, EnhancedStore } from "@reduxjs/toolkit";

//
// ====== Core Module Interface ======
//

export interface PiModule<TState = any> {
  reducer: Reducer<TState>;
  middleware?: Middleware[];
}

export interface PiModules {
  [key: string]: PiModule;
}

//
// ====== Configuration Types ======
//

export interface PiConfig<TModules extends PiModules = PiModules> {
  modules: TModules;
  routes?: any; // Will be typed based on router config
}

//
// ====== Store Types ======
//

export type InferStoreState<TModules extends PiModules> = {
  [K in keyof TModules]: TModules[K] extends PiModule<infer TState> ? TState : never;
};

// Enhanced store dispatch type that supports thunks
export type PiDispatch<TState = any> = ThunkDispatch<TState, unknown, UnknownAction>;

// Enhanced store type that includes thunk dispatch
export type PiStore<TState = any> = EnhancedStore<TState> & {
  dispatch: PiDispatch<TState>;
};