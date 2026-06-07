export type DonePayload<Params = void, Done = void> = {
  params: Params;
  result: Done;
};

export type FailPayload<Params = void, Fail = Error> = {
  params: Params;
  error: Fail;
};

export type FinallyPayload<Params = void, Done = void, Fail = Error> =
  | ({ status: "done" } & DonePayload<Params, Done>)
  | ({ status: "fail" } & FailPayload<Params, Fail>);
