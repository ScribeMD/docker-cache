import { jest } from "@jest/globals";

import type { InputOptions } from "@actions/core";
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
  const IMAGES_LIST = Array.from(
    { length: 4 },
    (_elem: undefined, index: number): string => `test-docker-image:v${index}`
  );
  const IMAGES = IMAGES_LIST.join("\n");
  const PREEXISTING_IMAGES = IMAGES_LIST.slice(1, 3).reverse().join("\n");
  const NEW_IMAGES = [IMAGES_LIST[0], IMAGES_LIST[3]].join(" ");

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
    expect(core.saveState).nthCalledWith<[string, boolean]>(
      1,
      docker.CACHE_HIT,
      cacheHit
    );
    expect(core.setOutput).lastCalledWith(docker.CACHE_HIT, cacheHit);
    if (cacheHit) {
      expect(util.execBashCommand).lastCalledWith(
        `docker load --input ${docker.DOCKER_IMAGES_PATH}`
      );
    } else {
      expect(util.execBashCommand).lastCalledWith(
        'docker image list --format "{{ .Repository }}:{{ .Tag }}"'
      );
    }
    expect(util.execBashCommand).toHaveBeenCalledTimes(1);
  };

  const mockedLoadDockerImages = async (cacheHit: boolean): Promise<void> => {
    cache.restoreCache.mockResolvedValueOnce(cacheHit ? KEY : undefined);
    util.execBashCommand.mockResolvedValueOnce(cacheHit ? "" : IMAGES);
    await docker.loadDockerImages();

    assertLoadDockerImages(cacheHit);
  };

  const assertSaveDockerImages = (
    cacheHit: boolean,
    readOnly: boolean = false
  ): void => {
    expect(core.getInput).nthCalledWith<[string, InputOptions]>(1, "key", {
      required: true,
    });
    expect(core.getState).nthCalledWith<[string]>(1, docker.CACHE_HIT);
    if (!cacheHit) {
      expect(core.getInput).lastCalledWith("read-only");
      if (!readOnly) {
        expect(core.getState).lastCalledWith(docker.DOCKER_IMAGES_LIST);
        expect(core.info).nthCalledWith<[string]>(1, "Listing Docker images.");
        expect(util.execBashCommand).nthCalledWith<[string]>(
          1,
          'docker image list --format "{{ .Repository }}:{{ .Tag }}"'
        );
      }
    }
  };

  const mockedSaveDockerImages = async (
    cacheHit: boolean,
    readOnly: boolean = false,
    stdout: string = IMAGES
  ): Promise<void> => {
    core.getState.mockReturnValueOnce(cacheHit.toString());
    if (!cacheHit) {
      core.getInput.mockReturnValueOnce(readOnly.toString());
      if (!readOnly) {
        core.getState.mockReturnValueOnce(PREEXISTING_IMAGES);
        util.execBashCommand.mockResolvedValueOnce(stdout);
      }
    }
    await docker.saveDockerImages();

    assertSaveDockerImages(cacheHit, readOnly);
  };

  const assertSaveCacheHit = (): void => {
    expect(core.info).lastCalledWith(
      `Cache hit occurred on the primary key ${KEY}, not saving cache.`
    );
    expect(util.execBashCommand).not.toHaveBeenCalled();
    expect(cache.saveCache).not.toHaveBeenCalled();
  };

  test("exports CACHE_HIT", (): void => {
    expect(docker.CACHE_HIT).toBe("cache-hit");
  });

  test("exports DOCKER_IMAGES_LIST", (): void => {
    expect(docker.DOCKER_IMAGES_LIST).toBe("docker-images-list");
  });

  test("exports DOCKER_IMAGES_PATH", (): void => {
    expect(docker.DOCKER_IMAGES_PATH).toBe("~/.docker-images.tar");
  });

  test("are loaded on cache hit", async (): Promise<void> => {
    await mockedLoadDockerImages(true);

    expect(core.saveState).toHaveBeenCalledTimes(1);

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

  test("that are present during restore step are recorded on cache miss", async (): Promise<void> => {
    await mockedLoadDockerImages(false);

    expect(core.info).lastCalledWith(
      "Recording preexisting Docker images. These include standard images " +
        "pre-cached by GitHub Actions when Docker is run as root."
    );
    expect(core.saveState).lastCalledWith(docker.DOCKER_IMAGES_LIST, IMAGES);
  });

  test("are saved on cache miss", async (): Promise<void> => {
    await mockedSaveDockerImages(false);

    expect(core.info).lastCalledWith(
      "Images present before restore step will be skipped; only new images " +
        "will be saved."
    );
    expect(util.execBashCommand).lastCalledWith(
      `docker save --output ${docker.DOCKER_IMAGES_PATH} ${NEW_IMAGES}`
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
      core.getState,
      util.execBashCommand,
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

    assertSaveCacheHit();
  });

  test("aren't saved on cache hit", async (): Promise<void> => {
    await mockedSaveDockerImages(true);

    assertSaveCacheHit();
  });

  test("aren't saved on cache miss when new Docker image list is empty", async (): Promise<void> => {
    await mockedSaveDockerImages(false, false, PREEXISTING_IMAGES);

    expect(util.execBashCommand).toHaveBeenCalledTimes(1);
    expect(core.info).lastCalledWith("No Docker images to save");
    expect(cache.saveCache).not.toHaveBeenCalled();
  });
});
