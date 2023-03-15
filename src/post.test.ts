import { jest } from "@jest/globals";

jest.unstable_mockModule(
  "./docker.js",
  (): Partial<typeof import("./docker.js")> => ({
    saveDockerImages: jest.fn<typeof import("./docker.js").saveDockerImages>(),
  })
);

describe("Post", (): void => {
  test("saves Docker images on module load", async (): Promise<void> => {
    const docker = jest.mocked(await import("./docker.js"));
    await import("./post.js");

    expect(docker.saveDockerImages).lastCalledWith();
  });
});
