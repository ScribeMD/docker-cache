import { jest } from "@jest/globals";

jest.unstable_mockModule(
  "./docker.js",
  (): Partial<typeof import("./docker.js")> => ({
    loadDockerImages: jest.fn<typeof import("./docker.js").loadDockerImages>(),
  })
);

describe("Main", (): void => {
  test("loads Docker images on module load", async (): Promise<void> => {
    const docker = jest.mocked(await import("./docker.js"));
    await import("./main.js");

    expect(docker.loadDockerImages).lastCalledWith();
  });
});
