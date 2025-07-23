---
title: Forms and Validation
description: Learn how to build forms with validation using Pi's Redux-only form library
---

In this tutorial, you'll learn how to build robust forms with validation using Pi's Redux-only form library. We'll create a comprehensive form system that follows Pi's Redux-first principles while providing an excellent developer experience.

By the end of this tutorial, you'll understand:
- How to create forms using Pi's Redux-only form library
- Implementing synchronous and asynchronous validation
- Creating reusable form components with Pi conventions
- Handling form submission with error recovery
- Testing form behavior effectively
- Integrating forms with Pi's navigation system

## Pi's Redux-Only Form Architecture

Pi takes a unique approach to forms by treating all form state as pure Redux state using a specialized form library. This provides several benefits:

- **Complete observability** - Every keystroke and validation error is visible in Redux DevTools
- **Time-travel debugging** - Step through form interactions to debug issues
- **Deterministic testing** - Forms are pure functions of Redux state
- **AI-friendly** - Machines can understand and generate form logic
- **Framework agnostic** - Works with React, Angular, Web Components, or CLI
- **Serializable state** - Forms can be persisted, rehydrated, or time-traveled

## The createForm Factory

Pi provides a `createForm` factory that generates all necessary Redux artifacts for form management:

```typescript
// Import the form library
import { createForm } from '@pi/form';

// Type definitions
interface FormConfig<T extends Record<string, unknown>> {
  formId: string;
  fields: {
    [K in keyof T]: FieldConfig<T[K]>;
  };
  onSubmit?: (
    values: T,
    dispatch: Dispatch,
    getState: () => unknown,
  ) => Promise<unknown> | unknown;
}

interface FieldConfig<V = unknown> {
  initialValue: V;
  validators?: Array<Validator<V>>;
  asyncValidators?: Array<AsyncValidator<V>>;
}

// The factory returns all Redux artifacts needed
interface FormArtifacts<T> {
  reducer: Reducer<FormState<T>>;
  selectors: FormSelectors<T>;
  actions: FormActions<T>;
  middleware?: Middleware;
}
```

## Step 1: Define a Video Form

Let's create a comprehensive video form with validation:

```typescript
// features/videos/videoForm.ts
import { createForm, type Validator, type AsyncValidator } from '@pi/form';
import { videosAPI } from './videosAPI';

// Define the form data type
interface VideoFormData {
  title: string;
  url: string;
  description: string;
  published: boolean;
  category: string;
}

// Synchronous validators
const validateTitle: Validator<string> = (title) => {
  if (!title.trim()) return 'Title is required';
  if (title.length < 3) return 'Title must be at least 3 characters';
  if (title.length > 100) return 'Title must be less than 100 characters';
  return undefined;
};

const validateUrl: Validator<string> = (url) => {
  if (!url.trim()) return 'URL is required';
  
  try {
    new URL(url);
  } catch {
    return 'Please enter a valid URL';
  }
  
  return undefined;
};

const validateDescription: Validator<string> = (description) => {
  if (description.length > 500) return 'Description must be less than 500 characters';
  return undefined;
};

const validateCategory: Validator<string> = (category) => {
  if (!category) return 'Please select a category';
  return undefined;
};

// Asynchronous validator for URL uniqueness
const validateUrlUnique: AsyncValidator<string> = async (url) => {
  if (!url.trim()) return undefined; // Skip async validation if empty
  
  try {
    const isDuplicate = await videosAPI.checkDuplicateUrl(url);
    if (isDuplicate) {
      return 'A video with this URL already exists';
    }
    return undefined;
  } catch (error) {
    return 'Unable to verify URL uniqueness';
  }
};

// Create the form using Pi's form library
export const videoFormArtifacts = createForm<VideoFormData>({
  formId: 'videoForm',
  
  fields: {
    title: {
      initialValue: '',
      validators: [validateTitle],
    },
    url: {
      initialValue: '',
      validators: [validateUrl],
      asyncValidators: [validateUrlUnique],
    },
    description: {
      initialValue: '',
      validators: [validateDescription],
    },
    published: {
      initialValue: false,
    },
    category: {
      initialValue: '',
      validators: [validateCategory],
    },
  },
  
  onSubmit: async (values, dispatch, getState) => {
    // Extract video ID from current route for edit mode
    const state = getState() as RootState;
    const currentRoute = state.router.current;
    const videoId = currentRoute?.params?.id;
    
    if (videoId) {
      // Update existing video
      await videosAPI.update({ id: videoId, ...values });
    } else {
      // Create new video
      await videosAPI.create(values);
    }
  },
});

// Export the generated artifacts with clear names
export const {
  reducer: videoFormReducer,
  actions: videoFormActions,
  selectors: videoFormSelectors,
  middleware: videoFormMiddleware,
} = videoFormArtifacts;
```

