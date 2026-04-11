#!/bin/bash
# Search for image-related Supabase storage code
cd /home/appuser/project
grep -rn "storage\|bucket\|avatar_url\|image_url" --include="*.tsx" --include="*.ts" | grep -v node_modules | head -40