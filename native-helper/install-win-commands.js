/**
 * TypeByAman — Register Win+R Commands (start & stop)
 * Author: Aman Kumar | github.com/Amankr0075
 *
 * Allows starting and stopping the Native Helper directly from Win+R:
 *   Win + R -> "start"
 *   Win + R -> "stop"
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const binDir = path.resolve(__dirname, 'bin');
const startBat = path.join(binDir, 'start.bat');
const stopBat = path.join(binDir, 'stop.bat');

const windowsApps = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps');

// 1. Copy command batch files to WindowsApps (which is permanently in PATH)
if (fs.existsSync(windowsApps)) {
  const commands = [
    { name: 'start.bat', src: startBat },
    { name: 'stop.bat', src: stopBat },
    { name: 'tba.bat', src: startBat },
    { name: 'tba-start.bat', src: startBat },
    { name: 'tba-stop.bat', src: stopBat },
  ];

  for (const cmd of commands) {
    const dest = path.join(windowsApps, cmd.name);
    fs.copyFileSync(cmd.src, dest);
  }
  console.log('✓ Installed command files to WindowsApps directory:');
  console.log('  - ' + path.join(windowsApps, 'start.bat'));
  console.log('  - ' + path.join(windowsApps, 'stop.bat'));
}

// 2. Register in Windows Registry under App Paths for instant Win+R recognition
const regKeys = [
  { name: 'start.exe', target: startBat },
  { name: 'stop.exe', target: stopBat },
  { name: 'tba.exe', target: startBat },
  { name: 'tba-start.exe', target: startBat },
  { name: 'tba-stop.exe', target: stopBat },
];

for (const r of regKeys) {
  try {
    const regCmd = `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${r.name}" /ve /t REG_SZ /d "${r.target}" /f`;
    execSync(regCmd, { stdio: 'ignore' });
  } catch (_) {}
}

console.log('✓ Registered Win+R App Paths:');
console.log('  - Win+R -> start');
console.log('  - Win+R -> stop');
console.log('\n================================================================');
console.log('All set! You can now press Win+R anytime and type:');
console.log('  start -> Launches the Native Helper with a green toast notification');
console.log('  stop  -> Stops the Native Helper with a red toast notification');
console.log('================================================================\n');
