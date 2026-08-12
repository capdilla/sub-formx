---
description: "Use when writing React components, hooks, state management, or any code using CreateSubState from sub-formx. Covers useValue, observer, setKeyState, setState, subscribe patterns."
applyTo: "src/**/*.{ts,tsx}"
---

# State Management Rules using `CreateSubState`

## 1. Global State

Whenever global state is required, it must be managed using `CreateSubState` from `sub-formx`.

### Example

```ts
import { CreateSubState } from "sub-formx";

interface AppState {
  user: User | null;
  selected_language: string;
  sidebarOpen: boolean;
}

export const appState = new CreateSubState<AppState>({
  user: null,
  selected_language: "auto",
  sidebarOpen: true,
});
```

---

## 2. Using `SubState`

### Step 1: Create the state

```ts
// state/index.ts
import { CreateSubState } from "sub-formx";

interface AppState {
  name: string;
  age: number;
  tags: string[];
  menu: {
    isOpen: boolean;
  };
}

export const appState = new CreateSubState<AppState>({
  name: "",
  age: 0,
  tags: [],
  menu: {
    isOpen: false,
  },
});
```

### Step 2: Use the state inside components

```ts
// header/index.ts
import { appState } from "state";

const Header = () => {
  const { value } = appState.useValue({ key: "menu" });

  return (
    <Menu collapse={value.isOpen}>
      {items.render(() => (
        <Menu.Item />
      ))}
    </Menu>
  );
};

const UserView = () => {
  const toggleHeader = () => {
    const oldMenu = appState.observer.state.menu;

    appState.observer.setKeyState("menu", {
      isOpen: !oldMenu.isOpen,
    });
  };

  return (
    <div>
      <Header />
      <button onClick={toggleHeader}>Toggle Header</button>
    </div>
  );
};
```

---

## 3. Observing a Specific Part of the State

When you only need a small part of the state value, use `observeValue` to reduce unnecessary renders.

```ts
const Tag = ({ index }) => {
  const { value } = appState.useValue({
    key: "tags",
    observeValue: (state) => state[index],
  });

  return <span>{value}</span>;
};
```

---

## 4. Listening to State Changes Without Rendering

Use `observer.subscribe` for side effects instead of `useValue`.

```ts
useEffect(() => {
  const unsubscribe = appState.observer.subscribe("menu", (menu) => {
    if (menu.isOpen) {
      fetch("/send-event");
    }
  });

  return () => unsubscribe();
}, []);
```

---

## 5. Do Not Consume State in Components That Do Not Need It

State should always be read in the **smallest component that actually needs it**.

### Incorrect

```tsx
const MyComponent = () => {
  const { value: user } = appState.useValue({ key: "user" });
  return (
    <div>
      <h1>The user</h1>
      <span>{user.name}</span>
    </div>
  );
};
```

### Correct

```tsx
const UserInfo = () => {
  const { value: user } = appState.useValue({ key: "user" });
  return <span>{user.name}</span>;
};

const MyComponent = () => {
  return (
    <div>
      <h1>The user</h1>
      <UserInfo />
    </div>
  );
};
```

---

## 6. Do Not Use `useValue` When the State Is Only Needed for an Action

If a value is not required for rendering, read it from `observer.state` inside the handler.

### Incorrect

```ts
const { value: isOpen } = appState.useValue({ key: "isOpen" });
const toggle = () => {
  appState.observer.setKeyState("isOpen", isOpen);
};
```

### Correct

```ts
const toggle = () => {
  const isOpen = appState.observer.state.isOpen;
  appState.observer.setKeyState("isOpen", !isOpen);
};
```

---

## 7. Choosing Between `setKeyState` and `setState`

* One property → `setKeyState`
* Multiple properties → `setState`

```ts
appState.observer.setKeyState("isOpen", true);

appState.observer.setState({
  isOpen: true,
  isEnded: false,
});
```

---

## Performance Principles

* Read state only where it is needed.
* Avoid lifting state unnecessarily.
* Split components when only part of the UI depends on a state value.
* Use `observeValue` for partial state observation.
* Use `subscribe` for side effects instead of rendering.

## Component Design

Prefer **small, focused components**. If only a small part of the UI depends on a specific state value, extract it into a dedicated component.

## Clear Separation

* **For rendering UI**: `appState.useValue(...)`
* **For actions/handlers**: `appState.observer.state`

Never use `useValue` just to execute actions or handlers.
