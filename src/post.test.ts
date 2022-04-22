import { jest } from "@jest/globals";

import type { Mocked } from "./util.test.js";

jest.unstable_mockModule(
  "./docker.js",
  (): Partial<typeof import("./docker.js")> => ({
    saveDockerImages: jest.fn<typeof import("./docker.js").saveDockerImages>(),
  })
);

describe("Post", (): void => {
  let docker: Mocked<typeof import("./docker.js")>;

  beforeAll(async (): Promise<void> => {
    docker = <any>await import("./docker.js");
  });

  test("saves Docker images on module load", async (): Promise<void> => {
    await import("./post.js");

    expect(docker.saveDockerImages).lastCalledWith();
  });
});
