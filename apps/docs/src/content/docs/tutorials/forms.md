---
title: Forms and Validation
description: Learn how to build forms with validation in Pi using Redux-first principles
---

In this tutorial, you'll learn how to build robust forms with validation in Pi. We'll create a comprehensive form system that follows Pi's Redux-first principles while providing an excellent developer experience.

By the end of this tutorial, you'll understand:
- How to manage form state in Redux following Pi conventions
- Implementing synchronous and asynchronous validation
- Creating reusable form components
- Handling form submission with error recovery
- Testing form behavior effectively

## Form Architecture in Pi

Pi takes a unique approach to forms by treating all form state as Redux state. This provides several benefits:

- **Complete observability** - Every keystroke and validation error is visible in Redux DevTools
- **Time-travel debugging** - Step through form interactions to debug issues
- **Deterministic testing** - Forms are pure functions of Redux state
- **AI-friendly** - Machines can understand and generate form logic

## The createFormSlice Factory

Pi provides a `createFormSlice` factory that eliminates form boilerplate while maintaining full Redux transparency:

```typescript
// utils/createFormSlice.ts
interface FieldConfig<T> {
  defaultValue: T;
  validateSync?: (value: T) => string | null;
  validateAsync?: (value: T) => Promise<void>; // Throws on error
}

interface FormConfig<F extends Record<string, FieldConfig<any>>> {
  slice: string;
  fields: F;
  load?: (id: string) => Promise<Partial<FieldValues<F>>>;
  submit: (id: string | undefined, data: FieldValues<F>) => Promise<void>;
}

export function createFormSlice<F extends Record<string, FieldConfig<any>>>(
  config: FormConfig<F>
) {
  // Implementation creates Redux slice with all necessary reducers
  // Returns { slice, actions, thunks, selectors }
}
```

## Step 1: Define a Video Form

Let's create a comprehensive video form with validation:

```typescript
// features/videos/videoForm.ts
import { createFormSlice } from '../../utils/createFormSlice';
import { videosAPI } from './videosAPI';

// Validation functions
const validateTitle = (title: string): string | null => {
  if (!title.trim()) return 'Title is required';
  if (title.length < 3) return 'Title must be at least 3 characters';
  if (title.length > 100) return 'Title must be less than 100 characters';
  return null;
};

const validateUrl = async (url: string): Promise<void> => {
  if (!url.trim()) throw new Error('URL is required');
  
  // Check URL format
  try {
    new URL(url);
  } catch {
    throw new Error('Please enter a valid URL');
  }
  
  // Check for duplicates (async validation)
  const isDuplicate = await videosAPI.checkDuplicateUrl(url);
  if (isDuplicate) {
    throw new Error('A video with this URL already exists');
  }
};

const validateDescription = (description: string): string | null => {
  if (description.length > 500) return 'Description must be less than 500 characters';
  return null;
};

// Create the form slice
export const videoForm = createFormSlice({
  slice: 'videoForm',
  
  fields: {
    title: {
      defaultValue: '',
      validateSync: validateTitle,
    },
    url: {
      defaultValue: '',
      validateSync: (url) => url.trim() ? null : 'URL is required',
      validateAsync: validateUrl,
    },
    description: {
      defaultValue: '',
      validateSync: validateDescription,
    },
    published: {
      defaultValue: false,
    },
    category: {
      defaultValue: '',
      validateSync: (category) => category ? null : 'Please select a category',
    },
  },
  
  load: async (id: string) => {
    const video = await videosAPI.getById(id);
    return {
      title: video.title,
      url: video.url,
      description: video.description,
      published: video.published,
      category: video.category,
    };
  },
  
  submit: async (id: string | undefined, data) => {
    if (id) {
      return videosAPI.update({ id, ...data });
    } else {
      return videosAPI.create(data);
    }
  },
});

// Export generated artifacts
export const {
  // Redux slice
  slice: videoFormSlice,
  
  // Actions
  actions: {
    fieldChange,
    reset: resetForm,
    setFieldError,
    clearFieldError,
  },
  
  // Async thunks
  thunks: {
    load: loadVideoForm,
    submit: submitVideoForm,
    validateUrl: validateUrlField,
  },
  
  // Selectors
  selectors: {
    useForm: useVideoForm,
    useField: useVideoFormField,
    getFormState: getVideoFormState,
  },
} = videoForm;
```

## Step 2: Form State Shape

The `createFormSlice` generates a predictable state shape:

```typescript
interface VideoFormState {
  fields: {
    title: {
      value: string;
      touched: boolean;
      error: string | null;
      validating: boolean;
    };
    url: {
      value: string;
      touched: boolean;
      error: string | null;
      validating: boolean;
    };
    description: {
      value: string;
      touched: boolean;
      error: string | null;
      validating: boolean;
    };
    published: {
      value: boolean;
      touched: boolean;
      error: string | null;
      validating: boolean;
    };
    category: {
      value: string;
      touched: boolean;
      error: string | null;
      validating: boolean;
    };
  };
  submitting: boolean;
  submitError: string | null;
  dirty: boolean;
  valid: boolean;
  lastSaved: number | null;
}
```

