import { exec } from "node:child_process";
import { promisify } from "node:util";
const execAsPromised = promisify(exec);

import { error, info, setFailed } from "@actions/core";

const execBashCommand = async (
  command: string,
  platform: NodeJS.Platform = process.platform
): Promise<string> => {
  info(command);
  const shell =
    platform === "win32"
      ? "C:\\Program Files\\Git\\bin\\bash.exe"
      : "/usr/bin/bash";
  let output = "";
  try {
    const result = await execAsPromised(command, { shell });
    output = result.stdout;
    info(output);
    error(result.stderr);
  } catch (error: any) {
    setFailed(error.toString());
  }
  return output;
};

export { execBashCommand };
