const { execSync } = require('child_process');
const path = require('path');

const gitDir = path.join(__dirname, '.catdoes/git');
const workTree = __dirname;

// Reset hard to the target commit
execSync(`git --git-dir=${gitDir} --work-tree=${workTree} reset --hard c96af89`, { stdio: 'inherit' });

// Force push to origin
execSync(`git --git-dir=${gitDir} --work-tree=${workTree} push --force origin main`, { stdio: 'inherit' });

console.log('Reset complete!');