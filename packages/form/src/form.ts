import { createSelector, createAction, createAsyncThunk, createReducer } from '@reduxjs/toolkit';
import type { Reducer, Middleware, Dispatch, PayloadAction } from '@reduxjs/toolkit';

export type Validator<V> = (value: V) => string | undefined;
export type AsyncValidator<V> = (value: V) => Promise<string | undefined>;

// Action payload type definitions
interface UpdateFieldValuePayload {
  path: string;
  value: unknown;
}

interface FieldActionPayload {
  path: string;
}

interface ValidationStartPayload {
  path: string;
  requestId: number;
}

interface ValidationSuccessPayload {
  path: string;
  requestId: number;
  errors: string[];
}

interface ValidationFailurePayload {
  path: string;
  requestId: number;
  error: string;
}

interface SubmitStartPayload {
  requestId: number;
}

interface SubmitSuccessPayload {
  requestId: number;
}

interface SubmitFailurePayload {
  requestId: number;
  error: string;
}

export interface FieldConfig<V = unknown> {
  initialValue: V;
  validators?: Array<Validator<V>>;
  asyncValidators?: Array<AsyncValidator<V>>;
}

export interface FormConfig<T extends Record<string, unknown>> {
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

export interface FieldState<V = unknown> {
  value: V;
  initialValue: V;
  dirty: boolean;
  touched: boolean;
  visited: boolean;
  focused: boolean;
  validating: boolean;
  errors: string[];
}

export interface FormState<T = Record<string, unknown>> {
  submitting: boolean;
  submitSucceeded: boolean;
  submitError: string | undefined;
  requestId: number;
  fields: {
    [K in keyof T]: FieldState<T[K]>;
  };
}

export interface FormSelectors<T extends Record<string, unknown>> {
  selectFormState: () => <RootState>(state: RootState) => FormState<T> | undefined;
  selectFieldValue: <K extends keyof T>(path: K) => <RootState>(state: RootState) => T[K] | undefined;
  getFieldError: (path: keyof T) => <RootState>(state: RootState) => string[] | undefined;
  isSubmitting: <RootState>(state: RootState) => boolean;
  isValidationPending: <RootState>(state: RootState) => boolean;
  isFormValid: <RootState>(state: RootState) => boolean;
  isFieldDirty: (path: keyof T) => <RootState>(state: RootState) => boolean;
  isFormDirty: <RootState>(state: RootState) => boolean;
  getDirtyFields: <RootState>(state: RootState) => (keyof T)[];
}

export interface FormActions<T extends Record<string, unknown>> {
  updateFieldValue: <K extends keyof T>(path: K, value: T[K]) => PayloadAction<UpdateFieldValuePayload>;
  focusField: (path: keyof T) => PayloadAction<FieldActionPayload>;
  blurField: (path: keyof T) => PayloadAction<FieldActionPayload>;
  touchField: (path: keyof T) => PayloadAction<FieldActionPayload>;
  resetForm: () => PayloadAction<void>;
  validateField: (path: keyof T) => any;
  validateForm: () => any;
  submitForm: () => any;
}

export interface FormArtifacts<T extends Record<string, unknown>> {
  reducer: Reducer<FormState<T>>;
  selectors: FormSelectors<T>;
  actions: FormActions<T>;
  middleware?: Middleware;
}


function createFormActions<T extends Record<string, unknown>>(formId: string, config: FormConfig<T>) {
  const prefix = `form/${formId}`;

  // Basic field actions
  const updateFieldValue = createAction<UpdateFieldValuePayload>(`${prefix}/updateFieldValue`);
  const focusField = createAction<FieldActionPayload>(`${prefix}/focusField`);
  const blurField = createAction<FieldActionPayload>(`${prefix}/blurField`);
  const touchField = createAction<FieldActionPayload>(`${prefix}/touchField`);
  const resetForm = createAction(`${prefix}/resetForm`);

  // Validation actions
  const validationStart = createAction<ValidationStartPayload>(`${prefix}/validationStart`);
  const validationSuccess = createAction<ValidationSuccessPayload>(`${prefix}/validationSuccess`);
  const validationFailure = createAction<ValidationFailurePayload>(`${prefix}/validationFailure`);

  // Submit actions (legacy - keeping for backward compatibility but not exposed in public API)
  // These are used in the reducer for legacy support
  createAction<SubmitStartPayload>(`${prefix}/submitStart`);
  createAction<SubmitSuccessPayload>(`${prefix}/submitSuccess`);
  createAction<SubmitFailurePayload>(`${prefix}/submitFailure`);

  // Thunk for validating a single field
  const validateField = createAsyncThunk(
    `${prefix}/validateField`,
    async (fieldPath: string, { dispatch, getState }) => {
      const state = getState() as any;
      const formState: FormState<T> = state[config.formId];
      const requestId = formState.requestId + 1;
      
      const fieldConfig = config.fields[fieldPath as keyof T];
      const fieldState = formState.fields[fieldPath as keyof T];
      
      if (!fieldConfig || !fieldState) {
        return;
      }

      dispatch(validationStart({ path: fieldPath, requestId }));

      try {
        // Run sync validators
        const syncErrors: string[] = [];
        if (fieldConfig.validators) {
          for (const validator of fieldConfig.validators) {
            const error = validator(fieldState.value);
            if (error) {
              syncErrors.push(error);
              break; // First error wins for sync validators
            }
          }
        }

        // Run async validators if no sync errors
        if (syncErrors.length === 0 && fieldConfig.asyncValidators) {
          for (const asyncValidator of fieldConfig.asyncValidators) {
            const error = await asyncValidator(fieldState.value);
            if (error) {
              syncErrors.push(error);
              break; // First error wins
            }
          }
        }

        dispatch(validationSuccess({
          path: fieldPath,
          requestId,
          errors: syncErrors,
        }));

        return syncErrors;
      } catch (error) {
        dispatch(validationFailure({ 
          path: fieldPath, 
          requestId, 
          error: 'Async validation failed' 
        }));
        throw error;
      }
    }
  );

  // Thunk for validating all fields
  const validateForm = createAsyncThunk(
    `${prefix}/validateForm`,
    async (_, { dispatch }) => {
      const validationPromises = Object.keys(config.fields).map(fieldPath =>
        dispatch(validateField(fieldPath))
      );

      const results = await Promise.allSettled(validationPromises);
      
      // Check if any validation failed
      const hasFailures = results.some(result => result.status === 'rejected');
      if (hasFailures) {
        throw new Error('Some field validations failed');
      }

      // Extract all errors
      const allErrors = results
        .filter(result => result.status === 'fulfilled')
        .flatMap(result => (result as any).value || []);

      return allErrors;
    }
  );

  const submitForm = createAsyncThunk(
    `${prefix}/submitForm`,
    async (_, { dispatch, getState }) => {
      // First validate the form
      await dispatch(validateForm()).unwrap();

      // Check if form is valid after validation
      const state = getState() as any;
      const formState: FormState<T> = state[config.formId];
      
      const hasErrors = Object.values(formState.fields).some(
        (field: any) => field.errors.length > 0
      );

      if (hasErrors) {
        throw new Error('Form validation failed');
      }

      // Extract values
      const values = {} as T;
      for (const fieldPath of Object.keys(config.fields)) {
        (values as any)[fieldPath] = formState.fields[fieldPath as keyof T].value;
      }

      // Call onSubmit if provided
      if (config.onSubmit) {
        await config.onSubmit(values, dispatch, getState);
      }

      return values;
    }
  );

  // Return public API
  return {
    updateFieldValue: <K extends keyof T>(path: K, value: T[K]) =>
      updateFieldValue({ path: path as string, value }),
    focusField: (path: keyof T) =>
      focusField({ path: path as string }),
    blurField: (path: keyof T) =>
      blurField({ path: path as string }),
    touchField: (path: keyof T) =>
      touchField({ path: path as string }),
    resetForm: () => resetForm(),
    validateField: (path: keyof T) => validateField(path as string),
    validateForm,
    submitForm,
  };
}

function createFormReducer<T extends Record<string, unknown>>(config: FormConfig<T>, actions: any) {
  // Create initial state from config
  const initialState: FormState<T> = {
    submitting: false,
    submitSucceeded: false,
    submitError: undefined,
    requestId: 0,
    fields: {} as { [K in keyof T]: FieldState<T[K]> },
  };

  // Initialize fields
  for (const fieldPath of Object.keys(config.fields)) {
    const fieldConfig = config.fields[fieldPath as keyof T];
    (initialState.fields as any)[fieldPath] = {
      value: fieldConfig.initialValue,
      initialValue: fieldConfig.initialValue,
      dirty: false,
      touched: false,
      visited: false,
      focused: false,
      validating: false,
      errors: [],
    };
  }

  const prefix = `form/${config.formId}`;

  return createReducer(initialState, (builder) => {
    builder
      // Field update
      .addCase(`${prefix}/updateFieldValue` as any, (state, action: PayloadAction<UpdateFieldValuePayload>) => {
        // Guard against malformed payloads
        if (!action.payload || typeof action.payload !== 'object') return;
        const { path, value } = action.payload;
        if (typeof path !== 'string') return;
        
        const field = (state.fields as any)[path];
        if (field) {
          field.value = value;
          field.dirty = value !== field.initialValue;
          // Schedule validation on next tick would be ideal, but we'll validate immediately for simplicity
        }
      })
      
      // Field focus
      .addCase(`${prefix}/focusField` as any, (state, action: PayloadAction<FieldActionPayload>) => {
        // Guard against malformed payloads
        if (!action.payload || typeof action.payload !== 'object') return;
        const { path } = action.payload;
        if (typeof path !== 'string') return;
        
        const field = (state.fields as any)[path];
        if (field) {
          field.focused = true;
          field.visited = true;
        }
      })
      
      // Field blur
      .addCase(`${prefix}/blurField` as any, (state, action: PayloadAction<FieldActionPayload>) => {
        // Guard against malformed payloads
        if (!action.payload || typeof action.payload !== 'object') return;
        const { path } = action.payload;
        if (typeof path !== 'string') return;
        
        const field = (state.fields as any)[path];
        if (field) {
          field.focused = false;
        }
      })
      
      // Field touch
      .addCase(`${prefix}/touchField` as any, (state, action: PayloadAction<FieldActionPayload>) => {
        // Guard against malformed payloads
        if (!action.payload || typeof action.payload !== 'object') return;
        const { path } = action.payload;
        if (typeof path !== 'string') return;
        
        const field = (state.fields as any)[path];
        if (field) {
          field.touched = true;
        }
      })
      
      // Form reset
      .addCase(`${prefix}/resetForm` as any, (state) => {
        state.submitting = false;
        state.submitSucceeded = false;
        state.submitError = undefined;
        state.requestId = 0;
        
        for (const fieldPath of Object.keys(state.fields)) {
          const field = (state.fields as any)[fieldPath];
          const fieldConfig = config.fields[fieldPath as keyof T];
          field.value = fieldConfig.initialValue;
          field.dirty = false;
          field.touched = false;
          field.visited = false;
          field.focused = false;
          field.validating = false;
          field.errors = [];
        }
      })
      
      // Validation start
      .addCase(`${prefix}/validationStart` as any, (state, action: PayloadAction<ValidationStartPayload>) => {
        // Guard against malformed payloads
        if (!action.payload || typeof action.payload !== 'object') return;
        const { path, requestId } = action.payload;
        if (typeof path !== 'string' || typeof requestId !== 'number') return;
        
        const field = (state.fields as any)[path];
        if (field && requestId >= state.requestId) {
          field.validating = true;
          state.requestId = Math.max(state.requestId, requestId);
        }
      })
      
      // Validation success
      .addCase(`${prefix}/validationSuccess` as any, (state, action: PayloadAction<ValidationSuccessPayload>) => {
        // Guard against malformed payloads
        if (!action.payload || typeof action.payload !== 'object') return;
        const { path, requestId, errors } = action.payload;
        if (typeof path !== 'string' || typeof requestId !== 'number' || !Array.isArray(errors)) return;
        
        const field = (state.fields as any)[path];
        if (field && requestId >= state.requestId) {
          field.validating = false;
          field.errors = errors;
          state.requestId = Math.max(state.requestId, requestId);
        }
      })
      
      // Validation failure
      .addCase(`${prefix}/validationFailure` as any, (state, action: PayloadAction<ValidationFailurePayload>) => {
        // Guard against malformed payloads
        if (!action.payload || typeof action.payload !== 'object') return;
        const { path, requestId, error } = action.payload;
        if (typeof path !== 'string' || typeof requestId !== 'number' || typeof error !== 'string') return;
        
        const field = (state.fields as any)[path];
        if (field && requestId >= state.requestId) {
          field.validating = false;
          field.errors = [error];
          state.requestId = Math.max(state.requestId, requestId);
        }
      })
      
      // Handle async thunk actions for form submission
      .addCase(actions.submitForm.pending, (state) => {
        state.submitting = true;
        state.submitSucceeded = false;
        state.submitError = undefined;
        state.requestId += 1;
      })
      .addCase(actions.submitForm.fulfilled, (state) => {
        state.submitting = false;
        state.submitSucceeded = true;
        state.submitError = undefined;
      })
      .addCase(actions.submitForm.rejected, (state, action) => {
        state.submitting = false;
        state.submitSucceeded = false;
        state.submitError = action.error.message || 'Submission failed';
      })
      
      // Handle async thunk actions for form validation
      .addCase(actions.validateForm.pending, () => {
        // Can add global validation pending state if needed
      })
      .addCase(actions.validateForm.fulfilled, () => {
        // Validation completed successfully
      })
      .addCase(actions.validateForm.rejected, () => {
        // Validation failed
      })

      // Submit start (legacy - keeping for manual actions)
      .addCase(`${prefix}/submitStart` as any, (state, action: PayloadAction<SubmitStartPayload>) => {
        // Guard against malformed payloads
        if (!action.payload || typeof action.payload !== 'object') return;
        const { requestId } = action.payload;
        if (typeof requestId !== 'number') return;
        
        if (requestId >= state.requestId) {
          state.submitting = true;
          state.submitSucceeded = false;
          state.submitError = undefined;
          state.requestId = Math.max(state.requestId, requestId);
        }
      })
      
      // Submit success (legacy)
      .addCase(`${prefix}/submitSuccess` as any, (state, action: PayloadAction<SubmitSuccessPayload>) => {
        // Guard against malformed payloads
        if (!action.payload || typeof action.payload !== 'object') return;
        const { requestId } = action.payload;
        if (typeof requestId !== 'number') return;
        
        if (requestId >= state.requestId) {
          state.submitting = false;
          state.submitSucceeded = true;
          state.submitError = undefined;
          state.requestId = Math.max(state.requestId, requestId);
        }
      })
      
      // Submit failure (legacy)
      .addCase(`${prefix}/submitFailure` as any, (state, action: PayloadAction<SubmitFailurePayload>) => {
        // Guard against malformed payloads
        if (!action.payload || typeof action.payload !== 'object') return;
        const { requestId, error } = action.payload;
        if (typeof requestId !== 'number' || typeof error !== 'string') return;
        
        if (requestId >= state.requestId) {
          state.submitting = false;
          state.submitSucceeded = false;
          state.submitError = error;
          state.requestId = Math.max(state.requestId, requestId);
        }
      });
  });
}

function createFormMiddleware<T extends Record<string, unknown>>(config: FormConfig<T>): Middleware | undefined {
  // Check if any field has async validators
  const hasAsyncValidators = Object.values(config.fields).some(
    (fieldConfig) => fieldConfig.asyncValidators && fieldConfig.asyncValidators.length > 0
  );

  if (!hasAsyncValidators) {
    return undefined;
  }

  // Track in-flight requests per field
  const inFlightRequests = new Map<string, Set<number>>();

  return (store) => (next) => (action: any) => {
    // Handle validation start actions
    if (action.type?.endsWith('/validationStart')) {
      const { path, requestId } = action.payload;
      
      // Initialize tracking for this field if needed
      if (!inFlightRequests.has(path)) {
        inFlightRequests.set(path, new Set());
      }
      
      const fieldRequests = inFlightRequests.get(path);
      if (!fieldRequests) {
        return next(action);
      }
      
      // If there's already a newer or equal request for this field, skip this one
      const hasNewerRequest = Array.from(fieldRequests).some(existingId => existingId >= requestId);
      if (hasNewerRequest) {
        // Dispatch a stale validation action instead
        store.dispatch({
          type: `form/${config.formId}/validationStale`,
          payload: { path, requestId }
        });
        return; // Don't proceed with this action
      }
      
      // Add this request to tracking
      fieldRequests.add(requestId);
    }
    
    // Handle validation completion (success or failure)
    if (action.type?.endsWith('/validationSuccess') || action.type?.endsWith('/validationFailure')) {
      const { path, requestId } = action.payload;
      const fieldRequests = inFlightRequests.get(path);
      
      if (fieldRequests) {
        fieldRequests.delete(requestId);
        if (fieldRequests.size === 0) {
          inFlightRequests.delete(path);
        }
      }
    }

    return next(action);
  };
}

function createFormSelectors<T extends Record<string, unknown>>(formId: string): FormSelectors<T> {
  // Base selector to get the form state from the root state
  const selectFormState = () => <RootState>(state: RootState): FormState<T> | undefined => {
    return (state as any)[formId];
  };

  // Memoized selector for field values
  const selectFieldValue = <K extends keyof T>(path: K) => 
    createSelector(
      [selectFormState()],
      (formState): T[K] | undefined => formState?.fields[path]?.value
    );

  // Memoized selector for field errors
  const getFieldError = (path: keyof T) =>
    createSelector(
      [selectFormState()],
      (formState): string[] | undefined => {
        const field = formState?.fields[path];
        return field?.errors.length ? field.errors : undefined;
      }
    );

  // Memoized selector for submission state
  const isSubmitting = createSelector(
    [selectFormState()],
    (formState): boolean => formState?.submitting ?? false
  );

  // Memoized selector for validation pending state
  const isValidationPending = createSelector(
    [selectFormState()],
    (formState): boolean => {
      if (!formState) return false;
      return Object.values(formState.fields).some((field: any) => field.validating);
    }
  );

  // Memoized selector for form validity
  const isFormValid = createSelector(
    [selectFormState()],
    (formState): boolean => {
      if (!formState) return false;
      const hasErrors = Object.values(formState.fields).some((field: any) => field.errors.length > 0);
      const isValidating = Object.values(formState.fields).some((field: any) => field.validating);
      return !hasErrors && !isValidating;
    }
  );

  // Memoized selector for field dirty state
  const isFieldDirty = (path: keyof T) =>
    createSelector(
      [selectFormState()],
      (formState): boolean => formState?.fields[path]?.dirty ?? false
    );

  // Memoized selector for form dirty state
  const isFormDirty = createSelector(
    [selectFormState()],
    (formState): boolean => {
      if (!formState) return false;
      return Object.values(formState.fields).some((field: any) => field.dirty);
    }
  );

  // Memoized selector for dirty fields list
  const getDirtyFields = createSelector(
    [selectFormState()],
    (formState): (keyof T)[] => {
      if (!formState) return [];
      return Object.keys(formState.fields).filter(
        (fieldPath) => (formState.fields as any)[fieldPath].dirty
      ) as (keyof T)[];
    }
  );

  return {
    selectFormState,
    selectFieldValue,
    getFieldError,
    isSubmitting,
    isValidationPending,
    isFormValid,
    isFieldDirty,
    isFormDirty,
    getDirtyFields,
  };
}

export function createForm<T extends Record<string, unknown>>(
  config: FormConfig<T>,
): FormArtifacts<T> {
  // Validate config
  if (!config.formId) {
    throw new Error('FormConfig must have a formId');
  }
  
  if (!config.fields || Object.keys(config.fields).length === 0) {
    throw new Error('FormConfig must have at least one field');
  }

  // Create all the artifacts
  const actions = createFormActions<T>(config.formId, config);
  const reducer = createFormReducer<T>(config, actions);
  const selectors = createFormSelectors<T>(config.formId);
  const middleware = createFormMiddleware<T>(config);

  return {
    reducer,
    selectors,
    actions,
    middleware,
  };
}