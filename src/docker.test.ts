import { jest } from "@jest/globals";

import type { Mocked } from "./util.test.js";

jest.mock("@actions/cache");
jest.mock("@actions/core");

jest.unstable_mockModule("./util.js", (): typeof import("./util.js") => ({
  CACHE_HIT: "cache-hit",
  DOCKER_IMAGES_PATH: "~/.docker-images.tar",
  execBashCommand: jest.fn<typeof import("./util.js").execBashCommand>(),
}));

/* Expect the given mocks each to have been called exactly once and in the given
 * order.
 */
const assertCalledInOrder = (...mocks: jest.Mock[]): void => {
  const callOrders = mocks.map((currentMock: jest.Mock): number => {
    expect(currentMock).toHaveBeenCalledTimes(1);
    return <number>currentMock.mock.invocationCallOrder[0];
  });

  const sortedCallOrders = [...callOrders].sort(
    (a: number, b: number) => a - b
  );
  expect(callOrders).toStrictEqual(sortedCallOrders);
};

describe("Docker images", (): void => {
  const KEY = "a-cache-key";

  let cache: Mocked<typeof import("@actions/cache")>;
  let core: Mocked<typeof import("@actions/core")>;
  let util: Mocked<typeof import("./util.js")>;
  let docker: typeof import("./docker.js");

  beforeAll(async (): Promise<void> => {
    cache = <any>await import("@actions/cache");
    core = <any>await import("@actions/core");
    util = <any>await import("./util.js");
    docker = await import("./docker.js");

    core.getInput.mockReturnValue(KEY);
  });

  const mockedLoadDockerImages = async (cacheHit: boolean): Promise<void> => {
    cache.restoreCache.mockResolvedValueOnce(cacheHit ? KEY : undefined);
    await docker.loadDockerImages();

    expect(core.getInput).lastCalledWith("key", { required: true });
    expect(cache.restoreCache).lastCalledWith([util.DOCKER_IMAGES_PATH], KEY);
  };

  const mockedSaveDockerImages = async (cacheHit: boolean): Promise<void> => {
    core.getState.mockReturnValueOnce(cacheHit.toString());
    await docker.saveDockerImages();

    expect(core.getInput).lastCalledWith("key", { required: true });
    expect(core.getState).lastCalledWith(util.CACHE_HIT);
  };

  test("are loaded on cache hit", async (): Promise<void> => {
    await mockedLoadDockerImages(true);

    expect(core.saveState).lastCalledWith(util.CACHE_HIT, true);
    expect(core.setOutput).lastCalledWith(util.CACHE_HIT, true);
    expect(util.execBashCommand).lastCalledWith(
      `docker load --input ${util.DOCKER_IMAGES_PATH}`
    );

    /* The cache must be restored before the Docker images can be loaded. This
     * at least checks that the calls are made in the right order, but doesn't
     * ensure that the cache finished restoring before the Docker images started
     * loading.
     */
    assertCalledInOrder(
      core.getInput,
      cache.restoreCache,
      util.execBashCommand
    );
  });

  test("aren't loaded on cache miss", async (): Promise<void> => {
    await mockedLoadDockerImages(false);

    expect(core.saveState).lastCalledWith(util.CACHE_HIT, false);
    expect(core.setOutput).lastCalledWith(util.CACHE_HIT, false);
    expect(util.execBashCommand).not.toHaveBeenCalled();
  });

  test("are saved on cache miss", async (): Promise<void> => {
    await mockedSaveDockerImages(false);

    expect(util.execBashCommand).lastCalledWith(
      'docker image list --format "{{ .Repository }}:{{ .Tag }}" | ' +
        '2>&1 xargs --delimiter="\n" --no-run-if-empty --verbose --exit ' +
        `docker save --output ${util.DOCKER_IMAGES_PATH}`
    );
    expect(cache.saveCache).lastCalledWith([util.DOCKER_IMAGES_PATH], KEY);

    /* The Docker images must be saved before the cache can be. This at least
     * checks that the calls are made in the right order, but doesn't ensure
     * that the Docker images finished saving before the cache started saving.
     */
    assertCalledInOrder(
      core.getInput,
      core.getState,
      util.execBashCommand,
      cache.saveCache
    );
  });

  test("aren't saved on cache hit", async (): Promise<void> => {
    await mockedSaveDockerImages(true);

    expect(core.info).lastCalledWith(
      `Cache hit occurred on the primary key ${KEY}, not saving cache.`
    );
    expect(util.execBashCommand).not.toHaveBeenCalled();
    expect(cache.saveCache).not.toHaveBeenCalled();
  });
});
