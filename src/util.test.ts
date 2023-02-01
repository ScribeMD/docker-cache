import { testProp } from "@fast-check/jest";
import { jest } from "@jest/globals";
import { Arbitrary, constantFrom, string } from "fast-check";

jest.unstable_mockModule("node:child_process", () => ({
  exec: jest.fn<typeof import("node:child_process").exec>(),
}));

jest.mock("@actions/core");

describe("Util", (): void => {
  let child_process: jest.MockedObject<typeof import("node:child_process")>;
  let core: jest.MockedObject<typeof import("@actions/core")>;
  let util: typeof import("./util.js");

  beforeAll(async (): Promise<void> => {
    child_process = <any>await import("node:child_process");
    core = <any>await import("@actions/core");
    util = await import("./util.js");
  });

  describe("execBashCommand", (): void => {
    const mockedExec = async (
      command: string,
      error: Error | null,
      platform: NodeJS.Platform,
      stdout = "",
      stderr = ""
    ): Promise<string> => {
      child_process.exec.mockImplementationOnce(<typeof child_process.exec>((
        _command: any,
        _options: any,
        callback: any
      ): any => {
        callback(error, { stdout, stderr });
      }));
      const output = await util.execBashCommand(command, platform);

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
      return output;
    };

    const platform = (): Arbitrary<NodeJS.Platform> =>
      constantFrom<NodeJS.Platform>("linux", "win32");

    testProp(
      "ferries command output to GitHub Actions on success",
      [string(), platform(), string(), string()],
      async (
        command: string,
        platform: NodeJS.Platform,
        stdout: string,
        stderr: string
      ): Promise<void> => {
        jest.clearAllMocks();
        const output = await mockedExec(
          command,
          null,
          platform,
          stdout,
          stderr
        );

        expect(output).toBe(stdout);
        expect(core.info).lastCalledWith(stdout);
        expect(core.error).lastCalledWith(stderr);
      },
      {
        examples: [
          ["sample Linux command", "linux", "", ""],
          ["sample Windows command", "win32", "", ""],
        ],
      }
    );

    testProp(
      "ferries failure to GitHub Actions",
      [string(), string(), platform(), string(), string()],
      async (
        command: string,
        errorMessage: string,
        platform: NodeJS.Platform,
        stdout: string,
        stderr: string
      ): Promise<void> => {
        jest.clearAllMocks();
        const error = new Error(errorMessage);
        const output = await mockedExec(
          command,
          error,
          platform,
          stdout,
          stderr
        );

        expect(output).toBe("");
        expect(core.info).toHaveBeenCalledTimes(1);
        expect(core.error).not.toHaveBeenCalled();
        expect(core.setFailed).lastCalledWith(error.toString());
      },
      {
        examples: [
          ["sample Linux command", "", "linux", "", ""],
          ["sample Windows command", "", "win32", "", ""],
        ],
      }
    );
  });
});
