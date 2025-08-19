#!/bin/bash
echo "=== Install: Cloning repository and installing dependencies ==="

PROJECT_DIR="/home/ec2-user/goshenkata.com"
GITHUB_REPO_URL="https://github.com/Goshenkata/goshenkata.com.git"
APP_DIRECTORY="frontend"

cd /home/ec2-user

echo "Cloning repository..."
git clone "$GITHUB_REPO_URL"

if [ ! -d "$PROJECT_DIR" ]; then
    echo "ERROR: Failed to clone repository"
    exit 1
fi

cd "$PROJECT_DIR/$APP_DIRECTORY"

echo "Installing npm dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install npm dependencies"
    exit 1
fi

# Set proper ownership
chown -R ec2-user:ec2-user "$PROJECT_DIR"

echo "Install completed successfully"
exit 0
