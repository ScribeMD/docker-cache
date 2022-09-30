import { testProp } from "@fast-check/jest";
import { jest } from "@jest/globals";
import { string } from "fast-check";

import type { ExecOptions } from "node:child_process";
import type { InputOptions } from "@actions/core";

jest.unstable_mockModule("node:child_process", () => ({
  exec: jest.fn<typeof import("node:child_process").exec>(),
}));
jest.mock("@actions/cache");
jest.mock("@actions/core");

const getKey = (paths: string[], key: string): string => {
  return [...paths, key].join(", ");
};

describe("Integration Test", (): void => {
  const EXEC_OPTIONS = { shell: "/usr/bin/bash" };
  const LIST_COMMAND =
    'docker image list --format "{{ .Repository }}:{{ .Tag }}"';

  let child_process: jest.MockedObject<typeof import("node:child_process")>;
  let cache: jest.MockedObject<typeof import("@actions/cache")>;
  let core: jest.MockedObject<typeof import("@actions/core")>;
  let docker: typeof import("./docker.js");

  let loadCommand: string;
  let inMemoryCache: Record<string, string>;
  let state: Record<string, string>;
  let dockerImages: string[];
  let callCount: number;

  beforeEach(async (): Promise<void> => {
    child_process = <any>await import("node:child_process");
    cache = <any>await import("@actions/cache");
    core = <any>await import("@actions/core");
    docker = <any>await import("./docker.js");

    loadCommand = `docker load --input ${docker.DOCKER_IMAGES_PATH}`;

    cache.saveCache.mockImplementation(
      (paths: string[], key: string): Promise<any> => {
        inMemoryCache[getKey(paths, key)] = key;
        return Promise.resolve();
      }
    );

    cache.restoreCache.mockImplementation(
      (paths: string[], primaryKey: string): Promise<string | undefined> => {
        const value = inMemoryCache[getKey(paths, primaryKey)];
        return Promise.resolve(value);
      }
    );

    core.getState.mockImplementation((key: string): string => {
      return state[key] || "";
    });

    core.saveState.mockImplementation((key: string, value: any): void => {
      state[key] = value.toString();
    });
  });

  const mockExec = (
    listStderr: string,
    otherStdout: string,
    otherStderr: string
  ): void => {
    child_process.exec.mockImplementation(
      (command: string, _options: any, callback: any): any => {
        let stdout: string, stderr: string;
        if (command === LIST_COMMAND) {
          /* When Docker is running as root, docker image list generates a list that includes a
           * standard set of Docker images that are pre-cached by GitHub Actions. The production
           * code filters out the Docker images present during the restore step from the list of
           * images to save since caching pre-cached images would harm performance and waste
           * cache space. This mock implementation of docker image list ensures a non-empty
           * difference between the restore and save steps so there is something to save.
           */
          dockerImages.push(`test-docker-image:v${++callCount}`);
          stdout = dockerImages.join("\n");
          stderr = listStderr;
        } else {
          stdout = otherStdout;
          stderr = otherStderr;
        }
        callback(null, { stdout, stderr });
      }
    );
  };

  const assertExecBashCommand = (
    infoCallNum: number,
    execCallNum: number,
    command: string,
    stdout: string,
    stderr: string
  ): void => {
    expect(core.info).nthCalledWith<[string]>(infoCallNum, command);
    expect(child_process.exec).nthCalledWith<[string, ExecOptions, any]>(
      execCallNum,
      command,
      EXEC_OPTIONS,
      expect.anything()
    );
    expect(core.info).nthCalledWith<[string]>(infoCallNum + 1, stdout);
    expect(core.error).nthCalledWith<[string]>(execCallNum, stderr);
    expect(core.setFailed).not.toHaveBeenCalled();
  };

  const assertLoadDockerImages = (
    cacheHit: boolean,
    listStderr: string,
    loadStdout: string,
    loadStderr: string
  ): void => {
    expect(core.getInput).nthCalledWith<[string, InputOptions]>(1, "key", {
      required: true,
    });
    expect(core.setOutput).lastCalledWith(docker.CACHE_HIT, cacheHit);
    if (cacheHit) {
      assertExecBashCommand(1, 1, loadCommand, loadStdout, loadStderr);
      expect(core.saveState).toHaveBeenCalledTimes(1);
    } else {
      expect(core.info).nthCalledWith<[string]>(
        1,
        "Recording preexisting Docker images. These include standard images " +
          "pre-cached by GitHub Actions when Docker is run as root."
      );
      assertExecBashCommand(
        2,
        1,
        LIST_COMMAND,
        dockerImages.join("\n"),
        listStderr
      );
    }
    expect(child_process.exec).toHaveBeenCalledTimes(1);
  };

  const assertSaveCacheHit = (key: string): void => {
    expect(core.info).lastCalledWith(
      `Cache hit occurred on the primary key ${key}, not saving cache.`
    );
    expect(child_process.exec).not.toHaveBeenCalled();
    expect(core.setFailed).not.toHaveBeenCalled();
    expect(cache.saveCache).not.toHaveBeenCalled();
  };

  const assertSaveCacheMiss = (
    listStderr: string,
    saveStdout: string,
    saveStderr: string
  ): void => {
    expect(core.getInput).lastCalledWith("read-only");
    expect(core.info).nthCalledWith<[string]>(1, "Listing Docker images.");
    assertExecBashCommand(
      2,
      1,
      LIST_COMMAND,
      dockerImages.join("\n"),
      listStderr
    );
    expect(core.info).nthCalledWith<[string]>(
      4,
      "Images present before restore step will be skipped; only new images " +
        "will be saved."
    );
    const saveCommand = `docker save --output ${docker.DOCKER_IMAGES_PATH} test-docker-image:v2`;
    assertExecBashCommand(5, 2, saveCommand, saveStdout, saveStderr);
  };

  const assertSaveDockerImages = (
    cacheHit: boolean,
    key: string,
    listStderr: string,
    saveStdout: string,
    saveStderr: string
  ): void => {
    expect(core.getInput).nthCalledWith<[string, InputOptions]>(1, "key", {
      required: true,
    });
    cacheHit
      ? assertSaveCacheHit(key)
      : assertSaveCacheMiss(listStderr, saveStdout, saveStderr);
  };

  testProp(
    "cache misses, then hits",
    [string(), string(), string(), string()],
    async (
      key: string,
      listStderr: string,
      otherStdout: string,
      otherStderr: string
    ): Promise<void> => {
      jest.clearAllMocks();
      inMemoryCache = {};
      state = {};
      dockerImages = [];
      callCount = 0;
      core.getInput.mockReturnValue(key);
      mockExec(listStderr, otherStdout, otherStderr);

      // Attempt first cache restore.
      await docker.loadDockerImages();
      // Expect cache miss since cache has never been saved.
      assertLoadDockerImages(false, listStderr, otherStdout, otherStderr);
      jest.clearAllMocks();

      // Run post step first time.
      await docker.saveDockerImages();
      // Expect cache saved on cache miss.
      assertSaveDockerImages(false, key, listStderr, otherStdout, otherStderr);
      jest.clearAllMocks();

      // Attempt second cache restore.
      await docker.loadDockerImages();
      // Expect cache hit since cache has been saved.
      assertLoadDockerImages(true, listStderr, otherStdout, otherStderr);
      jest.clearAllMocks();

      // Run post step second time.
      await docker.saveDockerImages();
      // Expect cache not to have been saved on cache hit.
      assertSaveDockerImages(true, key, listStderr, otherStdout, otherStderr);
    }
  );
});
