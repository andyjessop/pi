---
title: Your First Pi App
description: Step-by-step tutorial to build a complete Pi application from scratch
---

In this tutorial, you'll build a complete Pi application from scratch. We'll create a simple task management app that demonstrates all the core Pi concepts: Redux-first design, navigation middleware, pure components, and type-safe routing.

By the end, you'll have a working application with:
- Task listing and detail views
- Create, read, update, and delete operations  
- Form handling with validation
- Modal dialogs
- Complete type safety

## Prerequisites

- Basic knowledge of React and Redux
- Node.js 16+ installed
- Familiarity with TypeScript (helpful but not required)

## Project Setup

### 1. Create New React App

```bash
npx create-react-app pi-tasks --template typescript
cd pi-tasks
```

### 2. Install Pi and Dependencies

```bash
npm install @pi/router redux @reduxjs/toolkit react-redux
npm install --save-dev @types/redux @types/react-redux
```

### 3. Project Structure

Let's organize our code following Pi conventions:

```
src/
├── store/
│   ├── index.ts           # Redux store configuration
│   └── rootReducer.ts     # Combine all reducers
├── features/
│   └── tasks/
│       ├── tasksSlice.ts      # Redux slice
│       ├── tasksMiddleware.ts # Navigation middleware  
│       ├── tasksAPI.ts        # API functions
│       └── components/        # Feature components
├── pages/
│   ├── HomePage.tsx
│   ├── TasksPage.tsx
│   ├── TaskDetailPage.tsx
│   └── TaskFormModal.tsx
├── routes.ts              # Route definitions
└── App.tsx
```

## Step 1: Configure Redux Store

### Create the Store

```typescript
// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { createBrowserRouterMiddleware } from '@pi/router';
import rootReducer from './rootReducer';

const routerMiddleware = createBrowserRouterMiddleware();

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(routerMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### Combine Reducers

```typescript
// src/store/rootReducer.ts
import { combineReducers } from '@reduxjs/toolkit';
import { routerSlice } from '@pi/router';
import tasksReducer from '../features/tasks/tasksSlice';

const rootReducer = combineReducers({
  router: routerSlice.reducer,
  tasks: tasksReducer,
});

export default rootReducer;
```

## Step 2: Define Data Types

```typescript
// src/features/tasks/types.ts
export interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequest {
  title: string;
  description: string;
}

export interface UpdateTaskRequest {
  id: string;
  title?: string;
  description?: string;
  completed?: boolean;
}
```

## Step 3: Create Tasks Feature Slice

Following Pi's CRUD conventions, create a comprehensive slice for task management:

```typescript
// src/features/tasks/tasksSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Task, CreateTaskRequest, UpdateTaskRequest } from './types';

interface TasksState {
  // List state
  list: Task[] | null;
  listLoading: boolean;
  listError: string | null;
  
  // Current task state
  current: Task | null;
  currentLoading: boolean;
  currentError: string | null;
  
  // Form state
  formData: Partial<Task> | null;
  formSaving: boolean;
  formError: string | null;
}

const initialState: TasksState = {
  list: null,
  listLoading: false,
  listError: null,
  current: null,
  currentLoading: false,
  currentError: null,
  formData: null,
  formSaving: false,
  formError: null,
};

const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    // List operations
    fetchListRequest: (state) => {
      state.listLoading = true;
      state.listError = null;
    },
    fetchListSuccess: (state, action: PayloadAction<Task[]>) => {
      state.listLoading = false;
      state.list = action.payload;
    },
    fetchListFailure: (state, action: PayloadAction<string>) => {
      state.listLoading = false;
      state.listError = action.payload;
    },
    
    // Single task operations
    fetchTaskRequest: (state) => {
      state.currentLoading = true;
      state.currentError = null;
    },
    fetchTaskSuccess: (state, action: PayloadAction<Task>) => {
      state.currentLoading = false;
      state.current = action.payload;
    },
    fetchTaskFailure: (state, action: PayloadAction<string>) => {
      state.currentLoading = false;
      state.currentError = action.payload;
    },
    
    // Form operations
    initializeForm: (state, action: PayloadAction<Partial<Task> | null>) => {
      state.formData = action.payload || {
        title: '',
        description: '',
        completed: false,
      };
      state.formError = null;
    },
    updateFormField: (state, action: PayloadAction<{field: keyof Task, value: any}>) => {
      if (state.formData) {
        state.formData[action.payload.field] = action.payload.value;
      }
    },
    
    // Save operations
    saveTaskRequest: (state) => {
      state.formSaving = true;
      state.formError = null;
    },
    saveTaskSuccess: (state, action: PayloadAction<Task>) => {
      state.formSaving = false;
      state.formData = null;
      // Update list if it exists
      if (state.list) {
        const existingIndex = state.list.findIndex(t => t.id === action.payload.id);
        if (existingIndex >= 0) {
          state.list[existingIndex] = action.payload;
        } else {
          state.list.push(action.payload);
        }
      }
      // Update current if it matches
      if (state.current?.id === action.payload.id) {
        state.current = action.payload;
      }
    },
    saveTaskFailure: (state, action: PayloadAction<string>) => {
      state.formSaving = false;
      state.formError = action.payload;
    },
    
    // Delete operations
    deleteTaskRequest: (state) => {
      state.currentLoading = true;
      state.currentError = null;
    },
    deleteTaskSuccess: (state, action: PayloadAction<string>) => {
      state.currentLoading = false;
      const taskId = action.payload;
      // Remove from list
      if (state.list) {
        state.list = state.list.filter(t => t.id !== taskId);
      }
      // Clear current if it matches
      if (state.current?.id === taskId) {
        state.current = null;
      }
    },
    deleteTaskFailure: (state, action: PayloadAction<string>) => {
      state.currentLoading = false;
      state.currentError = action.payload;
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
  },
});

