/**
 * TypeByAman — Remove Windows Auto-Start
 * Author: Aman Kumar | github.com/Amankr0075
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const startupDir = path.join(
  process.env.APPDATA || '',
  'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'
);

const shortcutPath = path.join(startupDir, 'TypeByAman-Native-Helper.lnk');

if (fs.existsSync(shortcutPath)) {
  try {
    fs.unlinkSync(shortcutPath);
    console.log('✓ Successfully removed TypeByAman shortcut from Windows Startup.');
  } catch (err) {
    console.error('Failed to remove shortcut:', err.message);
  }
} else {
  console.log('ℹ Startup shortcut not found. Already removed.');
}

// Kill running helper on port 9876 if any
try {
  const findPid = execSync('powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort 9876 -ErrorAction SilentlyContinue).OwningProcess"', { encoding: 'utf8' }).trim();
  if (findPid) {
    execSync(`taskkill /F /PID ${findPid}`, { stdio: 'ignore' });
    console.log(`✓ Stopped running Native Helper process (PID: ${findPid}).`);
  }
} catch (_) {}
