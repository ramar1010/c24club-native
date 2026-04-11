#!/bin/bash
# Search for onPress or similar handlers for the retake button
cd /home/appuser/project
grep -n "retakeButton" app/\(tabs\)/discover.tsx