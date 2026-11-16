const fs = require('fs');
const path = require('path');

const releaseDir = path.join(__dirname, '..', 'release');
if (fs.existsSync(releaseDir)) {
  const files = fs.readdirSync(releaseDir);
  for (const file of files) {
    // Remove all old executables, blockmaps, and yml manifests so release folder stays minimal
    if (file.endsWith('.exe') || file.endsWith('.blockmap') || file.endsWith('.yml')) {
      try {
        fs.unlinkSync(path.join(releaseDir, file));
        console.log(`[Clean] Removed old release asset: ${file}`);
      } catch (e) {
        console.warn(`[Clean] Notice: Could not remove ${file}:`, e.message);
      }
    }
  }
}
