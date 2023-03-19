import { jest } from "@jest/globals";

import type { loadDockerImages } from "./docker.js";
import type { Docker } from "../types/aliases.js";

jest.unstable_mockModule(
  "./docker.js",
  (): Partial<Docker> => ({
    loadDockerImages: jest.fn<typeof loadDockerImages>(),
  })
);

const docker = jest.mocked(await import("./docker.js"));

describe("Main", (): void => {
  test("loads Docker images on module load", async (): Promise<void> => {
    await import("./main.js");

    expect(docker.loadDockerImages).lastCalledWith();
  });
});
