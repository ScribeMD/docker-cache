import { exec } from "node:child_process";
import { promisify } from "node:util";
const execAsPromised = promisify(exec);

import { error, info, setFailed } from "@actions/core";

const execBashCommand = async (command: string): Promise<string> => {
  info(command);
  let output = "";
  try {
    const result = await execAsPromised(command);
    output = result.stdout;
    info(output);
    error(result.stderr);
  } catch (error: any) {
    setFailed(error.toString());
  }
  return output;
};

export { execBashCommand };
