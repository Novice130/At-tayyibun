#!/bin/bash
# Master Backup Script
# Run as root: sudo ./backup_all.sh

set -e

BACKUP_DIR="/root/full_backup"
mkdir -p $BACKUP_DIR
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "Starting Backup to $BACKUP_DIR..."

# 1. Backup ModestUmmah (WordPress)
echo "Backing up ModestUmmah..."
# Database
mysqldump -u modest_user -pModestClothingStore91 modestummah_db > $BACKUP_DIR/modestummah_db.sql || echo "Warning: ModestUmmah DB backup failed"
# Files
tar -czf $BACKUP_DIR/modestummah_files.tar.gz -C /var/www modestummah

# 2. Backup LearnNovice & Projects
# Based on your Nginx config, these seem to be the folders:
FOLDERS=("learnnovice" "cpts-companion" "citcd" "citcd-website" "html")

for folder in "${FOLDERS[@]}"; do
    if [ -d "/var/www/$folder" ]; then
        echo "Backing up $folder..."
        tar -czf $BACKUP_DIR/${folder}_files.tar.gz -C /var/www $folder
    else
        echo "Warning: /var/www/$folder does not exist, skipping."
    fi
done

# 3. Backup Nginx Configs (Reference)
echo "Backing up Nginx Configs..."
tar -czf $BACKUP_DIR/nginx_configs.tar.gz /etc/nginx/sites-available

# 4. Final Package
echo "Creating final archive..."
FINAL_ARCHIVE="server_backup_$TIMESTAMP.tar.gz"
tar -czf $FINAL_ARCHIVE -C /root full_backup

echo "------------------------------------------------"
echo "BACKUP COMPLETE: $FINAL_ARCHIVE"
echo "Location: /root/$FINAL_ARCHIVE"
echo "------------------------------------------------"
echo "IMPORTANT: Now download this file to your computer using SCP!"
