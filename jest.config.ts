import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: "reports/jest/",
  coverageProvider: "v8",
  moduleFileExtensions: ["ts", "js"],
  rootDir: "src",
  testEnvironment: "node",
  watchman: true,

  // See https://kulshekhar.github.io/ts-jest/docs/guides/esm-support#use-esm-presets.
  preset: "ts-jest/presets/default-esm",
  globals: {
    "ts-jest": {
      useESM: true,
    },
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};

if (process.env["CI"] === "true") {
  config.ci = true;
  config.reporters = [["jest-junit", { outputDirectory: "reports/jest/" }]];
}

export default config;
