---
title: Test Your Routes
description: How-to guide for testing Pi applications, routes, middleware, and components
---

This guide shows you how to test Pi applications effectively. You'll learn how to test routes, navigation middleware, async operations, and React components using Pi's testing utilities and Redux patterns.

## Testing Philosophy

Pi's architecture makes testing straightforward because:

- **Pure functions** - Components are pure render functions
- **Predictable state** - All state lives in Redux store
- **Observable side effects** - Navigation middleware is testable
- **Deterministic behavior** - No hidden state or side effects

## Testing Setup

### Install Testing Dependencies

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install --save-dev redux-mock-store @types/redux-mock-store
```

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
};
```

### Test Setup File

```typescript
// src/setupTests.ts
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// Configure testing library
configure({ testIdAttribute: 'data-testid' });

// Mock window.location
delete (window as any).location;
window.location = {
  ...window.location,
  href: 'http://localhost:3000/',
  pathname: '/',
  search: '',
  hash: '',
};

// Mock fetch
global.fetch = jest.fn();
```

## Testing Utilities

### Create Test Store

```typescript
// src/test-utils/createTestStore.ts
import { configureStore } from '@reduxjs/toolkit';
import { createHeadlessRouterMiddleware } from '@pi/router';
import { routerSlice } from '@pi/router';
import usersReducer from '../features/users/usersSlice';

export function createTestStore(preloadedState = {}) {
  const routerMiddleware = createHeadlessRouterMiddleware('/');
  
  return configureStore({
    reducer: {
      router: routerSlice.reducer,
      users: usersReducer,
    },
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(routerMiddleware),
  });
}

export type TestStore = ReturnType<typeof createTestStore>;
```

### Custom Render Function

```typescript
// src/test-utils/render.tsx
import React from 'react';
import { render as rtlRender, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createTestStore, TestStore } from './createTestStore';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: any;
  store?: TestStore;
}

export function render(
  ui: React.ReactElement,
  {
    preloadedState = {},
    store = createTestStore(preloadedState),
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children?: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }

  return {
    ...rtlRender(ui, { wrapper: Wrapper, ...renderOptions }),
    store,
  };
}

// Re-export everything
export * from '@testing-library/react';
```

## Testing Redux Slices

### Basic Slice Tests

```typescript
// features/users/usersSlice.test.ts
import usersReducer, {
  fetchListRequest,
  fetchListSuccess,
  fetchListFailure,
  initialState,
} from './usersSlice';

describe('users slice', () => {
  test('should handle initial state', () => {
    expect(usersReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  test('should handle fetchListRequest', () => {
    const actual = usersReducer(initialState, fetchListRequest());
    
    expect(actual.listLoading).toBe(true);
    expect(actual.listError).toBe(null);
  });

  test('should handle fetchListSuccess', () => {
    const users = [
      { id: '1', name: 'John Doe', email: 'john@example.com' },
      { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
    ];

    const loadingState = {
      ...initialState,
      listLoading: true,
    };

    const actual = usersReducer(loadingState, fetchListSuccess(users));

    expect(actual.listLoading).toBe(false);
    expect(actual.list).toEqual(users);
    expect(actual.listError).toBe(null);
  });

  test('should handle fetchListFailure', () => {
    const error = 'Failed to fetch users';
    const loadingState = {
      ...initialState,
      listLoading: true,
    };

    const actual = usersReducer(loadingState, fetchListFailure(error));

    expect(actual.listLoading).toBe(false);
    expect(actual.listError).toBe(error);
    expect(actual.list).toBe(null);
  });
});
```

### Testing Complex State Updates

