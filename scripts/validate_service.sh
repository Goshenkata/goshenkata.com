#!/bin/bash
echo "Validating service..."

sleep 3

if curl -s http://localhost:3000/health | grep -q "OK"; then
    echo "Service is healthy"
    exit 0
else
    echo "Service validation failed"
    exit 1
fi
