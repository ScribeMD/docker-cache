import { jest } from "@jest/globals";

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

  let child_process: Mocked<typeof import("node:child_process")>;
  let cache: Mocked<typeof import("@actions/cache")>;
  let core: Mocked<typeof import("@actions/core")>;
  let docker: typeof import("./docker.js");

  let inMemoryCache: Record<string, string>;
  let state: Record<string, string>;

  beforeEach(async (): Promise<void> => {
    child_process = <any>await import("node:child_process");
    cache = <any>await import("@actions/cache");
    core = <any>await import("@actions/core");
    docker = <any>await import("./docker.js");

    inMemoryCache = {};
    state = {};

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

  const mockedExec = async (load: boolean, command: string): Promise<void> => {
    const stdout = "standard output from Bash command";
    const stderr = "error output from Bash command";
    child_process.exec.mockImplementationOnce(
      (_command: any, _options: any, callback: any): any => {
        callback(null, { stdout, stderr });
      }
    );

    await (load ? docker.loadDockerImages() : docker.saveDockerImages());

    expect(core.getInput).nthCalledWith<[string, InputOptions]>(1, "key", {
      required: true,
    });
    expect(core.info).nthCalledWith<[string]>(1, command);
    expect(child_process.exec).lastCalledWith(
      command,
      EXEC_OPTIONS,
      expect.anything()
    );
    expect(core.info).lastCalledWith(stdout);
    expect(core.error).lastCalledWith(stderr);
    expect(core.setFailed).not.toHaveBeenCalled();
  };

  test("cache misses, then hits", async (): Promise<void> => {
    // Attempt first cache restore.
    await docker.loadDockerImages();

    // Expect cache miss since cache has never been saved.
    expect(core.getInput).nthCalledWith<[string, InputOptions]>(1, "key", {
      required: true,
    });
    expect(core.setOutput).lastCalledWith(docker.CACHE_HIT, false);
    expect(child_process.exec).not.toHaveBeenCalled();
    expect(core.setFailed).not.toHaveBeenCalled();
    jest.clearAllMocks();

    // Run post step first time, expecting cache saved on cache miss.
    const saveCommand =
      'docker image list --format "{{ .Repository }}:{{ .Tag }}" | ' +
      '2>&1 xargs --delimiter="\n" --no-run-if-empty --verbose --exit ' +
      `docker save --output ${docker.DOCKER_IMAGES_PATH}`;
    await mockedExec(false, saveCommand);
    jest.clearAllMocks();

    // Attempt second cache restore.
    const loadCommand = `docker load --input ${docker.DOCKER_IMAGES_PATH}`;
    await mockedExec(true, loadCommand);

    // Expect cache hit since cache has been saved.
    expect(core.setOutput).lastCalledWith(docker.CACHE_HIT, true);
    jest.clearAllMocks();

    // Run post step second time.
    await docker.saveDockerImages();

    // Expect cache not to have been saved on cache hit.
    expect(core.getInput).lastCalledWith("key", { required: true });
    expect(core.info).lastCalledWith(
      `Cache hit occurred on the primary key ${KEY}, not saving cache.`
    );
    expect(child_process.exec).not.toHaveBeenCalled();
    expect(core.setFailed).not.toHaveBeenCalled();
  });
});
