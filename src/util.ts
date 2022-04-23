import { exec } from "child_process";
import { promisify } from "util";
const execAsPromised = promisify(exec);

import { error, info, setFailed } from "@actions/core";

const CACHE_HIT = "cache-hit";
const DOCKER_IMAGES_PATH = "~/.docker-images.tar";

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

export { CACHE_HIT, DOCKER_IMAGES_PATH, execBashCommand };
