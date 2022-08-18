import { jest } from "@jest/globals";

import type { Mocked } from "./util.test.js";

jest.mock("@actions/cache");
jest.mock("@actions/core");

jest.unstable_mockModule("./util.js", (): typeof import("./util.js") => ({
  execBashCommand: jest.fn<typeof import("./util.js").execBashCommand>(),
}));

// Expect the given mocks were called in the given order.
const assertCalledInOrder = (...mocks: jest.Mock[]): void => {
  const mockCallCounts: Record<string, number> = {};
  const callOrders = mocks.map((currentMock: jest.Mock): number => {
    const mockName = currentMock.getMockName();
    const callCount = mockCallCounts[mockName] ?? 0;
    mockCallCounts[mockName] = callCount + 1;
    return <number>currentMock.mock.invocationCallOrder[callCount];
  });

  const sortedCallOrders = [...callOrders].sort(
    (a: number, b: number): number => a - b
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
  });

  beforeEach(async (): Promise<void> => {
    core.getInput.mockReturnValueOnce(KEY);
  });

  const assertLoadDockerImages = (cacheHit: boolean): void => {
    expect(core.getInput).lastCalledWith("key", { required: true });
    expect(cache.restoreCache).lastCalledWith([docker.DOCKER_IMAGES_PATH], KEY);
    expect(core.saveState).lastCalledWith(docker.CACHE_HIT, cacheHit);
    expect(core.setOutput).lastCalledWith(docker.CACHE_HIT, cacheHit);
  };

  const mockedLoadDockerImages = async (cacheHit: boolean): Promise<void> => {
    cache.restoreCache.mockResolvedValueOnce(cacheHit ? KEY : undefined);
    await docker.loadDockerImages();

    assertLoadDockerImages(cacheHit);
  };

  const mockedSaveDockerImages = async (
    cacheHit: boolean,
    readOnly: boolean = false
  ): Promise<void> => {
    core.getState.mockReturnValueOnce(cacheHit.toString());
    if (!cacheHit) {
      core.getInput.mockReturnValueOnce(readOnly.toString());
    }
    await docker.saveDockerImages();

    expect(core.getInput).nthCalledWith(1, "key", { required: true });
    if (!cacheHit) {
      expect(core.getInput).lastCalledWith("read-only");
    }
    expect(core.getState).lastCalledWith(docker.CACHE_HIT);
  };

  const assertCacheHitSave = (): void => {
    expect(core.info).lastCalledWith(
      `Cache hit occurred on the primary key ${KEY}, not saving cache.`
    );
    expect(util.execBashCommand).not.toHaveBeenCalled();
    expect(cache.saveCache).not.toHaveBeenCalled();
  };

  test("exports CACHE_HIT", (): void => {
    expect(docker.CACHE_HIT).toBe("cache-hit");
  });

  test("exports DOCKER_IMAGES_PATH", (): void => {
    expect(docker.DOCKER_IMAGES_PATH).toBe("~/.docker-images.tar");
  });

  test("are loaded on cache hit", async (): Promise<void> => {
    await mockedLoadDockerImages(true);

    expect(util.execBashCommand).lastCalledWith(
      `docker load --input ${docker.DOCKER_IMAGES_PATH}`
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

    expect(util.execBashCommand).not.toHaveBeenCalled();
  });

  test("are saved on cache miss", async (): Promise<void> => {
    await mockedSaveDockerImages(false);

    expect(util.execBashCommand).lastCalledWith(
      'docker image list --format "{{ .Repository }}:{{ .Tag }}" | ' +
        '2>&1 xargs --delimiter="\n" --no-run-if-empty --verbose --exit ' +
        `docker save --output ${docker.DOCKER_IMAGES_PATH}`
    );
    expect(cache.saveCache).lastCalledWith([docker.DOCKER_IMAGES_PATH], KEY);

    /* The Docker images must be saved before the cache can be. This at least
     * checks that the calls are made in the right order, but doesn't ensure
     * that the Docker images finished saving before the cache started saving.
     */
    assertCalledInOrder(
      core.getInput,
      core.getState,
      core.getInput,
      util.execBashCommand,
      cache.saveCache
    );
  });

  test("aren't saved on cache miss when in read-only mode", async (): Promise<void> => {
    await mockedSaveDockerImages(false, true);

    expect(core.info).lastCalledWith(
      `Cache miss occurred on the primary key ${KEY}. ` +
        "Not saving cache as read-only option was selected."
    );
    expect(util.execBashCommand).not.toHaveBeenCalled();
    expect(cache.saveCache).not.toHaveBeenCalled();
  });

  test("aren't saved on cache hit when in read-only mode", async (): Promise<void> => {
    await mockedSaveDockerImages(true, true);

    assertCacheHitSave();
  });

  test("aren't saved on cache hit", async (): Promise<void> => {
    await mockedSaveDockerImages(true);

    assertCacheHitSave();
  });
});
