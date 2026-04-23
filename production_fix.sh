#!/bin/bash

# =============================================
# 🚀 Connect2Campus - Production Fix & Update
# =============================================
# This script ensures that the latest code is pulled,
# database is updated, and frontend is DEPLOYED to Nginx.
# =============================================

set -e  # Stop on any error

echo "============================================="
echo "🚀 Starting Production Fix..."
echo "============================================="

# 1. Pull Latest Code
echo "📥 Step 1/4: Pulling latest code..."
cd ~/SchoolSoftware
git reset --hard HEAD
git pull origin main
echo "✅ Code updated!"

# 2. Update Database Schema
echo "🗄️  Step 2/4: Updating database schema..."
cd ~/SchoolSoftware/backend
node fix_missing_tables.js
echo "✅ Database updated!"

# 3. Build & Deploy Frontend
echo "🏗️  Step 3/4: Building and Deploying Frontend..."
cd ~/SchoolSoftware/frontend
rm -rf dist
export NODE_OPTIONS="--max-old-space-size=2048"
npm run build

echo "🚚 Moving files to Nginx directory..."
sudo rm -rf /var/www/school_app/*
sudo cp -r dist/* /var/www/school_app/
sudo chown -R www-data:www-data /var/www/school_app
echo "✅ Frontend deployed to Nginx!"

# 4. Restart Services
echo "🔄 Step 4/4: Restarting services..."
sudo systemctl restart nginx
pm2 restart all
echo "✅ All services restarted!"

echo "============================================="
echo "✅ PRODUCTION UPDATE COMPLETE!"
echo "🌐 Please Hard Refresh (Ctrl+F5) your browser."
echo "============================================="
