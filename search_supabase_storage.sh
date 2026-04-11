#!/bin/bash

# Search for supabase.storage.from() usage
echo "=== Searching for supabase.storage.from(...) usage ==="
grep -rn "supabase\.storage\.from" . --include="*.ts" --include="*.tsx" 2>/dev/null || echo "No matches found"

echo ""
echo "=== Searching for update({ image_status: 'pending' }) usage ==="
grep -rn "image_status.*pending\|image_status:.*pending" . --include="*.ts" --include="*.tsx" 2>/dev/null || echo "No matches found"

echo ""
echo "=== Searching for camera/image picker related code ==="
grep -rn "expo-camera\|ImagePicker\|image picker" . --include="*.ts" --include="*.tsx" -n 2>/dev/null | head -30 || echo "No matches found"

echo ""
echo "=== Searching for 'retake' or 'selfie' related code ==="
grep -rin "retake\|selfie" . --include="*.ts" --include="*.tsx" -n 2>/dev/null | head -30 || echo "No matches found"

echo ""
echo "=== Searching for thumbnail generation logic ==="
grep -rin "thumbnail\|resizeImage\|crop\|imageProcessing" . --include="*.ts" --include="*.tsx" -n 2>/dev/null | head -20 || echo "No matches found"