## Step 3: Navigation Middleware Integration

Integrate the form with Pi's navigation system:

```typescript
// features/videos/videoFormMiddleware.ts
import { createNavigationMiddleware } from '@pi/router';
import { loadVideoForm, resetForm } from './videoForm';

// Create video modal middleware
export const createVideoModalMw = createNavigationMiddleware({
  onEnter({ dispatch }) {
    // Initialize form for creation
    dispatch(resetForm());
  },
  
  onLeave({ dispatch }) {
    // Clean up form state
    dispatch(resetForm());
  },
});

// Edit video modal middleware
export const editVideoModalMw = createNavigationMiddleware({
  async onEnter({ params, dispatch }) {
    // Load existing video data
    dispatch(loadVideoForm(params.id));
  },
  
  onLeave({ dispatch }) {
    // Clean up form state
    dispatch(resetForm());
  },
});
```

## Step 4: Form Component

Create a reusable form component:

```typescript
// components/VideoForm.tsx
import React from 'react';
import { useDispatch } from 'react-redux';
import { navigateTo } from '@pi/router';
import { 
  useVideoForm, 
  useVideoFormField, 
  fieldChange, 
  submitVideoForm,
  validateUrlField 
} from '../features/videos/videoForm';

interface VideoFormProps {
  videoId?: string; // undefined for create, string for edit
  onSuccess?: () => void;
}

export const VideoForm: React.FC<VideoFormProps> = ({ videoId, onSuccess }) => {
  const dispatch = useDispatch();
  const form = useVideoForm();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await dispatch(submitVideoForm({ id: videoId })).unwrap();
      onSuccess?.();
    } catch (error) {
      // Error is handled in form state
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="video-form">
      <h2>{videoId ? 'Edit Video' : 'Create Video'}</h2>
      
      <TitleField />
      <UrlField />
      <DescriptionField />
      <CategoryField />
      <PublishedField />
      
      {form.submitError && (
        <div className="error-banner">{form.submitError}</div>
      )}
      
      <div className="form-actions">
        <button
          type="button"
          onClick={() => dispatch(navigateTo('../'))}
          disabled={form.submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!form.valid || form.submitting}
          className="btn-primary"
        >
          {form.submitting ? 'Saving...' : 'Save Video'}
        </button>
      </div>
    </form>
  );
};

// Individual field components
const TitleField: React.FC = () => {
  const dispatch = useDispatch();
  const field = useVideoFormField('title');
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(fieldChange({ field: 'title', value: e.target.value }));
  };
  
  return (
    <div className="form-field">
      <label htmlFor="title">
        Title *
        {field.validating && <span className="validating-spinner" />}
      </label>
      <input
        id="title"
        type="text"
        value={field.value}
        onChange={handleChange}
        className={field.error ? 'error' : ''}
        disabled={field.validating}
      />
      {field.error && <div className="field-error">{field.error}</div>}
    </div>
  );
};

const UrlField: React.FC = () => {
  const dispatch = useDispatch();
  const field = useVideoFormField('url');
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(fieldChange({ field: 'url', value: e.target.value }));
  };
  
  const handleBlur = () => {
    if (field.value && !field.error) {
      // Trigger async validation on blur
      dispatch(validateUrlField(field.value));
    }
  };
  
  return (
    <div className="form-field">
      <label htmlFor="url">
        Video URL *
        {field.validating && <span className="validating-spinner" />}
      </label>
      <input
        id="url"
        type="url"
        value={field.value}
        onChange={handleChange}
        onBlur={handleBlur}
        className={field.error ? 'error' : ''}
        disabled={field.validating}
        placeholder="https://example.com/video.mp4"
      />
      {field.error && <div className="field-error">{field.error}</div>}
    </div>
  );
};

const DescriptionField: React.FC = () => {
  const dispatch = useDispatch();
  const field = useVideoFormField('description');
  
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    dispatch(fieldChange({ field: 'description', value: e.target.value }));
  };
  
  return (
    <div className="form-field">
      <label htmlFor="description">Description</label>
      <textarea
        id="description"
        value={field.value}
        onChange={handleChange}
        className={field.error ? 'error' : ''}
        rows={4}
        placeholder="Describe your video..."
      />
      <div className="field-hint">
        {field.value.length}/500 characters
      </div>
      {field.error && <div className="field-error">{field.error}</div>}
    </div>
  );
};

const CategoryField: React.FC = () => {
  const dispatch = useDispatch();
  const field = useVideoFormField('category');
  
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(fieldChange({ field: 'category', value: e.target.value }));
  };
  
  return (
    <div className="form-field">
      <label htmlFor="category">Category *</label>
      <select
        id="category"
        value={field.value}
        onChange={handleChange}
        className={field.error ? 'error' : ''}
      >
        <option value="">Select a category</option>
        <option value="education">Education</option>
        <option value="entertainment">Entertainment</option>
        <option value="technology">Technology</option>
        <option value="sports">Sports</option>
        <option value="music">Music</option>
      </select>
      {field.error && <div className="field-error">{field.error}</div>}
    </div>
  );
};

const PublishedField: React.FC = () => {
  const dispatch = useDispatch();
  const field = useVideoFormField('published');
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(fieldChange({ field: 'published', value: e.target.checked }));
  };
  
  return (
    <div className="form-field checkbox-field">
      <label>
        <input
          type="checkbox"
          checked={field.value}
          onChange={handleChange}
        />
        Publish immediately
      </label>
    </div>
  );
};
```

