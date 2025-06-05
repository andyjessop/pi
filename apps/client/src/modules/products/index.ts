// Module exports - clean, generic API
export { reducer, selectors, middleware, module } from "./redux";
export { Container } from "./react";
export type { ProductsState, Product } from "./redux";
export { findProductById, formatPrice } from "../products-shared";