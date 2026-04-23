import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@offergo/auth/core";

export const { GET, POST, PUT, PATCH, DELETE } = toNextJsHandler(auth);
