import { constantFrom, record, string } from "fast-check";

import type { Arbitrary } from "fast-check";

import type { ConsoleOutput } from "../util.js";

export const consoleOutput = (): Arbitrary<ConsoleOutput> =>
  record({
    stdout: string(),
    stderr: string(),
  });

export const platform = (): Arbitrary<NodeJS.Platform> =>
  constantFrom("linux", "win32");