```typescript
// Test optimistic updates and rollbacks
describe('optimistic updates', () => {
  test('should apply optimistic update', () => {
    const users = [
      { id: '1', name: 'John Doe', email: 'john@example.com' },
    ];

    const stateWithUsers = {
      ...initialState,
      list: users,
      current: users[0],
    };

    const updates = { name: 'John Updated' };
    
    const actual = usersReducer(
      stateWithUsers, 
      updateUserOptimistic({ id: '1', updates })
    );

    expect(actual.current?.name).toBe('John Updated');
    expect(actual.list?.[0].name).toBe('John Updated');
  });

  test('should revert optimistic update on failure', () => {
    const originalUser = { id: '1', name: 'John Doe', email: 'john@example.com' };
    const updatedUser = { ...originalUser, name: 'John Updated' };

    const stateWithUpdate = {
      ...initialState,
      list: [updatedUser],
      current: updatedUser,
    };

    const actual = usersReducer(
      stateWithUpdate, 
      revertUserUpdate(originalUser)
    );

    expect(actual.current?.name).toBe('John Doe');
    expect(actual.list?.[0].name).toBe('John Doe');
  });
});
```

## Testing Navigation Middleware

### Mock API Calls

```typescript
// features/users/usersMiddleware.test.ts
import { usersAPI } from './usersAPI';
import { usersListMiddleware, userDetailMiddleware } from './usersMiddleware';
import { createTestStore } from '../../test-utils/createTestStore';

// Mock the API
jest.mock('./usersAPI');
const mockedUsersAPI = usersAPI as jest.Mocked<typeof usersAPI>;

describe('users middleware', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    jest.clearAllMocks();
  });

  describe('usersListMiddleware', () => {
    test('loads users successfully', async () => {
      const mockUsers = [
        { id: '1', name: 'John Doe', email: 'john@example.com' },
        { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
      ];

      mockedUsersAPI.getList.mockResolvedValue(mockUsers);

      const context = {
        dispatch: store.dispatch,
        getState: store.getState,
        signal: new AbortController().signal,
        params: {},
        query: new URLSearchParams(),
        route: { path: '/users' },
      };

      await usersListMiddleware.onEnter!(context);

      const state = store.getState();
      expect(state.users.list).toEqual(mockUsers);
      expect(state.users.listLoading).toBe(false);
      expect(state.users.listError).toBe(null);
    });

    test('handles API errors', async () => {
      const error = new Error('Network error');
      mockedUsersAPI.getList.mockRejectedValue(error);

      const context = {
        dispatch: store.dispatch,
        getState: store.getState,
        signal: new AbortController().signal,
        params: {},
        query: new URLSearchParams(),
        route: { path: '/users' },
      };

      await usersListMiddleware.onEnter!(context);

      const state = store.getState();
      expect(state.users.list).toBe(null);
      expect(state.users.listLoading).toBe(false);
      expect(state.users.listError).toBe('Network error');
    });

    test('handles request cancellation', async () => {
      const abortController = new AbortController();
      const abortError = new DOMException('Operation aborted', 'AbortError');
      
      mockedUsersAPI.getList.mockRejectedValue(abortError);

      const context = {
        dispatch: store.dispatch,
        getState: store.getState,
        signal: abortController.signal,
        params: {},
        query: new URLSearchParams(),
        route: { path: '/users' },
      };

      abortController.abort();
      await usersListMiddleware.onEnter!(context);

      // Should not dispatch failure action on abort
      const state = store.getState();
      expect(state.users.listError).toBe(null);
    });
  });

  describe('userDetailMiddleware', () => {
    test('loads user and clears on leave', async () => {
      const mockUser = { id: '123', name: 'John Doe', email: 'john@example.com' };
      mockedUsersAPI.getById.mockResolvedValue(mockUser);

      const context = {
        dispatch: store.dispatch,
        getState: store.getState,
        signal: new AbortController().signal,
        params: { id: '123' },
        query: new URLSearchParams(),
        route: { path: '/users/:id' },
      };

      // Test onEnter
      await userDetailMiddleware.onEnter!(context);

      let state = store.getState();
      expect(state.users.current).toEqual(mockUser);

      // Test onLeave
      userDetailMiddleware.onLeave!(context);

      state = store.getState();
      expect(state.users.current).toBe(null);
    });
  });
});
```

