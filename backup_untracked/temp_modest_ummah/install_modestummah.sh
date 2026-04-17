#!/bin/bash
# Complete Installer for ModestUmmah.com (Nginx + PHP + MariaDB + WordPress)
# Run as root (sudo)

set -e

DOMAIN="modestummah.com"
DB_NAME="modestummah_db"
DB_USER="modest_user"
DB_PASS="ModestClothingStore91" 
WEB_ROOT="/var/www/modestummah"

echo "Starting deployment for $DOMAIN..."

# 1. Install Dependencies (LEMP Stack)
echo "Installing Nginx, MariaDB, and PHP..."
apt-get update
apt-get install -y nginx mariadb-server php-fpm php-mysql php-curl php-gd php-mbstring php-xml php-xmlrpc php-soap php-intl php-zip

# 2. Start Services
systemctl enable --now nginx
systemctl enable --now mariadb

# 3. Configure Database
echo "Configuring Database..."
mysql -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME};"
mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
mysql -e "GRANT ALL ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

# 4. Download WordPress
echo "Downloading WordPress..."
mkdir -p $WEB_ROOT
chown -R www-data:www-data $WEB_ROOT
cd $WEB_ROOT
if [ ! -f wp-config.php ]; then
    wget -O latest.tar.gz https://wordpress.org/latest.tar.gz
    tar -xzf latest.tar.gz --strip-components=1
    rm latest.tar.gz
    chown -R www-data:www-data .
fi

# 5. Fix Nginx Config (Dynamic PHP Version)
PHP_SOCK=$(ls /var/run/php/php*-fpm.sock | head -n 1)
echo "Detected PHP socket: $PHP_SOCK"

# Create Nginx Config if it doesn't exist
cat > /etc/nginx/sites-available/modestummah.conf <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    root ${WEB_ROOT};
    index index.php index.html;

    access_log /var/log/nginx/modestummah.access.log;
    error_log /var/log/nginx/modestummah.error.log;

    location / {
        try_files \$uri \$uri/ /index.php?\$args;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:$PHP_SOCK;
    }

    location ~ /\.ht {
        deny all;
    }
}
EOF

ln -sf /etc/nginx/sites-available/modestummah.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo "Installation Complete! Go to http://$DOMAIN"
