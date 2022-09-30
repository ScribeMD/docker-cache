import { jest } from "@jest/globals";

jest.unstable_mockModule(
  "./docker.js",
  (): Partial<typeof import("./docker.js")> => ({
    loadDockerImages: jest.fn<typeof import("./docker.js").loadDockerImages>(),
  })
);

describe("Main", (): void => {
  let docker: jest.MockedObject<typeof import("./docker.js")>;

  beforeAll(async (): Promise<void> => {
    docker = <any>await import("./docker.js");
  });

  test("loads Docker images on module load", async (): Promise<void> => {
    await import("./main.js");

    expect(docker.loadDockerImages).lastCalledWith();
  });
});
