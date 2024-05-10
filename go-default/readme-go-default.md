# go-default

## Get started

1. Run go mod init github/Eyevinn/name
2. Edit the installed files appropriately
3. Put any executables in directories with proper names under cmd/cmd1 etc
   and update the Makefile

## Included

The defaults for all go projects include:

- A gitignore file
- Github actions for running tests and golang-ci-lint
- A Makefile for running tests, coverage, and update repo
- A README skeleton (update badges to Go, see e.g. mp4ff)
- A CHANGELOG.md file that should be changed manually
- A config file for pre-commit (see https://pre-commit.com)
