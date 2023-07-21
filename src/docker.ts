import { restoreCache, saveCache } from "@actions/cache";
import { getInput, getState, info, saveState, setOutput } from "@actions/core";

import { execBashCommand } from "./util.js";

const CACHE_HIT = "cache-hit";
const DOCKER_IMAGES_LIST = "docker-images-list";
const DOCKER_IMAGES_PATH = "~/.docker-images.tar";
const LIST_COMMAND =
  'docker image list --format "{{ .Repository }}:{{ .Tag }}"';

const loadDockerImages = async (): Promise<void> => {
  const requestedKey = getInput("key", { required: true });
  const restoredKey = await restoreCache([DOCKER_IMAGES_PATH], requestedKey);
  const cacheHit = requestedKey === restoredKey;
  saveState(CACHE_HIT, cacheHit);
  setOutput(CACHE_HIT, cacheHit);
  if (cacheHit) {
    await execBashCommand(`docker load --input ${DOCKER_IMAGES_PATH}`);
  } else {
    info(
      "Recording preexisting Docker images. These include standard images " +
        "pre-cached by GitHub Actions when Docker is run as root."
    );
    const dockerImages = await execBashCommand(LIST_COMMAND);
    saveState(DOCKER_IMAGES_LIST, dockerImages);
  }
};

const saveDockerImages = async (): Promise<void> => {
  const key = getInput("key", { required: true });
  const includedImages = getInput("included-images", { required: true });
  const includedImagesList = includedImages.split(" ");
  if (getState(CACHE_HIT) === "true") {
    info(`Cache hit occurred on the primary key ${key}, not saving cache.`);
  } else if (getInput("read-only") === "true") {
    info(
      `Cache miss occurred on the primary key ${key}. Not saving cache as ` +
        "read-only option was selected."
    );
  } else {
    const preexistingImages = getState(DOCKER_IMAGES_LIST).split("\n");
    info("Listing Docker images.");
    const images = await execBashCommand(LIST_COMMAND);
    const imagesList = images.split("\n");
    const newImages = imagesList.filter(
      (image: string): boolean =>
        !preexistingImages.includes(image) &&
        includedImagesList.includes(image)
    );
    if (newImages.length === 0) {
      info("No Docker images to save");
    } else {
      info(
        "Images present before restore step will be skipped; only new images " +
          "will be saved."
      );
      const newImagesArgs = newImages.join(" ");
      info("newImagesArgs");
      info(newImagesArgs);
      const cmd = `docker save --output ${DOCKER_IMAGES_PATH} ${newImagesArgs}`;
      await execBashCommand(cmd);
      await saveCache([DOCKER_IMAGES_PATH], key);
    }
  }
};

export {
  saveDockerImages,
  loadDockerImages,
  CACHE_HIT,
  DOCKER_IMAGES_LIST,
  DOCKER_IMAGES_PATH,
};
