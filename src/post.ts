import { saveCache } from "@actions/cache";
import { getInput, getState } from "@actions/core";

import { CACHE_HIT, DOCKER_IMAGES_PATH, execBashCommand } from "./util";

const saveDockerImages = async (): Promise<void> => {
  if (!getState(CACHE_HIT)) {
    await execBashCommand(
      'docker image list --format "{{ .Repository }}:{{ .Tag }}" | ' +
        'xargs --delimiter="\n" --no-run-if-empty --verbose --exit ' +
        `docker save --output ${DOCKER_IMAGES_PATH}`
    );
    const key = getInput("key", { required: true });
    await saveCache([DOCKER_IMAGES_PATH], key);
  }
};

await saveDockerImages();

export { saveDockerImages };
