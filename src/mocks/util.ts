import { jest } from "@jest/globals";

import type { promisify } from "node:util";

export const utilFactory = (): {
  promisify: Omit<typeof promisify, "custom">;
} => ({
  promisify: jest.fn<typeof promisify>(),
});
