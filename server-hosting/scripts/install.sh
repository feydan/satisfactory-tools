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

apt install -y unzip lib32gcc1 steamcmd crudini

# install satisfactory: https://satisfactory.fandom.com/wiki/Dedicated_servers
if [ $USE_EXPERIMENTAL_BUILD = "true" ]; then
  STEAM_INSTALL_SCRIPT="/usr/games/steamcmd +login anonymous +app_update 1690800 -beta experimental validate +quit"
else
  STEAM_INSTALL_SCRIPT="/usr/games/steamcmd +login anonymous +app_update 1690800 -beta public validate +quit"
fi
# note, we are switching users because steam doesn't recommend running steamcmd as root
su - ubuntu -c "$STEAM_INSTALL_SCRIPT"

BLUEPRINT_SAVE_DIR="/home/ubuntu/.config/Epic/FactoryGame/Saved/SaveGames/blueprints"
EPIC_SAVE_DIR="/home/ubuntu/.config/Epic/FactoryGame/Saved/SaveGames/server"
STEAM_DIR="/home/ubuntu/.steam/SteamApps/common/SatisfactoryDedicatedServer"
CONFIG_DIR="$STEAM_DIR/FactoryGame/Saved/Config"
CONFIG_SERVER_DIR="$CONFIG_DIR/LinuxServer"

# pull down any saved files to new instances
su - ubuntu -c "mkdir -p $EPIC_SAVE_DIR $CONFIG_DIR $BLUEPRINT_SAVE_DIR"
su - ubuntu -c "/usr/local/bin/aws s3 sync s3://$S3_SAVE_BUCKET/blueprints $BLUEPRINT_SAVE_DIR"
su - ubuntu -c "/usr/local/bin/aws s3 sync s3://$S3_SAVE_BUCKET/saves $EPIC_SAVE_DIR"
su - ubuntu -c "/usr/local/bin/aws s3 sync s3://$S3_SAVE_BUCKET/config $CONFIG_DIR"
su - ubuntu -c "mkdir -p $CONFIG_SERVER_DIR"

GAME_INI_PATH="$CONFIG_SERVER_DIR/Game.ini"
su - ubuntu -c "crudini --set '$GAME_INI_PATH' '/Script/Engine.GameSession' MaxPlayers 8"
su - ubuntu -c "crudini --set '$GAME_INI_PATH' '/script/engine.gamenetworkmanager' TotalNetBandwidth 104857600"
su - ubuntu -c "crudini --set '$GAME_INI_PATH' '/script/engine.gamenetworkmanager' MaxDynamicBandwidth 104857600"
su - ubuntu -c "crudini --set '$GAME_INI_PATH' '/script/engine.gamenetworkmanager' MAXPOSITIONERRORSQUARED 32.00f"
su - ubuntu -c "crudini --set '$GAME_INI_PATH' '/script/engine.gamenetworkmanager' MoveRepSize 512.0f"
su - ubuntu -c "crudini --set '$GAME_INI_PATH' '/script/engine.gamenetworkmanager' CLIENTADJUSTUPDATECOST 512.0f"
su - ubuntu -c "crudini --set '$GAME_INI_PATH' '/script/engine.gamenetworkmanager' ClientAuthorativePosition true"
su - ubuntu -c "crudini --set '$GAME_INI_PATH' '/script/engine.gamenetworkmanager' bMovementTimeDiscrepancyDetection false"
su - ubuntu -c "crudini --set '$GAME_INI_PATH' '/script/engine.gamenetworkmanager' bMovementTimeDiscrepancyResolution false"
su - ubuntu -c "crudini --set '$GAME_INI_PATH' '/script/engine.gamenetworkmanager' bMovementTimeDiscrepancyForceCorrectionsDuringResolution false"
su - ubuntu -c "crudini --set '$GAME_INI_PATH' '/script/engine.gamenetworkmanager' MAXCLIENTUPDATEINTERVAL 2.20f"
su - ubuntu -c "crudini --set '$GAME_INI_PATH' '/script/engine.gamenetworkmanager' MaxMoveDeltaTime 0.700f"
su - ubuntu -c "crudini --set '$GAME_INI_PATH' '/script/engine.gamenetworkmanager' MaxClientSmoothingDeltaTime 2.20f"
su - ubuntu -c "crudini --set '$GAME_INI_PATH' '/script/engine.gamenetworkmanager' MaxClientForcedUpdateDuration 1.0f"
su - ubuntu -c "crudini --set '$GAME_INI_PATH' '/script/engine.gamenetworkmanager' ClientNetSendMoveDeltaTime 0.0332"
su - ubuntu -c "crudini --set '$GAME_INI_PATH' '/script/engine.gamenetworkmanager' ClientNetSendMoveDeltaTimeStationary 0.0664"
su - ubuntu -c "crudini --set '$GAME_INI_PATH' '/script/engine.gamenetworkmanager' ClientNetSendMoveThrottleOverPlayerCount 99"
su - ubuntu -c "crudini --set '$GAME_INI_PATH' '/script/engine.gamenetworkmanager' ServerForcedUpdateHitchThreshold 2.800f"

