import { testProp } from "@fast-check/jest";
import { jest } from "@jest/globals";
import { string } from "fast-check";

import { consoleOutput, platform } from "./arbitraries/util.js";

import type { ConsoleOutput } from "./util.js";

jest.unstable_mockModule("node:child_process", () => ({
  exec: jest.fn<typeof import("node:child_process").exec>(),
}));

jest.mock("@actions/core");

describe("Util", (): void => {
  let child_process: jest.MockedObject<typeof import("node:child_process")>;
  let core: jest.MockedObject<typeof import("@actions/core")>;
  let util: typeof import("./util.js");

  beforeAll(async (): Promise<void> => {
    child_process = jest.mocked(await import("node:child_process"));
    core = jest.mocked(await import("@actions/core"));
    util = await import("./util.js");
  });

  describe("execBashCommand", (): void => {
    const mockedExec = async (
      command: string,
      error: Error | null,
      platform: NodeJS.Platform,
      output: ConsoleOutput
    ): Promise<string> => {
      child_process.exec.mockImplementationOnce(<typeof child_process.exec>((
        _command: any,
        _options: any,
        callback: any
      ): any => {
        callback(error, output);
      }));
      const stdout = await util.execBashCommand(command, platform);

      expect(core.info).nthCalledWith<[string]>(1, command);
      const shell =
        platform === "win32"
          ? "C:\\Program Files\\Git\\bin\\bash.exe"
          : "/usr/bin/bash";
      expect(child_process.exec).lastCalledWith(
        command,
        { shell },
        expect.anything()
      );
      return stdout;
    };

    testProp(
      "ferries command output to GitHub Actions on success",
      [string(), platform(), consoleOutput()],
      async (
        command: string,
        platform: NodeJS.Platform,
        output: ConsoleOutput
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
      }
    );

    testProp(
      "ferries failure to GitHub Actions",
      [string(), string(), platform(), consoleOutput()],
      async (
        command: string,
        errorMessage: string,
        platform: NodeJS.Platform,
        output: ConsoleOutput
      ): Promise<void> => {
        jest.clearAllMocks();
        const error = new Error(errorMessage);
        const stdout = await mockedExec(command, error, platform, output);

        expect(stdout).toBe("");
        expect(core.info).toHaveBeenCalledTimes(1);
        expect(core.error).not.toHaveBeenCalled();
        expect(core.setFailed).lastCalledWith(error.toString());
      },
      {
        examples: [
          ["sample Linux command", "", "linux", { stdout: "", stderr: "" }],
          ["sample Windows command", "", "win32", { stdout: "", stderr: "" }],
        ],
      }
    );
  });
});
