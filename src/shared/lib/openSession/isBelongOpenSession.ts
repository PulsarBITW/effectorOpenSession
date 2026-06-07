export type IsBelongOpenSessionParams = {
  openId: string | null;
  effectOpenId: string | null;
  isOpen: boolean;
};

export const isBelongOpenSession = (params: IsBelongOpenSessionParams) => {
  logMatching(params);
  return params.isOpen && params.effectOpenId === params.openId;
};

const logMatching = (params: IsBelongOpenSessionParams) => {
  console.log("\n");
  console.log("@__IsBelongOpenSession__@");
  console.log(
    "isBelong: ",
    params.isOpen && params.effectOpenId === params.openId,
  );
  console.log("Params", params);
  console.log("@_______________________@");
  console.log("\n");
};
