---
title: Modals and Dialogs
description: Learn how to implement modals and dialogs in Pi using URL-addressable routes
---

In this tutorial, you'll learn how to implement modals and dialogs in Pi. Unlike traditional approaches that manage modal state locally, Pi makes modals **URL-addressable** by mapping them to child routes. This provides deep-linking, time-travel debugging, and complete observability.

By the end of this tutorial, you'll understand:
- How to implement URL-addressable modals using nested routes
- Creating accessible modal components with focus management
- Handling modal lifecycle with navigation middleware
- Building different types of modals: forms, confirmations, and wizards
- Testing modal behavior effectively

## Modal Philosophy in Pi

In Pi, the route hierarchy **is** the UI state. Therefore, the most "thematic" way to expose a modal is to map it onto a child route. This guarantees:

- **Deep-linking** — `/videos/123/edit` opens the modal directly
- **Time-travel** and **headless testing** — the URI plus Redux actions fully reproduces the view
- **Deterministic rendering** — components remain pure, emitting only actions

## Modal Taxonomy

| Type | Deep-link? | Interaction Scope | Pattern |
|------|------------|-------------------|---------|
| **Form Modal** (create/edit) | Yes | Single entity | URL addressable route |
| **Confirmation** (delete) | Yes | Context-sensitive | Nested route or inline |
| **Wizard** (multi-step) | Yes | Complex workflow | Chained modal routes |
| **Side Drawer** | Yes | Supplementary content | Route + CSS transforms |
| **Toast/Alert** | No | Ephemeral feedback | `modalStack` slice |

## Step 1: Basic Modal Route Structure

Let's start with a simple edit video modal:

```typescript
// routes.ts - Nested modal routes
export const routes: Route[] = [
  {
    path: "/",
    component: Shell,
    children: [
      {
        path: "videos/:id",
        component: VideoDetailPage,
        middleware: [videoDetailMw],
        children: [
          {
            path: "edit", // Modal segment
            component: EditVideoModal,
            middleware: [editVideoModalMw],
          },
          {
            path: "delete", // Confirmation modal
            component: DeleteVideoModal,
            middleware: [deleteVideoModalMw],
          },
        ],
      },
      {
        path: "videos",
        component: VideosPage,
        middleware: [videosListMw],
        children: [
          {
            path: "create", // Create modal
            component: CreateVideoModal,
            middleware: [createVideoModalMw],
          },
        ],
      },
    ],
  },
];
```

## Step 2: Modal State Management

Create a slice for managing modal-specific state:

```typescript
// features/modals/editVideoModalSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Video } from '../videos/types';

interface EditVideoModalState {
  // Form data
  draft: Partial<Video> | null;
  
  // Operation states
  loading: boolean;
  saving: boolean;
  error: string | null;
  
  // Validation state
  fieldErrors: Record<string, string>;
  touched: Record<string, boolean>;
}

const initialState: EditVideoModalState = {
  draft: null,
  loading: false,
  saving: false,
  error: null,
  fieldErrors: {},
  touched: {},
};

const editVideoModalSlice = createSlice({
  name: 'editVideoModal',
  initialState,
  reducers: {
    // Load operations
    loadRequest: (state) => {
      state.loading = true;
      state.error = null;
    },
    loadSuccess: (state, action: PayloadAction<Video>) => {
      state.loading = false;
      state.draft = { ...action.payload };
    },
    loadFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    
    // Form operations
    updateField: (state, action: PayloadAction<{field: keyof Video, value: any}>) => {
      if (state.draft) {
        state.draft[action.payload.field] = action.payload.value;
        state.touched[action.payload.field] = true;
        // Clear field error when user types
        delete state.fieldErrors[action.payload.field];
      }
    },
    
    setFieldError: (state, action: PayloadAction<{field: string, error: string}>) => {
      state.fieldErrors[action.payload.field] = action.payload.error;
    },
    
    clearFieldError: (state, action: PayloadAction<string>) => {
      delete state.fieldErrors[action.payload];
    },
    
    // Save operations
    saveRequest: (state) => {
      state.saving = true;
      state.error = null;
    },
    saveSuccess: (state) => {
      state.saving = false;
      // Keep draft for optimistic updates
    },
    saveFailure: (state, action: PayloadAction<string>) => {
      state.saving = false;
      state.error = action.payload;
    },
    
    // Cleanup
    reset: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  loadRequest,
  loadSuccess,
  loadFailure,
  updateField,
  setFieldError,
  clearFieldError,
  saveRequest,
  saveSuccess,
  saveFailure,
  reset,
} = editVideoModalSlice.actions;

export default editVideoModalSlice.reducer;
```

