import { createTRPCReact } from "@trpc/react-query";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@tradelab/backend/router";

export const trpc = createTRPCReact<AppRouter>();

/** tRPC router 의 입력 타입 추론 — `RouterInputs["simulatorLeaderboard"]["fetch"]` */
export type RouterInputs = inferRouterInputs<AppRouter>;
/** tRPC router 의 출력 타입 추론 — `RouterOutputs["simulatorLeaderboard"]["fetch"]` */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
