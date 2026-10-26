param([string]$Action = "start")

function Show-Toast($Title, $Message) {
    try {
        Add-Type -AssemblyName System.Windows.Forms
        $notify = New-Object System.Windows.Forms.NotifyIcon
        $notify.Icon = [System.Drawing.SystemIcons]::Information
        $notify.BalloonTipTitle = $Title
        $notify.BalloonTipText = $Message
        $notify.Visible = $true
        $notify.ShowBalloonTip(2000)
        Start-Sleep -Milliseconds 1500
        $notify.Dispose()
    } catch {}
}

if ($Action -eq "start") {
    $existing = Get-NetTCPConnection -LocalPort 9876 -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }
    if ($existing) {
        Show-Toast "TypeByAman" "🟢 Native Helper is ALREADY active (Port 9876)"
        exit 0
    }

    $helperDir = (Resolve-Path "$PSScriptRoot\..").Path
    Start-Process "node.exe" -ArgumentList "cursor-helper.js" -WorkingDirectory $helperDir -WindowStyle Hidden

    # Wait up to 3.5 seconds to confirm it is listening
    $started = $false
    for ($i = 0; $i -lt 18; $i++) {
        Start-Sleep -Milliseconds 200
        if (Get-NetTCPConnection -LocalPort 9876 -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }) {
            $started = $true
            break
        }
    }

    if ($started) {
        Show-Toast "TypeByAman" "🟢 Native Helper STARTED (Port 9876)`nScreen & input sync active"
    } else {
        Show-Toast "TypeByAman" "⚠️ Helper started. Ready on port 9876."
    }
} elseif ($Action -eq "stop") {
    $conns = Get-NetTCPConnection -LocalPort 9876 -ErrorAction SilentlyContinue
    if ($conns) {
        $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 0 }
        foreach ($p in $pids) {
            Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        }
        Show-Toast "TypeByAman" "🔴 Native Helper STOPPED"
    } else {
        Show-Toast "TypeByAman" "ℹ️ Native Helper is already stopped."
    }
}
