# Form Toolkit – Redux‑friendly form state management

This repository provides a small, fully‑typed utility—`createForm`—for deriving all Redux artefacts (reducer, actions, selectors, and optional middleware) required to manage one or more HTML form instances.  
Although there is no published _npm_ package yet, the module may be imported directly from source:

```ts
import { createForm } from "./form";
```

It is framework‑agnostic, but pairs naturally with React/Preact components and **@reduxjs/toolkit** stores.

---

## Features

- **Single call API** – derive reducer, strongly‑typed action creators, memoised selectors and optional middleware.
- **First‑class TypeScript support** – the form’s value shape is inferred from the configuration object.
- **Declarative validation**

  - Synchronous `Validator<T>` functions.
  - Asynchronous `AsyncValidator<T>` functions with race‑condition cancellation via `requestId`.

- **Ergonomic field helpers** – `updateFieldValue`, `focusField`, `blurField`, `touchField`, `resetForm`, etc.
- **Composable** – multiple forms coexist safely in the same Redux store.
- **Serialisation‑safe by default** – optional escape hatch for non‑serialisable data during tests.
- **Headless** – use with any UI library or none at all.
- **Tiny dependency surface** – only relies on _@reduxjs/toolkit_.

---

## Quick start

### 1  Define a form configuration

```ts
interface LoginValues {
  email: string;
  password: string;
}

const loginConfig = {
  formId: "login",
  fields: {
    email: {
      initialValue: "",
      validators: [required, emailFormat],
      asyncValidators: [checkEmailExists],
    },
    password: {
      initialValue: "",
      validators: [required, minLength(8)],
    },
  },
  /** Optional; called by actions.submitForm() */
  onSubmit: async ({ email, password }) => {
    await api.login(email, password);
  },
} satisfies FormConfig<LoginValues>;
```

### 2  Create form artefacts

```ts
const loginForm = createForm(loginConfig);
```

`loginForm` contains:

| key          | description                                               |
| ------------ | --------------------------------------------------------- |
| `reducer`    | A Redux slice reducer handling the form state.            |
| `actions`    | Typed action creators (see below).                        |
| `selectors`  | Memoised selector factory functions.                      |
| `middleware` | Optional, only generated when `asyncValidators` are used. |

### 3  Add to the Redux store

```ts
const store = configureStore({
  reducer: {
    login: loginForm.reducer,
    // …other slices
  },
  middleware: (gDM) =>
    loginForm.middleware ? gDM().concat(loginForm.middleware) : gDM(),
});
```

### 4  Wire into your UI layer (React example)

```tsx
function LoginForm() {
  const dispatch = useDispatch();
  const email = useSelector(loginForm.selectors.selectFieldValue("email"));
  const errors = useSelector(loginForm.selectors.getFieldError("email"));
  const submitting = useSelector(loginForm.selectors.isSubmitting);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void dispatch(loginForm.actions.submitForm());
      }}
    >
      <input
        value={email ?? ""}
        onChange={(e) =>
          dispatch(loginForm.actions.updateFieldValue("email", e.target.value))
        }
        onFocus={() => dispatch(loginForm.actions.focusField("email"))}
        onBlur={() => dispatch(loginForm.actions.blurField("email"))}
      />
      {errors?.map((msg) => <span key={msg}>{msg}</span>)}
      {/* …password field */}
      <button disabled={submitting}>Sign in</button>
    </form>
  );
}
```

---

## Validation

### Synchronous

```ts
const required: Validator<string> = (v) =>
  !v || v.trim() === "" ? "Required" : undefined;
```

### Asynchronous

```ts
const checkEmailExists: AsyncValidator<string> = async (email) => {
  const exists = await api.emailTaken(email);
  return exists ? "Email already registered" : undefined;
};
```

_Async validators_ receive cancellation if the field value changes before the request resolves, ensuring only the most recent result is applied.

---

## Actions

All actions are namespaced by `formId`.
Parameters are typed from the configuration.

| action creator                     | purpose                                           |
| ---------------------------------- | ------------------------------------------------- |
| `updateFieldValue(path, value)`    | Mutate field value and recompute `dirty`.         |
| `focusField(path)` / `blurField()` | Track focus / visit state.                        |
| `touchField(path)`                 | Mark as touched.                                  |
| `validateField(path)`              | Run sync + async validators for one field.        |
| `validateForm()`                   | Validate every field sequentially.                |
| `submitForm()`                     | Runs `validateForm`; on success calls `onSubmit`. |
| `resetForm()`                      | Restore initial values and clear meta‑state.      |

---

## Selectors

Selector factories must be invoked **once** and then passed the store state:

```ts
const selectPasswordError = loginForm.selectors.getFieldError("password");
const error = selectPasswordError(store.getState());
```

Notable helpers:

| selector factory                       | return value                                       |
| -------------------------------------- | -------------------------------------------------- |
| `selectFormState()`                    | Entire form slice.                                 |
| `selectFieldValue(path)`               | Field value.                                       |
| `getFieldError(path)`                  | First error string or `undefined`.                 |
| `isFieldDirty(path)` / `isFormDirty`   | Boolean.                                           |
| `getDirtyFields`                       | Array of dirty field paths.                        |
| `isSubmitting` / `isValidationPending` | Booleans.                                          |
| `isFormValid`                          | `true` when every field has `errors.length === 0`. |

---

## Type definitions

```ts
type Validator<T> = (value: T) => string | undefined;
type AsyncValidator<T> = (value: T) => Promise<string | undefined>;

interface FormFieldConfig<T> {
  initialValue: T;
  validators?: Validator<T>[];
  asyncValidators?: AsyncValidator<T>[];
}

interface FormConfig<Values extends Record<string, unknown>> {
  formId: string;
  fields: {
    [K in keyof Values]: FormFieldConfig<Values[K]>;
  };
  onSubmit?: (
    values: Values,
    dispatch: Dispatch,
    getState: () => unknown,
  ) => void | Promise<unknown>;
}
```

---

## Testing

The repository includes an exhaustive Bun test‑suite (`bun test`) exercising:

- Artefact creation and state initialisation
- Field‑level and form‑level interactions
- Sync and async validation, race conditions, serialisation, and middleware
- Edge cases: oversized data, non‑serialisable values, circular references, malformed actions, etc.

These tests may serve as advanced usage examples.
