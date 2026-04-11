#!/bin/bash

# This script searches for selfie/camera/image related code in the C24 Club project

echo "=========================================="
echo "Searching for Supabase Storage Usage..."
echo "=========================================="
grep -rn "supabase\.storage" . --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null || echo "No supabase.storage calls found"

echo ""
echo "=========================================="
echo "Searching for image_status updates..."
echo "=========================================="
grep -rn "image_status" . --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null || echo "No image_status columns found"

echo ""
echo "=========================================="
echo "Searching for Camera/Image Picker code..."
echo "=========================================="
grep -rn "expo-camera\|ImagePicker\|Camera\|camera" . --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null | head -40 || echo "No camera/image picker imports found"

echo ""
echo "=========================================="
echo "Searching for 'retake' or 'selfie' keywords..."
echo "=========================================="
grep -rin "retake\|selfie" . --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null | head -30 || echo "No 'retake' or 'selfie' keywords found"

echo ""
echo "=========================================="
echo "Searching for avatar/profile image upload..."
echo "=========================================="
grep -rin "avatar\|upload\|profile.*image" . --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null | head -30 || echo "No avatar/image upload code found"

echo ""
echo "Listing all .ts/.tsx files..."
echo "=========================================="
find . -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | head -50

echo ""
echo "=========================================="
echo "Checking app directory structure..."
echo "=========================================="
ls -la app/ 2>/dev/null || echo "No app directory found"
ls -la app/\(tabs\)/ 2>/dev/null || echo "No tabs directory found"