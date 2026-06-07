# effectorOpenSession

Utilities for protecting Effector events and effects from stale open-session lifecycle updates.

`effectorOpenSession` helps manage the lifecycle of an opened UI entity, such as a modal, drawer, or popover. Each `open` call creates an internal session id, and that id is used to check whether events and async effect results still belong to the currently active open session.

This is useful when the user closes a UI entity or opens it again while an async operation is still running. In that case, stale results can be ignored safely.

## Features

- Track the current open-session lifecycle.
- Generate a new internal `_openId` on each `open`.
- Protect async effects from stale `done`, `fail`, `doneData`, `failData`, and `finally` emissions.
- Protect events by deriving readonly events that emit only while the current session is still active.
- Reset protected effect `inFlight` and `pending` state when the session is closed or reopened.
- Preserve pending delegation when wrapping an existing Effector effect.

## Basic usage

```ts
import { createEvent, createStore, sample } from "effector";
import { createOpenSession } from "effector-open-session";

const modalOpened = createEvent<void>();
const modalClosed = createEvent<void>();

const $isModalOpen = createStore(false)
  .on(modalOpened, () => true)
  .on(modalClosed, () => false);

const openSessionModel = createOpenSession({
  open: modalOpened,
  close: modalClosed,
  $isOpen: $isModalOpen,
});
```

## `createOpenSession`

Creates an open-session model that tracks the current lifecycle of an opened UI entity.

```ts
const openSessionModel = createOpenSession({
  open,
  close,
  $isOpen,
});
```

### Parameters

| Name      | Description                                                  |
| --------- | ------------------------------------------------------------ |
| `open`    | Event that starts a new open session.                        |
| `close`   | Event that closes the current session.                       |
| `$isOpen` | Store that represents whether the session is currently open. |

### Returns

| Name            | Description                                                                           |
| --------------- | ------------------------------------------------------------------------------------- |
| `$openId`       | Readonly store with the current open session id.                                      |
| `protectEffect` | Function for wrapping effects so they react only to the current open session.         |
| `protectEvent`  | Function for deriving readonly events that emit only within the current open session. |

## Protecting effects

Use `protectEffect` to wrap an effect or async function whose result should be ignored after the session is closed or reopened.

```ts
import { createEffect, sample } from "effector";

const postCreateTaskFx = createEffect(async (params: { title: string }) => {
  const response = await fetch("/api/tasks", {
    method: "POST",
    body: JSON.stringify(params),
  });

  return response.json();
});

const protectedPostCreateTaskFx =
  openSessionModel.protectEffect(postCreateTaskFx);
```

The returned protected effect should be called instead of the original effect.

```ts
sample({
  clock: modalOpened,
  fn: () => ({ title: "New task" }),
  target: protectedPostCreateTaskFx,
});
```

The protected effect emits `done`, `fail`, `doneData`, `failData`, and `finally` only if, when the effect completes:

- the session is still open;
- the `_openId` used to start the effect matches the current `_openId`.

```ts
sample({
  clock: protectedPostCreateTaskFx.doneData,
  fn: (task) => task.status,
  target: $status,
});
```

You can reset local state on close as usual:

```ts
sample({
  clock: modalClosed,
  target: $status.reinit,
});
```

### Pending and in-flight state

`protectEffect` overrides `inFlight` and `pending`.

`inFlight` contains the number of protected effect calls that are still running within the current open session. It is incremented on each protected effect call and decremented only when a matching call from the current open session finishes.

Both `inFlight` and `pending` are reset when the session is closed or reopened.

```ts
protectedPostCreateTaskFx.pending.watch((isPending) => {
  console.log("Current session pending:", isPending);
});
```

### Pending delegation

If an existing Effector effect is passed to `protectEffect`, the original effect also becomes pending because the protected effect delegates execution to it internally.

```ts
const originalFx = createEffect(async () => {});

const protectedFx = openSessionModel.protectEffect(originalFx);

protectedFx();

originalFx.pending; // true
protectedFx.pending; // true
```

## Protecting events

Use `protectEvent` to create a protected readonly event derived from an existing event.

The original event should still be called from the UI or external code. The returned protected event should be used inside the internal model logic.

```ts
import { createEvent, sample } from "effector";

type FormValues = {
  name: string;
  email: string;
};

const formSubmitted = createEvent<FormValues>();

const protectedFormSubmitted = openSessionModel.protectEvent(formSubmitted);
```

Call the original event from the UI or external layer:

```ts
formSubmitted({
  name: "John",
  email: "john@example.com",
});
```

Use the protected event in the model:

```ts
sample({
  clock: protectedFormSubmitted,
  target: submitFormFx,
});
```

The protected event emits the original payload only when the event belongs to the current open session.

## Example with close button

```ts
const closeClicked = createEvent<void>();

const protectedCloseClicked = openSessionModel.protectEvent(closeClicked);

sample({
  clock: protectedCloseClicked,
  target: someModelEvent,
});
```

## Why this is useful

Without session protection, async operations can update state after the UI entity that started them has already been closed or reopened.

For example:

1. A modal is opened.
2. A request starts.
3. The modal is closed.
4. The request finishes.
5. The stale result updates state that no longer belongs to the current UI lifecycle.

`effectorOpenSession` prevents this by associating effect calls and protected events with the current open session.

## API

### `createOpenSession(params)`

```ts
createOpenSession<T>({
  open,
  close,
  $isOpen,
});
```

Creates an open-session model.

### `protectEffect(effect)`

```ts
const protectedFx = openSessionModel.protectEffect(effect);

const protectedFx = openSessionModel.protectEffect(() => {});

const protectedFx = openSessionModel.protectEffect(async (red) => {});
```

Wraps an Effector effect or function into a protected effect bound to the current open session.

The returned effect has protected versions of:

- `done`
- `doneData`
- `fail`
- `failData`
- `finally`
- `inFlight`
- `pending`

### `protectEvent(event)`

```ts
const protectedEvent = openSessionModel.protectEvent(event);
```

Creates a readonly event that emits the original payload only when the current open session is still active.

## TypeScript

The package is written in TypeScript and preserves payload, result, and error types for protected events and effects.

```ts
const protectedFx = openSessionModel.protectEffect<
  { title: string },
  { id: string },
  Error
>(postCreateTaskFx);
```
