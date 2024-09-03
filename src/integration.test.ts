import { exec } from "node:child_process";
import { testProp } from "@fast-check/jest";
import { jest } from "@jest/globals";
import { fullUnicodeString } from "fast-check";

import { consoleOutput } from "./arbitraries/util.js";
import { utilFactory } from "./mocks/util.js";

import type { ExecOptions } from "node:child_process";
import type { InputOptions } from "@actions/core";
import type { Mock } from "jest-mock";

import type { ConsoleOutput } from "./util.js";

jest.unstable_mockModule("node:util", utilFactory);
jest.mock("@actions/cache");
jest.mock("@actions/core");

const nodeUtil = jest.mocked(await import("node:util"));
const cache = jest.mocked(await import("@actions/cache"));
const core = jest.mocked(await import("@actions/core"));
const docker = await import("./docker.js");

interface ToString {
  toString(): string;
}

const getKey = (paths: string[], primaryKey: string): string =>
  [...paths, primaryKey].join(", ");

describe("Integration Test", (): void => {
  const EXEC_OPTIONS = { shell: "/bin/bash" };
  const LIST_COMMAND =
    "docker image list --format '" +
    '{{ if ne .Repository "<none>" }}{{ .Repository }}' +
    `{{ if ne .Tag "<none>" }}:{{ .Tag }}{{ end }}{{ else }}{{ .ID }}{{ end }}'`;

  let loadCommand: string;
  let inMemoryCache: Map<string, string>;
  let state: Map<string, string>;
  let dockerImages: string[];
  let callCount: number;
  let execMock: Mock<(command: string) => Promise<ConsoleOutput>>;

  beforeEach((): void => {
    loadCommand = `docker load --input ${docker.DOCKER_IMAGES_PATH}`;

    cache.saveCache.mockImplementation(
      (paths: string[], primaryKey: string): Promise<number> => {
        const key = getKey(paths, primaryKey);
        inMemoryCache.set(key, primaryKey);
        return Promise.resolve(0);
      },
    );

    cache.restoreCache.mockImplementation(
      (paths: string[], primaryKey: string): Promise<string | undefined> => {
        const key = getKey(paths, primaryKey);
        return Promise.resolve(inMemoryCache.get(key));
      },
    );

    core.getState.mockImplementation((key: string): string => {
      return state.get(key) ?? "";
    });

    core.saveState.mockImplementation((key: string, value: ToString): void => {
      state.set(key, value.toString());
    });
  });

  const joinOutput = (stdout: string[], stderr: string): ConsoleOutput => ({
    stdout: stdout.join("\n"),
    stderr,
  });

  const mockExec = (listStderr: string, otherOutput: ConsoleOutput): void => {
    execMock = jest.fn((command: string): Promise<ConsoleOutput> => {
      let output: ConsoleOutput;
      if (command === LIST_COMMAND) {
        /* When Docker is running as root, docker image list generates a list
         * that includes a standard set of Docker images that are pre-cached by
         * GitHub Actions. The production code filters out the Docker images
         * present during the restore step from the list of images to save since
         * caching pre-cached images would harm performance and waste cache
         * space. This mock implementation of docker image list ensures a
         * non-empty difference between the restore and save steps so there is
         * something to save.
         */
        dockerImages.push(`test-docker-image:v${++callCount}`);
        output = joinOutput(dockerImages, listStderr);
      } else {
        output = otherOutput;
      }
      return Promise.resolve(output);
    });

    nodeUtil.promisify.mockReturnValue(execMock);
  };

  const assertExecBashCommand = (
    infoCallNum: number,
    execCallNum: number,
    command: string,
    output: ConsoleOutput,
  ): void => {
    expect(core.info).nthCalledWith<[string]>(infoCallNum, command);
    expect(nodeUtil.promisify).nthCalledWith<[typeof exec]>(execCallNum, exec);
    expect(execMock).nthCalledWith<[string, ExecOptions]>(
      execCallNum,
      command,
      EXEC_OPTIONS,
    );
    expect(core.info).nthCalledWith<[string]>(infoCallNum + 1, output.stdout);
    expect(core.error).nthCalledWith<[string]>(execCallNum, output.stderr);
    expect(core.setFailed).not.toHaveBeenCalled();
  };

  const assertLoadDockerImages = (
    cacheHit: boolean,
    listStderr: string,
    loadOutput: ConsoleOutput,
  ): void => {
    expect(core.getInput).nthCalledWith<[string, InputOptions]>(1, "key", {
      required: true,
    });
    expect(core.setOutput).lastCalledWith(docker.CACHE_HIT, cacheHit);
    if (cacheHit) {
      assertExecBashCommand(1, 1, loadCommand, loadOutput);
      expect(core.saveState).toHaveBeenCalledTimes(1);
    } else {
      expect(core.info).nthCalledWith<[string]>(
        1,
        "Recording preexisting Docker images. These include standard images " +
          "pre-cached by GitHub Actions when Docker is run as root.",
      );
      const listOutput = joinOutput(dockerImages, listStderr);
      assertExecBashCommand(2, 1, LIST_COMMAND, listOutput);
    }
    expect(execMock).toHaveBeenCalledTimes(1);
  };

  const assertSaveCacheHit = (key: string): void => {
    expect(core.info).lastCalledWith(
      `Cache hit occurred on the primary key ${key}, not saving cache.`,
    );
    expect(execMock).not.toHaveBeenCalled();
    expect(core.setFailed).not.toHaveBeenCalled();
    expect(cache.saveCache).not.toHaveBeenCalled();
  };

  const assertSaveCacheMiss = (
    listStderr: string,
    saveOutput: ConsoleOutput,
  ): void => {
    expect(core.getInput).lastCalledWith("read-only");
    expect(core.info).nthCalledWith<[string]>(1, "Listing Docker images.");
    const listOutput = joinOutput(dockerImages, listStderr);
    assertExecBashCommand(2, 1, LIST_COMMAND, listOutput);
    expect(core.info).nthCalledWith<[string]>(
      4,
      "Images present before restore step will be skipped; only new images " +
        "will be saved.",
    );
    const saveCommand = `docker save --output ${docker.DOCKER_IMAGES_PATH} test-docker-image:v2`;
    assertExecBashCommand(5, 2, saveCommand, saveOutput);
  };

  const assertSaveDockerImages = (
    cacheHit: boolean,
    key: string,
    listStderr: string,
    saveOutput: ConsoleOutput,
  ): void => {
    expect(core.getInput).nthCalledWith<[string, InputOptions]>(1, "key", {
      required: true,
    });
    cacheHit
      ? assertSaveCacheHit(key)
      : assertSaveCacheMiss(listStderr, saveOutput);
  };

  testProp(
    "cache misses, then hits",
    [fullUnicodeString(), fullUnicodeString(), consoleOutput()],
    async (
      key: string,
      listStderr: string,
      otherOutput: ConsoleOutput,
    ): Promise<void> => {
      jest.clearAllMocks();
      inMemoryCache = new Map<string, string>();
      state = new Map<string, string>();
      dockerImages = [];
      callCount = 0;
      core.getInput.mockReturnValue(key);
      mockExec(listStderr, otherOutput);

      // Attempt first cache restore.
      await docker.loadDockerImages();
      // Expect cache miss since cache has never been saved.
      assertLoadDockerImages(false, listStderr, otherOutput);
      jest.clearAllMocks();

      // Run post step first time.
      await docker.saveDockerImages();
      // Expect cache saved on cache miss.
      assertSaveDockerImages(false, key, listStderr, otherOutput);
      jest.clearAllMocks();

      // Attempt second cache restore.
      await docker.loadDockerImages();
      // Expect cache hit since cache has been saved.
      assertLoadDockerImages(true, listStderr, otherOutput);
      jest.clearAllMocks();

      // Run post step second time.
      await docker.saveDockerImages();
      // Expect cache not to have been saved on cache hit.
      assertSaveDockerImages(true, key, listStderr, otherOutput);
    },
  );
});
