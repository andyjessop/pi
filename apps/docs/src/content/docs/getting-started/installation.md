---
title: Installation
description: How to install and set up Pi in your React project
---

Pi is designed to work with existing React applications using Redux Toolkit. This guide will walk you through the installation and basic setup process.

## Prerequisites

Before installing Pi, ensure you have:

- **Node.js** 16.0 or higher
- **React** 18.0 or higher  
- **TypeScript** 4.7 or higher (recommended)

## Installation

### Install Pi Router

```bash
npm install @pi/router
```

### Install Required Dependencies

Pi requires Redux Toolkit and React Redux:

```bash
npm install @reduxjs/toolkit react-redux
```

### Install Type Definitions (TypeScript)

If using TypeScript, install the type definitions:

```bash
npm install --save-dev @types/react-redux
```

## Basic Setup

### 1. Configure Redux Store

Create your Redux store with Pi's router middleware:

```typescript
// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { createBrowserRouterMiddleware } from '@pi/router';
import { routerSlice } from '@pi/router';

const routerMiddleware = createBrowserRouterMiddleware();

export const store = configureStore({
  reducer: {
    router: routerSlice.reducer,
    // Add your feature slices here
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(routerMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### 2. Define Your Routes

Create a routes configuration file:

```typescript
// src/routes.ts
import { Route } from '@pi/router';
import { HomePage, AboutPage } from './pages';

export const routes: Route[] = [
  {
    path: "/",
    component: HomePage,
  },
  {
    path: "/about", 
    component: AboutPage,
  },
];
```

### 3. Initialize Your App

Set up your app with Redux Provider and router initialization:

```typescript
// src/App.tsx
import React from 'react';
import { Provider } from 'react-redux';
import { Outlet } from '@pi/router';
import { store } from './store';
import { routes } from './routes';
import { initializeRouter } from '@pi/router';

// Initialize router with your routes
initializeRouter(routes);

function App() {
  return (
    <Provider store={store}>
      <div className="app">
        <main>
          <Outlet />
        </main>
      </div>
    </Provider>
  );
}

export default App;
```

### 4. Create Your First Page

Create a simple page component:

```typescript
// src/pages/HomePage.tsx
import React from 'react';
import { useDispatch } from 'react-redux';
import { navigateTo } from '@pi/router';

export const HomePage: React.FC = () => {
  const dispatch = useDispatch();
  
  return (
    <div>
      <h1>Welcome to Pi</h1>
      <p>Your Redux-first application is running!</p>
      <button onClick={() => dispatch(navigateTo('/about'))}>
        Go to About
      </button>
    </div>
  );
};
```

## Development Setup

### Redux DevTools

Install the Redux DevTools extension for debugging:

**Chrome**: [Redux DevTools Extension](https://chrome.google.com/webstore/detail/redux-devtools/lmhkpmbekcpmknklioeibfkpmmfibljd)

**Firefox**: [Redux DevTools Add-on](https://addons.mozilla.org/en-US/firefox/addon/reduxdevtools/)

The extension will automatically work with Pi applications since they use standard Redux Toolkit.

### TypeScript Configuration

For optimal TypeScript support, ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true
  }
}
```

## Verification

To verify your installation is working correctly:

1. **Start your development server**:
   ```bash
   npm start
   ```

2. **Open Redux DevTools** in your browser
3. **Navigate between routes** - you should see Redux actions being dispatched
4. **Check the router state** in Redux DevTools under the `router` slice

You should see actions like:
- `router/navigationRequest`
- `router/navigationSuccess` 
- Route state updates in the Redux store

## Next Steps

Now that Pi is installed and configured:

- [**Quick Start Guide**](/getting-started/quick-start/) - Build your first Pi application
- [**Your First Pi App**](/tutorials/first-app/) - Comprehensive tutorial
- [**Architecture Overview**](/concepts/architecture/) - Understand Pi's design principles

## Troubleshooting

### Common Issues

**Router middleware not working:**
- Ensure `routerSlice.reducer` is added to your store
- Verify router middleware is added to the middleware array
- Check that `initializeRouter()` is called before rendering

**TypeScript errors:**
- Make sure you're using compatible versions of all dependencies
- Verify your `tsconfig.json` configuration matches the requirements

**Navigation not working:**
- Confirm routes are properly defined and imported
- Check that components are exported correctly
- Verify `navigateTo()` calls use the correct action creator

For additional help, check the [API Reference](/reference/api/) or see the [debugging guide](/guides/debugging/).