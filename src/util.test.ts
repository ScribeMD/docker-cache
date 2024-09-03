import { exec } from "node:child_process";
import { testProp } from "@fast-check/jest";
import { jest } from "@jest/globals";
import { fullUnicodeString } from "fast-check";

import { consoleOutput, platform } from "./arbitraries/util.js";
import { utilFactory } from "./mocks/util.js";

import type { ConsoleOutput } from "./util.js";

jest.unstable_mockModule("node:util", utilFactory);
jest.mock("@actions/core");

const nodeUtil = jest.mocked(await import("node:util"));
const core = jest.mocked(await import("@actions/core"));
const util = await import("./util.js");

describe("Util", (): void => {
  describe("execBashCommand", (): void => {
    const mockedExec = async (
      command: string,
      error: Error | null,
      platform: NodeJS.Platform,
      output: ConsoleOutput,
    ): Promise<string> => {
      const execMock = jest.fn(
        (): Promise<ConsoleOutput> =>
          error ? Promise.reject(error) : Promise.resolve(output),
      );

      nodeUtil.promisify.mockReturnValueOnce(execMock);

      const stdout = await util.execBashCommand(command, platform);

      expect(core.info).nthCalledWith<[string]>(1, command);
      expect(nodeUtil.promisify).lastCalledWith(exec);
      const shell =
        platform === "win32"
          ? "C:\\Program Files\\Git\\bin\\bash.exe"
          : "/bin/bash";
      expect(execMock).lastCalledWith(command, { shell });
      return stdout;
    };

    testProp(
      "ferries command output to GitHub Actions on success",
      [fullUnicodeString(), platform(), consoleOutput()],
      async (
        command: string,
        platform: NodeJS.Platform,
        output: ConsoleOutput,
      ): Promise<void> => {
        jest.clearAllMocks();
        const stdout = await mockedExec(command, null, platform, output);

        expect(stdout).toBe(output.stdout);
        expect(core.info).lastCalledWith(output.stdout);
        expect(core.error).lastCalledWith(output.stderr);
      },
      {
        examples: [
          ["sample Linux command", "linux", { stdout: "", stderr: "" }],
          ["sample Windows command", "win32", { stdout: "", stderr: "" }],
        ],
      },
    );

    testProp(
      "ferries failure to GitHub Actions",
      [fullUnicodeString(), fullUnicodeString(), platform(), consoleOutput()],
      async (
        command: string,
        errorMessage: string,
        platform: NodeJS.Platform,
        output: ConsoleOutput,
      ): Promise<void> => {
        jest.clearAllMocks();
        const error = new Error(errorMessage);
        const stdout = await mockedExec(command, error, platform, output);

        expect(stdout).toBe("");
        expect(core.info).toHaveBeenCalledTimes(1);
        expect(core.error).not.toHaveBeenCalled();
        expect(core.setFailed).lastCalledWith(error);
      },
      {
        examples: [
          ["sample Linux command", "", "linux", { stdout: "", stderr: "" }],
          ["sample Windows command", "", "win32", { stdout: "", stderr: "" }],
        ],
      },
    );
  });
});
