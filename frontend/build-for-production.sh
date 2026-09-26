#!/bin/bash

# Exit on any error
set -e

echo "🏗️  Building frontend for production..."

# Get the directory of the script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Run TypeScript checks
echo "🔍 Running TypeScript checks..."
npm run typecheck

# Run tests (optional - comment out if you want faster builds)
echo "🧪 Running tests..."
npm test -- --run --passWithNoTests

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist

# Build for production
echo "📦 Building for production..."
npm run build

# Verify build output
if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not found"
    exit 1
fi

if [ ! -f "dist/index.html" ]; then
    echo "❌ Build failed - index.html not found in dist"
    exit 1
fi

echo "✅ Frontend build completed successfully!"
echo "📁 Build output is in: $SCRIPT_DIR/dist"
echo "📏 Build size:"
du -sh dist/*