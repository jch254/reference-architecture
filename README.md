## What this is

A minimal, production-ready backend reference architecture.

Built with:

- NestJS
- DynamoDB (single-table mindset)
- Docker + CodeBuild compatible runtime

## Principles

- stateless API
- no domain logic
- no async/background systems
- minimal, explicit structure

## Endpoints

- GET /health
- GET /example

## Goal

Provide a clean foundation for building new systems without inheriting legacy complexity.

## Usage

This repository is used as a reference architecture when generating new applications.

Typical workflow:

1. Copy this repository as `/example-project`
2. Use it as architectural context for LLM-assisted generation
3. Generate a new application in a separate repository
4. Evolve the new application independently

Principle:

Reuse structure, not implementation.