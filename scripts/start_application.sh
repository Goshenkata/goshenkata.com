#!/bin/bash
echo "=== ApplicationStart: Starting Node.js application ==="

echo "=== Install: Installing npm dependencies ==="

APP_DIRECTORY="/home/ec2-user/frontend"
PROJECT_DIR="/home/ec2-user"

if [ ! -d "$APP_DIRECTORY" ]; then
    echo "ERROR: Frontend directory not found at $APP_DIRECTORY"
    echo "CodeDeploy should have copied files there"
    exit 1
fi

cd "$APP_DIRECTORY"

echo "Installing npm dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install npm dependencies"
    exit 1
fi

echo "Install completed successfully"
echo "Starting Node.js application..."

# Create log file with proper permissions
LOG_FILE="/home/ec2-user/app.log"
touch "$LOG_FILE"
chown ec2-user:ec2-user "$LOG_FILE"

# Start the application as ec2-user in background
echo "Starting application from directory: $APP_DIRECTORY"
sudo -u ec2-user bash -c "cd '$APP_DIRECTORY' && nohup npm start > '$LOG_FILE' 2>&1 &"

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
