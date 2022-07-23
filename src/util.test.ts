import { jest } from "@jest/globals";

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
    const COMMAND = "Bash command to execute";

    const mockedExec = async (
      error: Error | null,
      stdout: string | null = null,
      stderr: string | null = null
    ): Promise<void> => {
      child_process.exec.mockImplementationOnce(
        (_command: any, _options: any, callback: any): any => {
          callback(error, { stdout, stderr });
        }
      );
      await util.execBashCommand(COMMAND);

      expect(core.info).nthCalledWith<[string]>(1, COMMAND);
      expect(child_process.exec).lastCalledWith(
        COMMAND,
        { shell: "/usr/bin/bash" },
        expect.anything()
      );
    };

    test("ferries command output to GitHub Actions on success", async (): Promise<void> => {
      const stdout = "standard output from Bash command";
      const stderr = "error output from Bash command";
      await mockedExec(null, stdout, stderr);

      expect(core.info).lastCalledWith(stdout);
      expect(core.error).lastCalledWith(stderr);
    });

    test("ferries failure to GitHub Actions", async (): Promise<void> => {
      const error = new Error("reason Bash command failed");
      await mockedExec(error);

      expect(core.info).toHaveBeenCalledTimes(1);
      expect(core.error).not.toHaveBeenCalled();
      expect(core.setFailed).lastCalledWith(error.toString());
    });
  });
});

export { Mocked };
