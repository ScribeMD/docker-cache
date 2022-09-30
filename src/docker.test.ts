import { testProp } from "@fast-check/jest";
import { jest } from "@jest/globals";
import { boolean, string, uniqueArray } from "fast-check";

import type { InputOptions } from "@actions/core";
import type { FunctionLike } from "jest-mock";

jest.mock("@actions/cache");
jest.mock("@actions/core");

jest.unstable_mockModule("./util.js", (): typeof import("./util.js") => ({
  execBashCommand: jest.fn<typeof import("./util.js").execBashCommand>(),
}));

// Expect the given mocks were called in the given order.
const assertCalledInOrder = <T extends FunctionLike>(
  ...mocks: jest.MockedFunction<T>[]
): void => {
  const mockCallCounts: Record<string, number> = {};
  const callOrders = mocks.map(
    (currentMock: jest.MockedFunction<T>): number => {
      const mockName = currentMock.getMockName();
      const callCount = mockCallCounts[mockName] ?? 0;
      mockCallCounts[mockName] = callCount + 1;
      return <number>currentMock.mock.invocationCallOrder[callCount];
    }
  );

  const sortedCallOrders = [...callOrders].sort(
    (a: number, b: number): number => a - b
  );
  expect(callOrders).toStrictEqual(sortedCallOrders);
};

describe("Docker images", (): void => {
  let cache: jest.MockedObject<typeof import("@actions/cache")>;
  let core: jest.MockedObject<typeof import("@actions/core")>;
  let util: jest.MockedObject<typeof import("./util.js")>;
  let docker: typeof import("./docker.js");

  beforeAll(async (): Promise<void> => {
    cache = <any>await import("@actions/cache");
    core = <any>await import("@actions/core");
    util = <any>await import("./util.js");
    docker = await import("./docker.js");
  });

  const joinAndSplit = (list: string[]): string[] => {
    const joined = list.join("\n");
    return joined.split("\n");
  };

  const assertLoadDockerImages = (key: string, cacheHit: boolean): void => {
    expect(core.getInput).lastCalledWith("key", { required: true });
    expect(cache.restoreCache).lastCalledWith([docker.DOCKER_IMAGES_PATH], key);
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

  const mockedLoadDockerImages = async (
    key: string,
    cacheHit: boolean,
    images: string = ""
  ): Promise<void> => {
    core.getInput.mockReturnValue(key);
    cache.restoreCache.mockResolvedValueOnce(cacheHit ? key : undefined);
    util.execBashCommand.mockResolvedValueOnce(images);
    await docker.loadDockerImages();

    assertLoadDockerImages(key, cacheHit);
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
    key: string,
    cacheHit: boolean,
    readOnly: boolean,
    preexistingImages: string[],
    newImages: string[]
  ): Promise<void> => {
    core.getInput.mockReturnValueOnce(key);
    core.getState.mockReturnValueOnce(cacheHit.toString());
    if (!cacheHit) {
      core.getInput.mockReturnValueOnce(readOnly.toString());
      if (!readOnly) {
        core.getState.mockReturnValueOnce(preexistingImages.join("\n"));
        const images = [...new Set([...preexistingImages, ...newImages])];
        util.execBashCommand.mockResolvedValueOnce(images.join("\n"));
      }
    }
    await docker.saveDockerImages();

    assertSaveDockerImages(cacheHit, readOnly);
  };

  const assertCacheNotSaved = (): void => {
    expect(util.execBashCommand).not.toHaveBeenCalled();
    expect(cache.saveCache).not.toHaveBeenCalled();
  };

  const assertSaveCacheHit = (key: string): void => {
    expect(core.info).lastCalledWith(
      `Cache hit occurred on the primary key ${key}, not saving cache.`
    );
    assertCacheNotSaved();
  };

  const assertSaveReadOnly = (key: string): void => {
    expect(core.info).lastCalledWith(
      `Cache miss occurred on the primary key ${key}. ` +
        "Not saving cache as read-only option was selected."
    );
    assertCacheNotSaved();
  };

  const assertNoNewImagesToSave = (): void => {
    expect(util.execBashCommand).toHaveBeenCalledTimes(1);
    expect(core.info).lastCalledWith("No Docker images to save");
    expect(cache.saveCache).not.toHaveBeenCalled();
  };

  const assertSaveCacheMiss = (key: string, newImages: string[]): void => {
    expect(core.info).lastCalledWith(
      "Images present before restore step will be skipped; only new images " +
        "will be saved."
    );
    expect(util.execBashCommand).lastCalledWith(
      `docker save --output ${docker.DOCKER_IMAGES_PATH} ${newImages.join(" ")}`
    );
    expect(cache.saveCache).lastCalledWith([docker.DOCKER_IMAGES_PATH], key);

    /* The Docker images must be saved before the cache can be. This at least
     * checks that the calls are made in the right order, but doesn't ensure
     * that the Docker images finished saving before the cache started saving.
     */
    assertCalledInOrder<FunctionLike>(
      core.getInput,
      core.getState,
      core.getInput,
      core.getState,
      util.execBashCommand,
      util.execBashCommand,
      cache.saveCache
    );
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

  testProp(
    "are loaded on cache hit",
    [string()],
    async (key: string): Promise<void> => {
      jest.clearAllMocks();
      await mockedLoadDockerImages(key, true);

      expect(core.saveState).toHaveBeenCalledTimes(1);

      /* The cache must be restored before the Docker images can be loaded. This
       * at least checks that the calls are made in the right order, but doesn't
       * ensure that the cache finished restoring before the Docker images started
       * loading.
       */
      assertCalledInOrder<FunctionLike>(
        core.getInput,
        cache.restoreCache,
        util.execBashCommand
      );
    }
  );

  testProp(
    "that are present during restore step are recorded on cache miss",
    [string(), string()],
    async (key: string, images: string): Promise<void> => {
      jest.clearAllMocks();
      await mockedLoadDockerImages(key, false, images);

      expect(core.info).lastCalledWith(
        "Recording preexisting Docker images. These include standard images " +
          "pre-cached by GitHub Actions when Docker is run as root."
      );
      expect(core.saveState).lastCalledWith(docker.DOCKER_IMAGES_LIST, images);
    }
  );

  testProp(
    "are saved unless cache hit, in read-only mode, or new Docker image list is empty",
    [
      string(),
      boolean(),
      boolean(),
      uniqueArray(string()),
      uniqueArray(string()),
    ],
    async (
      key: string,
      cacheHit: boolean,
      readOnly: boolean,
      preexistingImages: string[],
      newImages: string[]
    ): Promise<void> => {
      jest.clearAllMocks();
      preexistingImages = joinAndSplit(preexistingImages);
      const preexistingImageSet = new Set(preexistingImages);
      newImages = joinAndSplit(newImages);
      newImages = newImages.filter(
        (image: string): boolean => !preexistingImageSet.has(image)
      );
      await mockedSaveDockerImages(
        key,
        cacheHit,
        readOnly,
        preexistingImages,
        newImages
      );

      if (cacheHit) {
        assertSaveCacheHit(key);
      } else if (readOnly) {
        assertSaveReadOnly(key);
      } else if (newImages.length === 0) {
        assertNoNewImagesToSave();
      } else {
        assertSaveCacheMiss(key, newImages);
      }
    },
    {
      examples: [
        ["my-key", false, false, ["preexisting-image"], ["new-image"]],
        ["my-key", false, false, ["preexisting-image"], ["preexisting-image"]],
        ["my-key", false, true, ["preexisting-image"], ["new-image"]],
        ["my-key", true, false, ["preexisting-image"], ["new-image"]],
      ],
    }
  );
});
