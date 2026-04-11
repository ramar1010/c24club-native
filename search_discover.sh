#!/bin/bash
# Find files related to discover, selfie, camera, image upload
find . -type f \( -name "*.tsx" -o -name "*.ts" \) | while read f; do
  # Check if file name contains discover, selfie, camera, or upload
  if [[ "$f" == *"discover"* ]] || [[ "$f" == *"selfie"* ]] || [[ "$f" == *"camera"* ]]; then
    echo "Found: $f"
  fi
done