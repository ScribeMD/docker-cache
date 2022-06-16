import { testProp } from "@fast-check/jest";
import { jest } from "@jest/globals";
import { string } from "fast-check";

jest.unstable_mockModule("node:child_process", () => ({
  exec: jest.fn<typeof import("node:child_process").exec>(),
}));

jest.mock("@actions/core");

type Mocked<T> = jest.MockedObject<Awaited<T>>;

describe("Util", (): void => {
  let child_process: Mocked<typeof import("node:child_process")>;
  let core: Mocked<typeof import("@actions/core")>;
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
      stdout: string = "",
      stderr: string = ""
    ): Promise<string> => {
      child_process.exec.mockImplementationOnce(
        (_command: any, _options: any, callback: any): any => {
          callback(error, { stdout, stderr });
        }
      );
      const output = await util.execBashCommand(command);

      expect(core.info).nthCalledWith<[string]>(1, command);
      expect(child_process.exec).lastCalledWith(
        command,
        { shell: "/usr/bin/bash" },
        expect.anything()
      );
      return output;
    };

    testProp(
      "ferries command output to GitHub Actions on success",
      [string(), string(), string()],
      async (
        command: string,
        stdout: string,
        stderr: string
      ): Promise<void> => {
        jest.clearAllMocks();
        const output = await mockedExec(command, null, stdout, stderr);

        expect(output).toBe(stdout);
        expect(core.info).lastCalledWith(stdout);
        expect(core.error).lastCalledWith(stderr);
      }
    );

    testProp(
      "ferries failure to GitHub Actions",
      [string(), string(), string(), string()],
      async (
        command: string,
        errorMessage: string,
        stdout: string,
        stderr: string
      ): Promise<void> => {
        jest.clearAllMocks();
        const error = new Error(errorMessage);
        const output = await mockedExec(command, error, stdout, stderr);

        expect(output).toBe("");
        expect(core.info).toHaveBeenCalledTimes(1);
        expect(core.error).not.toHaveBeenCalled();
        expect(core.setFailed).lastCalledWith(error.toString());
      }
    );
  });
});

export { Mocked };