## Step 2: Store Integration

Add the form to your Redux store:

```typescript
// store/rootReducer.ts
import { combineReducers } from '@reduxjs/toolkit';
import { routerSlice } from '@pi/router';
import { videoFormReducer } from '../features/videos/videoForm';

export const rootReducer = combineReducers({
  router: routerSlice.reducer,
  videoForm: videoFormReducer,
  // ... other reducers
});

export type RootState = ReturnType<typeof rootReducer>;
```

```typescript
// store/store.ts
import { configureStore } from '@reduxjs/toolkit';
import { createHeadlessRouterMiddleware } from '@pi/router';
import { rootReducer } from './rootReducer';
import { videoFormMiddleware } from '../features/videos/videoForm';
import { routes } from '../routes';

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(createHeadlessRouterMiddleware(routes))
      .concat(videoFormMiddleware || []), // Add form middleware if present
});

export type AppDispatch = typeof store.dispatch;
```

## Step 3: Form State Shape

The form library generates a predictable, serializable state shape:

```typescript
interface VideoFormState {
  submitting: boolean;
  submitSucceeded: boolean;
  submitError: string | undefined;
  requestId: number;
  fields: {
    title: {
      value: string;
      initialValue: string;
      dirty: boolean;
      touched: boolean;
      visited: boolean;
      focused: boolean;
      validating: boolean;
      errors: string[];
    };
    url: {
      value: string;
      initialValue: string;
      dirty: boolean;
      touched: boolean;
      visited: boolean;
      focused: boolean;
      validating: boolean;
      errors: string[];
    };
    // ... other fields follow the same pattern
  };
}
```

## Step 4: Navigation Integration

Integrate the form with Pi's navigation system using middleware:

```typescript
// features/videos/videoFormRoutes.ts
import { createNavigationMiddleware } from '@pi/router';
import { videoFormActions } from './videoForm';
import { videosAPI } from './videosAPI';

// Create video route middleware
export const createVideoMiddleware = createNavigationMiddleware({
  onEnter({ dispatch }) {
    // Initialize clean form for creation
    dispatch(videoFormActions.resetForm());
  },
  
  onLeave({ dispatch }) {
    // Clean up form state when leaving
    dispatch(videoFormActions.resetForm());
  },
});

// Edit video route middleware
export const editVideoMiddleware = createNavigationMiddleware({
  async onEnter({ params, dispatch }) {
    const videoId = params.id;
    
    try {
      // Load existing video data
      const video = await videosAPI.getById(videoId);
      
      // Initialize form with existing data
      dispatch(videoFormActions.updateFieldValue('title', video.title));
      dispatch(videoFormActions.updateFieldValue('url', video.url));
      dispatch(videoFormActions.updateFieldValue('description', video.description));
      dispatch(videoFormActions.updateFieldValue('published', video.published));
      dispatch(videoFormActions.updateFieldValue('category', video.category));
    } catch (error) {
      // Handle loading error - could navigate to error route
      console.error('Failed to load video:', error);
    }
  },
  
  onLeave({ dispatch }) {
    // Clean up form state when leaving
    dispatch(videoFormActions.resetForm());
  },
});
```

