import { restoreCache, saveCache } from "@actions/cache";
import { getInput, getState, info, saveState, setOutput } from "@actions/core";

import { CACHE_HIT, DOCKER_IMAGES_PATH, execBashCommand } from "./util.js";

const loadDockerImages = async (): Promise<void> => {
  const requestedKey = getInput("key", { required: true });
  const restoredKey = await restoreCache([DOCKER_IMAGES_PATH], requestedKey);
  const cacheHit = requestedKey === restoredKey;
  saveState(CACHE_HIT, cacheHit);
  setOutput(CACHE_HIT, cacheHit);
  if (cacheHit) {
    await execBashCommand(`docker load --input ${DOCKER_IMAGES_PATH}`);
  }
};

const saveDockerImages = async (): Promise<void> => {
  const key = getInput("key", { required: true });
  if (getState(CACHE_HIT) === "true") {
    info(`Cache hit occurred on the primary key ${key}, not saving cache.`);
  } else {
    await execBashCommand(
      'docker image list --format "{{ .Repository }}:{{ .Tag }}" | ' +
        '2>&1 xargs --delimiter="\n" --no-run-if-empty --verbose --exit ' +
        `docker save --output ${DOCKER_IMAGES_PATH}`
    );
    await saveCache([DOCKER_IMAGES_PATH], key);
  }
};

export { saveDockerImages, loadDockerImages };
