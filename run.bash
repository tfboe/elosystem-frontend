#!/usr/bin/env bash

echo "# Starting vs-code-in-docker.."

SCRIPT="`readlink -e $0`"
SCRIPTPATH="`dirname $SCRIPT`"

echo "# SCRIPTPATH:"
echo $SCRIPTPATH

# setting up git name and email
export GIT_NAME="`git config user.name`"
export GIT_EMAIL="`git config user.email`"

# rebuild
echo "rebuild docker-compose"
cd docker-local-dev
docker-compose build

echo "# allow xHost"
xhost +local:

#make and run container
echo "IMPORTANT: DONT close this terminal or vscode will close"

docker-compose up --exit-code-from core

echo "# disallow xHost"
xhost -local:
