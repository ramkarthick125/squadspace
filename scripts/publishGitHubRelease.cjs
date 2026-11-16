const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

function getGitHubToken() {
  try {
    const cred = execSync('git credential fill', {
      input: 'protocol=https\nhost=github.com\n\n',
      encoding: 'utf8',
    });
    const match = cred.match(/password=([^\r\n]+)/);
    if (match) return match[1].trim();
  } catch (e) {
    console.warn('Could not read git credential helper:', e.message);
  }
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
}

const token = getGitHubToken();
if (!token) {
  console.error('No GitHub token found!');
  process.exit(1);
}

const OWNER = 'ramkarthick125';
const REPO = 'squadspace';
const TAG = 'v1.0.8';
const RELEASE_NAME = 'SquadSpace 1.0.8 — VSync Lag Fix & In-App Version Information';
const BODY = `## SquadSpace 1.0.8 — VSync Lag Fix & In-App Version Information

### 🚀 Complete Performance & Anti-Lag Optimization
- **Restored Standard VSync Compositor**: Removed dangerous \`disable-gpu-vsync\` and \`disable-frame-rate-limit\` Chromium command-line switches that were causing 100% GPU spin and severe micro-stuttering. The app now syncs cleanly with your monitor refresh rate (60/120/144Hz) with near-zero CPU and GPU load.
- **Audio Meter Re-Render Thrashing Fixed**: Throttled WebRTC microphone level checks from 144Hz down to 15Hz and eliminated redundant React component re-renders that were causing the entire voice stage and sidebar to re-render dozens of times per second.
- **Lounge TV Canvas Throttling**: Reduced TV texture upload resolution from 1080p to 540p with minute-level change detection, eliminating GPU texture upload stalls.
- **Native Hotkey Relaxed Polling**: Optimized background gaming key and mouse polling from 15ms to 35ms, drastically cutting idle CPU wakeups.

### ℹ️ In-App Version Display & Settings Info
- **Settings Page "App Info & Updates"**: Added a dedicated section in Settings showing the exact installed version (\`v1.0.8\`), distribution mode (Portable in-place silent / Desktop setup), platform architecture (Windows x64), and a one-click **"Check for Updates"** button.
- **Title Bar Version Badge**: Subtle \`v1.0.8\` chip displayed directly next to the SquadSpace logo in the desktop title bar upon opening the app.
- **Settings Sidebar Footer**: Shows current build version and native client status at the bottom of the Settings sidebar.

### ⚡ Seamless Discord-Style Portable Auto-Updates
- **In-Place Portable Self-Update**: Portable \`SquadSpace.exe\` updates silently in-place without opening any Windows installer dialogs or wizard windows.
- **Installer Option**: \`SquadSpace Setup 1.0.8.exe\` provides a custom installation directory chooser for users who prefer installed setups.
`;

function apiRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`);
    const req = https.request(url, {
      method,
      headers: {
        'User-Agent': 'SquadSpace-Updater',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function uploadAsset(uploadUrlTemplate, filePath, contentType) {
  return new Promise((resolve, reject) => {
    const fileName = path.basename(filePath);
    const uploadUrl = uploadUrlTemplate.replace('{?name,label}', `?name=${encodeURIComponent(fileName)}`);
    const fileStats = fs.statSync(filePath);
    const fileStream = fs.createReadStream(filePath);

    console.log(`[Upload] Uploading ${fileName} (${(fileStats.size / 1024 / 1024).toFixed(2)} MB)...`);

    const url = new URL(uploadUrl);
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'SquadSpace-Updater',
        'Authorization': `Bearer ${token}`,
        'Content-Type': contentType || 'application/octet-stream',
        'Content-Length': fileStats.size,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[Upload] ✓ Successfully uploaded ${fileName}`);
          resolve(JSON.parse(data));
        } else {
          console.error(`[Upload] ✗ Failed to upload ${fileName}: Status ${res.statusCode} - ${data}`);
          reject(new Error(`Upload failed with status ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    fileStream.pipe(req);
  });
}

async function main() {
  console.log(`Checking for existing release for tag ${TAG}...`);
  let release = null;
  const existingRes = await apiRequest('GET', `/repos/${OWNER}/${REPO}/releases/tags/${TAG}`);
  if (existingRes.status === 200) {
    release = existingRes.data;
    console.log(`Found existing release (ID: ${release.id})`);
  } else {
    console.log(`Creating release for ${TAG}...`);
    const createRes = await apiRequest('POST', `/repos/${OWNER}/${REPO}/releases`, {
      tag_name: TAG,
      target_commitish: 'main',
      name: RELEASE_NAME,
      body: BODY,
      draft: false,
      prerelease: false,
    });
    if (createRes.status !== 201) {
      console.error('Failed to create release:', createRes);
      process.exit(1);
    }
    release = createRes.data;
    console.log(`Release created successfully! (ID: ${release.id})`);
  }

  const uploadUrl = release.upload_url;
  const existingAssets = release.assets || [];
  const VERSION = TAG.replace(/^v/, '');

  const filesToUpload = [
    {
      path: path.join(__dirname, '..', 'release', `SquadSpace Setup ${VERSION}.exe`),
      type: 'application/octet-stream',
    },
    {
      path: path.join(__dirname, '..', 'release', `SquadSpace Setup ${VERSION}.exe.blockmap`),
      type: 'application/octet-stream',
    },
    {
      path: path.join(__dirname, '..', 'release', 'SquadSpace.exe'),
      type: 'application/octet-stream',
    },
    {
      path: path.join(__dirname, '..', 'release', 'latest.yml'),
      type: 'text/yaml',
    },
  ];

  for (const item of filesToUpload) {
    if (!fs.existsSync(item.path)) {
      console.warn(`File not found: ${item.path}, skipping.`);
      continue;
    }
    const name = path.basename(item.path);
    const existing = existingAssets.find(a => a.name === name);
    if (existing) {
      console.log(`Deleting previous asset ${name} (ID: ${existing.id}) before re-upload...`);
      await apiRequest('DELETE', `/repos/${OWNER}/${REPO}/releases/assets/${existing.id}`);
    }

    await uploadAsset(uploadUrl, item.path, item.type);
  }

  console.log('\n🎉 ALL ASSETS PUBLISHED TO GITHUB RELEASE!');
  console.log(`Release URL: ${release.html_url}`);
}

main().catch(err => {
  console.error('Error in publish script:', err);
  process.exit(1);
});
