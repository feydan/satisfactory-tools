#!/bin/sh

# Configuration
DOMAIN="your-duckdns-domain"  # Replace with your Duck DNS subdomain
TOKEN="your-duckdns-token"    # Replace with your Duck DNS token

# Get the instance's public IPs
IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

# Update Duck DNS
# https://www.duckdns.org/update?domains={YOURVALUE}&token={YOURVALUE}[&ip={YOURVALUE}][&ipv6={YOURVALUE}][&verbose=true][&clear=true]
URL="https://www.duckdns.org/update?domains=$DOMAIN&token=$TOKEN&ip=$IP"

RESPONSE=$(curl -s $URL)

# Check if the update was successful
if [ "$RESPONSE" = "OK" ]; then
    echo "Duck DNS updated successfully with IP: $IP"
else
    echo "Failed to update Duck DNS"
fi