## Step 5: Route Configuration

Define routes that use the form middleware:

```typescript
// routes.ts
import { createVideoMiddleware, editVideoMiddleware } from './features/videos/videoFormRoutes';

export const routes = [
  {
    path: '/',
    component: HomePage,
  },
  {
    path: '/videos',
    component: VideosPage,
  },
  {
    path: '/videos/create',
    component: VideoFormPage,
    middleware: [createVideoMiddleware],
  },
  {
    path: '/videos/:id/edit',
    component: VideoFormPage,
    middleware: [editVideoMiddleware],
  },
] as const;
```

## Step 6: Form Component

Create a reusable form component following Pi conventions:

```typescript
// components/VideoForm.tsx
import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { navigateTo } from '@pi/router';
import { videoFormActions, videoFormSelectors } from '../features/videos/videoForm';
import type { RootState, AppDispatch } from '../store/store';

export const VideoForm: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  
  // Use selectors to get form state
  const isSubmitting = useSelector(videoFormSelectors.isSubmitting);
  const isFormValid = useSelector(videoFormSelectors.isFormValid);
  const submitError = useSelector((state: RootState) => 
    videoFormSelectors.selectFormState()(state)?.submitError
  );
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await dispatch(videoFormActions.submitForm()).unwrap();
      // Navigate back to videos list on success
      dispatch(navigateTo('/videos'));
    } catch (error) {
      // Error is handled in form state automatically
      console.error('Form submission failed:', error);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="video-form">
      <h2>Video Details</h2>
      
      <TitleField />
      <UrlField />
      <DescriptionField />
      <CategoryField />
      <PublishedField />
      
      {submitError && (
        <div className="error-banner" role="alert">
          {submitError}
        </div>
      )}
      
      <div className="form-actions">
        <button
          type="button"
          onClick={() => dispatch(navigateTo('/videos'))}
          disabled={isSubmitting}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!isFormValid || isSubmitting}
          className="btn-primary"
        >
          {isSubmitting ? 'Saving...' : 'Save Video'}
        </button>
      </div>
    </form>
  );
};

// Individual field components following Pi patterns
const TitleField: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  
  // Use field-specific selector
  const fieldValue = useSelector(videoFormSelectors.selectFieldValue('title'));
  const fieldErrors = useSelector(videoFormSelectors.getFieldError('title'));
  const isValidating = useSelector((state: RootState) => {
    const formState = videoFormSelectors.selectFormState()(state);
    return formState?.fields.title.validating ?? false;
  });
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(videoFormActions.updateFieldValue('title', e.target.value));
  };
  
  const handleFocus = () => {
    dispatch(videoFormActions.focusField('title'));
  };
  
  const handleBlur = () => {
    dispatch(videoFormActions.blurField('title'));
    dispatch(videoFormActions.touchField('title'));
  };
  
  return (
    <div className="form-field">
      <label htmlFor="title">
        Title *
        {isValidating && <span className="validating-spinner" aria-label="Validating" />}
      </label>
      <input
        id="title"
        type="text"
        value={fieldValue || ''}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={fieldErrors?.length ? 'error' : ''}
        disabled={isValidating}
        aria-invalid={fieldErrors?.length > 0}
        aria-describedby={fieldErrors?.length ? 'title-error' : undefined}
      />
      {fieldErrors?.length > 0 && (
        <div id="title-error" className="field-error" role="alert">
          {fieldErrors[0]}
        </div>
      )}
    </div>
  );
};

const UrlField: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  
  const fieldValue = useSelector(videoFormSelectors.selectFieldValue('url'));
  const fieldErrors = useSelector(videoFormSelectors.getFieldError('url'));
  const isValidating = useSelector((state: RootState) => {
    const formState = videoFormSelectors.selectFormState()(state);
    return formState?.fields.url.validating ?? false;
  });
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(videoFormActions.updateFieldValue('url', e.target.value));
  };
  
  const handleFocus = () => {
    dispatch(videoFormActions.focusField('url'));
  };
  
  const handleBlur = () => {
    dispatch(videoFormActions.blurField('url'));
    dispatch(videoFormActions.touchField('url'));
    
    // Trigger async validation for URL uniqueness
    if (fieldValue && !fieldErrors?.length) {
      dispatch(videoFormActions.validateField('url'));
    }
  };
  
  return (
    <div className="form-field">
      <label htmlFor="url">
        Video URL *
        {isValidating && <span className="validating-spinner" aria-label="Validating" />}
      </label>
      <input
        id="url"
        type="url"
        value={fieldValue || ''}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={fieldErrors?.length ? 'error' : ''}
        disabled={isValidating}
        placeholder="https://example.com/video.mp4"
        aria-invalid={fieldErrors?.length > 0}
        aria-describedby={fieldErrors?.length ? 'url-error' : undefined}
      />
      {fieldErrors?.length > 0 && (
        <div id="url-error" className="field-error" role="alert">
          {fieldErrors[0]}
        </div>
      )}
    </div>
  );
};

const DescriptionField: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  
  const fieldValue = useSelector(videoFormSelectors.selectFieldValue('description'));
  const fieldErrors = useSelector(videoFormSelectors.getFieldError('description'));
  
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    dispatch(videoFormActions.updateFieldValue('description', e.target.value));
  };
  
  const handleFocus = () => {
    dispatch(videoFormActions.focusField('description'));
  };
  
  const handleBlur = () => {
    dispatch(videoFormActions.blurField('description'));
    dispatch(videoFormActions.touchField('description'));
  };
  
  return (
    <div className="form-field">
      <label htmlFor="description">Description</label>
      <textarea
        id="description"
        value={fieldValue || ''}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={fieldErrors?.length ? 'error' : ''}
        rows={4}
        placeholder="Describe your video..."
        aria-invalid={fieldErrors?.length > 0}
        aria-describedby="description-hint description-error"
      />
      <div id="description-hint" className="field-hint">
        {(fieldValue || '').length}/500 characters
      </div>
      {fieldErrors?.length > 0 && (
        <div id="description-error" className="field-error" role="alert">
          {fieldErrors[0]}
        </div>
      )}
    </div>
  );
};

const CategoryField: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  
  const fieldValue = useSelector(videoFormSelectors.selectFieldValue('category'));
  const fieldErrors = useSelector(videoFormSelectors.getFieldError('category'));
  
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(videoFormActions.updateFieldValue('category', e.target.value));
  };
  
  const handleFocus = () => {
    dispatch(videoFormActions.focusField('category'));
  };
  
  const handleBlur = () => {
    dispatch(videoFormActions.blurField('category'));
    dispatch(videoFormActions.touchField('category'));
  };
  
  return (
    <div className="form-field">
      <label htmlFor="category">Category *</label>
      <select
        id="category"
        value={fieldValue || ''}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={fieldErrors?.length ? 'error' : ''}
        aria-invalid={fieldErrors?.length > 0}
        aria-describedby={fieldErrors?.length ? 'category-error' : undefined}
      >
        <option value="">Select a category</option>
        <option value="education">Education</option>
        <option value="entertainment">Entertainment</option>
        <option value="technology">Technology</option>
        <option value="sports">Sports</option>
        <option value="music">Music</option>
      </select>
      {fieldErrors?.length > 0 && (
        <div id="category-error" className="field-error" role="alert">
          {fieldErrors[0]}
        </div>
      )}
    </div>
  );
};

const PublishedField: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  
  const fieldValue = useSelector(videoFormSelectors.selectFieldValue('published'));
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(videoFormActions.updateFieldValue('published', e.target.checked));
  };
  
  const handleFocus = () => {
    dispatch(videoFormActions.focusField('published'));
  };
  
  const handleBlur = () => {
    dispatch(videoFormActions.blurField('published'));
    dispatch(videoFormActions.touchField('published'));
  };
  
  return (
    <div className="form-field checkbox-field">
      <label>
        <input
          type="checkbox"
          checked={fieldValue || false}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        Publish immediately
      </label>
    </div>
  );
};
```

