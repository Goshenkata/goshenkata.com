#!/bin/bash
sleep 3

echo "Validating service..."

MAX_RETRIES=5
SLEEP_BETWEEN=2
for i in $(seq 1 $MAX_RETRIES); do
    if curl -s http://localhost:3000/health | grep -q "OK"; then
        echo "Service is healthy"
        exit 0
    fi
    echo "Health check failed, retrying in $SLEEP_BETWEEN seconds... ($i/$MAX_RETRIES)"
    sleep $SLEEP_BETWEEN
done
echo "Service validation failed"
exit 1
