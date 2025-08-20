#!/bin/bash
echo "=== Install: Installing npm dependencies ==="

APP_DIRECTORY="/home/ec2-user/frontend"

if [ ! -d "$APP_DIRECTORY" ]; then
    echo "ERROR: Frontend directory not found at $PROJECT_DIR/$APP_DIRECTORY"
    echo "CodeDeploy should have copied files there"
    exit 1
fi

cd "$$APP_DIRECTORY"

echo "Installing npm dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install npm dependencies"
    exit 1
fi

echo "Install completed successfully"
exit 0