ENGINE_INI_PATH="$CONFIG_SERVER_DIR/Engine.ini"
su - ubuntu -c "crudini --set '$ENGINE_INI_PATH' '/script/onlinesubsystemutils.ipnetdriver' MaxInternetClientRate 104857600"
su - ubuntu -c "crudini --set '$ENGINE_INI_PATH' '/script/onlinesubsystemutils.ipnetdriver' MaxClientRate 104857600"
su - ubuntu -c "crudini --set '$ENGINE_INI_PATH' '/script/onlinesubsystemutils.ipnetdriver' NetServerMaxTickRate 60"
su - ubuntu -c "crudini --set '$ENGINE_INI_PATH' '/script/onlinesubsystemutils.ipnetdriver' LanServerMaxTickRate 60"
su - ubuntu -c "crudini --set '$ENGINE_INI_PATH' '/script/onlinesubsystemutils.ipnetdriver' MaxNetTickRate 60"
su - ubuntu -c "crudini --set '$ENGINE_INI_PATH' '/script/onlinesubsystemutils.ipnetdriver' InitialConnectTimeout 300.0"
su - ubuntu -c "crudini --set '$ENGINE_INI_PATH' '/script/onlinesubsystemutils.ipnetdriver' ConnectionTimeout 300.0"

su - ubuntu -c "crudini --set '$ENGINE_INI_PATH' '/script/engine.player' ConfiguredInternetSpeed 104857600"
su - ubuntu -c "crudini --set '$ENGINE_INI_PATH' '/script/engine.player' ConfiguredLanSpeed 104857600"

su - ubuntu -c "crudini --set '$ENGINE_INI_PATH' '/script/socketsubsystemepic.epicnetdriver' MaxClientRate 104857600"
su - ubuntu -c "crudini --set '$ENGINE_INI_PATH' '/script/socketsubsystemepic.epicnetdriver' MaxInternetClientRate 104857600"

su - ubuntu -c "crudini --set '$ENGINE_INI_PATH' '/script/engine.engine' bSmoothFrameRate true"
su - ubuntu -c "crudini --set '$ENGINE_INI_PATH' '/script/engine.engine' bUseFixedFrameRate false"
su - ubuntu -c "crudini --set '$ENGINE_INI_PATH' '/script/engine.engine' SmoothedFrameRateRange '(LowerBound=(Type=Inclusive,Value=5.000000),UpperBound=(Type=Exclusive,Value=15.000000))'"
su - ubuntu -c "crudini --set '$ENGINE_INI_PATH' '/script/engine.engine' NetClientTicksPerSecond 15"

su - ubuntu -c "crudini --set '$ENGINE_INI_PATH' '/script/engine.garbagecollectionsettings' gc.MaxObjectsNotConsideredByGC 476499"
su - ubuntu -c "crudini --set '$ENGINE_INI_PATH' '/script/engine.garbagecollectionsettings' gc.SizeOfPermanentObjectPool 100378488"
su - ubuntu -c "crudini --set '$ENGINE_INI_PATH' '/script/engine.garbagecollectionsettings' gc.ActorClusteringEnabled True"
su - ubuntu -c "crudini --set '$ENGINE_INI_PATH' '/script/engine.garbagecollectionsettings' gc.BlueprintClusteringEnabled True"

su - ubuntu -c "crudini --set '$ENGINE_INI_PATH' '/script/engine.streamingsettings' s.EventDrivenLoaderEnabled True"
su - ubuntu -c "crudini --set '$ENGINE_INI_PATH' '/script/engine.streamingsettings' s.AsyncLoadingThreadEnabled True"

su - ubuntu -c "crudini --set '$ENGINE_INI_PATH' '/script/engine.streamingsettings' net.MaxRepArraySize 65535"
su - ubuntu -c "crudini --set '$ENGINE_INI_PATH' '/script/engine.streamingsettings' net.MaxRepArrayMemory 65535"

# enable as server so it stays up and start: https://satisfactory.fandom.com/wiki/Dedicated_servers/Running_as_a_Service
cat <<EOF >/etc/systemd/system/satisfactory.service
[Unit]
Description=Satisfactory dedicated server
Wants=network-online.target
After=syslog.target network.target nss-lookup.target network-online.target

[Service]
Environment="LD_LIBRARY_PATH=./linux64"
ExecStartPre=$STEAM_INSTALL_SCRIPT
ExecStart=$STEAM_DIR/FactoryServer.sh
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
cat <<EOF >/home/ubuntu/auto-shutdown.sh
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

sudo /usr/local/bin/aws s3 sync $BLUEPRINT_SAVE_DIR s3://$S3_SAVE_BUCKET/blueprints
sudo /usr/local/bin/aws s3 sync $EPIC_SAVE_DIR s3://$S3_SAVE_BUCKET/saves
sudo /usr/local/bin/aws s3 sync $CONFIG_DIR s3://$S3_SAVE_BUCKET/config

echo "No activity detected for \$shutdownIdleMinutes minutes, shutting down."
sudo shutdown -h now
EOF
chmod +x /home/ubuntu/auto-shutdown.sh
chown ubuntu:ubuntu /home/ubuntu/auto-shutdown.sh

cat <<'EOF' >/etc/systemd/system/auto-shutdown.service
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
