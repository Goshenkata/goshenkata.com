#!/bin/bash
echo "=== ApplicationStart: Starting Node.js application ==="

PROJECT_DIR="/home/ec2-user/goshenkata.com"
APP_DIRECTORY="frontend"
APP_PORT="3000"

cd "$PROJECT_DIR/$APP_DIRECTORY"

echo "Starting Node.js application..."

# Create log file with proper permissions
touch /home/ec2-user/app.log
chown ec2-user:ec2-user /home/ec2-user/app.log

# Start the application as ec2-user in background
sudo -u ec2-user bash -c "cd '$PROJECT_DIR/$APP_DIRECTORY' && nohup npm start > /home/ec2-user/app.log 2>&1 &"

if [ $? -eq 0 ]; then
    echo "Node.js application started successfully"
    echo "Process ID: $(pgrep -f 'node.*server.js')"
    echo "Logs: tail -f /home/ec2-user/app.log"
else
    echo "ERROR: Failed to start Node.js application"
    exit 1
fi

# Wait a moment for the app to start
sleep 3

exit 0