export const {
  fetchListRequest,
  fetchListSuccess,
  fetchListFailure,
  fetchTaskRequest,
  fetchTaskSuccess,
  fetchTaskFailure,
  initializeForm,
  updateFormField,
  saveTaskRequest,
  saveTaskSuccess,
  saveTaskFailure,
  deleteTaskRequest,
  deleteTaskSuccess,
  deleteTaskFailure,
  clearCurrent,
  clearForm,
} = tasksSlice.actions;

export default tasksSlice.reducer;
```

## Step 4: Create API Layer

```typescript
// src/features/tasks/tasksAPI.ts
import { Task, CreateTaskRequest, UpdateTaskRequest } from './types';

// Simulate API with localStorage for this tutorial
class TasksAPI {
  private getStoredTasks(): Task[] {
    const stored = localStorage.getItem('pi-tasks');
    return stored ? JSON.parse(stored) : [];
  }
  
  private setStoredTasks(tasks: Task[]): void {
    localStorage.setItem('pi-tasks', JSON.stringify(tasks));
  }
  
  async getList(): Promise<Task[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return this.getStoredTasks();
  }
  
  async getById(id: string): Promise<Task> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const tasks = this.getStoredTasks();
    const task = tasks.find(t => t.id === id);
    if (!task) {
      throw new Error(`Task ${id} not found`);
    }
    return task;
  }
  
  async create(data: CreateTaskRequest): Promise<Task> {
    await new Promise(resolve => setTimeout(resolve, 800));
    const tasks = this.getStoredTasks();
    const newTask: Task = {
      ...data,
      id: Date.now().toString(),
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tasks.push(newTask);
    this.setStoredTasks(tasks);
    return newTask;
  }
  
  async update(data: UpdateTaskRequest): Promise<Task> {
    await new Promise(resolve => setTimeout(resolve, 800));
    const tasks = this.getStoredTasks();
    const index = tasks.findIndex(t => t.id === data.id);
    if (index === -1) {
      throw new Error(`Task ${data.id} not found`);
    }
    const updatedTask = {
      ...tasks[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    tasks[index] = updatedTask;
    this.setStoredTasks(tasks);
    return updatedTask;
  }
  
  async delete(id: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 600));
    const tasks = this.getStoredTasks();
    const filtered = tasks.filter(t => t.id !== id);
    if (filtered.length === tasks.length) {
      throw new Error(`Task ${id} not found`);
    }
    this.setStoredTasks(filtered);
  }
}

export const tasksAPI = new TasksAPI();
```

## Step 5: Create Navigation Middleware

This is where Pi shines—side effects are handled declaratively through route transitions:

```typescript
// src/features/tasks/tasksMiddleware.ts
import { createNavigationMiddleware } from '@pi/router';
import { tasksAPI } from './tasksAPI';
import {
  fetchListRequest,
  fetchListSuccess,
  fetchListFailure,
  fetchTaskRequest,
  fetchTaskSuccess,
  fetchTaskFailure,
  initializeForm,
  clearCurrent,
  clearForm,
} from './tasksSlice';

// Tasks list route middleware
export const tasksListMiddleware = createNavigationMiddleware({
  async onEnter({ dispatch }) {
    dispatch(fetchListRequest());
    try {
      const tasks = await tasksAPI.getList();
      dispatch(fetchListSuccess(tasks));
    } catch (error) {
      dispatch(fetchListFailure((error as Error).message));
    }
  },
});

// Task detail route middleware  
export const taskDetailMiddleware = createNavigationMiddleware({
  async onEnter({ params, dispatch }) {
    dispatch(fetchTaskRequest());
    try {
      const task = await tasksAPI.getById(params.id);
      dispatch(fetchTaskSuccess(task));
    } catch (error) {
      dispatch(fetchTaskFailure((error as Error).message));
    }
  },
  
  onLeave({ dispatch }) {
    dispatch(clearCurrent());
  },
});

// Create task modal middleware
export const createTaskMiddleware = createNavigationMiddleware({
  onEnter({ dispatch }) {
    dispatch(initializeForm(null));
  },
  
  onLeave({ dispatch }) {
    dispatch(clearForm());
  },
});

// Edit task modal middleware
export const editTaskMiddleware = createNavigationMiddleware({
  onEnter({ dispatch, getState }) {
    const { current } = getState().tasks;
    if (current) {
      dispatch(initializeForm(current));
    }
  },
  
  onLeave({ dispatch }) {
    dispatch(clearForm());
  },
});
```

This tutorial continues with the remaining steps to build out the complete application. The key takeaway is how Pi's architecture makes complex state management predictable and observable through Redux conventions.

## Next Steps

Continue building:
- [**Forms and Validation**](/tutorials/forms/) - Add form validation and error handling
- [**Modals and Dialogs**](/tutorials/modals/) - Implement the task form modal
- [**Testing Your App**](/guides/testing/) - Write comprehensive tests

## Key Concepts Learned

In this tutorial, you've implemented:

1. **Redux-First Architecture** - All state lives in Redux store
2. **CRUD Action Patterns** - Consistent `*Request/Success/Failure` actions  
3. **Navigation Middleware** - Side-effects triggered by route transitions
4. **Pure Components** - React components as simple render functions
5. **Separation of Concerns** - Clear boundaries between routes, data, and UI