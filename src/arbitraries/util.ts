import {
  constantFrom,
  fullUnicode,
  fullUnicodeString,
  record,
  stringOf,
  tuple,
  uniqueArray,
} from "fast-check";

import type { Arbitrary } from "fast-check";

import type { ConsoleOutput } from "../util.js";

export const consoleOutput = (): Arbitrary<ConsoleOutput> =>
  record({
    stdout: fullUnicodeString(),
    stderr: fullUnicodeString(),
  });

export const dockerImages = (): Arbitrary<string[]> =>
  uniqueArray(
    stringOf(
      fullUnicode().filter((char: string): boolean => char !== "\n"),
      { minLength: 1 },
    ),
  );

export const platform = (): Arbitrary<NodeJS.Platform> =>
  constantFrom("linux", "win32");

/**
 * @template T
 * @param arrArbA an arbitrary that generates an array of T
 * @param arrArbB an arbitrary that generates an array of T
 * @returns an arbitrary that generates a 2-tuple of arrays of T with no overlap
 */
export const uniquePair = <T>(
  arrArbA: Arbitrary<T[]>,
  arrArbB: Arbitrary<T[]>,
): Arbitrary<[T[], T[]]> =>
  tuple(arrArbA, arrArbB).map(([arrayA, arrayB]: [T[], T[]]): [T[], T[]] => {
    const setA = new Set(arrayA);
    arrayB = arrayB.filter((elem: T): boolean => !setA.has(elem));
    return [arrayA, arrayB];
  });