## Step 7: Form Lifecycle in Pi

The complete form lifecycle follows Pi's Redux-first principles:

1. **Route Enter** → Navigation middleware triggers form initialization
2. **User Input** → `updateFieldValue()` actions dispatch automatically
3. **Field Validation** → Sync validation runs immediately, async validation on blur/manual trigger
4. **Form Submit** → `submitForm()` thunk validates all fields and calls `onSubmit`
5. **Success/Error** → State updates automatically, UI reacts to state changes  
6. **Route Leave** → Navigation middleware cleans up form state

## Step 8: Testing Forms with Pi

Pi forms are highly testable due to their pure Redux design:

```typescript
// videoForm.test.ts
import { configureStore } from '@reduxjs/toolkit';
import { videoFormReducer, videoFormActions } from './videoForm';
import { videosAPI } from './videosAPI';

// Mock the API
jest.mock('./videosAPI');
const mockVideosAPI = videosAPI as jest.Mocked<typeof videosAPI>;

describe('Video Form', () => {
  let store: ReturnType<typeof configureStore>;
  
  beforeEach(() => {
    store = configureStore({
      reducer: {
        videoForm: videoFormReducer,
      },
    });
  });
  
  test('should initialize with empty state', () => {
    const state = store.getState().videoForm;
    
    expect(state.fields.title.value).toBe('');
    expect(state.fields.title.dirty).toBe(false);
    expect(state.fields.title.errors).toEqual([]);
    expect(state.submitting).toBe(false);
  });
  
  test('should validate required title field', () => {
    // Update field with empty value
    store.dispatch(videoFormActions.updateFieldValue('title', ''));
    
    const state = store.getState().videoForm;
    expect(state.fields.title.errors).toContain('Title is required');
  });
  
  test('should validate title length constraints', () => {
    // Test minimum length
    store.dispatch(videoFormActions.updateFieldValue('title', 'ab'));
    let state = store.getState().videoForm;
    expect(state.fields.title.errors).toContain('Title must be at least 3 characters');
    
    // Test maximum length
    const longTitle = 'a'.repeat(101);
    store.dispatch(videoFormActions.updateFieldValue('title', longTitle));
    state = store.getState().videoForm;
    expect(state.fields.title.errors).toContain('Title must be less than 100 characters');
  });
  
  test('should handle URL validation', () => {
    // Test invalid URL
    store.dispatch(videoFormActions.updateFieldValue('url', 'not-a-url'));
    let state = store.getState().videoForm;
    expect(state.fields.url.errors).toContain('Please enter a valid URL');
    
    // Test valid URL
    store.dispatch(videoFormActions.updateFieldValue('url', 'https://example.com/video.mp4'));
    state = store.getState().videoForm;
    expect(state.fields.url.errors).toEqual([]);
  });
  
  test('should handle async URL uniqueness validation', async () => {
    // Mock duplicate URL response
    mockVideosAPI.checkDuplicateUrl.mockResolvedValue(true);
    
    // Trigger async validation
    await store.dispatch(videoFormActions.validateField('url'));
    
    const state = store.getState().videoForm;
    expect(state.fields.url.errors).toContain('A video with this URL already exists');
    expect(mockVideosAPI.checkDuplicateUrl).toHaveBeenCalledTimes(1);
  });
  
  test('should track field interactions correctly', () => {
    // Test focus
    store.dispatch(videoFormActions.focusField('title'));
    let state = store.getState().videoForm;
    expect(state.fields.title.focused).toBe(true);
    expect(state.fields.title.visited).toBe(true);
    
    // Test blur
    store.dispatch(videoFormActions.blurField('title'));
    state = store.getState().videoForm;
    expect(state.fields.title.focused).toBe(false);
    
    // Test touch
    store.dispatch(videoFormActions.touchField('title'));
    state = store.getState().videoForm;
    expect(state.fields.title.touched).toBe(true);
  });
  
  test('should handle successful form submission', async () => {
    // Setup valid form data
    store.dispatch(videoFormActions.updateFieldValue('title', 'Test Video'));
    store.dispatch(videoFormActions.updateFieldValue('url', 'https://example.com/video.mp4'));
    store.dispatch(videoFormActions.updateFieldValue('category', 'education'));
    
    // Mock successful API call
    mockVideosAPI.create.mockResolvedValue({ id: '123', title: 'Test Video' });
    
    // Submit form
    await store.dispatch(videoFormActions.submitForm()).unwrap();
    
    const state = store.getState().videoForm;
    expect(state.submitting).toBe(false);
    expect(state.submitSucceeded).toBe(true);
    expect(state.submitError).toBeUndefined();
    expect(mockVideosAPI.create).toHaveBeenCalledWith({
      title: 'Test Video',
      url: 'https://example.com/video.mp4',
      description: '',
      published: false,
      category: 'education',
    });
  });
  
  test('should handle form submission errors', async () => {
    // Setup valid form data
    store.dispatch(videoFormActions.updateFieldValue('title', 'Test Video'));
    store.dispatch(videoFormActions.updateFieldValue('url', 'https://example.com/video.mp4'));
    store.dispatch(videoFormActions.updateFieldValue('category', 'education'));
    
    // Mock API error
    mockVideosAPI.create.mockRejectedValue(new Error('Network error'));
    
    // Attempt to submit form
    try {
      await store.dispatch(videoFormActions.submitForm()).unwrap();
    } catch (error) {
      // Expected to throw
    }
    
    const state = store.getState().videoForm;
    expect(state.submitting).toBe(false);
    expect(state.submitSucceeded).toBe(false);
    expect(state.submitError).toBeDefined();
  });
  
  test('should reset form state', () => {
    // Make changes to form
    store.dispatch(videoFormActions.updateFieldValue('title', 'Changed Title'));
    store.dispatch(videoFormActions.focusField('title'));
    store.dispatch(videoFormActions.touchField('title'));
    
    // Reset form
    store.dispatch(videoFormActions.resetForm());
    
    const state = store.getState().videoForm;
    expect(state.fields.title.value).toBe('');
    expect(state.fields.title.dirty).toBe(false);
    expect(state.fields.title.touched).toBe(false);
    expect(state.fields.title.focused).toBe(false);
    expect(state.fields.title.visited).toBe(false);
    expect(state.fields.title.errors).toEqual([]);
  });
});
```

