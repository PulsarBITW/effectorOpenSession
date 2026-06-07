export type CreateTaskRequestDto = { value: string };

export type CreateTaskResponseDto = { status: "success" | "fail" };

export async function postCreateTask(
  req: CreateTaskRequestDto,
): Promise<CreateTaskResponseDto> {
  console.log("@req", req);
  await pause(Math.random() * 1000 + 2_000);
  return { status: Math.random() > 0.3 ? "success" : "fail" };
}

const pause = (delay: number) => new Promise((res) => setTimeout(res, delay));
