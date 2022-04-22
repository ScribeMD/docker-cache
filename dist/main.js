import { restoreCache } from "@actions/cache";
import { getInput, saveState, setOutput } from "@actions/core";
import { CACHE_HIT, DOCKER_IMAGES_PATH, execBashCommand } from "./util";
const loadDockerImages = async () => {
    const requestedKey = getInput("key", { required: true });
    const restoredKey = await restoreCache([DOCKER_IMAGES_PATH], requestedKey);
    const cacheHit = requestedKey === restoredKey;
    saveState(CACHE_HIT, cacheHit);
    setOutput(CACHE_HIT, cacheHit);
    if (cacheHit) {
        await execBashCommand(`docker load --input ${DOCKER_IMAGES_PATH}`);
    }
};
await loadDockerImages();
export { loadDockerImages };
