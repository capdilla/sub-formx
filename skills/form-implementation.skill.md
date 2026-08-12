---
description: "Use when implementing React forms with sub-formx. Covers createFormInstance, createForm, createField, useForm, FormWrapper, FieldComponent, field components, validation, useWatchForm, middleware, and advanced patterns."
applyTo: "src/**/*.{ts,tsx}"
---

# Form Implementation Rules using `sub-formx`

## 1. Form Setup (One Time per App)

### Step 1: Define a components dictionary

```tsx
// components/Fields/index.tsx
import { Input } from "./Input";
import { DropDown } from "./Dropdown";

export const components = {
  Input,
  DropDown,
};
```

### Step 2: Create the form instance

```tsx
// instance.ts
import { components } from "./components/Fields";
import { createFormInstance } from "sub-formx";

export const { createForm } = createFormInstance({ components });
```

### Step 3: Create a typed form factory

```tsx
// form.ts
import { createForm } from "./instance";

interface MyFormState {
  name: string;
  surname: string;
}

export const { useForm, createField } = createForm<MyFormState>();
```

- `createField`'s `type` parameter is strictly typed to the keys of your components dictionary. Passing an unknown type throws an error listing all available component types.
- `createField` auto-generates `id` from `name` if not explicitly provided.
- `componentProps` on `createField` omits `onChange` and `value` from the component's own props type — the form handles these automatically, so they can't be overridden.

---

## 2. Implementing Field Components

### Interface contract

Every field component **must** accept:
- `onChange: (value: T) => void`
- `value: Value<T>` (from `sub-formx`)
- Omit `value` and `onChange` from the HTML primitives

```tsx
type Primitives = React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>;

export interface InputProps extends Omit<Primitives, "value" | "onChange"> {
  onChange: (value: string) => void;
  value: Value<string>;
}
```

### Always split into sub-components with `memo`

**Required pattern:** split every field into at least two sub-components wrapped in `memo`:

1. **Base component** — observes only `state.value` via `observeValue`
2. **ErrorMessage component** — observes only `state.validation` via `observeValue`

```tsx
import { memo } from "react";
import { Value, useValue } from "sub-formx";

const ErrorMessage = memo(({ value }: { value: Value<string> }) => {
  const { value: state } = useValue({
    key: value.key,
    stateObserver: value.stateObserver,
    observeValue: (state) => state.validation,
    defaultValue: {
      isValid: true,
      showValidation: false,
      errorMessage: "",
    },
  });

  if (!state?.showValidation) return null;
  if (state?.isValid) return <p>Valid</p>;

  return <p>{state?.errorMessage}</p>;
});

const BaseInput = (props: InputProps) => {
  const { value } = useValue({
    ...props.value,
    observeValue: (state) => state.value,
  });

  return (
    <input
      {...props}
      onChange={(e) => props.onChange(e?.target?.value || "")}
      value={value || ""}
    />
  );
};

export const Input = (props: InputProps) => {
  return (
    <>
      <BaseInput {...props} />
      <ErrorMessage value={props.value} />
    </>
  );
};
```

### Why splitting + memo matters

| Component | Re-renders when |
|---|---|
| `BaseInput` | Only when `state.value` changes |
| `ErrorMessage` | Only when `state.validation` changes |
| Parent `Input` | Only when its own props change |

Without this split, a single component subscribing to the full state would re-render on every keystroke (value change) even when only showing validation messages.

### `useValue` advanced options

```tsx
const { value } = useValue({
  key: value.key,
  stateObserver: value.stateObserver,
  observeValue: (state) => state.someProperty, // mapper — derive a subset
  defaultValue: fallbackValue,                  // takes priority over state value
  deepEqual: false,                             // skip equality check (always re-render)
  deps: [externalDep],                          // re-sync from state when external dep changes
});
```

- `defaultValue` takes **full priority** over the state value. Use it for stable fallback shapes.
- `deepEqual` defaults to the library's `deepEqual` utility. Pass `false` to disable and always re-render.
- `deps` triggers a re-sync from the state observer when an external dependency changes — useful when `observeValue` depends on values not tracked by the state observer (e.g., an index from parent props).

---

## 3. Using a Form in a Component