## Step 3: Navigation Middleware for Modal Lifecycle

```typescript
// features/modals/editVideoModalMiddleware.ts
import { createNavigationMiddleware } from '@pi/router';
import { videosAPI } from '../videos/videosAPI';
import {
  loadRequest,
  loadSuccess,
  loadFailure,
  reset,
  saveRequest,
  saveSuccess,
  saveFailure,
} from './editVideoModalSlice';

export const editVideoModalMw = createNavigationMiddleware({
  // Load video data when modal opens
  async onEnter({ params, dispatch }) {
    dispatch(loadRequest());
    try {
      const video = await videosAPI.getById(params.id);
      dispatch(loadSuccess(video));
    } catch (error) {
      dispatch(loadFailure((error as Error).message));
    }
  },
  
  // Clean up state when modal closes
  onLeave({ dispatch }) {
    dispatch(reset());
  },
  
  // Handle errors during navigation
  onError({ error, dispatch }) {
    dispatch(loadFailure((error as Error).message));
  },
});

// Thunk for saving video
export const saveVideo = (videoId: string, data: Partial<Video>) => 
  async (dispatch: any) => {
    dispatch(saveRequest());
    try {
      const updatedVideo = await videosAPI.update({ id: videoId, ...data });
      dispatch(saveSuccess());
      
      // Update the videos list if it exists
      dispatch({ type: 'videos/updateInList', payload: updatedVideo });
      
      return updatedVideo;
    } catch (error) {
      dispatch(saveFailure((error as Error).message));
      throw error;
    }
  };
```

## Step 4: Accessible Modal Component

Create a fully accessible modal component with proper focus management:

