// @ts-nocheck
// This file contains intentionally invalid TypeScript to demonstrate type safety.
// It should NOT compile when type checking is enabled.
// Use this file to verify that our type system correctly catches errors.

import {
	createRouteRegistry,
	navigateTo,
} from "./pi";

const TestComponent = () => "test";

const routes = [
	{
		path: "/",
		component: TestComponent,
	},
	{
		path: "/users/:id",
		component: TestComponent,
	},
	{
		path: "/posts/:postId/comments/:commentId",
		component: TestComponent,
	},
] as const;

const validPaths = [
	"/",
	"/users/:id",
	"/posts/:postId/comments/:commentId",
] as const;

const registry = createRouteRegistry(routes, validPaths);

// ❌ These should cause TypeScript errors when @ts-nocheck is removed:

// Invalid route path
const invalid1 = navigateTo(registry, "/nonexistent");

// Missing required parameter
const invalid2 = navigateTo(registry, "/users/:id", {});

// Wrong parameter name  
const invalid3 = navigateTo(registry, "/users/:id", { userId: "123" });

// Extra invalid parameter
const invalid4 = navigateTo(registry, "/", { invalidParam: "test" });

// Typo in route path
const invalid5 = navigateTo(registry, "/user/:id", { id: "123" }); // should be /users/:id

// Missing required parameters in multi-param route
const invalid6 = navigateTo(registry, "/posts/:postId/comments/:commentId", { postId: "1" });

export {
	invalid1,
	invalid2,  
	invalid3,
	invalid4,
	invalid5,
	invalid6,
};