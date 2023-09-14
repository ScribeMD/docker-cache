import type { JestConfigWithTsJest } from "ts-jest";

const config: JestConfigWithTsJest = {
  collectCoverage: true,
  coverageDirectory: "reports/jest/",
  coverageProvider: "v8",
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  extensionsToTreatAsEsm: [".ts"],
  moduleFileExtensions: ["ts", "js"],
  resetMocks: true,
  rootDir: "../src",

  // See https://kulshekhar.github.io/ts-jest/docs/guides/esm-support#use-esm-presets.
  preset: "ts-jest/presets/default-esm",
  transform: {
    "^.+\\.ts$": ["ts-jest", { useESM: true }],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};

if (process.env["CI"] === "true") {
  config.ci = true;
  config.collectCoverageFrom = ["**/*.ts"];
  config.reporters = [
    ["jest-junit", { outputDirectory: "<rootDir>/reports/jest/" }],
  ];
}

export default config;
