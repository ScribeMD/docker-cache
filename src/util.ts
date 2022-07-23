import { exec } from "node:child_process";
import { promisify } from "node:util";
const execAsPromised = promisify(exec);

import { error, info, setFailed } from "@actions/core";

const execBashCommand = async (command: string): Promise<void> => {
  info(command);
  try {
    const result = await execAsPromised(command, { shell: "/usr/bin/bash" });
    info(result.stdout);
    error(result.stderr);
  } catch (error: any) {
    setFailed(error.toString());
  }
};

export { execBashCommand };
