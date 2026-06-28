#!/bin/bash
# Search for all camera-related code
cd /home/appuser/project
grep -rn "Camera\|ImagePicker\|expo-camera" --include="*.tsx" --include="*.ts" | grep -v node_modules