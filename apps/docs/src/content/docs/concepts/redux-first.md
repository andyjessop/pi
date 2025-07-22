---
title: Redux-First Design
description: Understanding Pi's Redux-first approach and why Redux becomes the application runtime
---

This page explains Pi's Redux-first design philosophy, exploring why Redux serves as the application runtime and how this architectural decision enables unprecedented observability, predictability, and AI-friendly development.

## What Does "Redux-First" Mean?

In Pi, "Redux-first" means that **Redux is not just state management—it's the application runtime**. Every piece of application behavior flows through Redux:

- **Navigation state** - Routes, parameters, loading states
- **Domain data** - Entities, collections, relationships  
- **UI state** - Modals, forms, loading indicators
- **Side effects** - API calls, data fetching, cleanup
- **Error handling** - Validation errors, network failures

This is fundamentally different from traditional React applications where state is scattered across components, hooks, and context providers.

## The Traditional React Problem

### Scattered State

In typical React applications, state lives everywhere:

```typescript
// Component-level state
const [users, setUsers] = useState([]);
const [loading, setLoading] = useState(false);

// Context state
const { theme, setTheme } = useTheme();

// Custom hook state
const { data, error, mutate } = useSWR('/api/users');

// URL state
const [searchParams, setSearchParams] = useSearchParams();

// Global state
const { user } = useAuth();
```

This creates several problems:

1. **No single source of truth** - Data can be out of sync between locations
2. **Difficult debugging** - State changes are scattered and hard to trace
3. **Complex testing** - Multiple state sources make testing unpredictable
4. **Poor observability** - No way to see complete application state
5. **Hard to reason about** - Side effects happen in many places

### Hidden Side Effects

Side effects in traditional React are often hidden:

```typescript
// Side effects scattered throughout components
useEffect(() => {
  // API call in component
  fetchUsers().then(setUsers);
}, []);

// Side effects in custom hooks
const useUsers = () => {
  useEffect(() => {
    // Another API call
    loadUserPreferences();
  }, []);
};

// Side effects in event handlers
const handleSubmit = async () => {
  // Direct API call
  await createUser(userData);
  // Manual state update
  setUsers(prev => [...prev, newUser]);
};
```

These scattered side effects make it impossible to understand what's happening in the application without reading every component.

## Pi's Redux-First Solution

### Single Application Runtime

Pi consolidates everything into Redux:

```typescript
// All state lives in Redux store
interface AppState {
  router: {
    current: RouteMatch | null;
    pending: RouteMatch | null;
    status: 'idle' | 'loading' | 'error';
  };
  users: {
    list: User[] | null;
    current: User | null;
    loading: boolean;
    error: string | null;
  };
  ui: {
    modals: Modal[];
    notifications: Notification[];
    theme: 'light' | 'dark';
  };
}

// All changes flow through actions
dispatch(navigateTo('/users/123'));
dispatch(createUserRequest());
dispatch(createUserSuccess(newUser));
dispatch(showNotification({ type: 'success', message: 'User created' }));
```

### Centralized Side Effects

All side effects happen in navigation middleware:

```typescript
// Side effects are explicit and centralized
const userDetailMiddleware = createNavigationMiddleware({
  async onEnter({ params, dispatch }) {
    // Explicit side effect
    dispatch(fetchUserRequest());
    
    try {
      const user = await api.getUser(params.id);
      dispatch(fetchUserSuccess(user));
    } catch (error) {
      dispatch(fetchUserFailure(error.message));
    }
  },
  
  onLeave({ dispatch }) {
    // Explicit cleanup
    dispatch(clearCurrentUser());
  },
});
```

This approach provides complete visibility into when and why side effects occur.

## Benefits of Redux-First Architecture

### 1. Complete Observability

Every state change is visible in Redux DevTools:

```typescript
// You can see the exact sequence of what happened:
{ type: 'router/navigationRequest', payload: { path: '/users/123' } }
{ type: 'users/fetchUserRequest' }
{ type: 'users/fetchUserSuccess', payload: { id: '123', name: 'John' } }
{ type: 'router/navigationSuccess' }
```

No hidden state changes, no mystery updates—everything is transparent.

### 2. Predictable State Updates

All state changes follow consistent patterns:

```typescript
// Every async operation follows the same pattern
dispatch(operationRequest());
try {
  const result = await apiCall();
  dispatch(operationSuccess(result));
} catch (error) {
  dispatch(operationFailure(error.message));
}
```

This consistency makes the application predictable and easier to reason about.

### 3. Time-Travel Debugging

Redux DevTools enable powerful debugging capabilities:

- **Replay actions** - Step through every state change
- **Skip actions** - See what happens without certain actions
- **Export/import state** - Share exact application states for debugging
- **Hot reloading** - Change code while preserving state

### 4. Deterministic Testing

Pure functions and explicit state make testing straightforward:

```typescript
// Test exact state transitions
const state = reducer(initialState, action);
expect(state.users.loading).toBe(true);

// Test complete workflows
dispatch(navigateTo('/users/123'));
await waitForAction('users/fetchUserSuccess');
expect(getState().users.current?.id).toBe('123');
```

### 5. AI-Friendly Development

The Redux-first approach creates perfect conditions for AI assistance:

- **Observable behavior** - AI can see every state change
- **Explicit actions** - AI understands what each action does
- **Predictable patterns** - AI can follow consistent conventions
- **Complete audit trail** - AI can reason about application flow

## Core Principles

### 1. Single Source of Truth

All application state lives in the Redux store:

```typescript
// ❌ Component state
const [user, setUser] = useState(null);

// ✅ Redux state
const user = useSelector(state => state.users.current);
```

### 2. State is Read-Only

State can only be changed by dispatching actions:

```typescript
// ❌ Direct mutation
user.name = 'New Name';

// ✅ Action dispatch
dispatch(updateUser({ id: user.id, name: 'New Name' }));
```

### 3. Changes by Pure Functions

State changes are predictable and testable:

```typescript
// Reducers are pure functions
const userReducer = (state, action) => {
  switch (action.type) {
    case 'users/updateSuccess':
      return { ...state, current: action.payload };
    default:
      return state;
  }
};
```

### 4. Side Effects in Middleware

All side effects happen in navigation middleware:

```typescript
// Side effects are contained and observable
const middleware = createNavigationMiddleware({
  async onEnter({ dispatch }) {
    // Side effect happens here, not in components
    const data = await api.fetchData();
    dispatch(dataLoaded(data));
  },
});
```

## Patterns and Conventions

### CRUD Action Triplets

Every async operation follows a consistent pattern:

```typescript
// Request action - starts loading
{ type: 'users/fetchRequest' }

// Success action - operation completed
{ type: 'users/fetchSuccess', payload: [...users] }

// Failure action - operation failed
{ type: 'users/fetchFailure', payload: 'Error message' }
```

### Normalized State Shape

Data is stored in a predictable format:

```typescript
interface FeatureState<T> {
  // Data
  list: T[] | null;
  current: T | null;
  
  // Loading states
  loading: boolean;
  creating: boolean;
  updating: string | null;
  deleting: string | null;
  
  // Error states
  error: string | null;
  createError: string | null;
  updateError: string | null;
  deleteError: string | null;
}
```

### Navigation-Driven Side Effects

Data loading is triggered by route changes:

```typescript
// Navigation triggers data loading automatically
dispatch(navigateTo('/users/123'));
// → userDetailMiddleware.onEnter() executes
// → dispatch(fetchUserRequest())
// → API call happens
// → dispatch(fetchUserSuccess(user))
```

## Comparison: Traditional vs Redux-First

### Traditional React Approach

```typescript
const UserProfile = ({ userId }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const loadUser = async () => {
      try {
        setLoading(true);
        const userData = await api.getUser(userId);
        setUser(userData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadUser();
  }, [userId]);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>User not found</div>;
  
  return <div>{user.name}</div>;
};
```

**Problems:**
- State scattered across multiple useState hooks
- Side effect hidden in useEffect
- No visibility into loading process
- Difficult to test
- Repeated patterns across components

### Pi's Redux-First Approach

```typescript
// 1. State lives in Redux
interface UsersState {
  current: User | null;
  loading: boolean;
  error: string | null;
}

// 2. Side effects in middleware
const userDetailMiddleware = createNavigationMiddleware({
  async onEnter({ params, dispatch }) {
    dispatch(fetchUserRequest());
    try {
      const user = await api.getUser(params.id);
      dispatch(fetchUserSuccess(user));
    } catch (error) {
      dispatch(fetchUserFailure(error.message));
    }
  },
});

// 3. Pure component
const UserProfile = () => {
  const { current: user, loading, error } = useSelector(state => state.users);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>User not found</div>;
  
  return <div>{user.name}</div>;
};
```

**Benefits:**
- Single source of truth in Redux
- Side effects explicit and observable
- Complete visibility in DevTools
- Easy to test
- Consistent patterns everywhere

## Mental Model Shift

### From Component-Centric to Data-Centric

Traditional React encourages thinking in terms of components:
- "This component needs this data"
- "This component should handle this state"
- "This component will make this API call"

