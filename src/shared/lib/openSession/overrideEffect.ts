import type { Effect } from "effector";

export const overrideEffectFields = <Params, Done, Fail>(
  effect: Effect<Params, Done, Fail>,
  fields: Partial<Effect<Params, Done, Fail>>,
): Effect<Params, Done, Fail> => Object.assign(effect, fields);
