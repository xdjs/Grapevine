#!/bin/bash

# Copy favicon to multiple locations to ensure it works on Vercel
echo "Copying favicon to build directory..."

# Create dist directory if it doesn't exist
mkdir -p dist/public

# Copy favicon to the build output directory
if [ -f "client/public/favicon.ico" ]; then
    cp client/public/favicon.ico dist/public/favicon.ico
    echo "Favicon copied to dist/public/favicon.ico"
fi

# Also copy to root of dist for fallback
if [ -f "client/public/favicon.ico" ]; then
    cp client/public/favicon.ico dist/favicon.ico
    echo "Favicon copied to dist/favicon.ico"
fi

echo "Favicon setup complete"