```typescript
// components/EditVideoModal.tsx
import React, { useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { navigateTo } from '@pi/router';
import { RootState } from '../../store';
import { updateField, setFieldError } from '../features/modals/editVideoModalSlice';
import { saveVideo } from '../features/modals/editVideoModalMiddleware';

export const EditVideoModal: React.FC = () => {
  const dispatch = useDispatch();
  const { draft, loading, saving, error, fieldErrors } = useSelector(
    (state: RootState) => state.editVideoModal
  );
  const routeParams = useSelector(selectRouteParams);
  
  // Focus management
  const modalRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  
  useEffect(() => {
    // Store the element that opened the modal
    openerRef.current = document.activeElement as HTMLElement;
    
    // Focus the modal
    modalRef.current?.focus();
    
    // Trap focus within modal
    const trapFocus = (e: FocusEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        modalRef.current.focus();
      }
    };
    
    document.addEventListener('focusin', trapFocus);
    
    return () => {
      document.removeEventListener('focusin', trapFocus);
      // Restore focus to opener
      openerRef.current?.focus();
    };
  }, []);
  
  // Event handlers
  const handleClose = () => {
    dispatch(navigateTo('../')); // Navigate back to parent route
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };
  
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) {
      handleClose();
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!draft) return;
    
    // Client-side validation
    const errors: Record<string, string> = {};
    
    if (!draft.title?.trim()) {
      errors.title = 'Title is required';
    }
    
    if (!draft.url?.trim()) {
      errors.url = 'URL is required';
    } else {
      try {
        new URL(draft.url);
      } catch {
        errors.url = 'Please enter a valid URL';
      }
    }
    
    // Set field errors if any
    Object.entries(errors).forEach(([field, errorMsg]) => {
      dispatch(setFieldError({ field, error: errorMsg }));
    });
    
    if (Object.keys(errors).length > 0) return;
    
    // Save video
    try {
      await dispatch(saveVideo(routeParams.id, draft));
      handleClose(); // Close modal on success
    } catch (error) {
      // Error is handled in slice
    }
  };
  
  const handleFieldChange = (field: keyof Video) => 
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      dispatch(updateField({ field, value: e.target.value }));
    };
  
  // Render loading state
  if (loading || !draft) {
    return (
      <ModalOverlay>
        <ModalContent>
          <div className="loading-spinner">Loading video...</div>
        </ModalContent>
      </ModalOverlay>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <ModalOverlay>
        <ModalContent>
          <div className="error-state">
            <h2>Error Loading Video</h2>
            <p>{error}</p>
            <button onClick={handleClose}>Close</button>
          </div>
        </ModalContent>
      </ModalOverlay>
    );
  }
  
  // Render form
  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      tabIndex={-1}
      className="modal-overlay"
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <header className="modal-header">
            <h2 id="modal-title">Edit Video</h2>
            <button
              type="button"
              className="modal-close"
              onClick={handleClose}
              aria-label="Close modal"
            >
              ×
            </button>
          </header>
          
          <div className="modal-body">
            <div className="form-field">
              <label htmlFor="title">Title *</label>
              <input
                id="title"
                type="text"
                value={draft.title || ''}
                onChange={handleFieldChange('title')}
                className={fieldErrors.title ? 'error' : ''}
                disabled={saving}
              />
              {fieldErrors.title && (
                <div className="field-error">{fieldErrors.title}</div>
              )}
            </div>
            
            <div className="form-field">
              <label htmlFor="url">Video URL *</label>
              <input
                id="url"
                type="url"
                value={draft.url || ''}
                onChange={handleFieldChange('url')}
                className={fieldErrors.url ? 'error' : ''}
                disabled={saving}
                placeholder="https://example.com/video.mp4"
              />
              {fieldErrors.url && (
                <div className="field-error">{fieldErrors.url}</div>
              )}
            </div>
            
            <div className="form-field">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={draft.description || ''}
                onChange={handleFieldChange('description')}
                disabled={saving}
                rows={4}
              />
            </div>
            
            {error && (
              <div className="submit-error">{error}</div>
            )}
          </div>
          
          <footer className="modal-footer">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

// Reusable modal layout components
const ModalOverlay: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="fixed inset-0 grid place-items-center bg-black/60 z-50">
    {children}
  </div>
);

const ModalContent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="w-full max-w-lg rounded bg-white p-6 shadow-lg">
    {children}
  </div>
);
```

## Step 5: Different Modal Types

### Confirmation Modal

```typescript
// components/DeleteVideoModal.tsx
export const DeleteVideoModal: React.FC = () => {
  const dispatch = useDispatch();
  const { current } = useSelector((state: RootState) => state.videos);
  const [deleting, setDeleting] = useState(false);
  
  const handleConfirm = async () => {
    if (!current) return;
    
    setDeleting(true);
    try {
      await dispatch(deleteVideo(current.id));
      dispatch(navigateTo('../../')); // Navigate to videos list
    } catch (error) {
      setDeleting(false);
    }
  };
  
  return (
    <ModalOverlay>
      <ModalContent>
        <h2>Delete Video</h2>
        <p>Are you sure you want to delete "{current?.title}"?</p>
        <p>This action cannot be undone.</p>
        
        <div className="modal-actions">
          <button onClick={() => dispatch(navigateTo('../'))}>
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="btn-danger"
          >
            {deleting ? 'Deleting...' : 'Delete Video'}
          </button>
        </div>
      </ModalContent>
    </ModalOverlay>
  );
};
```

