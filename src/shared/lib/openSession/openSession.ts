import {
  attach,
  createEffect,
  createEvent,
  createStore,
  sample,
  type Effect,
  type Event,
  type EventCallable,
  type StoreWritable,
} from "effector";
import { readonly, spread } from "patronum";

import { isBelongOpenSession } from "./isBelongOpenSession";
import { overrideEffectFields } from "./overrideEffect";
import type { DonePayload, FailPayload, FinallyPayload } from "./types";
import { createIdGenerator } from "./createIdGenerator";

export type CreateOpenSessionParams<T = void, D = void> = {
  open: EventCallable<T>;
  close: EventCallable<D>;
  $isOpen: StoreWritable<boolean>;
};

export type OpenSessionParams<Params> = {
  originalParams: Params;
  _openId: string | null;
};

export type OpenSessionPayload<T> = {
  originalPayload: T;
  _openId: string | null;
};

/**
 * Creates an open-session model that tracks the current lifecycle
 * of an opened UI entity, such as a modal, drawer, or popover.
 *
 * Each `open` call generates a new internal `_openId`. This ID is used
 * to determine whether async effects and derived events still belong
 * to the currently open session.
 *
 * Use `protectEffect` to wrap effects whose results should be ignored
 * after the session is closed or reopened.
 *
 * Use `protectEvent` to derive readonly events that should be emitted
 * only while the current open session is still active.
 *
 * @template T Payload type of the `open` event.
 *
 * @param params Open-session configuration.
 * @param params.open Event that starts a new open session.
 * @param params.close Event that closes the current session.
 * @param params.$isOpen Store that represents whether the session is currently open.
 *
 * @returns Open-session model.
 * @returns $openId Readonly store with the current open session ID.
 * @returns protectEffect Function for wrapping effects so they react only to the current open session.
 * @returns protectEvent Function for deriving readonly events that emit only within the current open session.
 *
 * @example
 * const openSessionModel = createOpenSession({
 *   open: modal.open,
 *   close: modal.close,
 *   $isOpen: modal.$isOpen,
 * });
 *
 * const protectedFx = openSessionModel.protectEffect(postCreateTaskFx);
 *
 * const formSubmitted = createEvent<FormValues>();
 * const protectedFormSubmitted =
 *   openSessionModel.protectEvent(formSubmitted);
 */
