# docker-cache

[![Test Workflow Status](https://github.com/ScribeMD/docker-cache/workflows/Test/badge.svg)](https://github.com/ScribeMD/docker-cache/actions/workflows/test.yaml)
[![Git Hooks: pre-commit](https://img.shields.io/badge/pre--commit-Git_Hooks-orange?logo=precommit&logoColor=FAB040)](https://pre-commit.com/)
[![Commit Style: Conventional Commits](https://img.shields.io/badge/Conventional_Commits-Commit_Style-yellow?logo=conventionalcommits&logoColor=FE5196)](https://conventionalcommits.org)
[![Code Style: Prettier](https://img.shields.io/badge/Prettier-Code_Style-FF69B4?logo=prettier&logoColor=F7B93E)](https://prettier.io/)

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
