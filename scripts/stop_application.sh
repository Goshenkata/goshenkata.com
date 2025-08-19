#!/bin/bash
echo "=== ApplicationStop: Stopping Node.js application ==="

# Find and kill all node processes
if pgrep -f "node.*server.js" > /dev/null; then
    echo "Killing existing Node.js processes..."
    pkill -f "node.*server.js"
    sleep 2
    
    # Force kill if still running
    if pgrep -f "node.*server.js" > /dev/null; then
        echo "Force killing remaining Node.js processes..."
        pkill -9 -f "node.*server.js"
    fi
    echo "Node.js application stopped"
else
    echo "No Node.js application running"
fi

exit 0
