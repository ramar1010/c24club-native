#!/bin/bash
cd /home/appuser/project
git --git-dir=.catdoes/git --work-tree=. reset --hard c96af89
git --git-dir=.catdoes/git --work-tree=. push --force origin main