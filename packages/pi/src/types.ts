import type { Reducer, Middleware, EnhancedStore, ThunkAction, UnknownAction } from "@reduxjs/toolkit";

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

// Enhanced store type for Pi framework
export type PiStore<TState = any> = EnhancedStore<TState>;

// Thunk action type for Pi framework
export type PiThunkAction<TReturnType = void, TState = any> = ThunkAction<
  TReturnType,
  TState,
  unknown,
  UnknownAction
>;