### Testing Middleware Composition

```typescript
// Test middleware that calls other middleware
describe('composed middleware', () => {
  test('runs auth check then data loading', async () => {
    const authSpy = jest.spyOn(authMiddleware, 'onEnter').mockResolvedValue();
    const dataSpy = jest.spyOn(dataMiddleware, 'onEnter').mockResolvedValue();

    const context = {
      dispatch: store.dispatch,
      getState: () => ({
        ...store.getState(),
        auth: { user: { id: '1', role: 'admin' } },
      }),
      signal: new AbortController().signal,
      params: {},
      query: new URLSearchParams(),
      route: { path: '/admin' },
    };

    await composedMiddleware.onEnter!(context);

    expect(authSpy).toHaveBeenCalledBefore(dataSpy as any);
    expect(authSpy).toHaveBeenCalledWith(context);
    expect(dataSpy).toHaveBeenCalledWith(context);
  });
});
```

## Testing Navigation

### Basic Navigation Tests

```typescript
// navigation.test.ts
import { navigateTo, waitForAction, selectCurrentRoute } from '@pi/router';
import { createTestStore } from '../test-utils/createTestStore';

describe('navigation', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  test('navigates to user detail page', async () => {
    store.dispatch(navigateTo('/users/123'));

    // Wait for navigation to complete
    await waitForAction(store, 'router/navigationSuccess');

    const currentRoute = selectCurrentRoute(store.getState());
    expect(currentRoute?.path).toBe('/users/:id');
    expect(currentRoute?.params.id).toBe('123');
  });

  test('handles navigation errors', async () => {
    // Mock API to throw error
    mockedUsersAPI.getById.mockRejectedValue(new Error('User not found'));

    store.dispatch(navigateTo('/users/nonexistent'));

    await waitForAction(store, 'router/navigationFailure');

    const state = store.getState();
    expect(state.router.status).toBe('error');
    expect(state.router.error).toContain('User not found');
  });

  test('cancels navigation when new navigation starts', async () => {
    // Start first navigation
    store.dispatch(navigateTo('/users/123'));

    // Start second navigation before first completes
    store.dispatch(navigateTo('/users/456'));

    await waitForAction(store, 'router/navigationSuccess');

    const currentRoute = selectCurrentRoute(store.getState());
    expect(currentRoute?.params.id).toBe('456');
  });
});
```

### Testing Route Parameters

```typescript
describe('route parameters', () => {
  test('extracts single parameter', async () => {
    store.dispatch(navigateTo('/users/123'));
    await waitForAction(store, 'router/navigationSuccess');

    const currentRoute = selectCurrentRoute(store.getState());
    expect(currentRoute?.params).toEqual({ id: '123' });
  });

  test('extracts multiple parameters', async () => {
    store.dispatch(navigateTo('/projects/456/tasks/789'));
    await waitForAction(store, 'router/navigationSuccess');

    const currentRoute = selectCurrentRoute(store.getState());
    expect(currentRoute?.params).toEqual({
      projectId: '456',
      taskId: '789',
    });
  });

  test('handles query parameters', async () => {
    store.dispatch(navigateTo('/users?page=2&filter=active'));
    await waitForAction(store, 'router/navigationSuccess');

    const currentRoute = selectCurrentRoute(store.getState());
    expect(currentRoute?.query.get('page')).toBe('2');
    expect(currentRoute?.query.get('filter')).toBe('active');
  });
});
```

## Testing Components

### Pure Component Tests

