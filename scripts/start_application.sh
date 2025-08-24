#!/bin/bash
echo "Starting Node.js application..."

set -a
source /home/ec2-user/.env
set +a

cd /home/ec2-user/frontend
npm install
sudo -E -u ec2-user nohup /usr/bin/npm start > /home/ec2-user/app.log 2>&1 &

sleep 5
echo "Application started"
exit 0