```tsx
import { FormWrapper } from "sub-formx";
import { useForm, createField } from "./form";

const App = () => {
  const {
    fields,
    getFormValues,
    getFormState,
    setShowValidation,
    revalidateForm,
    core,
    updateFormState,
  } = useForm({
    defaultState: {
      name: "",
      surname: "",
    },
    fields: [
      createField({
        name: "name",
        type: "Input",
        validation: { required: true },
      }),
      createField({
        name: "surname",
        type: "Input",
        validation: { required: true },
      }),
    ],
  });

  const onSubmit = () => {
    const { values, isFormValid } = getFormValues();
    if (!isFormValid) {
      setShowValidation(true);
      return;
    }
    fetch("/send", { body: JSON.stringify(values) });
  };

  return (
    <>
      <FormWrapper fields={fields} />
      <button onClick={onSubmit}>Submit</button>
    </>
  );
};
```

### `updateFormState` — programmatic form updates

```tsx
// Set specific fields — re-runs validation for all fields
updateFormState({ name: "John", surname: "Doe" });
```

Internally calls `createDefaultState` which re-validates every field. Use this to pre-fill forms from API data or reset the form.

---

## 4. Validation Patterns

### Required field

```tsx
createField({
  name: "email",
  type: "Input",
  validation: {
    required: true,
    errorMessage: "Email is required",
  },
})
```

### Custom validation — access to all form values

```tsx
createField({
  name: "confirmPassword",
  type: "Input",
  validation: {
    customValidation: (formState) => ({
      isValid: formState.confirmPassword.value === formState.password.value,
      errorMessage: "Passwords must match",
    }),
  },
})
```

- `customValidation` receives the **entire** `FormState<T>` — you can cross-reference any field
- Return `{ isValid, errorMessage }` (no `showValidation` — the form controls that)

---

## 5. Complete Form API Reference

| API | Signature | Purpose |
|---|---|---|
| `fields` | `Record<keyof T, Field<T>>` | Augmented fields for `<FormWrapper>` or `<FieldComponent>` |
| `core` | `FormCore<T>` (= `SubState<FormState<T>>`) | Raw form SubState — pass to `useWatchForm` |
| `getFormValues()` | `() => { values: T, isFormValid: boolean }` | Extract typed raw values for submission |
| `getFormState()` | `() => { isFormValid: boolean, fields: FormState<T> }` | Full state including validation info |
| `setShowValidation(bool)` | `(showValidation: boolean) => void` | Bulk toggle all validation messages |
| `revalidateForm(opts?)` | `(options?: { showValidation?: boolean }) => void` | Re-run validation on all fields |
| `updateFormState(partial)` | `(newState: T \| Pick<T, K>) => void` | Programmatic update — recreates state and re-validates |
| `onFormChange` | `(formState: FormState<T>, formObserver: SubState<FormState<T>>) => void` | Callback on any field change |

---

## 6. Rendering Fields: `FormWrapper` vs `FieldComponent`

### `FormWrapper` — render all fields at once

```tsx
<FormWrapper fields={fields} />
```

Uses `useMemo` to convert the fields record to an array and renders each field via its `component` and `componentProps`.

### `FieldComponent` — render individual fields in scattered layouts

```tsx
import { FieldComponent } from "sub-formx";

const ComplexLayout = ({ fields }) => {
  return (
    <div>
      <section className="left-column">
        <FieldComponent fields={fields} name="name" />
      </section>
      <section className="right-column">
        <FieldComponent fields={fields} name="surname" />
      </section>
    </div>
  );
};
```

Use this when fields are spread across a complex layout and can't be rendered contiguously.

---

## 7. Watching Form State Outside the Form (`useWatchForm`)

```tsx
import { useWatchForm, FormCore } from "sub-formx";

interface MyFormState {
  name: string;
  surname: string;
}

const SubmitButton = ({ formCore }: { formCore: FormCore<MyFormState> }) => {
  const isFormValid = useWatchForm(formCore, {
    mapValue: (state) => state.isFormValid,
  });

  return <button disabled={!isFormValid}>Submit</button>;
};

// Usage in the form component:
const { fields, core } = useForm({ ... });
// ...
<SubmitButton formCore={core} />
```

### `mapValue` comparison caveat

`mapValue` results are compared with **strict reference equality (`===`)**, NOT deep equal. If `mapValue` returns a new object/array reference on every call, the component **will re-render every time**.

```tsx
// INCORRECT — new array on every call, always re-renders
useWatchForm(formCore, {
  mapValue: (state) => [state.fields.name.value, state.fields.surname.value],
});

// CORRECT — primitive values are safe
useWatchForm(formCore, {
  mapValue: (state) => state.isFormValid;
});
```