export const createOpenSession = <T = void>({
  open,
  close,
  $isOpen,
}: CreateOpenSessionParams<T>) => {
  const generateId = createIdGenerator();

  const $openId = createStore<string | null>(null);

  sample({
    clock: open,
    fn: generateId,
    target: $openId,
  });

  sample({
    clock: close,
    target: $openId.reinit,
  });

  /**
   * Wraps an effect or an async function into a protected effect
   * bound to the current open session.
   *
   * The returned protected effect should be called instead of the original
   * effect/function. Only calls made through the protected effect receive
   * the current `_openId` and can be checked against the current open session.
   *
   * If the original Effector effect is passed and the protected effect is called,
   * the original effect will also become pending, because the protected effect
   * delegates execution to it internally.
   *
   * The `done`, `fail`, `doneData`, `failData`, and `finally` events
   * are emitted only if, at the moment the effect completes:
   *
   * - the session is still open;
   * - the `_openId` used to start the effect matches the current `_openId`.
   *
   * This makes it safe to ignore stale responses, for example when
   * the user closes the modal or opens it again before the request finishes.
   *
   * `inFlight` contains the number of protected effect calls that are still
   * running within the current open session. It is incremented on each protected
   * effect call and decremented only when a matching call from the current open
   * session finishes.
   *
   * Both `inFlight` and `pending` are reset when the session is closed or reopened.
   *
   * @template Params Effect parameters.
   * @template Done Successful effect result type.
   * @template Fail Effect error type.
   *
   * @param effect Effector effect or function that should be protected from stale results.
   *
   * @returns Effect with overridden `done`, `doneData`, `fail`, `failData`,
   * `finally`, `inFlight`, and `pending` fields that react only to the current open session.
   *
   * @example // Pending state delegation
   * const originalFx = createEffect(async () => {});
   * const protectedFx = openSessionModel.protectEffect(originalFx);
   * protectedFx();
   * originalFx.pending // true
   * protectedFx.pending // true
   *
   * @example
   * const protectedFx = openSessionModel.protectEffect(postCreateTaskFx);
   *
   * sample({
   *   clock: modal.open,
   *   fn: () => ({ value: "123" }),
   *   target: protectedFx,
   * });
   *
   * sample({
   *   clock: protectedFx.doneData,
   *   fn: (res) => res.status,
   *   target: $status,
   * });
   *
   * sample({
   *   clock: modal.close,
   *   target: $status.reinit,
   * });
   *
   */
  const protectEffect = <Params = void, Done = void, Fail = Error>(
    effect:
      | Effect<Params, Done, Fail>
      | ((params: Params) => Done | Promise<Done>),
  ) => {
    const $inFlight = createStore<number>(0);

    const done = createEvent<DonePayload<Params, Done>>();
    const fail = createEvent<FailPayload<Params, Fail>>();
    const doneData = createEvent<Done>();
    const failData = createEvent<Fail>();
    const finallyEvent = createEvent<FinallyPayload<Params, Done, Fail>>();

    const innerFx = createEffect<OpenSessionParams<Params>, Done, Fail>(
      ({ originalParams }) => effect(originalParams),
    );

    const protectedFx = attach({
      source: $openId,
      mapParams: (originalParams: Params, _openId) => ({
        originalParams,
        _openId,
      }),
      effect: innerFx,
    });

    sample({
      clock: innerFx,
      source: {
        openId: $openId,
        isOpen: $isOpen,
        inFlight: $inFlight,
      },
      filter: ({ openId, isOpen }, params) =>
        isBelongOpenSession({
          openId,
          effectOpenId: params._openId,
          isOpen,
        }),
      fn: ({ inFlight }) => inFlight + 1,
      target: $inFlight,
    });

    sample({ clock: [open, close], target: $inFlight.reinit });

    sample({
      clock: innerFx.done,
      source: {
        openId: $openId,
        isOpen: $isOpen,
      },
      filter: ({ openId, isOpen }, { params }) =>
        isBelongOpenSession({
          openId,
          effectOpenId: params._openId,
          isOpen,
        }),
      fn: (_, { params, result }) => ({
        params: params.originalParams,
        result,
      }),
      target: done,
    });

    sample({
      clock: innerFx.fail,
      source: {
        openId: $openId,
        isOpen: $isOpen,
      },
      filter: ({ openId, isOpen }, { params }) =>
        isBelongOpenSession({
          openId,
          effectOpenId: params._openId,
          isOpen,
        }),
      fn: (_, { params, error }) => ({
        params: params.originalParams,
        error,
      }),
      target: fail,
    });

    sample({
      clock: innerFx.finally,
      source: {
        openId: $openId,
        isOpen: $isOpen,
        inFlight: $inFlight,
      },
      filter: ({ openId, isOpen }, payload) =>
        isBelongOpenSession({
          openId,
          effectOpenId: payload.params._openId,
          isOpen,
        }),
      fn: ({ inFlight }, payload) => ({
        finallyEvent: { ...payload, params: payload.params.originalParams },
        inFlight: Math.max(0, inFlight - 1),
      }),
      target: spread({
        finallyEvent: finallyEvent,
        inFlight: $inFlight,
      }),
    });

    sample({
      clock: done,
      fn: ({ result }) => result,
      target: doneData,
    });

    sample({
      clock: fail,
      fn: ({ error }) => error,
      target: failData,
    });

    return overrideEffectFields(protectedFx, {
      done: readonly(done),
      doneData: readonly(doneData),
      fail: readonly(fail),
      failData: readonly(failData),
      finally: readonly(finallyEvent),
      inFlight: readonly($inFlight),
      pending: $inFlight.map((count) => count > 0),
    });
  };

  /**
   * Creates a protected readonly event derived from the provided event.
   *
   * The original event should still be called from the UI or external code.
   * The returned protected event should be used in the internal model logic
   * instead of the original event.
   *
   * This makes it safe to ignore events that do not belong to the current
   * open session, for example when the UI entity has already been closed
   * or reopened.
   *
   * @template Payload Event payload type.
   *
   * @param event Event that should be protected from being handled outside
   * the current open session.
   *
   * @returns Readonly event that emits the original payload only when the event
   * belongs to the current open session.
   *
   * @example
   * const formSubmitted = createEvent<FormValues>();
   *
   * const protectedFormSubmitted =
   *   openSessionModel.protectEvent(formSubmitted);
   *
   * // UI or external layer calls the original event.
   * formSubmitted({ name: "John", email: "john@example.com" });
   *
   * // Internal model logic listens to the protected event.
   * sample({
   *   clock: protectedFormSubmitted,
   *   target: submitFormFx,
   * });
   *
   * @example
   * const closeClicked = createEvent<void>();
   *
   * const protectedCloseClicked =
   *   openSessionModel.protectEvent(closeClicked);
   *
   * sample({
   *   clock: protectedCloseClicked,
   *   target: someModelEvent,
   * });
   */
  const protectEvent = <Payload = void>(
    event: EventCallable<Payload> | Event<Payload>,
  ) => {
    const protectedEvent = createEvent<Payload>();
    const innerEvent = createEvent<OpenSessionPayload<Payload>>();

    sample({
      clock: event,
      source: $openId,
      fn: (_openId, originalPayload) => ({
        originalPayload,
        _openId,
      }),
      target: innerEvent,
    });

    sample({
      clock: innerEvent,
      source: {
        openId: $openId,
        isOpen: $isOpen,
      },
      filter: ({ openId, isOpen }, payload) =>
        isBelongOpenSession({
          openId,
          effectOpenId: payload._openId,
          isOpen,
        }),
      fn: (_, payload) => payload.originalPayload,
      target: protectedEvent,
    });

    return readonly(protectedEvent);
  };

  return {
    $openId: readonly($openId),
    protectEffect,
    protectEvent,
  };
};
