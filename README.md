# docker-cache

[![Test Workflow Status](https://github.com/ScribeMD/docker-cache/workflows/Test/badge.svg)](https://github.com/ScribeMD/docker-cache/actions/workflows/test.yaml)
[![Copy/Paste: 0%](https://img.shields.io/badge/Copy%2FPaste-0%25-B200B2?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik03LjAyNCAzLjc1YzAtLjk2Ni43ODQtMS43NSAxLjc1LTEuNzVIMjAuMjVjLjk2NiAwIDEuNzUuNzg0IDEuNzUgMS43NXYxMS40OThhMS43NSAxLjc1IDAgMDEtMS43NSAxLjc1SDguNzc0YTEuNzUgMS43NSAwIDAxLTEuNzUtMS43NVYzLjc1em0xLjc1LS4yNWEuMjUuMjUgMCAwMC0uMjUuMjV2MTEuNDk4YzAgLjEzOS4xMTIuMjUuMjUuMjVIMjAuMjVhLjI1LjI1IDAgMDAuMjUtLjI1VjMuNzVhLjI1LjI1IDAgMDAtLjI1LS4yNUg4Ljc3NHoiLz48cGF0aCBkPSJNMS45OTUgMTAuNzQ5YTEuNzUgMS43NSAwIDAxMS43NS0xLjc1MUg1LjI1YS43NS43NSAwIDExMCAxLjVIMy43NDVhLjI1LjI1IDAgMDAtLjI1LjI1TDMuNSAyMC4yNWMwIC4xMzguMTExLjI1LjI1LjI1aDkuNWEuMjUuMjUgMCAwMC4yNS0uMjV2LTEuNTFhLjc1Ljc1IDAgMTExLjUgMHYxLjUxQTEuNzUgMS43NSAwIDAxMTMuMjUgMjJoLTkuNUExLjc1IDEuNzUgMCAwMTIgMjAuMjVsLS4wMDUtOS41MDF6Ii8+PC9zdmc+)](https://github.com/kucherenko/jscpd)
[![GitHub Action: Try Me](https://img.shields.io/badge/GitHub_Action-Try_Me-FF6978?logo=githubactions&logoColor=2088FF)](https://github.com/marketplace/actions/docker-cache)
[![Docker Cache](https://img.shields.io/badge/Docker-Cache-FF5666?logo=docker&logoColor=2496ED)](https://www.docker.com/)
[![Automated Updates: Dependabot](https://img.shields.io/badge/Dependabot-Automated_Updates-C98686?logo=dependabot&logoColor=025E8C)](https://github.com/dependabot)
[![Language: TypeScript](https://img.shields.io/badge/TypeScript-Language-ED9390?logo=typescript&logoColor=3178C6)](https://www.typescriptlang.org/)
[![Runtime: Node.js](https://img.shields.io/badge/Node.js-Runtime-F03A47?logo=nodedotjs&logoColor=339933)](https://nodejs.org/)
[![REPL: ts-node](https://img.shields.io/badge/ts--node-REPL-EB5160?logo=tsnode&logoColor=3178C6)](https://typestrong.org/ts-node/)
[![Test Framework: Jest](https://img.shields.io/badge/Jest-Test_Framework-FF8C42?logo=jest&logoColor=C21325)](https://jestjs.io/)
[![Package Management: Yarn](https://img.shields.io/badge/Yarn-Package_Management-00C49A?logo=yarn&logoColor=2C8EBB)](https://yarnpkg.com/)
[![Package Management: Poetry](https://img.shields.io/badge/Poetry-Package_Management-F58A07?logo=poetry&logoColor=60A5FA)](https://python-poetry.org/)
[![Git Hooks: pre-commit](https://img.shields.io/badge/pre--commit-Git_Hooks-66A182?logo=precommit&logoColor=FAB040)](https://pre-commit.com/)
[![Commit Style: Conventional Commits](https://img.shields.io/badge/Conventional_Commits-Commit_Style-F39237?logo=conventionalcommits&logoColor=FE5196)](https://conventionalcommits.org)
[![Releases: Semantic Versioning](https://img.shields.io/badge/SemVer-Releases-40C9A2?logo=semver&logoColor=3F4551)](https://semver.org/)
[![Code Style: Prettier](https://img.shields.io/badge/Prettier-Code_Style-758ECD?logo=prettier&logoColor=F7B93E)](https://prettier.io/)
[![Code Style: EditorConfig](https://img.shields.io/badge/EditorConfig-Code_Style-CF995F?logo=editorconfig&logoColor=FEFEFE)](https://editorconfig.org/)
[![Editor: Visual Studio Code](https://img.shields.io/badge/VSCode-Editor-E54B4B?logo=visualstudiocode&logoColor=007ACC)](https://code.visualstudio.com/)

Cache Docker Images Whether Built or Pulled

<!--TOC-->

- [docker-cache](#docker-cache)
  - [Usage](#usage)
  - [Inputs](#inputs)
    - [Required](#required)
  - [Outputs](#outputs)
    - [`cache-hit`](#cache-hit)
  - [Supported Runners](#supported-runners)
  - [Changelog](#changelog)

<!--TOC-->

Cache all Docker images whether built or pulled by
[saving](https://docs.docker.com/engine/reference/commandline/save/) them on
cache misses and
[loading](https://docs.docker.com/engine/reference/commandline/load/) them on
cache hits. Note that this action does not perform Docker layer caching.
[The official Docker build push action](https://github.com/docker/build-push-action)
performs Docker layer caching for built images but does not cache pulled images.

## Usage

- Add the following step before your first use of Docker:

  ```yaml
  - name: Cache Docker images.
    uses: ScribeMD/docker-cache@0.1.4
    with:
      key: docker-${{ runner.os }}-${{ hashFiles(...) }}
  ```

## Inputs

### Required

#### `key`

The explicit cache key to ferry to the
[official GitHub cache action](https://github.com/marketplace/actions/cache).
`restore-keys` are not supported, because partial cache restoration leads to a
["snowball" effect](https://glebbahmutov.com/blog/do-not-let-npm-cache-snowball/).

## Outputs

### `cache-hit`

The ferried output of the
[official GitHub cache action](https://github.com/marketplace/actions/cache).
True on cache hit (even if the subsequent
[`docker load`](https://docs.docker.com/engine/reference/commandline/load/)
failed) and false on cache miss. See also
[skipping steps based on cache-hit](https://github.com/marketplace/actions/cache#Skipping-steps-based-on-cache-hit).

## Supported Runners

Please refer to
[`README.md` of ScribeMD/rootless-docker](https://github.com/ScribeMD/rootless-docker#supported-runners).

## Changelog

Please refer to [`CHANGELOG.md`](CHANGELOG.md).
