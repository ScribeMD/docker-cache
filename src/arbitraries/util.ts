import { constantFrom, fullUnicodeString, record } from "fast-check";

import type { Arbitrary } from "fast-check";

import type { ConsoleOutput } from "../util.js";

export const consoleOutput = (): Arbitrary<ConsoleOutput> =>
  record({
    stdout: fullUnicodeString(),
    stderr: fullUnicodeString(),
  });

export const platform = (): Arbitrary<NodeJS.Platform> =>
  constantFrom("linux", "win32");
