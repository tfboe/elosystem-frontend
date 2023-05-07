#/bin/bash

mkdir -p upload-tournament/dist-backup

COPY_SCRIPT=$1
shift

TFBOE_HOST="elo.tfboe.org"
TFBOE_USER="elo@tfboe.org"

echo -n FTP-Password for tfboe:
read -s TFBOE_PASSWD
echo

while test $# -gt 0; do
    BUILD_SCRIPT=$1
    shift
    DIR=$1
    shift
    cd upload-tournament
    ../$BUILD_SCRIPT
    cp -r dist dist-backup/`date +"%Y-%m-%d_%H-%M-%S"`
    cd ..
    ./$COPY_SCRIPT $TFBOE_HOST $TFBOE_USER $TFBOE_PASSWD $DIR
done