```typescript
// components/UsersList.test.tsx
import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UsersList } from './UsersList';
import { render } from '../../test-utils/render';
import { navigateTo } from '@pi/router';

describe('UsersList', () => {
  test('renders users list', () => {
    const preloadedState = {
      users: {
        list: [
          { id: '1', name: 'John Doe', email: 'john@example.com' },
          { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
        ],
        listLoading: false,
        listError: null,
      },
    };

    render(<UsersList />, { preloadedState });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  test('shows loading state', () => {
    const preloadedState = {
      users: {
        list: null,
        listLoading: true,
        listError: null,
      },
    };

    render(<UsersList />, { preloadedState });

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test('shows error state', () => {
    const preloadedState = {
      users: {
        list: null,
        listLoading: false,
        listError: 'Failed to load users',
      },
    };

    render(<UsersList />, { preloadedState });

    expect(screen.getByText(/failed to load users/i)).toBeInTheDocument();
  });

  test('navigates on user click', async () => {
    const user = userEvent.setup();
    const preloadedState = {
      users: {
        list: [
          { id: '1', name: 'John Doe', email: 'john@example.com' },
        ],
        listLoading: false,
        listError: null,
      },
    };

    const { store } = render(<UsersList />, { preloadedState });

    const userLink = screen.getByText('John Doe');
    await user.click(userLink);

    // Check that navigation action was dispatched
    const actions = store.getState(); // In real tests, you'd use action tracking
    expect(store.getState().router.pending?.params.id).toBe('1');
  });
});
```

### Testing Forms

```typescript
// components/CreateUserForm.test.tsx
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateUserForm } from './CreateUserForm';
import { render } from '../../test-utils/render';
import { usersAPI } from '../../features/users/usersAPI';

jest.mock('../../features/users/usersAPI');
const mockedUsersAPI = usersAPI as jest.Mocked<typeof usersAPI>;

describe('CreateUserForm', () => {
  test('submits form with valid data', async () => {
    const user = userEvent.setup();
    const mockUser = { id: '123', name: 'John Doe', email: 'john@example.com' };
    
    mockedUsersAPI.create.mockResolvedValue(mockUser);

    const { store } = render(<CreateUserForm />);

    // Fill form
    await user.type(screen.getByLabelText(/name/i), 'John Doe');
    await user.type(screen.getByLabelText(/email/i), 'john@example.com');

    // Submit
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(mockedUsersAPI.create).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
      });
    });

    // Check navigation occurred
    const state = store.getState();
    expect(state.router.current?.params.id).toBe('123');
  });

  test('shows validation errors', async () => {
    const user = userEvent.setup();

    render(<CreateUserForm />);

    // Try to submit empty form
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
  });

  test('handles API errors', async () => {
    const user = userEvent.setup();
    
    mockedUsersAPI.create.mockRejectedValue(new Error('Email already exists'));

    render(<CreateUserForm />);

    // Fill and submit form
    await user.type(screen.getByLabelText(/name/i), 'John Doe');
    await user.type(screen.getByLabelText(/email/i), 'existing@example.com');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
    });
  });
});
```

### Testing Modals

```typescript
// components/EditUserModal.test.tsx
describe('EditUserModal', () => {
  test('opens modal via route', async () => {
    const { store } = render(<App />);
    
    store.dispatch(navigateTo('/users/123/edit'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  test('closes modal with escape key', async () => {
    const user = userEvent.setup();
    const { store } = render(<EditUserModal />);

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  test('closes modal on backdrop click', async () => {
    const user = userEvent.setup();
    render(<EditUserModal />);

    const backdrop = screen.getByRole('dialog');
    await user.click(backdrop);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
```

## Integration Tests

### Full User Flow Tests

```typescript
// integration/userWorkflow.test.tsx
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { render } from '../test-utils/render';
import { usersAPI } from '../features/users/usersAPI';

jest.mock('../features/users/usersAPI');
const mockedUsersAPI = usersAPI as jest.Mocked<typeof usersAPI>;

describe('User Management Workflow', () => {
  test('complete CRUD workflow', async () => {
    const user = userEvent.setup();
    
    // Mock API responses
    mockedUsersAPI.getList.mockResolvedValue([]);
    mockedUsersAPI.create.mockResolvedValue({
      id: '123',
      name: 'John Doe',
      email: 'john@example.com',
    });
    mockedUsersAPI.getById.mockResolvedValue({
      id: '123',
      name: 'John Doe',
      email: 'john@example.com',
    });
    mockedUsersAPI.update.mockResolvedValue({
      id: '123',
      name: 'John Updated',
      email: 'john@example.com',
    });

    const { store } = render(<App />);

    // Navigate to users page
    store.dispatch(navigateTo('/users'));
    await waitFor(() => {
      expect(screen.getByText(/users/i)).toBeInTheDocument();
    });

    // Create new user
    await user.click(screen.getByText(/create user/i));
    
    await user.type(screen.getByLabelText(/name/i), 'John Doe');
    await user.type(screen.getByLabelText(/email/i), 'john@example.com');
    await user.click(screen.getByRole('button', { name: /create/i }));

    // Should navigate to user detail
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Edit user
    await user.click(screen.getByText(/edit/i));
    
    const nameInput = screen.getByDisplayValue('John Doe');
    await user.clear(nameInput);
    await user.type(nameInput, 'John Updated');
    await user.click(screen.getByRole('button', { name: /save/i }));

    // Should show updated name
    await waitFor(() => {
      expect(screen.getByText('John Updated')).toBeInTheDocument();
    });
  });
});
```

### Testing Error Scenarios

```typescript
describe('Error Handling', () => {
  test('handles network errors gracefully', async () => {
    mockedUsersAPI.getList.mockRejectedValue(new Error('Network error'));

    const { store } = render(<App />);
    store.dispatch(navigateTo('/users'));

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });

    // Test retry functionality
    mockedUsersAPI.getList.mockResolvedValue([]);
    
    await userEvent.click(screen.getByText(/retry/i));

    await waitFor(() => {
      expect(screen.queryByText(/network error/i)).not.toBeInTheDocument();
    });
  });
});
```

## Performance Testing

### Testing with Large Data Sets

```typescript
describe('Performance', () => {
  test('handles large user lists efficiently', async () => {
    const largeUserList = Array.from({ length: 1000 }, (_, i) => ({
      id: String(i),
      name: `User ${i}`,
      email: `user${i}@example.com`,
    }));

    mockedUsersAPI.getList.mockResolvedValue(largeUserList);

    const { store } = render(<App />);
    
    const startTime = performance.now();
    store.dispatch(navigateTo('/users'));
    
    await waitFor(() => {
      expect(screen.getByText('User 0')).toBeInTheDocument();
    });
    
    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(1000); // Should render within 1 second
  });
});
```

## Custom Testing Utilities

### Wait for State Utilities

```typescript
// test-utils/waitForState.ts
export async function waitForState<T>(
  store: any,
  selector: (state: any) => T,
  predicate: (value: T) => boolean,
  timeout: number = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timeout waiting for state condition after ${timeout}ms`));
    }, timeout);

    const unsubscribe = store.subscribe(() => {
      const value = selector(store.getState());
      if (predicate(value)) {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(value);
      }
    });

    // Check immediately in case condition is already true
    const initialValue = selector(store.getState());
    if (predicate(initialValue)) {
      clearTimeout(timeoutId);
      unsubscribe();
      resolve(initialValue);
    }
  });
}

// Usage
await waitForState(
  store,
  state => state.users.list,
  list => list !== null && list.length > 0
);
```

This comprehensive testing guide covers all aspects of testing Pi applications. The key principles are leveraging Redux for predictable testing, using Pi's testing utilities, and maintaining separation between logic and presentation.

## Next Steps

- [**Debug with Redux DevTools**](/guides/debugging/) - Advanced debugging techniques
- [**API Reference**](/reference/testing/) - Complete testing API documentation
- [**Performance Optimization**](/guides/performance/) - Optimizing Pi applications