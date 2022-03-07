#/bin/bash

if [ "$(git rev-parse --abbrev-ref HEAD)" != "tfboe" ]; then
  echo 1>&2 "Publishing Production is only allowed on tfboe branch!"
  exit 1
fi

if [ ! -z "$(git status --porcelain)" ]; then
   echo 1>&2 "Uncommited git changes are not allowed!"
   exit 1
fi

cd upload-tournament

npm install

cd ..

./_deploy.sh copy-to-tfboe.sh build-for-tfboe.sh /public_html/admin
