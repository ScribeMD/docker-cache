import { testProp } from "@fast-check/jest";
import { jest } from "@jest/globals";
import { boolean, fullUnicodeString } from "fast-check";

import { dockerImages, uniquePair } from "./arbitraries/util.js";

import type { InputOptions } from "@actions/core";
import type { FunctionLike } from "jest-mock";

import type { Util } from "../types/aliases.js";
import type { execBashCommand } from "./util.js";

jest.mock("@actions/cache");
jest.mock("@actions/core");

jest.unstable_mockModule(
  "./util.js",
  (): Util => ({ execBashCommand: jest.fn<typeof execBashCommand>() }),
);

const cache = jest.mocked(await import("@actions/cache"));
const core = jest.mocked(await import("@actions/core"));
const util = jest.mocked(await import("./util.js"));
const docker = await import("./docker.js");

const fail = (message: string): never => {
  throw new Error(message);
};

// Expect the given mocks were called in the given order.
const assertCalledInOrder = <T extends FunctionLike>(
  ...mocks: jest.MockedFunction<T>[]
): void => {
  const mockCallCounts = new Map<jest.MockedFunction<T>, number>();
  const callOrders = mocks.map(
    (currentMock: jest.MockedFunction<T>, index: number): number => {
      const callCount = mockCallCounts.get(currentMock) ?? 0;
      mockCallCounts.set(currentMock, callCount + 1);
      return (
        currentMock.mock.invocationCallOrder[callCount] ??
        fail(`Mock function ${index} was called too few times: ${callCount}.`)
      );
    },
  );

  const sortedCallOrders = [...callOrders].sort(
    (a: number, b: number): number => a - b,
  );
  expect(callOrders).toStrictEqual(sortedCallOrders);
};

describe("Docker images", (): void => {
  const LIST_COMMAND =
    "docker image list --format '" +
    '{{ if ne .Repository "<none>" }}{{ .Repository }}' +
    `{{ if ne .Tag "<none>" }}:{{ .Tag }}{{ end }}{{ else }}{{ .ID }}{{ end }}'`;

  const assertLoadDockerImages = (key: string, cacheHit: boolean): void => {
    expect(core.getInput).lastCalledWith("key", { required: true });
    expect(cache.restoreCache).lastCalledWith([docker.DOCKER_IMAGES_PATH], key);
    expect(core.saveState).nthCalledWith<[string, boolean]>(
      1,
      docker.CACHE_HIT,
      cacheHit,
    );
    expect(core.setOutput).lastCalledWith(docker.CACHE_HIT, cacheHit);
    if (cacheHit) {
      expect(util.execBashCommand).lastCalledWith(
        `docker load --input ${docker.DOCKER_IMAGES_PATH}`,
      );
    } else {
      expect(util.execBashCommand).lastCalledWith(LIST_COMMAND);
    }
    expect(util.execBashCommand).toHaveBeenCalledTimes(1);
  };

  const mockedLoadDockerImages = async (
    key: string,
    cacheHit: boolean,
    images = "",
  ): Promise<void> => {
    core.getInput.mockReturnValue(key);
    cache.restoreCache.mockResolvedValueOnce(cacheHit ? key : undefined);
    util.execBashCommand.mockResolvedValueOnce(images);
    await docker.loadDockerImages();

    assertLoadDockerImages(key, cacheHit);
  };

  const assertSaveDockerImages = (
    cacheHit: boolean,
    key: string,
    readOnly = false,
    prevSave = false,
  ): void => {
    expect(core.getInput).nthCalledWith<[string, InputOptions]>(1, "key", {
      required: true,
    });
    expect(core.getState).nthCalledWith<[string]>(1, docker.CACHE_HIT);
    if (!cacheHit) {
      expect(core.getInput).lastCalledWith("read-only");
      if (!readOnly) {
        expect(cache.restoreCache).lastCalledWith([""], key, [], {
          lookupOnly: true,
        });
        if (!prevSave) {
          expect(core.getState).lastCalledWith(docker.DOCKER_IMAGES_LIST);
          expect(core.info).nthCalledWith<[string]>(
            1,
            "Listing Docker images.",
          );
          expect(util.execBashCommand).nthCalledWith<[string]>(1, LIST_COMMAND);
        }
      }
    }
  };

  const mockedSaveDockerImages = async (
    key: string,
    cacheHit: boolean,
    readOnly: boolean,
    prevSave: boolean,
    preexistingImages: string[],
    newImages: string[],
  ): Promise<void> => {
    core.getInput.mockReturnValueOnce(key);
    core.getState.mockReturnValueOnce(cacheHit.toString());
    if (!cacheHit) {
      core.getInput.mockReturnValueOnce(readOnly.toString());
      if (!readOnly) {
        if (prevSave) {
          cache.restoreCache.mockResolvedValueOnce(key);
        } else {
          cache.restoreCache.mockResolvedValueOnce(undefined);
          core.getState.mockReturnValueOnce(preexistingImages.join("\n"));
          const images = preexistingImages.concat(newImages);
          util.execBashCommand.mockResolvedValueOnce(images.join("\n"));
        }
      }
    }
    await docker.saveDockerImages();

    assertSaveDockerImages(cacheHit, key, readOnly, prevSave);
  };

  const assertCacheNotSaved = (): void => {
    expect(util.execBashCommand).not.toHaveBeenCalled();
    expect(cache.saveCache).not.toHaveBeenCalled();
  };

  const assertSaveCacheHit = (key: string): void => {
    expect(core.info).lastCalledWith(
      `Cache hit occurred on the primary key ${key}, not saving cache.`,
    );
    assertCacheNotSaved();
  };

  const assertSaveReadOnly = (key: string): void => {
    expect(core.info).lastCalledWith(
      `Cache miss occurred on the primary key ${key}. ` +
        "Not saving cache as read-only option was selected.",
    );
    assertCacheNotSaved();
  };

  const assertSavePrevSave = (key: string): void => {
    expect(core.info).lastCalledWith(
      "A cache miss occurred during the initial attempt to load Docker " +
        `images, but subsequently a cache with a matching key, ${key}, was saved. ` +
        "This can occur when run in parallel. Not saving cache.",
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
        "will be saved.",
    );
    expect(util.execBashCommand).lastCalledWith(
      `docker save --output ${docker.DOCKER_IMAGES_PATH} ${newImages.join(
        " ",
      )}`,
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
      cache.saveCache,
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
    [fullUnicodeString()],
    async (key: string): Promise<void> => {
      jest.clearAllMocks();
      await mockedLoadDockerImages(key, true);

      expect(core.saveState).toHaveBeenCalledTimes(1);

      /* The cache must be restored before the Docker images can be loaded. This
       * at least checks that the calls are made in the right order, but doesn't
       * ensure that the cache finished restoring before the Docker images
       * started loading.
       */
      assertCalledInOrder<FunctionLike>(
        core.getInput,
        cache.restoreCache,
        util.execBashCommand,
      );
    },
  );

  testProp(
    "that are present during restore step are recorded on cache miss",
    [fullUnicodeString(), fullUnicodeString()],
    async (key: string, images: string): Promise<void> => {
      jest.clearAllMocks();
      await mockedLoadDockerImages(key, false, images);

      expect(core.info).lastCalledWith(
        "Recording preexisting Docker images. These include standard images " +
          "pre-cached by GitHub Actions when Docker is run as root.",
      );
      expect(core.saveState).lastCalledWith(docker.DOCKER_IMAGES_LIST, images);
    },
  );

  testProp(
    "are saved unless cache hit, in read-only mode, cache already saved, or " +
      "new Docker image list is empty",
    [
      fullUnicodeString(),
      boolean(),
      boolean(),
      boolean(),
      uniquePair(dockerImages(), dockerImages()),
    ],
    async (
      key: string,
      cacheHit: boolean,
      readOnly: boolean,
      prevSave: boolean,
      [preexistingImages, newImages]: [string[], string[]],
    ): Promise<void> => {
      jest.clearAllMocks();
      await mockedSaveDockerImages(
        key,
        cacheHit,
        readOnly,
        prevSave,
        preexistingImages,
        newImages,
      );

      if (cacheHit) {
        assertSaveCacheHit(key);
      } else if (readOnly) {
        assertSaveReadOnly(key);
      } else if (prevSave) {
        assertSavePrevSave(key);
      } else if (newImages.length === 0) {
        assertNoNewImagesToSave();
      } else {
        assertSaveCacheMiss(key, newImages);
      }
    },
    {
      examples: [
        ["my-key", false, false, false, [["preexisting-image"], ["new-image"]]],
        ["my-key", false, false, false, [["preexisting-image"], []]],
        ["my-key", false, true, false, [["preexisting-image"], ["new-image"]]],
        ["my-key", true, false, false, [["preexisting-image"], ["new-image"]]],
        ["my-key", false, false, true, [["preexisting-image"], ["new-image"]]],
      ],
    },
  );
});
