#!/bin/bash

# =============================================
# 🚀 Connect2Campus - One-Command Deploy Script
# =============================================
# Run this on AWS after pushing new code:
#   bash ~/SchoolSoftware/deploy.sh
# =============================================

set -e  # Stop on any error

echo ""
echo "============================================="
echo "🚀 Starting Connect2Campus Deployment..."
echo "============================================="
echo ""

# 1. Pull Latest Code from GitHub
echo "📥 Step 1/5: Pulling latest code from GitHub (main)..."
cd ~/SchoolSoftware
git pull origin main
echo "✅ Code is up to date!"
echo ""

# 2. Install Frontend Dependencies
echo "📦 Step 2/5: Installing frontend dependencies..."
cd ~/SchoolSoftware/frontend
npm install
echo "✅ Frontend dependencies installed!"
echo ""

# 3. Build Frontend
echo "🏗️  Step 3/5: Building frontend for production..."
npm run build
echo "✅ Frontend built successfully!"
echo ""

# 4. Deploy Frontend to Nginx
echo "🚚 Step 4/5: Deploying frontend to Nginx..."
sudo rm -rf /var/www/school_app/*
sudo cp -r dist/* /var/www/school_app/
sudo chown -R www-data:www-data /var/www/school_app
sudo systemctl restart nginx
echo "✅ Frontend deployed and Nginx restarted!"
echo ""

# 5. Restart Backend
echo "🔄 Step 5/5: Restarting backend server..."
cd ~/SchoolSoftware/backend
npm install
pm2 restart all
echo "✅ Backend restarted!"
echo ""

echo "============================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "🌐 Live at: https://connect2campus.co.in"
echo "============================================="
echo ""
