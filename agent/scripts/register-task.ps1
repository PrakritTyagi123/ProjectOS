# Starts the agent at Windows logon, in your user session (needed for GUI apps like the Unity Editor).
# A Windows service would run in session 0 and could not open windows.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$py   = Join-Path $root '.venv\Scripts\pythonw.exe'   # no console window
$cfg  = Join-Path $root 'agent.yaml'

$action   = New-ScheduledTaskAction -Execute $py -Argument "-m projectos_agent --config `"$cfg`"" -WorkingDirectory $root
$trigger  = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
              -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
              -StartWhenAvailable -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName 'ProjectOS Agent' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'ProjectOS Agent'
Write-Host 'Registered and started "ProjectOS Agent". Check: curl http://127.0.0.1:8765/api/agent (with dev_allow_local) or the dashboard.'
Write-Host 'Remove later with: Unregister-ScheduledTask -TaskName "ProjectOS Agent"'
