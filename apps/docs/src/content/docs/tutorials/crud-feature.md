---
title: Building a CRUD Feature
description: Learn how to implement Create, Read, Update, Delete operations in Pi
---

In this tutorial, you'll learn how to build a complete CRUD (Create, Read, Update, Delete) feature in Pi. We'll extend the basic video listing app from the Quick Start guide to include full CRUD operations.

By the end of this tutorial, you'll understand:
- How to structure CRUD operations using Pi's conventions
- Navigation middleware patterns for data management
- Form handling and validation
- Modal-based editing workflows
- Error handling and loading states

## Starting Point

This tutorial assumes you've completed the [Quick Start guide](/getting-started/quick-start/) and have a basic video listing application running.

## Step 1: Extend the Videos Slice

First, let's extend our videos slice to support all CRUD operations:

```typescript
// features/videos/videosSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Video {
  id: string;
  title: string;
  description: string;
  url: string;
  thumbnail: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateVideoRequest {
  title: string;
  description: string;
  url: string;
}

interface UpdateVideoRequest {
  id: string;
  title?: string;
  description?: string;
  url?: string;
}

interface VideosState {
  // List state
  list: Video[] | null;
  listLoading: boolean;
  listError: string | null;
  
  // Current video state
  current: Video | null;
  currentLoading: boolean;
  currentError: string | null;
  
  // Form state for create/edit
  formData: Partial<Video> | null;
  formSaving: boolean;
  formError: string | null;
  
  // Delete state
  deleting: string | null; // ID of video being deleted
  deleteError: string | null;
}

const initialState: VideosState = {
  list: null,
  listLoading: false,
  listError: null,
  current: null,
  currentLoading: false,
  currentError: null,
  formData: null,
  formSaving: false,
  formError: null,
  deleting: null,
  deleteError: null,
};

const videosSlice = createSlice({
  name: 'videos',
  initialState,
  reducers: {
    // READ operations
    fetchListRequest: (state) => {
      state.listLoading = true;
      state.listError = null;
    },
    fetchListSuccess: (state, action: PayloadAction<Video[]>) => {
      state.listLoading = false;
      state.list = action.payload;
    },
    fetchListFailure: (state, action: PayloadAction<string>) => {
      state.listLoading = false;
      state.listError = action.payload;
    },
    
    fetchOneRequest: (state) => {
      state.currentLoading = true;
      state.currentError = null;
    },
    fetchOneSuccess: (state, action: PayloadAction<Video>) => {
      state.currentLoading = false;
      state.current = action.payload;
    },
    fetchOneFailure: (state, action: PayloadAction<string>) => {
      state.currentLoading = false;
      state.currentError = action.payload;
    },
    
    // CREATE operations
    createRequest: (state) => {
      state.formSaving = true;
      state.formError = null;
    },
    createSuccess: (state, action: PayloadAction<Video>) => {
      state.formSaving = false;
      state.formData = null;
      // Add to list if it exists
      if (state.list) {
        state.list.unshift(action.payload);
      }
    },
    createFailure: (state, action: PayloadAction<string>) => {
      state.formSaving = false;
      state.formError = action.payload;
    },
    
    // UPDATE operations
    updateRequest: (state) => {
      state.formSaving = true;
      state.formError = null;
    },
    updateSuccess: (state, action: PayloadAction<Video>) => {
      state.formSaving = false;
      state.formData = null;
      const video = action.payload;
      
      // Update in list
      if (state.list) {
        const index = state.list.findIndex(v => v.id === video.id);
        if (index >= 0) {
          state.list[index] = video;
        }
      }
      
      // Update current if it matches
      if (state.current?.id === video.id) {
        state.current = video;
      }
    },
    updateFailure: (state, action: PayloadAction<string>) => {
      state.formSaving = false;
      state.formError = action.payload;
    },
    
    // DELETE operations
    deleteRequest: (state, action: PayloadAction<string>) => {
      state.deleting = action.payload;
      state.deleteError = null;
    },
    deleteSuccess: (state, action: PayloadAction<string>) => {
      const videoId = action.payload;
      state.deleting = null;
      
      // Remove from list
      if (state.list) {
        state.list = state.list.filter(v => v.id !== videoId);
      }
      
      // Clear current if it matches
      if (state.current?.id === videoId) {
        state.current = null;
      }
    },
    deleteFailure: (state, action: PayloadAction<string>) => {
      state.deleting = null;
      state.deleteError = action.payload;
    },
    
    // Form management
    initializeForm: (state, action: PayloadAction<Partial<Video> | null>) => {
      state.formData = action.payload || {
        title: '',
        description: '',
        url: '',
      };
      state.formError = null;
    },
    updateFormField: (state, action: PayloadAction<{field: keyof Video, value: any}>) => {
      if (state.formData) {
        state.formData[action.payload.field] = action.payload.value;
      }
    },
    
    // Cleanup
    clearCurrent: (state) => {
      state.current = null;
      state.currentError = null;
    },
    clearForm: (state) => {
      state.formData = null;
      state.formError = null;
    },
    clearDeleteError: (state) => {
      state.deleteError = null;
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
  createRequest,
  createSuccess,
  createFailure,
  updateRequest,
  updateSuccess,
  updateFailure,
  deleteRequest,
  deleteSuccess,
  deleteFailure,
  initializeForm,
  updateFormField,
  clearCurrent,
  clearForm,
  clearDeleteError,
} = videosSlice.actions;

export default videosSlice.reducer;
```

