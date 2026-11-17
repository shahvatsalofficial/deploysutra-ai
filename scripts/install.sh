#!/usr/bin/env sh
# This script never installs global tools. It only prints the opt-in project-local command.
set -eu
printf '%s\n' 'DeploySutra AI — safe project-local skill installation' 'Usage: node packages/cli/index.mjs install-skills --host claude --target /path/to/your/project' 'Other hosts: cursor, codex, gemini, copilot, opencode' 'Nothing installed by running this script.'
