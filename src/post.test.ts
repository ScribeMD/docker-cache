import { jest } from "@jest/globals";

import type { saveDockerImages } from "./docker.js";
import type { Docker } from "../types/aliases.js";

jest.unstable_mockModule(
  "./docker.js",
  (): Partial<Docker> => ({
    saveDockerImages: jest.fn<typeof saveDockerImages>(),
  }),
);

const docker = jest.mocked(await import("./docker.js"));

describe("Post", (): void => {
  test("saves Docker images on module load", async (): Promise<void> => {
    await import("./post.js");

    expect(docker.saveDockerImages).lastCalledWith();
  });
});
