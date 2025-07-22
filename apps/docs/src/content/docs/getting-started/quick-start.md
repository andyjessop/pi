---
title: Quick Start
description: Get up and running with Pi in minutes
---

This guide will get you up and running with Pi in minutes. You'll learn the core concepts by building a simple video listing application.

## Installation

Install Pi in your React project:

```bash
npm install @pi/router redux @reduxjs/toolkit react-redux
```

## Basic Setup

### 1. Configure Redux Store

```typescript
// store.ts
import { configureStore } from '@reduxjs/toolkit';
import { createBrowserRouterMiddleware } from '@pi/router';
import { routerSlice } from '@pi/router';
import videosReducer from './features/videos/videosSlice';

const routerMiddleware = createBrowserRouterMiddleware();

export const store = configureStore({
  reducer: {
    router: routerSlice.reducer,
    videos: videosReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(routerMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### 2. Define Routes

```typescript
// routes.ts
import { Route } from '@pi/router';
import { HomePage, VideosPage, VideoDetailPage } from './pages';
import { videosMiddleware, videoDetailMiddleware } from './middleware';

export const routes: Route[] = [
  {
    path: "/",
    component: HomePage,
  },
  {
    path: "/videos",
    component: VideosPage,
    middleware: [videosMiddleware],
  },
  {
    path: "/videos/:id",
    component: VideoDetailPage,
    middleware: [videoDetailMiddleware],
  },
];
```

### 3. Create Feature Slice

Pi follows strict CRUD conventions for all state changes:

```typescript
// features/videos/videosSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Video {
  id: string;
  title: string;
  url: string;
}

interface VideosState {
  list: Video[] | null;
  current: Video | null;
  loading: boolean;
  error: string | null;
}

const initialState: VideosState = {
  list: null,
  current: null,
  loading: false,
  error: null,
};

const videosSlice = createSlice({
  name: 'videos',
  initialState,
  reducers: {
    // List operations
    fetchListRequest: (state) => {
      state.loading = true;
      state.error = null;
    },
    fetchListSuccess: (state, action: PayloadAction<Video[]>) => {
      state.loading = false;
      state.list = action.payload;
    },
    fetchListFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    
    // Single item operations
    fetchOneRequest: (state) => {
      state.loading = true;
      state.error = null;
    },
    fetchOneSuccess: (state, action: PayloadAction<Video>) => {
      state.loading = false;
      state.current = action.payload;
    },
    fetchOneFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    
    clearCurrent: (state) => {
      state.current = null;
    },
  },
});

export const {
  fetchListRequest,
  fetchListSuccess,
  fetchListFailure,
  fetchOneRequest,
  fetchOneSuccess,
  fetchOneFailure,
  clearCurrent,
} = videosSlice.actions;

export default videosSlice.reducer;
```

### 4. Create Navigation Middleware

Side-effects happen in navigation middleware, triggered by route transitions:

```typescript
// features/videos/videosMiddleware.ts
import { createNavigationMiddleware } from '@pi/router';
import { api } from '../../services/api';
import {
  fetchListRequest,
  fetchListSuccess, 
  fetchListFailure,
  fetchOneRequest,
  fetchOneSuccess,
  fetchOneFailure,
  clearCurrent
} from './videosSlice';

// Videos list route middleware
export const videosMiddleware = createNavigationMiddleware({
  async onEnter({ dispatch }) {
    dispatch(fetchListRequest());
    try {
      const videos = await api.getVideoList();
      dispatch(fetchListSuccess(videos));
    } catch (error) {
      dispatch(fetchListFailure((error as Error).message));
    }
  },
});

// Video detail route middleware
export const videoDetailMiddleware = createNavigationMiddleware({
  async onEnter({ params, dispatch }) {
    dispatch(fetchOneRequest());
    try {
      const video = await api.getVideo(params.id);
      dispatch(fetchOneSuccess(video));
    } catch (error) {
      dispatch(fetchOneFailure((error as Error).message));
    }
  },
  
  onLeave({ dispatch }) {
    dispatch(clearCurrent());
  },
});
```

### 5. Create Pure Components

Components are pure functions that read from Redux and dispatch actions:

```typescript
// pages/VideosPage.tsx
import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { navigateTo } from '@pi/router';
import { RootState } from '../store';

export const VideosPage: React.FC = () => {
  const { list, loading, error } = useSelector((state: RootState) => state.videos);
  const dispatch = useDispatch();

  if (loading) return <div>Loading videos...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!list) return null;

  return (
    <div>
      <h1>Videos</h1>
      <div className="video-grid">
        {list.map((video) => (
          <div key={video.id} className="video-card">
            <h3>{video.title}</h3>
            <button
              onClick={() => dispatch(navigateTo(`/videos/${video.id}`))}
            >
              View Details
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
```

```typescript
// pages/VideoDetailPage.tsx
import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { navigateTo } from '@pi/router';
import { RootState } from '../store';

export const VideoDetailPage: React.FC = () => {
  const { current, loading, error } = useSelector((state: RootState) => state.videos);
  const dispatch = useDispatch();

  if (loading || !current) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <button onClick={() => dispatch(navigateTo('/videos'))}>
        ← Back to Videos
      </button>
      <h1>{current.title}</h1>
      <video src={current.url} controls />
    </div>
  );
};
```

### 6. Setup App Root

```typescript
// App.tsx
import React from 'react';
import { Provider } from 'react-redux';
import { Outlet } from '@pi/router';
import { store } from './store';
import { routes } from './routes';

// Initialize router with routes
import { initializeRouter } from '@pi/router';
initializeRouter(routes);

function App() {
  return (
    <Provider store={store}>
      <div className="app">
        <nav>
          <a href="/">Home</a>
          <a href="/videos">Videos</a>
        </nav>
        <main>
          <Outlet />
        </main>
      </div>
    </Provider>
  );
}

export default App;
```

## Key Concepts

You've just built your first Pi application! Here are the key concepts you used:

### 1. **Redux-First Design**
All application state lives in Redux. Routes, data, loading states, errors—everything is in the store.

### 2. **Navigation Middleware**
Side-effects (API calls) happen in navigation middleware, triggered automatically by route transitions.

### 3. **CRUD Actions**
All async operations follow the pattern: `*Request`, `*Success`, `*Failure` for predictable state management.

### 4. **Pure Components** 
React components only render—they don't manage state or perform side-effects directly.

### 5. **Declarative Navigation**
Navigation is handled by dispatching `navigateTo()` actions, not imperatively calling history APIs.

## What's Next?

- [**Build a CRUD Feature**](/tutorials/crud-feature/) - Add create, update, and delete functionality
- [**Forms and Validation**](/tutorials/forms/) - Learn Pi's approach to form management
- [**Testing Guide**](/guides/testing/) - How to test Pi applications effectively
- [**Type Safety**](/reference/type-safety/) - Using Pi's compile-time route validation

## Benefits You Get

With this simple setup, you now have:

- **🔍 Full observability** - Every state change is visible in Redux DevTools
- **⏰ Time travel debugging** - Step backwards and forwards through state changes  
- **🧪 Easy testing** - Pure functions and predictable state transitions
- **🤖 AI-friendly code** - Machines can understand and modify your application logic
- **📊 Complete audit trail** - Every user action and state change is recorded