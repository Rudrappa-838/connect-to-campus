#!/bin/bash
echo "Restarting Backend..."
cd /home/ubuntu/SchoolSoftware/backend
pm2 stop school-backend || true
pm2 delete school-backend || true
pm2 start src/server.js --name school-backend
pm2 save
echo "Waiting for startup..."
sleep 5
echo "Checking API Health..."
curl -v http://localhost:5000/api
