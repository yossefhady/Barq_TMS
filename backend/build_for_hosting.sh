#!/bin/bash
set -e

# Navigate to the script directory
cd "$(dirname "$0")"

echo "Building BarqTMS API for Hosting..."

# 1. Sync Frontend
echo "------------------------------------------------"
echo "Syncing frontend from ../barq-dashboard..."
mkdir -p wwwroot
rsync -av --delete --exclude '.*' ../barq-dashboard/ wwwroot/

# 2. Define Output Directory
OUTPUT_DIR="../publish/hosting_package"
rm -rf "$OUTPUT_DIR"

# 3. Publish (Portable / Framework Dependent)
echo "------------------------------------------------"
echo "Publishing..."
# Using --self-contained false creates a "Portable" build.
dotnet publish BarqTMS.API.csproj -c Release --self-contained false -o "$OUTPUT_DIR"

echo "------------------------------------------------"
echo "Build complete."
echo "Location: barq_deploy/publish/hosting_package"
