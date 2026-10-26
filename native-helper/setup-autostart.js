/**
 * TypeByAman — Setup Windows Auto-Start
 * Author: Aman Kumar | github.com/Amankr0075
 *
 * Installs a silent launcher shortcut into the Windows Startup folder
 * so the Native Helper starts automatically on PC boot without opening any terminal.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const startupDir = path.join(
  process.env.APPDATA || '',
  'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'
);

if (!fs.existsSync(startupDir)) {
  console.error('[Error] Could not locate Windows Startup directory:', startupDir);
  process.exit(1);
}

const vbsPath = path.resolve(__dirname, 'start-silent.vbs');
const shortcutPath = path.join(startupDir, 'TypeByAman-Native-Helper.lnk');

if (!fs.existsSync(vbsPath)) {
  console.error('[Error] start-silent.vbs not found at:', vbsPath);
  process.exit(1);
}

// Create shortcut using WScript.Shell via PowerShell
const psCommand = `powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('${shortcutPath.replace(/'/g, "''")}'); $s.TargetPath = '${vbsPath.replace(/'/g, "''")}'; $s.WorkingDirectory = '${__dirname.replace(/'/g, "''")}'; $s.Description = 'TypeByAman Native Hardware Bridge'; $s.Save()"`;

try {
  execSync(psCommand, { stdio: 'inherit' });
  console.log('================================================================');
  console.log('✓ Auto-Start Installed Successfully!');
  console.log('  Location: ' + shortcutPath);
  console.log('  Target:   ' + vbsPath);
  console.log('================================================================');
  console.log('\nLaunching Native Helper silently in background now...');

  // Start it immediately
  execSync(`wscript "${vbsPath}"`, { stdio: 'ignore' });

  console.log('✓ Native Helper is now running silently in the background on port 9876.');
  console.log('✓ It will automatically launch on every PC reboot. Zero PowerShell needed.\n');
} catch (err) {
  console.error('[Error] Failed to install startup shortcut:', err.message);
  process.exit(1);
}