## Advanced Form Patterns

### Conditional Fields

```typescript
// Show advanced options only when published is checked
const AdvancedOptionsFields: React.FC = () => {
  const publishedValue = useSelector(videoFormSelectors.selectFieldValue('published'));
  
  if (!publishedValue) return null;
  
  return (
    <div className="advanced-options">
      <h3>Publishing Options</h3>
      <ScheduleField />
      <FeaturedField />
    </div>
  );
};
```

### Field Dependencies

```typescript
// Subcategory depends on selected category
const SubcategoryField: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const categoryValue = useSelector(videoFormSelectors.selectFieldValue('category'));
  const subcategoryValue = useSelector(videoFormSelectors.selectFieldValue('subcategory'));
  
  // Get subcategories based on selected category
  const subcategories = getSubcategoriesForCategory(categoryValue);
  
  // Reset subcategory when category changes
  React.useEffect(() => {
    if (subcategoryValue && !subcategories.some(sub => sub.id === subcategoryValue)) {
      dispatch(videoFormActions.updateFieldValue('subcategory', ''));
    }
  }, [categoryValue, subcategoryValue, subcategories, dispatch]);
  
  return (
    <div className="form-field">
      <label htmlFor="subcategory">Subcategory</label>
      <select
        id="subcategory"
        value={subcategoryValue || ''}
        onChange={(e) => dispatch(videoFormActions.updateFieldValue('subcategory', e.target.value))}
        disabled={!categoryValue || subcategories.length === 0}
      >
        <option value="">Select a subcategory</option>
        {subcategories.map(sub => (
          <option key={sub.id} value={sub.id}>{sub.name}</option>
        ))}
      </select>
    </div>
  );
};
```

