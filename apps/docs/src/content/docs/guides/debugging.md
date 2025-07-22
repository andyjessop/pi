---
title: Debug with Redux DevTools
description: How-to guide for debugging Pi applications using Redux DevTools and other techniques
---

This guide shows you how to debug Pi applications effectively using Redux DevTools, logging strategies, and Pi-specific debugging techniques. Pi's Redux-first architecture provides unparalleled observability into your application's behavior.

## Why Pi is Debug-Friendly

Pi's architecture provides exceptional debugging capabilities because:

- **Complete observability** - All state changes flow through Redux
- **Action history** - Every user interaction and side effect is recorded
- **Time-travel debugging** - Step backwards and forwards through state changes
- **Deterministic behavior** - No hidden state or unpredictable side effects
- **Serializable state** - All state can be exported, imported, and replayed

## Redux DevTools Setup

### Install Redux DevTools

**Chrome Extension**: [Redux DevTools](https://chrome.google.com/webstore/detail/redux-devtools/lmhkpmbekcpmknklioeibfkpmmfibljd)

**Firefox Add-on**: [Redux DevTools](https://addons.mozilla.org/en-US/firefox/addon/reduxdevtools/)

### Configure in Your App

Redux DevTools work automatically with Redux Toolkit, but you can enhance the experience:

```typescript
// store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { createBrowserRouterMiddleware } from '@pi/router';

const routerMiddleware = createBrowserRouterMiddleware();

export const store = configureStore({
  reducer: {
    router: routerSlice.reducer,
    users: usersReducer,
    // ... other reducers
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Enable serializable checks for better debugging
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }).concat(routerMiddleware),
  
  // Enhanced DevTools configuration
  devTools: process.env.NODE_ENV !== 'production' && {
    name: 'Pi Application',
    trace: true, // Enable action stack traces
    traceLimit: 25,
  },
});
```

## Basic Debugging Workflow

### 1. Open Redux DevTools

1. Open your browser's developer tools (F12)
2. Click the "Redux" tab
3. You'll see three main panels:
   - **Actions**: History of all dispatched actions
   - **State**: Current application state
   - **Diff**: Changes between state versions

### 2. Monitor Actions

Every interaction in your Pi application generates Redux actions:

```typescript
// Navigation generates these actions:
{ type: 'router/navigationRequest', payload: { path: '/users/123' } }
{ type: 'users/fetchOneRequest' }
{ type: 'users/fetchOneSuccess', payload: { id: '123', name: 'John' } }
{ type: 'router/navigationSuccess', payload: { ... } }
```

### 3. Inspect State Changes

Click any action to see:
- **Action**: The dispatched action details
- **State**: Full state after this action
- **Diff**: What changed from previous state

### 4. Time Travel

Use the slider or action buttons to:
- Jump to any point in history
- Skip actions temporarily
- Replay actions from a specific point

## Debugging Navigation Issues

### Common Navigation Problems

#### Problem: Route Not Loading Data

**Symptoms**: Component renders but shows loading state indefinitely

**Debug Steps**:

1. **Check Actions**: Look for navigation actions in DevTools
   ```
   ✅ router/navigationRequest
   ❌ Missing: users/fetchOneRequest
   ```

2. **Verify Middleware**: Ensure middleware is attached to route
   ```typescript
   // routes.ts - Check middleware is configured
   {
     path: "/users/:id",
     component: UserDetailPage,
     middleware: [userDetailMiddleware], // ← Should be here
   }
   ```

3. **Check Middleware Implementation**: Look for errors in middleware
   ```typescript
   // Debug middleware with console.log
   export const userDetailMiddleware = createNavigationMiddleware({
     async onEnter({ params, dispatch }) {
       console.log('Middleware entered with params:', params);
       dispatch(fetchOneRequest());
       // ... rest of implementation
     },
   });
   ```

#### Problem: Navigation Completes But Wrong State

**Symptoms**: Navigation action succeeds but app shows wrong content

**Debug Steps**:

1. **Check Route Matching**: Verify path matches in DevTools
   ```
   Action: router/navigationSuccess
   Payload: {
     current: {
       path: "/users/:id",     // Expected path
       params: { id: "123" },  // Expected params
       url: "/users/123"       // Actual URL
     }
   }
   ```

2. **Verify Component Selectors**: Check if selectors return expected data
   ```typescript
   // Add debugging to selectors
   const selectCurrentUser = createSelector(
     (state: RootState) => state.users.current,
     (user) => {
       console.log('Current user selector:', user);
       return user;
     }
   );
   ```

### Navigation Debugging Utilities

Create debugging utilities for navigation:

```typescript
// utils/debugNavigation.ts
export const debugNavigation = (store: any) => {
  const originalDispatch = store.dispatch;
  
  store.dispatch = (action: any) => {
    if (action.type?.startsWith('router/')) {
      console.group(`🧭 Navigation: ${action.type}`);
      console.log('Action:', action);
      
      const result = originalDispatch(action);
      
      setTimeout(() => {
        const state = store.getState();
        console.log('Router State:', state.router);
        console.groupEnd();
      }, 0);
      
      return result;
    }
    
    return originalDispatch(action);
  };
};

// Use in development
if (process.env.NODE_ENV === 'development') {
  debugNavigation(store);
}
```

## Debugging Async Operations

### Tracking Async Flows

Pi's CRUD patterns make async debugging straightforward:

```typescript
// Every async operation follows this pattern:
// 1. Request action (loading starts)
{ type: 'users/fetchListRequest' }

// 2. Success or failure action (loading ends)
{ type: 'users/fetchListSuccess', payload: [...users] }
// OR
{ type: 'users/fetchListFailure', payload: 'Error message' }
```

### Common Async Issues

#### Problem: API Calls Never Complete

**Symptoms**: Loading state persists, no success/failure actions

**Debug Steps**:

1. **Check Network Tab**: Verify API calls are made
   - Are requests being sent?
   - What's the response status/body?

2. **Check Error Handling**: Look for uncaught exceptions
   ```typescript
   // Add comprehensive error logging
   export const userDetailMiddleware = createNavigationMiddleware({
     async onEnter({ params, dispatch }) {
       dispatch(fetchOneRequest());
       
       try {
         const user = await usersAPI.getById(params.id);
         console.log('API response:', user);
         dispatch(fetchOneSuccess(user));
       } catch (error) {
         console.error('API error:', error);
         dispatch(fetchOneFailure(error.message));
       }
     },
   });
   ```

3. **Check AbortSignal**: Ensure requests aren't being cancelled
   ```typescript
   // Debug cancellation
   async onEnter({ params, dispatch, signal }) {
     signal.addEventListener('abort', () => {
       console.log('Request aborted for params:', params);
     });
     
     // ... rest of implementation
   }
   ```

#### Problem: Race Conditions

**Symptoms**: Outdated data appears, actions out of order

**Debug Steps**:

1. **Track Action Timing**: Add timestamps to actions
   ```typescript
   // Enhanced action logging
   const timestampMiddleware: Middleware = () => next => action => {
     const timestampedAction = {
       ...action,
       meta: {
         ...action.meta,
         timestamp: Date.now(),
       },
     };
     
     console.log(`${action.type} @ ${new Date().toISOString()}`);
     return next(timestampedAction);
   };
   ```

2. **Use Action Sequence Debugging**:
   ```typescript
   // Track action sequences
   let actionSequence: string[] = [];
   
   const sequenceMiddleware: Middleware = () => next => action => {
     actionSequence.push(`${action.type}@${Date.now()}`);
     console.log('Action sequence:', actionSequence.slice(-5)); // Last 5 actions
     return next(action);
   };
   ```

## Debugging State Issues

### State Shape Problems

#### Problem: Component Not Re-rendering

**Symptoms**: State changes but component doesn't update

**Debug Steps**:

1. **Check Selector**: Verify selector returns new reference when data changes
   ```typescript
   // Bad: Always returns same object reference
   const selectUser = (state: RootState) => state.users.current || {};
   
   // Good: Returns null when no user, new object when user changes  
   const selectUser = (state: RootState) => state.users.current;
   ```

2. **Use useSelector Debugging**:
   ```typescript
   // Debug selector calls
   const user = useSelector((state: RootState) => {
     const result = state.users.current;
     console.log('Selector called, returning:', result);
     return result;
   });
   ```

3. **Check for Mutations**: Ensure reducers don't mutate state
   ```typescript
   // Redux Toolkit's Immer will catch mutations, but you can add logging
   const usersSlice = createSlice({
     name: 'users',
     initialState,
     reducers: {
       updateUser: (state, action) => {
         console.log('Before update:', JSON.stringify(state.current));
         state.current = { ...state.current, ...action.payload };
         console.log('After update:', JSON.stringify(state.current));
       },
     },
   });
   ```

### Performance Debugging

#### Problem: Too Many Re-renders

**Symptoms**: App feels slow, React DevTools show excessive renders

**Debug Steps**:

1. **Use React DevTools Profiler**: Identify which components re-render frequently

2. **Debug Selector Performance**:
   ```typescript
   import { createSelector } from '@reduxjs/toolkit';
   
   // Add debugging to expensive selectors
   const selectExpensiveComputation = createSelector(
     (state: RootState) => state.users.list,
     (users) => {
       console.time('Expensive computation');
       const result = users?.map(user => ({
         ...user,
         computed: heavyComputation(user),
       }));
       console.timeEnd('Expensive computation');
       return result;
     }
   );
   ```

3. **Track Selector Calls**:
   ```typescript
   // Count selector invocations
   let selectorCallCount = 0;
   
   const debugSelector = <T>(selector: (state: RootState) => T, name: string) => 
     (state: RootState) => {
       selectorCallCount++;
       console.log(`${name} called ${selectorCallCount} times`);
       return selector(state);
     };
   ```

## Advanced Debugging Techniques

### State Export/Import

Export application state for reproduction:

```typescript
// Export current state
const exportState = () => {
  const state = store.getState();
  const stateJson = JSON.stringify(state, null, 2);
  
  // Copy to clipboard or download
  navigator.clipboard.writeText(stateJson);
  console.log('State exported to clipboard');
};

// Import state for debugging
const importState = (stateJson: string) => {
  try {
    const state = JSON.parse(stateJson);
    
    // You can dispatch actions to recreate state
    // Or use Redux DevTools import functionality
    console.log('Importing state:', state);
  } catch (error) {
    console.error('Invalid state JSON:', error);
  }
};

// Add to window for easy access
if (process.env.NODE_ENV === 'development') {
  (window as any).exportState = exportState;
  (window as any).importState = importState;
}
```

### Action Filtering

Filter Redux DevTools to focus on specific actions:

```typescript
// In Redux DevTools, use the filter input:
// - Show only user actions: "users/"
// - Hide router actions: "!router/"
// - Show errors only: "Failure"
// - Regex patterns: "/fetch.*Success/"
```

### Custom Action Logging

Create domain-specific logging:

```typescript
// Enhanced action logging for specific features
const createFeatureLogger = (featureName: string) => {
  const middleware: Middleware = () => next => action => {
    if (action.type.startsWith(featureName)) {
      console.group(`🔧 ${featureName}: ${action.type}`);
      console.log('Action:', action);
      
      const result = next(action);
      
      // Log state changes after action
      setTimeout(() => {
        const state = store.getState();
        console.log('Updated state:', state[featureName]);
        console.groupEnd();
      }, 0);
      
      return result;
    }
    
    return next(action);
  };
  
  return middleware;
};

// Use for specific features
const usersLogger = createFeatureLogger('users');
```

## Error Debugging

### Error Boundaries for Navigation

```typescript
// components/NavigationErrorBoundary.tsx
class NavigationErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    console.error('Navigation error caught:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log error details
    console.group('🚨 Navigation Error');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo.componentStack);
    console.groupEnd();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Navigation Error</h2>
          <details>
            <summary>Error Details</summary>
            <pre>{this.state.error?.stack}</pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Global Error Handler

```typescript
// utils/errorHandler.ts
export const setupGlobalErrorHandling = () => {
  // Catch unhandled promises
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    // Log to Redux for visibility
    store.dispatch({
      type: 'errors/unhandledRejection',
      payload: {
        reason: event.reason?.message || 'Unknown error',
        stack: event.reason?.stack,
        timestamp: Date.now(),
      },
    });
  });

  // Catch JavaScript errors
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    
    store.dispatch({
      type: 'errors/globalError',
      payload: {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        timestamp: Date.now(),
      },
    });
  });
};
```

## Debugging Checklist

When debugging Pi applications, follow this systematic approach:

### 1. Navigation Issues
- [ ] Check route configuration
- [ ] Verify middleware is attached  
- [ ] Look for navigation actions in DevTools
- [ ] Confirm route parameters are correct
- [ ] Check for navigation cancellation

### 2. Data Loading Issues  
- [ ] Verify API requests in Network tab
- [ ] Look for Request/Success/Failure action sequence
- [ ] Check error handling in middleware
- [ ] Confirm AbortSignal handling
- [ ] Verify selector returns expected data

### 3. Component Issues
- [ ] Check if component receives expected props
- [ ] Verify selectors don't return stale references
- [ ] Look for unnecessary re-renders
- [ ] Check for state mutations
- [ ] Confirm error boundaries catch errors

### 4. Performance Issues
- [ ] Use React DevTools Profiler
- [ ] Check for expensive selector computations
- [ ] Look for memory leaks in middleware
- [ ] Verify proper cleanup in onLeave handlers
- [ ] Check for excessive action dispatching

## Production Debugging

### Safe Production Logging

```typescript
// Production-safe logging
const createProductionLogger = () => {
  if (process.env.NODE_ENV !== 'production') {
    return console.log; // Full logging in development
  }
  
  // Limited logging in production
  return (message: string, data?: any) => {
    // Only log errors or critical information
    if (message.includes('Error') || message.includes('Failed')) {
      console.error(message, data);
    }
  };
};

const logger = createProductionLogger();
```

### Remote Error Tracking

```typescript
// Integration with error tracking services
const reportError = (error: Error, context?: any) => {
  if (process.env.NODE_ENV === 'production') {
    // Report to Sentry, LogRocket, etc.
    errorTrackingService.captureException(error, context);
  } else {
    console.error('Error:', error, context);
  }
};

// Use in middleware
export const errorReportingMiddleware = createNavigationMiddleware({
  onError({ error, params, route }) {
    reportError(error as Error, { params, route });
  },
});
```

This debugging guide provides comprehensive techniques for troubleshooting Pi applications. The Redux-first architecture makes Pi applications highly observable and debuggable compared to traditional React applications.

## Next Steps

- [**API Reference**](/reference/debugging/) - Complete debugging API reference
- [**Performance Optimization**](/guides/performance/) - Optimizing Pi applications  
- [**Error Handling Patterns**](/guides/error-handling/) - Advanced error handling strategies