## Step 5: Form Lifecycle Management

The complete form lifecycle in Pi:

1. **Route Enter** → `resetForm()` or `loadVideoForm(id)`
2. **User Input** → `fieldChange()` actions dispatch automatically
3. **Field Validation** → Sync validation runs immediately, async on blur
4. **Form Submit** → `submitVideoForm()` thunk handles API call
5. **Success/Error** → State updates, form resets or shows errors
6. **Route Leave** → `resetForm()` cleans up state

## Step 6: Testing Forms

Pi forms are highly testable due to their Redux-first design:

```typescript
// videoForm.test.ts
import { createStore } from '@reduxjs/toolkit';
import { videoFormSlice, fieldChange, submitVideoForm } from './videoForm';

describe('Video Form', () => {
  let store: ReturnType<typeof createStore>;
  
  beforeEach(() => {
    store = createStore(videoFormSlice.reducer);
  });
  
  test('validates required title field', () => {
    store.dispatch(fieldChange({ field: 'title', value: '' }));
    
    const state = store.getState();
    expect(state.fields.title.error).toBe('Title is required');
    expect(state.valid).toBe(false);
  });
  
  test('validates title length', () => {
    store.dispatch(fieldChange({ field: 'title', value: 'ab' }));
    
    const state = store.getState();
    expect(state.fields.title.error).toBe('Title must be at least 3 characters');
  });
  
  test('async URL validation', async () => {
    // Mock API response
    jest.spyOn(videosAPI, 'checkDuplicateUrl').mockResolvedValue(true);
    
    await store.dispatch(validateUrlField('https://example.com/duplicate'));
    
    const state = store.getState();
    expect(state.fields.url.error).toBe('A video with this URL already exists');
  });
  
  test('successful form submission', async () => {
    // Setup valid form data
    store.dispatch(fieldChange({ field: 'title', value: 'Test Video' }));
    store.dispatch(fieldChange({ field: 'url', value: 'https://example.com/video' }));
    store.dispatch(fieldChange({ field: 'category', value: 'education' }));
    
    // Mock successful API call
    jest.spyOn(videosAPI, 'create').mockResolvedValue(mockVideo);
    
    await store.dispatch(submitVideoForm({ id: undefined }));
    
    const state = store.getState();
    expect(state.submitting).toBe(false);
    expect(state.submitError).toBe(null);
    expect(state.lastSaved).toBeGreaterThan(0);
  });
});
```

## Advanced Form Patterns

### Conditional Fields

```typescript
// Show advanced options only when published is checked
const AdvancedOptionsField: React.FC = () => {
  const publishedField = useVideoFormField('published');
  
  if (!publishedField.value) return null;
  
  return (
    <div className="advanced-options">
      {/* Additional fields */}
    </div>
  );
};
```

### Field Dependencies

```typescript
// Category affects available subcategories
const SubcategoryField: React.FC = () => {
  const categoryField = useVideoFormField('category');
  const subcategoryField = useVideoFormField('subcategory');
  
  const subcategories = getSubcategoriesForCategory(categoryField.value);
  
  return (
    <select value={subcategoryField.value} /* ... */>
      {subcategories.map(sub => (
        <option key={sub.id} value={sub.id}>{sub.name}</option>
      ))}
    </select>
  );
};
```

## Benefits of Pi's Form Architecture

1. **Complete Observability** - Every form interaction is visible in Redux DevTools
2. **Deterministic Testing** - Forms are pure functions of Redux state
3. **Time-Travel Debugging** - Step through form interactions to debug issues
4. **AI-Friendly** - Machines can understand and generate form logic
5. **Reusable Patterns** - Consistent form handling across the application
6. **Error Recovery** - Robust error handling with clear user feedback

## Next Steps

- [**Modals and Dialogs**](/tutorials/modals/) - Learn how to implement forms in modals
- [**Testing Forms**](/guides/testing/) - Comprehensive form testing strategies  
- [**Form Validation Reference**](/reference/validation/) - Complete validation patterns

## Key Concepts Learned

In this tutorial, you've implemented:

1. **Redux-First Forms** - All form state lives in Redux store
2. **Declarative Validation** - Both sync and async validation patterns
3. **Navigation Integration** - Forms managed through route lifecycle
4. **Reusable Components** - Individual field components with consistent patterns
5. **Comprehensive Testing** - Forms are easily testable as pure Redux logic