### Wizard Modal (Multi-step)

```typescript
// routes.ts - Wizard with multiple steps
{
  path: "videos/upload",
  component: UploadWizardModal,
  children: [
    { path: "", component: UploadStep1 },      // File selection
    { path: "step2", component: UploadStep2 }, // Metadata
    { path: "step3", component: UploadStep3 }, // Confirmation
  ],
}
```

## Step 6: CSS for Modal Animations

```css
/* Modal animations */
.modal-overlay {
  animation: fadeIn 0.2s ease-out;
}

.modal-content {
  animation: slideIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from { 
    transform: translateY(-20px) scale(0.95);
    opacity: 0;
  }
  to { 
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

/* Focus styles */
.modal-overlay:focus {
  outline: none;
}

.modal-content {
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
              0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

/* Error states */
.field-error {
  color: #dc2626;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.submit-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  padding: 0.75rem;
  border-radius: 0.375rem;
  margin-bottom: 1rem;
}
```

## Step 7: Testing Modals

Pi's URL-addressable modals are highly testable:

```typescript
// editVideoModal.test.ts
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { EditVideoModal } from './EditVideoModal';
import { store } from '../../store';

test('opens modal via navigation', async () => {
  // Navigate to modal route
  store.dispatch(navigateTo('/videos/123/edit'));
  
  await waitFor(() => {
    expect(store.getState().router.current?.path).toBe('/videos/123/edit');
  });
  
  render(
    <Provider store={store}>
      <EditVideoModal />
    </Provider>
  );
  
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
});

test('closes modal with escape key', async () => {
  const user = userEvent.setup();
  
  render(
    <Provider store={store}>
      <EditVideoModal />
    </Provider>
  );
  
  await user.keyboard('{Escape}');
  
  await waitFor(() => {
    expect(store.getState().router.current?.path).toBe('/videos/123');
  });
});

test('saves video and closes modal', async () => {
  const user = userEvent.setup();
  
  render(
    <Provider store={store}>
      <EditVideoModal />
    </Provider>
  );
  
  await user.type(screen.getByLabelText(/title/i), 'Updated Title');
  await user.click(screen.getByRole('button', { name: /save/i }));
  
  await waitFor(() => {
    expect(store.getState().router.current?.path).toBe('/videos/123');
  });
});
```

## Advanced Modal Patterns

### Stacked Modals

```typescript
// Modal within modal
{
  path: "videos/:id/edit",
  component: EditVideoModal,
  children: [
    {
      path: "confirm-save",
      component: ConfirmSaveModal,
    },
  ],
}
```

### Side Drawer

```typescript
// Same routing pattern, different CSS
.drawer {
  position: fixed;
  right: 0;
  top: 0;
  height: 100vh;
  width: 400px;
  transform: translateX(100%);
  transition: transform 0.3s ease;
}

.drawer[data-open="true"] {
  transform: translateX(0);
}
```

## Benefits of Pi's Modal Architecture

1. **Deep Linking** - Modals are directly addressable via URL
2. **Browser Navigation** - Back button works naturally
3. **Time Travel** - Full state history including modal interactions
4. **Testing** - Easy to test modal behavior with navigation
5. **Accessibility** - Proper focus management and ARIA attributes
6. **Observability** - All modal state changes are visible in Redux DevTools

## Next Steps

- [**Form Validation**](/tutorials/forms/) - Add comprehensive validation to modal forms
- [**Testing Modals**](/guides/testing/) - Advanced modal testing strategies
- [**Modal Reference**](/reference/modals/) - Complete modal component patterns

## Key Concepts Learned

In this tutorial, you've implemented:

1. **URL-Addressable Modals** - Modals as nested routes for deep linking
2. **Modal Lifecycle Management** - Navigation middleware for modal state
3. **Accessible Components** - Proper focus trapping and ARIA attributes  
4. **Form Integration** - Combining modals with Pi's form patterns
5. **Testing Strategies** - How to test modal interactions effectively