## Step 2: Expand the API Layer

Create a comprehensive API service for all CRUD operations:

```typescript
// features/videos/videosAPI.ts
import { Video, CreateVideoRequest, UpdateVideoRequest } from './types';

class VideosAPI {
  private baseURL = 'https://api.example.com/videos';
  
  async getList(): Promise<Video[]> {
    const response = await fetch(this.baseURL);
    if (!response.ok) {
      throw new Error(`Failed to fetch videos: ${response.statusText}`);
    }
    return response.json();
  }
  
  async getById(id: string): Promise<Video> {
    const response = await fetch(`${this.baseURL}/${id}`);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Video ${id} not found`);
      }
      throw new Error(`Failed to fetch video: ${response.statusText}`);
    }
    return response.json();
  }
  
  async create(data: CreateVideoRequest): Promise<Video> {
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create video');
    }
    
    return response.json();
  }
  
  async update(data: UpdateVideoRequest): Promise<Video> {
    const { id, ...updateData } = data;
    const response = await fetch(`${this.baseURL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update video');
    }
    
    return response.json();
  }
  
  async delete(id: string): Promise<void> {
    const response = await fetch(`${this.baseURL}/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Video ${id} not found`);
      }
      throw new Error(`Failed to delete video: ${response.statusText}`);
    }
  }
}

export const videosAPI = new VideosAPI();
```

## Step 3: Create CRUD Navigation Middleware

Now let's create middleware for each CRUD operation:

```typescript
// features/videos/videosMiddleware.ts
import { createNavigationMiddleware } from '@pi/router';
import { videosAPI } from './videosAPI';
import {
  fetchListRequest,
  fetchListSuccess,
  fetchListFailure,
  fetchOneRequest,
  fetchOneSuccess,
  fetchOneFailure,
  createRequest,
  createSuccess,
  createFailure,
  updateRequest,
  updateSuccess,
  updateFailure,
  deleteRequest,
  deleteSuccess,
  deleteFailure,
  initializeForm,
  clearCurrent,
  clearForm,
} from './videosSlice';

// Videos list middleware
export const videosListMiddleware = createNavigationMiddleware({
  async onEnter({ dispatch }) {
    dispatch(fetchListRequest());
    try {
      const videos = await videosAPI.getList();
      dispatch(fetchListSuccess(videos));
    } catch (error) {
      dispatch(fetchListFailure((error as Error).message));
    }
  },
});

// Video detail middleware
export const videoDetailMiddleware = createNavigationMiddleware({
  async onEnter({ params, dispatch }) {
    dispatch(fetchOneRequest());
    try {
      const video = await videosAPI.getById(params.id);
      dispatch(fetchOneSuccess(video));
    } catch (error) {
      dispatch(fetchOneFailure((error as Error).message));
    }
  },
  
  onLeave({ dispatch }) {
    dispatch(clearCurrent());
  },
});

// Create video modal middleware
export const createVideoMiddleware = createNavigationMiddleware({
  onEnter({ dispatch }) {
    dispatch(initializeForm(null));
  },
  
  onLeave({ dispatch }) {
    dispatch(clearForm());
  },
});

// Edit video modal middleware
export const editVideoMiddleware = createNavigationMiddleware({
  onEnter({ dispatch, getState }) {
    const { current } = getState().videos;
    if (current) {
      dispatch(initializeForm(current));
    }
  },
  
  onLeave({ dispatch }) {
    dispatch(clearForm());
  },
});

// CRUD operation thunks (called from components)
export const createVideo = (data: CreateVideoRequest) => 
  async (dispatch: any) => {
    dispatch(createRequest());
    try {
      const video = await videosAPI.create(data);
      dispatch(createSuccess(video));
    } catch (error) {
      dispatch(createFailure((error as Error).message));
      throw error; // Re-throw for component handling
    }
  };

export const updateVideo = (data: UpdateVideoRequest) =>
  async (dispatch: any) => {
    dispatch(updateRequest());
    try {
      const video = await videosAPI.update(data);
      dispatch(updateSuccess(video));
    } catch (error) {
      dispatch(updateFailure((error as Error).message));
      throw error;
    }
  };

export const deleteVideo = (id: string) =>
  async (dispatch: any) => {
    dispatch(deleteRequest(id));
    try {
      await videosAPI.delete(id);
      dispatch(deleteSuccess(id));
    } catch (error) {
      dispatch(deleteFailure((error as Error).message));
      throw error;
    }
  };
```

## Step 4: Update Route Configuration

Add routes for create and edit operations:

```typescript
// routes.ts
import { Route } from '@pi/router';
import { 
  HomePage, 
  VideosPage, 
  VideoDetailPage,
  CreateVideoModal,
  EditVideoModal 
} from './pages';
import {
  videosListMiddleware,
  videoDetailMiddleware,
  createVideoMiddleware,
  editVideoMiddleware,
} from './features/videos/videosMiddleware';

export const routes: Route[] = [
  {
    path: "/",
    component: HomePage,
  },
  {
    path: "/videos",
    component: VideosPage,
    middleware: [videosListMiddleware],
    children: [
      {
        path: "create",
        component: CreateVideoModal,
        middleware: [createVideoMiddleware],
      },
    ],
  },
  {
    path: "/videos/:id",
    component: VideoDetailPage,
    middleware: [videoDetailMiddleware],
    children: [
      {
        path: "edit",
        component: EditVideoModal,
        middleware: [editVideoMiddleware],
      },
    ],
  },
];
```

## Step 5: Create CRUD Components

### Updated Videos List Page

```typescript
// pages/VideosPage.tsx
import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { navigateTo, Outlet } from '@pi/router';
import { RootState } from '../store';

export const VideosPage: React.FC = () => {
  const { list, listLoading, listError } = useSelector((state: RootState) => state.videos);
  const dispatch = useDispatch();

  if (listLoading) return <div>Loading videos...</div>;
  if (listError) return <div>Error: {listError}</div>;
  if (!list) return null;

  return (
    <div>
      <div className="videos-header">
        <h1>Videos</h1>
        <button 
          className="btn-primary"
          onClick={() => dispatch(navigateTo('/videos/create'))}
        >
          Create Video
        </button>
      </div>
      
      <div className="video-grid">
        {list.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
      
      {/* Modal outlet for create form */}
      <Outlet />
    </div>
  );
};

const VideoCard: React.FC<{ video: Video }> = ({ video }) => {
  const dispatch = useDispatch();
  
  return (
    <div className="video-card">
      <img src={video.thumbnail} alt={video.title} />
      <h3>{video.title}</h3>
      <p>{video.description}</p>
      <div className="video-actions">
        <button
          onClick={() => dispatch(navigateTo(`/videos/${video.id}`))}
        >
          View Details
        </button>
        <button
          onClick={() => dispatch(navigateTo(`/videos/${video.id}/edit`))}
        >
          Edit
        </button>
      </div>
    </div>
  );
};
```

### Video Detail Page with Delete

```typescript
// pages/VideoDetailPage.tsx
import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { navigateTo, Outlet } from '@pi/router';
import { RootState } from '../store';
import { deleteVideo } from '../features/videos/videosMiddleware';

export const VideoDetailPage: React.FC = () => {
  const { 
    current, 
    currentLoading, 
    currentError, 
    deleting, 
    deleteError 
  } = useSelector((state: RootState) => state.videos);
  const dispatch = useDispatch();

  if (currentLoading || !current) return <div>Loading...</div>;
  if (currentError) return <div>Error: {currentError}</div>;

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this video?')) {
      try {
        await dispatch(deleteVideo(current.id));
        dispatch(navigateTo('/videos'));
      } catch (error) {
        // Error is handled in Redux state
      }
    }
  };

  return (
    <div>
      <div className="video-header">
        <button onClick={() => dispatch(navigateTo('/videos'))}>
          ← Back to Videos
        </button>
        <div className="video-actions">
          <button
            onClick={() => dispatch(navigateTo(`/videos/${current.id}/edit`))}
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting === current.id}
            className="btn-danger"
          >
            {deleting === current.id ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
      
      <h1>{current.title}</h1>
      <p>{current.description}</p>
      <video src={current.url} controls />
      
      {deleteError && (
        <div className="error-message">{deleteError}</div>
      )}
      
      {/* Modal outlet for edit form */}
      <Outlet />
    </div>
  );
};
```

This tutorial demonstrates how Pi's conventions make CRUD operations predictable and maintainable. The key principles are:

1. **Consistent Action Patterns** - All operations follow `*Request/Success/Failure`
2. **Navigation-Driven Side Effects** - Data fetching happens in middleware
3. **Pure Components** - UI only renders state and dispatches actions
4. **Modal-based Editing** - Forms are separate routes for deep-linking
5. **Optimistic Updates** - State updates immediately on success

## Next Steps

- [**Forms and Validation**](/tutorials/forms/) - Add comprehensive form validation
- [**Modals and Dialogs**](/tutorials/modals/) - Learn advanced modal patterns
- [**Testing CRUD Operations**](/guides/testing/) - Test your CRUD features effectively