### Dynamic Validation

```typescript
// Validation that depends on other field values
const validatePasswordConfirm = (confirmPassword: string, getState: () => RootState): string | undefined => {
  const state = getState();
  const passwordValue = videoFormSelectors.selectFieldValue('password')(state);
  
  if (confirmPassword && confirmPassword !== passwordValue) {
    return 'Passwords do not match';
  }
  
  return undefined;
};
```

## Benefits of Pi's Form Architecture

1. **Complete Observability** - Every form interaction is visible in Redux DevTools
2. **Deterministic Testing** - Forms are pure functions of Redux state  
3. **Time-Travel Debugging** - Step through form interactions to debug issues
4. **AI-Friendly** - Machines can understand and generate form logic
5. **Framework Agnostic** - Works with any UI framework or headless environments
6. **Reusable Patterns** - Consistent form handling across the application
7. **Error Recovery** - Robust error handling with clear user feedback
8. **Serializable State** - Forms can be persisted, rehydrated, or time-traveled
9. **Request Deduplication** - Built-in middleware prevents duplicate async operations
10. **Zero Runtime Registration** - Forms are created once via code generation

## Best Practices

### Form Organization
- Keep validator functions pure and testable
- Use TypeScript interfaces to define form data shapes  
- Co-locate form logic with related features
- Use descriptive `formId`s that match your domain

### Validation Strategy
- Use synchronous validators for immediate feedback
- Reserve async validators for server-side checks
- Keep validation logic simple and focused
- Test validators independently from components

### Error Handling
- Always handle both field-level and form-level errors
- Provide clear, actionable error messages
- Use proper ARIA attributes for accessibility
- Show loading states during async operations

### Performance
- Use memoized selectors to prevent unnecessary re-renders
- Debounce expensive async validations if needed
- Clean up form state when leaving routes
- Leverage Redux DevTools for performance debugging

## Next Steps

- [**Modals and Dialogs**](/tutorials/modals/) - Learn how to implement forms in modals
- [**Testing Guide**](/guides/testing/) - Comprehensive testing strategies for Pi applications
- [**Performance Optimization**](/guides/performance/) - Optimizing forms for large applications

## Key Concepts Mastered

In this tutorial, you've implemented:

1. **Redux-Only Forms** - Pure Redux state management without framework coupling
2. **Declarative Validation** - Both synchronous and asynchronous validation patterns
3. **Navigation Integration** - Forms managed through Pi's route lifecycle
4. **Reusable Components** - Individual field components with consistent patterns
5. **Comprehensive Testing** - Forms tested as pure Redux logic
6. **Accessibility** - Proper ARIA attributes and semantic HTML
7. **Error Handling** - Robust error states and user feedback
8. **Type Safety** - Full TypeScript integration for form data and validation
9. **Middleware Integration** - Request deduplication and async operation management
10. **Performance Optimization** - Efficient state updates and minimal re-renders

You now have the foundation to build complex, maintainable forms that scale with your Pi application while maintaining complete observability and testability.