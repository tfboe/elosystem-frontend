HOST=$1
USER=$2

if [ $# -eq 2 ]; then
  echo -n FTP-Password:
  read -s PASSWD
  echo
  DIR=${3:-/elo-system}
else
  PASSWD=$3
  DIR=${4:-/elo-system}
fi

cd upload-tournament/dist
echo "Send new compiled files via FTP"
ftp -p -i -n $HOST <<END_SCRIPT
quote USER $USER
quote PASS $PASSWD
cd $DIR
mput *
quit
END_SCRIPT
cd ../..

(
  cp login.html login.html.backup &&
  cp recomputeRankings.html recomputeRankings.html.backup &&
  cp mergePlayers.html mergePlayers.html.backup &&
  cp register.html register.html.backup &&
  sed -i -e 's/http:\/\/localhost:8000/https:\/\/elo.tfboe.org\/backend\/public/g' login.html &&
  sed -i -e 's/http:\/\/localhost:8000/https:\/\/elo.tfboe.org\/backend\/public/g' recomputeRankings.html &&
  sed -i -e 's/http:\/\/localhost:8000/https:\/\/elo.tfboe.org\/backend\/public/g' mergePlayers.html &&
  sed -i -e 's/http:\/\/localhost:8000/https:\/\/elo.tfboe.org\/backend\/public/g' register.html &&
  echo "Send static scripts via FTP" &&
  ftp -p -i -n $HOST <<END_SCRIPT
quote USER $USER
quote PASS $PASSWD
cd $DIR
mput login.html
mput register.html
mput recomputeRankings.html
mput mergePlayers.html
quit
END_SCRIPT
)

mv login.html.backup login.html
mv recomputeRankings.html.backup recomputeRankings.html
mv mergePlayers.html.backup mergePlayers.html
mv register.html.backup register.html