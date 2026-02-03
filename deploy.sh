#!/bin/bash

echo "🚀 Starting Deployment..."

# 1. Pull Latest Code
echo "📥 Pulling latest code..."
git pull origin main

# 2. Build Frontend
echo "🏗️ Building Frontend..."
cd frontend
npm install
npm run build

# 3. Deploy Frontend (The Critical Step)
echo "🚚 Moving files to Nginx folder..."
sudo rm -rf /var/www/school_app/*
sudo cp -r dist/* /var/www/school_app/

# 4. Restart Backend
echo "🔄 Restarting Backend..."
cd ../backend
npm install
pm2 restart all

echo "✅ DEPLOYMENT COMPLETE! - Site is live."
