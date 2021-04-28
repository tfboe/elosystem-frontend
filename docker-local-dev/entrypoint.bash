echo "##################################"
echo "####### ENTRYPOINT.bash ##########"
echo "##################################"

#configure git
su $USER -c "git config --global user.name \"$GIT_NAME\" && git config --global user.email \"$GIT_EMAIL\""

echo "# serve javascript on port 8080"
su $USER -c "cd upload-tournament && npm run start" &
echo "# start vscodium as $USER"
su $USER -c "/usr/bin/codium -w --user-data-dir /userdata /workspace"
