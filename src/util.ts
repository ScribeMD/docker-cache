import { exec } from "node:child_process";
import { promisify } from "node:util";

import { error, info, setFailed } from "@actions/core";

type ConsoleOutput = {
  stdout: string;
  stderr: string;
};

const execBashCommand = async (
  command: string,
  platform: NodeJS.Platform = process.platform
): Promise<string> => {
  info(command);
  const execAsPromised = promisify(exec);
  const shell =
    platform === "win32"
      ? "C:\\Program Files\\Git\\bin\\bash.exe"
      : "/usr/bin/bash";
  let stdout = "";
  try {
    const output: ConsoleOutput = await execAsPromised(command, { shell });
    stdout = output.stdout;
    info(stdout);
    error(output.stderr);
  } catch (error: any) {
    setFailed(error);
  }
  return stdout;
};

export { ConsoleOutput, execBashCommand };
