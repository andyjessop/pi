# **Redux‑Only Form State Management Library**

_A complete, headless specification_

---

## 0 Scope & Principles  

1. **Pure Redux artefacts only** – the library exports reducers, action‑creators (including thunks), selectors, and _optional_ middleware.
2. **No UI contract** – it must operate with React, Angular, Web Components, or CLI.
3. **Zero implicit registration** – a form is created **once** via code generation (`createForm`) outside any framework life‑cycle; nothing is mounted or unmounted at run‑time.
4. **Explicit, traceable data flow** – every state transition originates from a plain Redux action.
5. **Serialisable state** – the store can be persisted, rehydrated, or time‑travelled without loss of fidelity.

---

## 1 Library Entry Point

```ts
import { createForm } from "../../packages/form/src/form";
```

`createForm` is the **only** factory. Everything else (types, helpers, constants) hangs off the object it returns.

---

## 2 API Reference

### 2.1 `createForm` <T>

```ts
function createForm<T extends Record<string, unknown>>(
  config: FormConfig<T>,
): FormArtifacts<T>;
```

| Parameter | Type            | Purpose                                       |
| --------- | --------------- | --------------------------------------------- |
| `config`  | `FormConfig<T>` | Declarative recipe for fields and submission. |

#### 2.1.1 `FormConfig<T>`

```ts
export interface FieldConfig<V = unknown> {
  /** Seed value upon store initialisation. */
  initialValue: V;
  /** Ordered synchronous validators; first error wins. */
  validators?: Array<Validator<V>>;
  /** Ordered async validators. */
  asyncValidators?: Array<AsyncValidator<V>>;
}

export interface FormConfig<T> {
  /** Unique, stable identifier, used as slice key. */
  formId: string;
  /** Field dictionary keyed by *dot‑path* (`"address.city"`). */
  fields: {
    [K in keyof T]: FieldConfig<T[K]>;
  };
  /**
   * Optional side‑effect called by the `submitForm` thunk
   * *after* successful validation.
   */
  onSubmit?: (
    values: T,
    dispatch: Dispatch,
    getState: () => unknown,
  ) => Promise<unknown> | unknown;
}
```

#### 2.1.2 `FormArtifacts<T>`

```ts
export interface FormArtifacts<T> {
  /** Slice reducer suitable for combineReducers. */
  reducer: Reducer<FormState<T>>;
  /** Memoised selectors pre‑curried to the slice. */
  selectors: FormSelectors<T>;
  /** Action‑creators & thunks bound to this form. */
  actions: FormActions<T>;
  /**
   * Optional middleware (undefined if not required).
   * Handles request‑ID deduplication for async validation & submission.
   */
  middleware?: Middleware;
}
```

All names are _final_; consumers must not import private symbols.

---

### 2.2 Action‑Creators & Thunks (`FormActions<T>`)

| Name               | Signature         | Behaviour                                                                                               |                                                    |
| ------------------ | ----------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `updateFieldValue` | \`(path: keyof T  |  string, value: unknown)\`                                                                              | Sets `value`, flips `dirty`, schedules validation. |
| `focusField`       | `(path)`          | `focused = true`, `visited = true`.                                                                     |                                                    |
| `blurField`        | `(path)`          | `focused = false`.                                                                                      |                                                    |
| `touchField`       | `(path)`          | `touched = true`.                                                                                       |                                                    |
| `resetForm`        | `()`              | Restores _all_ field values & flags to their initial state.                                             |                                                    |
| `validateForm`     | `()`              | Forces synchronous + async validation for all fields.                                                   |                                                    |
| `submitForm`       | `()`              | Full life‑cycle:<br>1. `validateForm`<br>2. Run `onSubmit` if present<br>3. Dispatch `submit*` actions. |                                                    |

All action objects conform to the **Flux Standard Action** shape.

---

### 2.3 Selectors (`FormSelectors<T>`)

Each selector is partially applied to the slice; usage is `useSelector(loginSel.isSubmitting)`.

| Selector                 | Return Type                   | Notes                                    |
| ------------------------ | ----------------------------- | ---------------------------------------- |
| `selectFormState()`      | `FormState<T>` \| `undefined` | Entire branch.                           |
| `selectFieldValue(path)` | `T[keyof T]`                  | Current value.                           |
| `getFieldError(path)`    | `string[] \| undefined`       | Array (can be multi‑error).              |
| `isSubmitting`           | `boolean`                     | Global flag.                             |
| `isValidationPending`    | `boolean`                     | `true` iff any field `validating==true`. |
| `isFormValid`            | `boolean`                     | Memoised; no errors & not validating.    |
| `isFieldDirty(path)`     | `boolean`                     | `value !== initialValue`.                |
| `isFormDirty`            | `boolean`                     | Any field dirty.                         |
| `getDirtyFields`         | `string[]`                    | List of paths.                           |

---

## 3 State Schema (exact)

```ts
export interface FieldState<V = unknown> {
  value: V;
  initialValue: V;
  dirty: boolean;
  touched: boolean;
  visited: boolean;
  focused: boolean;

  validating: boolean; // async phase
  errors: string[]; // 0 = valid
}

