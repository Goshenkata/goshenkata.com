#!/bin/bash
echo "Starting Node.js application..."

cd /home/ec2-user/frontend
npm install
sudo -u ec2-user nohup npm start > /home/ec2-user/app.log 2>&1 &

sleep 5
echo "Application started"
exit 0
