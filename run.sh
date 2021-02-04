#!/usr/bin/env bash

# */5 * * * * /path/to/run.sh >> debug.log 2>&1

cd "$(dirname "${BASH_SOURCE[0]}")"

source ~/.nvm/nvm.sh

node index.js