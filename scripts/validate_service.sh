#!/bin/bash
echo "=== ValidateService: Checking application health ==="

HEALTH_URL="http://localhost:3000/health"
MAX_ATTEMPTS=10
SLEEP_INTERVAL=3

for i in $(seq 1 $MAX_ATTEMPTS); do
    echo "Health check attempt $i/$MAX_ATTEMPTS..."
    
    # Use curl to check the health endpoint
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null)
    
    if [ "$RESPONSE" = "200" ]; then
        echo "Health check passed! Application is responding correctly."
        
        # Get the actual response for verification
        HEALTH_DATA=$(curl -s "$HEALTH_URL" 2>/dev/null)
        echo "Health endpoint response: $HEALTH_DATA"
        
        exit 0
    else
        echo "Health check failed. HTTP status: $RESPONSE"
        
        if [ $i -lt $MAX_ATTEMPTS ]; then
            echo "Waiting $SLEEP_INTERVAL seconds before retry..."
            sleep $SLEEP_INTERVAL
        fi
    fi
done

echo "ERROR: Application failed health check after $MAX_ATTEMPTS attempts"
echo "Checking application logs..."
tail -10 /home/ec2-user/app.log

echo "Checking if Node.js process is running..."
pgrep -f "node.*server.js" && echo "Node.js process is running" || echo "Node.js process not found"

exit 1
