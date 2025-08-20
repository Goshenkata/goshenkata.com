#!/bin/bash
echo "Stopping Node.js application..."

pkill -f "node.*server.js"
pkill -f "npm.*start"

echo "Application stopped"
exit 0
