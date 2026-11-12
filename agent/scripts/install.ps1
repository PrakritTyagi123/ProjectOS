# ProjectOS agent: one-time setup. Run in PowerShell from the agent folder:
#   powershell -ExecutionPolicy Bypass -File scripts\install.ps1
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

$py = (Get-Command py -ErrorAction SilentlyContinue)
if (-not $py) { throw 'Python launcher (py) not found. Install Python 3.11+ from python.org first.' }

if (-not (Test-Path .venv)) { py -3 -m venv .venv }
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

foreach ($pair in @(@('agent.example.yaml','agent.yaml'), @('registry.example.yaml','registry.yaml'), @('secrets.env.example','secrets.env'))) {
  if (-not (Test-Path $pair[1])) { Copy-Item $pair[0] $pair[1]; Write-Host "Created $($pair[1]). Edit it." }
}
New-Item -ItemType Directory -Force logs | Out-Null

# secrets.env readable by you only
icacls secrets.env /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null

Write-Host ''
Write-Host 'Next:'
Write-Host '  1. Edit registry.yaml (real paths, ports, health URLs).'
Write-Host '  2. Test locally:  set dev_allow_local: true in agent.yaml, then'
Write-Host '       .\.venv\Scripts\python.exe -m projectos_agent --config agent.yaml'
Write-Host '       curl http://127.0.0.1:8765/api/projects'
Write-Host '  3. Set dev_allow_local back to false and fill in Access settings.'
Write-Host '  4. scripts\register-task.ps1 to start the agent at logon.'