export interface FormState<T = Record<string, unknown>> {
  submitting: boolean;
  submitSucceeded: boolean;
  submitError: unknown | undefined;

  requestId: number; // increment per submit attempt
  fields: {
    [K in keyof T]: FieldState<T[K]>;
  };
}
```

The slice key in the root store is the **`formId`** supplied by the developer.

---

## 4 Reducer Behaviour

1. **Initialisation** – the reducer is constructed closed‑over the `FormConfig`. Its initial state is fully _materialised_ from `initialValue` for every field.
2. **Action Handling** – every case returns a _new_ object with structural sharing; top‑level and per‑field referential integrity is maintained for performant selector re‑use.
3. **Safety** – unknown action types are ignored; unknown field paths throw **compile‑time** (generic‑based) TypeScript errors, never run‑time.

---

## 5 Async Validation & Submission

### 5.1 Mechanism

- Each async invocation is tagged with `meta.requestId`.
- The reducer tracks `currentRequestId`; only matching responses mutate state (prevents race conditions).
- Errors returned by async validators populate `errors`; failed promises fall back to `asyncValidationFailure`, retaining `dirty` state.

### 5.2 Middleware (Optional)

If any field has `asyncValidators`, `createForm` emits a middleware that:

- Collapses duplicate in‑flight validations for the same field/requestId.
- Dispatches `validationStale` if a newer request starts.

Developers must include this middleware when composing the store (see § 6.2).

---

## 6 Integration Guide (non‑normative but complete)

### 6.1 Form Module

```ts
// forms/loginForm.ts
import { createForm } from "../../packages/form/src/form";
import api from "../api";
import {
  required,
  emailFormat,
  minLength,
  checkEmailExists,
} from "./validators";

interface LoginValues {
  email: string;
  password: string;
}

export const {
  reducer: loginReducer,
  actions: loginAct,
  selectors: loginSel,
  middleware: loginMw,
} = createForm<LoginValues>({
  formId: "login",
  fields: {
    email: {
      initialValue: "",
      validators: [required, emailFormat],
      asyncValidators: [checkEmailExists],
    },
    password: { initialValue: "", validators: [required, minLength(8)] },
  },
  onSubmit: async (v) => {
    await api.login(v);
  },
});
```

### 6.2 Store

```ts
import { configureStore } from "@reduxjs/toolkit";
import thunk from "redux-thunk";
import { loginReducer, loginMw } from "./forms/loginForm";

export const store = configureStore({
  reducer: { login: loginReducer /* , other slices */ },
  middleware: (gDM) => gDM().concat(thunk, ...(loginMw ? [loginMw] : [])),
});
```

### 6.3 React Component (explicit handlers)

```tsx
import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { loginAct, loginSel } from "../forms/loginForm";

export const LoginForm: React.FC = () => {
  const d = useDispatch();

  const email = useSelector(loginSel.selectFieldValue("email"));
  const emailErr = useSelector(loginSel.getFieldError("email"));
  const password = useSelector(loginSel.selectFieldValue("password"));
  const passErr = useSelector(loginSel.getFieldError("password"));
  const submitting = useSelector(loginSel.isSubmitting);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        d(loginAct.submitForm());
      }}
    >
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) =>
            d(loginAct.updateFieldValue("email", e.target.value))
          }
          onFocus={() => d(loginAct.focusField("email"))}
          onBlur={() => {
            d(loginAct.blurField("email"));
            d(loginAct.touchField("email"));
          }}
        />
        {emailErr && <span className="error">{emailErr}</span>}
      </label>

      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) =>
            d(loginAct.updateFieldValue("password", e.target.value))
          }
          onFocus={() => d(loginAct.focusField("password"))}
          onBlur={() => {
            d(loginAct.blurField("password"));
            d(loginAct.touchField("password"));
          }}
        />
        {passErr && <span className="error">{passErr}</span>}
      </label>

      <button type="submit" disabled={submitting}>
        Log in
      </button>
      {submitting && <span>Authenticating…</span>}
    </form>
  );
};
```

No hooks, helpers, or _implicit_ abstractions are present; every Redux interaction is visible and type‑safe.

---

## 7 Extensibility Hooks

- **Extra Thunk Argument** – consumers supply an injected API client when creating the store; `onSubmit` and async validators receive it via `getState / extra`.
- **Field Arrays** – optional helpers `arrayInsert`, `arrayRemove`, etc. built on top of `updateFieldValue`.
- **Schema Validation** – wrapper to transform Yup/Zod results into validator arrays.

All extensions remain outside the core; the public surface of the library **will not grow UI‑facing capabilities**.

---

## 8 FAQs Answered Explicitly

1. **Who instantiates the form?** – Developer code; NEVER the library at run‑time.
2. **Can I omit `onSubmit`?** – Yes. Dispatch your own thunk and read `selectFormState` for values.
3. **Is the store polluted by side‑effects?** – No. Only action meta data (`requestId`, errors) are stored; actual network I/O lives in user‑supplied functions.
4. **SSR compatibility?** – Guaranteed: initial state is deterministic, and async thunks can be awaited during server render.
5. **Multiple forms of the same shape?** – Create _distinct_ form modules with different `formId`s, or parameterise `createForm` in a factory loop; IDs must stay unique.
