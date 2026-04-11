#!/bin/bash
# Search for functions related to taking photos or uploading images
cd /home/appuser/project
grep -r "takePhoto\|takePicture\|uploadImage\|uploadSelfie\|camera\|imagePicker" --include="*.tsx" --include="*.ts" | head -30