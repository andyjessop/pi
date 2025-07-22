---
title: Architecture Overview
description: Understanding Pi's Redux-first design and core architectural principles
---

Pi is a **Redux-first design model** for React that prescribes a minimal set of primitives plus strict conventions so that **all state—routing, domain data, and transient UI—lives in Redux**, while React components remain pure render functions.

## Core Architecture

### The Redux Runtime

In Pi, Redux isn't just a store—it's the **application runtime**. Every piece of application behavior flows through Redux:

- **Navigation state** - current route, parameters, query strings
- **Domain data** - entities, collections, relationships  
- **UI state** - modals, loading states, form data
- **Error states** - validation errors, API failures, route errors

This creates a completely **serializable application state** that can be inspected, replayed, and reasoned about by both humans and AI systems.

### Architectural Layers

```
┌─────────────────────────────────────────┐
│              React Components            │  ← Pure render functions
├─────────────────────────────────────────┤
│                Selectors                 │  ← State derivation
├─────────────────────────────────────────┤
│              Redux Store                 │  ← Single source of truth
├─────────────────────────────────────────┤
│           Navigation Middleware          │  ← Route lifecycle hooks
├─────────────────────────────────────────┤
│              Router Engine               │  ← Path matching & updates
└─────────────────────────────────────────┘
```

## Core Primitives

Pi provides a minimal set of primitives that handle all application concerns:

| Primitive | Purpose |
|-----------|---------|
| `navigateTo(path, params?)` | Dispatchable thunk for navigation |
| **Router middleware** | Matches paths, drives lifecycle hooks, updates router slice |
| `createNavigationMiddleware(handlers)` | Binds feature slices to route lifecycle hooks |
| **Selectors** | Extract route state and component data |
| `<Outlet />` | Renders matched route components |

## Navigation Middleware System

The key innovation in Pi is **navigation middleware**—functions that execute during route transitions and manage feature-specific state and side-effects.

```typescript
type NavigationMiddleware = {
  onEnter?: (ctx: LifecycleContext) => Promise<void> | void;
  onLeave?: (ctx: LifecycleContext) => Promise<void> | void;  
  onError?: (ctx: LifecycleContext & { error: unknown }) => void;
};
```

### Lifecycle Context

Each middleware function receives a context object with everything needed for that route:

```typescript
type LifecycleContext = {
  params: Record<string, string>;    // Route parameters
  query: URLSearchParams;            // Query parameters
  dispatch: Dispatch;                // Redux dispatcher
  getState: () => RootState;         // Current state getter
  signal: AbortSignal;               // Cancellation signal
  route: MatchedRoute;               // Route metadata
};
```

## State Organization

### Router State Shape

```typescript
type RouterState = {
  current: RouteMatch | null;    // Currently rendered route
  pending: RouteMatch | null;    // Route being resolved
  status: "idle" | "loading" | "error";
  error: string | null;
};
```

### Feature State Pattern

Each feature follows a consistent CRUD pattern:

```typescript
interface FeatureState {
  data: Entity[] | Entity | null;
  loading: boolean;
  error: string | null;
}

// With corresponding actions:
// - fetchRequest() 
// - fetchSuccess(data)
// - fetchFailure(error)
```

## Data Flow

### Navigation Sequence

1. **User Action**: Component dispatches `navigateTo('/path')`
2. **Route Matching**: Router middleware finds matching route
3. **State Transition**: `router.status` → `"loading"`, `pending` set
4. **Middleware Chain**: `onLeave` (old route) then `onEnter` (new route)
5. **Side Effects**: Feature middleware dispatches data fetching actions
6. **Resolution**: On success, `current = pending`, `status = "idle"`
7. **Render**: Components re-render with new state

### Component Rendering

```typescript
// Components are pure functions of Redux state
const VideosPage: React.FC = () => {
  const { list, loading, error } = useSelector(selectVideos);
  
  if (loading) return <Spinner />;
  if (error) return <ErrorBanner message={error} />;
  if (!list) return null;
  
  return <VideoGrid items={list} />;
};
```

## Type Safety

Pi provides complete compile-time type safety for navigation:

```typescript
// Route definitions generate types automatically
const routes = createRoutes({
  "/users/:userId/posts/:postId": UserPostPage
});

// Type-safe navigation - invalid paths won't compile
navigateTo("/users/123/posts/456");  // ✅ Valid
navigateTo("/users/123/posts");      // ❌ Missing required parameter
navigateTo("/invalid/path");         // ❌ Route doesn't exist
```

## Benefits

This architecture provides several key benefits:

### For Developers
- **Predictable**: All state changes are explicit Redux actions
- **Debuggable**: Full Redux DevTools integration and time-travel
- **Testable**: Pure functions and deterministic state transitions
- **Scalable**: Clear separation of concerns and consistent patterns

### For AI Systems  
- **Observable**: All application behavior flows through Redux actions
- **Serializable**: Complete application state can be captured and replayed
- **Deterministic**: No hidden state or unpredictable side-effects
- **Introspectable**: Full audit trail of all state changes

## Trade-offs

Pi prioritizes **predictability and observability** over convenience:

- **More boilerplate**: Explicit actions for all state changes
- **Learning curve**: Understanding Redux and middleware patterns
- **Constraints**: Strict conventions must be followed consistently

However, these trade-offs enable **unprecedented visibility** into application behavior, making Pi ideal for:

- Complex applications requiring debugging and maintenance
- AI-assisted development workflows  
- Applications needing replay/undo functionality
- Teams requiring consistent, predictable patterns

## Next Steps

- [**Redux-First Design**](/concepts/redux-first/) - Deep dive into Redux patterns
- [**AI-Friendly Development**](/concepts/ai-friendly/) - How Pi enables AI assistance  
- [**Quick Start Guide**](/getting-started/quick-start/) - Build your first Pi app