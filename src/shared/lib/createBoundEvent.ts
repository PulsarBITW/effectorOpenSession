import { scopeBind, type EventCallable } from "effector";

import { appScope } from "@shared/config/effector";

export function createBoundEvent<T>(
  event: EventCallable<T>
): (payload: T) => void {
  return scopeBind(event, { scope: appScope });
}
