import { createEvent, createStore } from "effector";

export function createDisclosure<OP = void, CP = void>(initialValue?: boolean) {
  const $isOpen = createStore<boolean>(initialValue ?? false);

  const open = createEvent<OP>();
  const close = createEvent<CP>();

  $isOpen.on(open, () => true).on(close, () => false);

  return { $isOpen, open, close } as const;
}