Pi encourages thinking in terms of data flow:
- "This route needs this data"
- "This navigation should trigger this side effect"
- "This action should update this state"

### From Imperative to Declarative

Traditional React often leads to imperative code:

```typescript
// Imperative: "Do this, then do that"
const handleSubmit = async () => {
  setLoading(true);
  try {
    const result = await api.createUser(formData);
    setUser(result);
    showNotification('User created');
    navigate(`/users/${result.id}`);
  } catch (error) {
    setError(error.message);
  } finally {
    setLoading(false);
  }
};
```

Pi promotes declarative code:

```typescript
// Declarative: "This should happen"
const handleSubmit = () => {
  dispatch(createUser(formData));
  // Middleware handles the rest:
  // - Sets loading state
  // - Makes API call
  // - Shows notification
  // - Navigates on success
  // - Handles errors
};
```

## Advanced Redux-First Patterns

### Optimistic Updates

Update UI immediately, rollback on failure:

```typescript
const optimisticUpdateMiddleware = createNavigationMiddleware({
  async onEnter({ params, dispatch, getState }) => {
    const optimisticUser = { ...getState().users.current, ...updates };
    
    // Apply optimistic update
    dispatch(updateUserOptimistic(optimisticUser));
    
    try {
      const result = await api.updateUser(params.id, updates);
      dispatch(updateUserSuccess(result));
    } catch (error) {
      // Rollback optimistic update
      dispatch(updateUserFailure(error.message));
      dispatch(revertOptimisticUpdate());
    }
  },
});
```

### Cross-Feature Coordination

Coordinate state across multiple features:

```typescript
// When user is deleted, clean up related data
const userDeletedMiddleware = createListenerMiddleware();

userDeletedMiddleware.startListening({
  actionCreator: deleteUserSuccess,
  effect: ({ payload: userId }, { dispatch }) => {
    // Clean up user's posts
    dispatch(removePostsByUser(userId));
    
    // Remove from current selections
    dispatch(removeFromSelectedUsers(userId));
    
    // Clear notifications for this user
    dispatch(clearNotificationsForUser(userId));
  },
});
```

### Derived State

Compute derived state efficiently:

```typescript
const selectUserStatistics = createSelector(
  [selectUsers, selectPosts],
  (users, posts) => {
    return users.map(user => ({
      ...user,
      postCount: posts.filter(p => p.authorId === user.id).length,
      lastPostDate: posts
        .filter(p => p.authorId === user.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
        ?.createdAt,
    }));
  }
);
```

## When Redux-First Makes Sense

Redux-first architecture is particularly beneficial for:

### Complex Applications
- Multiple interconnected features
- Complex state relationships
- Need for debugging and observability

### Team Development
- Multiple developers need consistent patterns
- Code reviews benefit from predictable structure
- Onboarding is faster with consistent conventions

### AI-Assisted Development
- AI agents need complete visibility into application behavior
- Predictable patterns make AI assistance more effective
- Observable state changes enable AI to reason about application flow

### Long-Term Maintenance
- Applications that need to be maintained over years
- Complex debugging requirements
- Need for comprehensive testing

## Trade-offs and Considerations

### Benefits
✅ Complete observability
✅ Predictable state changes
✅ Excellent debugging tools
✅ Deterministic testing
✅ AI-friendly architecture
✅ Time-travel debugging
✅ Hot reloading with state preservation

### Costs
❌ More boilerplate for simple operations
❌ Learning curve for Redux concepts
❌ Requires discipline to maintain patterns
❌ Can be overkill for very simple applications

### When to Consider Alternatives

Redux-first might not be the best choice for:
- Very simple applications with minimal state
- Prototypes and experiments
- Applications with no debugging requirements
- Teams unfamiliar with Redux who can't invest in learning

## Conclusion

Pi's Redux-first architecture transforms Redux from a state management library into a complete application runtime. This approach provides unprecedented visibility into application behavior, making development more predictable, debugging more powerful, and enabling new possibilities for AI-assisted development.

The key insight is that by consolidating all application behavior into Redux, we create a system that's not just easier to debug and test, but fundamentally easier to understand and reason about—both for humans and AI systems.

## Next Steps

- [**Architecture Overview**](/concepts/architecture/) - Complete technical architecture
- [**AI-Friendly Development**](/concepts/ai-friendly/) - How Redux-first enables AI assistance
- [**Redux Integration Reference**](/reference/redux/) - Complete Redux patterns and APIs
- [**Quick Start Guide**](/getting-started/quick-start/) - See Redux-first in practice