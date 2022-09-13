import { jest } from "@jest/globals";

import type { ExecOptions } from "node:child_process";
import type { InputOptions } from "@actions/core";
import type { Mocked } from "./util.test.js";

jest.unstable_mockModule("node:child_process", () => ({
  exec: jest.fn<typeof import("node:child_process").exec>(),
}));
jest.mock("@actions/cache");
jest.mock("@actions/core");

const getKey = (paths: string[], key: string): string => {
  return [...paths, key].join(", ");
};

describe("Integration Test", (): void => {
  const KEY = "a-cache-key";
  const EXEC_OPTIONS = { shell: "/usr/bin/bash" };
  const STDOUT = "standard output from Bash command";
  const STDERR = "error output from Bash command";
  const LIST_COMMAND =
    'docker image list --format "{{ .Repository }}:{{ .Tag }}"';

  const dockerImages: string[] = [];

  let child_process: Mocked<typeof import("node:child_process")>;
  let cache: Mocked<typeof import("@actions/cache")>;
  let core: Mocked<typeof import("@actions/core")>;
  let docker: typeof import("./docker.js");

  let inMemoryCache: Record<string, string>;
  let state: Record<string, string>;
  let loadCommand: string;

  beforeEach(async (): Promise<void> => {
    child_process = <any>await import("node:child_process");
    cache = <any>await import("@actions/cache");
    core = <any>await import("@actions/core");
    docker = <any>await import("./docker.js");

    inMemoryCache = {};
    state = {};
    loadCommand = `docker load --input ${docker.DOCKER_IMAGES_PATH}`;

    let callCount = 0;
    child_process.exec.mockImplementation(
      (command: string, _options: any, callback: any): any => {
        let stdout;
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
        } else {
          stdout = STDOUT;
        }
        callback(null, { stdout, stderr: STDERR });
      }
    );

    core.getInput.mockReturnValue(KEY);

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

  const assertExecBashCommand = (
    infoCallNum: number,
    execCallNum: number,
    command: string,
    stdout: string
  ): void => {
    expect(core.info).nthCalledWith<[string]>(infoCallNum, command);
    expect(child_process.exec).nthCalledWith<[string, ExecOptions, any]>(
      execCallNum,
      command,
      EXEC_OPTIONS,
      expect.anything()
    );
    expect(core.info).nthCalledWith<[string]>(infoCallNum + 1, stdout);
    expect(core.error).nthCalledWith<[string]>(execCallNum, STDERR);
    expect(core.setFailed).not.toHaveBeenCalled();
  };

  const assertLoadDockerImages = (cacheHit: boolean): void => {
    expect(core.getInput).nthCalledWith<[string, InputOptions]>(1, "key", {
      required: true,
    });
    expect(core.setOutput).lastCalledWith(docker.CACHE_HIT, cacheHit);
    if (cacheHit) {
      assertExecBashCommand(1, 1, loadCommand, STDOUT);
      expect(core.saveState).toHaveBeenCalledTimes(1);
    } else {
      expect(core.info).nthCalledWith<[string]>(
        1,
        "Recording preexisting Docker images. These include standard images " +
          "pre-cached by GitHub Actions when Docker is run as root."
      );
      assertExecBashCommand(2, 1, LIST_COMMAND, dockerImages.join("\n"));
    }
    expect(child_process.exec).toHaveBeenCalledTimes(1);
  };

  const assertSaveCacheHit = (): void => {
    expect(core.info).lastCalledWith(
      `Cache hit occurred on the primary key ${KEY}, not saving cache.`
    );
    expect(child_process.exec).not.toHaveBeenCalled();
    expect(core.setFailed).not.toHaveBeenCalled();
    expect(cache.saveCache).not.toHaveBeenCalled();
  };

  const assertSaveCacheMiss = (): void => {
    expect(core.getInput).lastCalledWith("read-only");
    expect(core.info).nthCalledWith<[string]>(1, "Listing Docker images.");
    assertExecBashCommand(2, 1, LIST_COMMAND, dockerImages.join("\n"));
    expect(core.info).nthCalledWith<[string]>(
      4,
      "Images present before restore step will be skipped; only new images " +
        "will be saved."
    );
    const saveCommand = `docker save --output ${docker.DOCKER_IMAGES_PATH} test-docker-image:v2`;
    assertExecBashCommand(5, 2, saveCommand, STDOUT);
  };

  const assertSaveDockerImages = (cacheHit: boolean): void => {
    expect(core.getInput).nthCalledWith<[string, InputOptions]>(1, "key", {
      required: true,
    });
    cacheHit ? assertSaveCacheHit() : assertSaveCacheMiss();
  };

  test("cache misses, then hits", async (): Promise<void> => {
    // Attempt first cache restore.
    await docker.loadDockerImages();
    assertLoadDockerImages(false); // Expect cache miss since cache has never been saved.
    jest.clearAllMocks();

    // Run post step first time.
    await docker.saveDockerImages();
    assertSaveDockerImages(false); // Expect cache saved on cache miss.
    jest.clearAllMocks();

    // Attempt second cache restore.
    await docker.loadDockerImages();
    assertLoadDockerImages(true); // Expect cache hit since cache has been saved.
    jest.clearAllMocks();

    // Run post step second time.
    await docker.saveDockerImages();
    assertSaveDockerImages(true); // Expect cache not to have been saved on cache hit.
  });
});
