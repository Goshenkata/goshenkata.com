#!/bin/bash
echo "=== ApplicationStart: Starting Node.js application ==="

echo "=== Install: Installing npm dependencies ==="

APP_DIRECTORY="/home/ec2-user/frontend"

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
