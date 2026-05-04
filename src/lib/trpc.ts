import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@tradelab/backend/router";

export const trpc = createTRPCReact<AppRouter>();
