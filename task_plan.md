# Task Plan: Gemini downloader + local Docker cleaning service

## Goal
Provide a Chrome MV3 extension that (1) downloads Gemini originals, (2) calls a local Docker service to clean them into a user-selected Result directory, and (3) optionally deletes originals after cleaning.

## Phases
- [x] Phase 1: Plan and setup
- [x] Phase 2: Research/gather information
- [x] Phase 3: Execute/build
- [x] Phase 4: Review and deliver

## Key Questions
1. How will the extension call the local Docker service (HTTP on localhost)?
2. How does the user set Result directory and delete-originals preference?
3. What exact API contract should the Docker service expose?

## Decisions Made
- Use localhost HTTP API from extension to Docker service.
- Default Docker mount: ${HOME}/Downloads -> /data.
- Extension auto-cleans after downloads using debounce.
- i18n uses Chrome default locale with manual override in settings.

## Errors Encountered
- None yet.

## Status
**Currently in Phase 4** - Ready to deliver
