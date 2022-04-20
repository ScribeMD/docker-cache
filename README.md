# docker-cache

[![Test](https://github.com/ScribeMD/docker-cache/workflows/Test/badge.svg)](https://github.com/ScribeMD/docker-cache/actions/workflows/test.yaml)
[![Bump Version](https://github.com/ScribeMD/docker-cache/workflows/Bump%20Version/badge.svg)](https://github.com/ScribeMD/docker-cache/actions/workflows/bump-version.yaml)
[![pre-commit](https://img.shields.io/badge/pre--commit-enabled-brightgreen?logo=pre-commit&logoColor=white)](https://github.com/pre-commit/pre-commit)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg?style=flat-square)](https://conventionalcommits.org)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

Cache Docker Images Whether Built or Pulled

<!--TOC-->

- [docker-cache](#docker-cache)
  - [Usage](#usage)
  - [Inputs](#inputs)
    - [Required](#required)
  - [Supported Runners](#supported-runners)
  - [Contributing](#contributing)
  - [Changelog](#changelog)

<!--TOC-->

[Use Docker in rootless mode](https://github.com/ScribeMD/rootless-docker) to
avoid permission issues. Query the Docker root directory via
[`docker info`](https://docs.docker.com/engine/reference/commandline/info/), so
it can be cached. This is where Docker stores both built and pulled images. Note
that this action does not perform Docker layer caching.
[The official Docker build push action](https://github.com/docker/build-push-action)
performs Docker layer caching for built images but does not cache pulled images.

## Usage

- Add the following step before your first use of Docker:

```yaml
- name: Cache Docker images.
  uses: ScribeMD/docker-cache@0.1.0
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

## Supported Runners

Please refer to
[README.md of ScribeMD/rootless-docker](https://github.com/ScribeMD/rootless-docker#supported-runners).

## Contributing

Please refer to [CONTRIBUTING.md](CONTRIBUTING.md).

## Changelog

Please refer to [CHANGELOG.md](CHANGELOG.md).
