#!/bin/bash
echo "=== BeforeInstall: Cleaning up previous deployment ==="

PROJECT_DIR="/home/ec2-user/goshenkata.com"

if [ -d "$PROJECT_DIR" ]; then
    echo "Removing existing project directory: $PROJECT_DIR"
    rm -rf "$PROJECT_DIR"
    echo "Project directory removed"
else
    echo "No existing project directory found"
fi
