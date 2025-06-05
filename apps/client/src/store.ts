import { createPi, createRoutes } from "pi";
import { module as homeModule } from "./modules/home";
import { module as aboutModule } from "./modules/about";
import { module as productsModule } from "./modules/products";
import { module as productModule } from "./modules/product";

// Define routes with clean paths
const routes = createRoutes({
  home: { path: "/" },
  about: { path: "/about" },
  products: { path: "/products" },
  product: { path: "/products/:id" },
});

// Create Pi app with modules and routes
export const app = createPi({
  modules: {
    home: homeModule,
    about: aboutModule,
    products: productsModule,
    product: productModule,
  },
  routes,
});

// Initialize the store
export const store = app.init();

// Export types for type safety following RTK docs
export type Routes = typeof routes;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;