If you need derived objects, do the derivation inside the component after subscribing to the raw data.

### Without `mapValue`

Returns `GetFormState<T>` (`{ fields: FormState<T>, isFormValid: boolean }`). Use when you need access to multiple field values and validations.

---

## 8. `onFormChange` for Side Effects

```tsx
const { fields } = useForm({
  defaultState: { name: "", surname: "" },
  fields: [...],
  onFormChange: (formState, formObserver) => {
    // formState = { name: { value, validation }, surname: { value, validation } }
    // formObserver = the full SubState — can call setState/setKeyState/addMiddleware

    appState.observer.setKeyState("person", {
      name: formState.name.value,
      surname: formState.surname.value,
    });
  },
});
```

- First arg: the current `FormState<T>`
- Second arg: the form's `SubState<FormState<T>>` — gives full access to `setState`, `setKeyState`, `addMiddleware` on the form itself

---

## 9. Form Middleware

Middleware can intercept and transform state updates before they're applied.

```tsx
const upperCaseMiddleware: Middleware<FormState<MyFormState>> = (ctx, next) => {
  if (ctx.key === "name" && typeof ctx.value === "string") {
    next({ value: ctx.value.toUpperCase() });
  } else {
    next();
  }
};

const { fields } = useForm({
  defaultState: { name: "", surname: "" },
  fields: [...],
  middleware: [upperCaseMiddleware],
});
```

- Middleware follows the Express/Koa chain pattern: `(ctx, next) => void`
- `ctx` has `{ key?, value, state }` — can modify before calling `next()`
- `setKeyState` provides `ctx.key`; `setState` does not

---

## 10. Dynamic Fields (Multi-step Forms, Conditional Fields)

The `fields` array can change at runtime. When it does, the form re-creates its internal state via `createDefaultState`, preserving values for fields present in both old and new arrays.

```tsx
const Step1Form = () => {
  const { fields } = useForm({
    defaultState: { name: "", surname: "" },
    fields: step === 1 ? step1Fields : step2Fields,
  });
};
```

---

## 11. No `isDirty` / Pristine Tracking

The form system does **not** track whether values have been modified from their initial state. If you need dirty checking, implement it manually via `onFormChange` comparing against `defaultState`.

---

## 12. Anti-Patterns to Avoid

### Don't put error message logic inside the base field component

```tsx
// INCORRECT — ErrorMessage logic re-renders on every value change
const Input = (props: InputProps) => {
  const { value } = useValue({ ...props.value }); // subscribes to full FieldValue
  return (
    <>
      <input value={value.value} ... />
      {!value.validation.isValid && <p>{value.validation.errorMessage}</p>}
    </>
  );
};
```

Always extract validation display into a separate `memo`-wrapped component that observes only `state.validation`.

### Don't use `useValue` when state is only needed for handlers

```tsx
// INCORRECT — subscribes to state for rendering but only uses it in a click handler
const { value: isOpen } = useValue({ key: "isOpen", stateObserver });
const toggle = () => observer.setKeyState("isOpen", !isOpen);

// CORRECT — read from observer.state directly
const toggle = () => {
  const isOpen = observer.state.isOpen;
  observer.setKeyState("isOpen", !isOpen);
};
```

If you don't need the value for rendering, read it from `getFormValues()`, `getFormState()`, or `observer.state` inside the handler.

### Don't use `useForm` directly without the typed factory

Always go through `createFormInstance` → `createForm<T>()`. Never call `useForm` raw — you lose type safety on field names and `createField` types.

### Don't subscribe to the full state in field components

```tsx
// INCORRECT
const { value } = useValue({ ...props.value, observeValue: (state) => state });

// CORRECT
const { value } = useValue({ ...props.value, observeValue: (state) => state.value });
```

Always use `observeValue` to subscribe only to the specific slice you need.

---

## Performance Principles for Forms

- Always split field components into `BaseField` + `ErrorMessage`, both wrapped in `memo`
- Use `observeValue` in `useValue` to subscribe only to the specific slice of state needed
- Extract form-watching logic into separate, small components using `useWatchForm` with `mapValue`
- `ErrorMessage` should only re-render when `validation.showValidation` or `validation.isValid` changes
- When `mapValue` returns an object/array, be aware of `===` comparison — prefer deriving inside the component
- For side effects (analytics, API calls), prefer `onFormChange` + `observer.subscribe` over rendering-based subscriptions
