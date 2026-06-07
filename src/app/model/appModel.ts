import { createEffect, createEvent, createStore, sample } from "effector";
import { postCreateTask, type CreateTaskResponseDto } from "./api";
import { createDisclosure } from "@shared/lib/createDisclosure";
import { createOpenSession } from "@shared/lib/openSession/openSession";

const appStarted = createEvent();

const modal = createDisclosure();
const postCreateTaskFx = createEffect(postCreateTask);

const sendRequest = createEvent();

const openSessionModel = createOpenSession({
  open: modal.open,
  close: modal.close,
  $isOpen: modal.$isOpen,
});

const protectedFx = openSessionModel.protectEffect(postCreateTaskFx);
// const protectedFromFunctionFx = openSessionModel.protectEffect(postCreateTask);

const $status = createStore<CreateTaskResponseDto["status"] | null>(null);

sample({
  clock: sendRequest,
  fn: () => ({ value: "123" }),
  target: protectedFx,
});

sample({
  clock: protectedFx.doneData,
  fn: (res) => res.status,
  target: $status,
});

sample({ clock: modal.close, target: $status.reinit });

export const appModel = {
  appStarted,
  sendRequest,
  $isLoading: protectedFx.pending,
  modal: { ...modal, $status },
} as const;
