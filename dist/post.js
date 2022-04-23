import { saveCache } from "@actions/cache";
import { getInput, getState, info } from "@actions/core";
import { CACHE_HIT, DOCKER_IMAGES_PATH, execBashCommand } from "./util";
const saveDockerImages = async () => {
    const key = getInput("key", { required: true });
    if (getState(CACHE_HIT)) {
        info(`Cache hit occurred on the primary key ${key}, not saving cache.`);
    }
    else {
        await execBashCommand('docker image list --format "{{ .Repository }}:{{ .Tag }}" | ' +
            'xargs --delimiter="\n" --no-run-if-empty --verbose --exit ' +
            `docker save --output ${DOCKER_IMAGES_PATH}`);
        await saveCache([DOCKER_IMAGES_PATH], key);
    }
};
await saveDockerImages();
export { saveDockerImages };
