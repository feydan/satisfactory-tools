#!/bin/sh

# Note: Arguments to this script 
#  1: string - S3 bucket for your backup save files (required)
#  2: true|false - whether to use Satisfactory Experimental build (optional, default false)
S3_SAVE_BUCKET=$1
USE_EXPERIMENTAL_BUILD=${2-false}


# install steamcmd: https://developer.valvesoftware.com/wiki/SteamCMD?__cf_chl_jschl_tk__=pmd_WNQPOiK18.h0rf16RCYrARI2s8_84hUMwT.7N1xHYcs-1635248050-0-gqNtZGzNAiWjcnBszQiR#Linux.2FmacOS)
add-apt-repository multiverse
dpkg --add-architecture i386
apt update

# Needed to accept steam license without hangup
echo steam steam/question 'select' "I AGREE" | sudo debconf-set-selections
echo steam steam/license note '' | sudo debconf-set-selections

apt install -y unzip lib32gcc1 steamcmd

# install satisfactory: https://satisfactory.fandom.com/wiki/Dedicated_servers
if [ $USE_EXPERIMENTAL_BUILD = "true" ]; then
    STEAM_INSTALL_SCRIPT="/usr/games/steamcmd +login anonymous +app_update 1690800 -beta experimental validate +quit"
else
    STEAM_INSTALL_SCRIPT="/usr/games/steamcmd +login anonymous +app_update 1690800 -beta public validate +quit"
fi
# note, we are switching users because steam doesn't recommend running steamcmd as root
su - ubuntu -c "$STEAM_INSTALL_SCRIPT"

EPIC_SAVE_DIR="/home/ubuntu/.config/Epic/FactoryGame/Saved/SaveGames/server"
STEAM_DIR="/home/ubuntu/.steam/SteamApps/common/SatisfactoryDedicatedServer"
CONFIG_DIR="$STEAM_DIR/FactoryGame/Saved/Config"
CONFIG_SERVER_DIR="$CONFIG_DIR/LinuxServer"

# pull down any saved files to new instances
su - ubuntu -c "mkdir -p $EPIC_SAVE_DIR $CONFIG_DIR"
su - ubuntu -c "/usr/local/bin/aws s3 sync s3://$S3_SAVE_BUCKET/saves $EPIC_SAVE_DIR"
su - ubuntu -c "/usr/local/bin/aws s3 sync s3://$S3_SAVE_BUCKET/config $CONFIG_DIR"
su - ubuntu -c "mkdir -p $CONFIG_SERVER_DIR"

GAME_INI_PATH="$CONFIG_SERVER_DIR/Game.ini"
if [ ! -f "$GAME_INI_PATH" ]; then
    su - ubuntu -c "echo '[/Script/Engine.GameSession]' > $GAME_INI_PATH"
    su - ubuntu -c "echo 'MaxPlayers=8' >> $GAME_INI_PATH"
fi

# enable as server so it stays up and start: https://satisfactory.fandom.com/wiki/Dedicated_servers/Running_as_a_Service
cat << EOF > /etc/systemd/system/satisfactory.service
[Unit]
Description=Satisfactory dedicated server
Wants=network-online.target
After=syslog.target network.target nss-lookup.target network-online.target

[Service]
Environment="LD_LIBRARY_PATH=./linux64"
ExecStartPre=$STEAM_INSTALL_SCRIPT
ExecStart=$STEAM_DIR/FactoryServer.sh -multihome=0.0.0.0
User=ubuntu
Group=ubuntu
StandardOutput=journal
Restart=on-failure
KillSignal=SIGINT
WorkingDirectory=$STEAM_DIR

[Install]
WantedBy=multi-user.target
EOF

systemctl enable satisfactory
systemctl start satisfactory

# enable auto shutdown: https://github.com/feydan/satisfactory-tools/tree/main/shutdown
cat << EOF > /home/ubuntu/auto-shutdown.sh
#!/bin/sh

shutdownIdleMinutes=10
idleCheckFrequencySeconds=1

isIdle=0
while [ \$isIdle -le 0 ]; do
    isIdle=1
    iterations=\$((60 / \$idleCheckFrequencySeconds * \$shutdownIdleMinutes))
    while [ \$iterations -gt 0 ]; do
        sleep \$idleCheckFrequencySeconds
        connectionBytes=\$(ss -lu | grep 777 | awk -F ' ' '{s+=\$2} END {print s}')
        if [ ! -z \$connectionBytes ] && [ \$connectionBytes -gt 0 ]; then
            isIdle=0
        fi
        if [ \$isIdle -le 0 ] && [ \$((\$iterations % 21)) -eq 0 ]; then
           echo "Activity detected, resetting shutdown timer to \$shutdownIdleMinutes minutes."
           break
        fi
        iterations=\$((\$iterations-1))
    done
done

sudo /usr/local/bin/aws s3 sync $EPIC_SAVE_DIR s3://$S3_SAVE_BUCKET/saves
sudo /usr/local/bin/aws s3 sync $CONFIG_DIR s3://$S3_SAVE_BUCKET/config

echo "No activity detected for \$shutdownIdleMinutes minutes, shutting down."
sudo shutdown -h now
EOF
chmod +x /home/ubuntu/auto-shutdown.sh
chown ubuntu:ubuntu /home/ubuntu/auto-shutdown.sh

cat << 'EOF' > /etc/systemd/system/auto-shutdown.service
[Unit]
Description=Auto shutdown if no one is playing Satisfactory
After=syslog.target network.target nss-lookup.target network-online.target

[Service]
Environment="LD_LIBRARY_PATH=./linux64"
ExecStart=/home/ubuntu/auto-shutdown.sh
User=ubuntu
Group=ubuntu
StandardOutput=journal
Restart=on-failure
KillSignal=SIGINT
WorkingDirectory=/home/ubuntu

[Install]
WantedBy=multi-user.target
EOF
systemctl enable auto-shutdown
systemctl start auto-shutdown

# automated backups to s3 every 5 minutes
su - ubuntu -c "(crontab -l; echo \"*/5 * * * * /usr/local/bin/aws s3 sync $EPIC_SAVE_DIR s3://$S3_SAVE_BUCKET/saves && /usr/local/bin/aws s3 sync $CONFIG_DIR s3://$S3_SAVE_BUCKET/config\") | crontab -"
