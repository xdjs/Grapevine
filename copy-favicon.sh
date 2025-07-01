#!/bin/bash

# Copy favicon to multiple locations to ensure it works on Vercel
echo "Copying favicon to all possible locations..."

# Create directories if they don't exist
mkdir -p dist/public dist static public assets

# Source favicon location
FAVICON_SOURCE="client/public/favicon.ico"

if [ -f "$FAVICON_SOURCE" ]; then
    # Copy to Vercel build output directory
    cp "$FAVICON_SOURCE" dist/public/favicon.ico
    echo "✓ Favicon copied to dist/public/favicon.ico"
    
    # Copy to root of dist for fallback
    cp "$FAVICON_SOURCE" dist/favicon.ico  
    echo "✓ Favicon copied to dist/favicon.ico"
    
    # Copy to static directories for Vercel static file serving
    cp "$FAVICON_SOURCE" public/favicon.ico
    echo "✓ Favicon copied to public/favicon.ico"
    
    cp "$FAVICON_SOURCE" static/favicon.ico
    echo "✓ Favicon copied to static/favicon.ico"
    
    # Copy to project root for direct access
    cp "$FAVICON_SOURCE" favicon.ico
    echo "✓ Favicon copied to root favicon.ico"
    
    echo "🎉 Favicon setup complete - deployed to 5 locations"
    
    # Verify file sizes
    echo "📊 File verification:"
    ls -la dist/public/favicon.ico public/favicon.ico favicon.ico 2>/dev/null || echo "Some files not found"
else
    echo "❌ Error: Source favicon not found at $FAVICON_SOURCE"
    exit 1
fi