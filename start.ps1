Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $projectDir 'backend'
$frontendDir = Join-Path $projectDir 'frontend'
$encodingScript = Join-Path $projectDir 'fix-terminal-encoding.ps1'

if (Test-Path $encodingScript) {
    . $encodingScript
}

function Get-PythonLauncher {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        return @{
            FilePath = 'py'
            ArgsPrefix = @()
            Display = 'py'
        }
    }

    if (Get-Command python -ErrorAction SilentlyContinue) {
        return @{
            FilePath = 'python'
            ArgsPrefix = @()
            Display = 'python'
        }
    }

    throw 'Python launcher not found. Please install Python 3.10+ first.'
}

function Get-PowerShellExecutable {
    if (Get-Command pwsh -ErrorAction SilentlyContinue) {
        return 'pwsh'
    }

    if (Get-Command powershell -ErrorAction SilentlyContinue) {
        return 'powershell'
    }

    throw 'PowerShell executable not found.'
}

function Start-DevWindow {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Title,

        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory,

        [Parameter(Mandatory = $true)]
        [string]$Command
    )

    $psExe = Get-PowerShellExecutable
    $commandBody = @"
Set-Location '$WorkingDirectory'
if (Test-Path '$encodingScript') {
    . '$encodingScript'
}
`$host.UI.RawUI.WindowTitle = '$Title'
$Command
"@

    Start-Process -FilePath $psExe -ArgumentList @(
        '-NoExit',
        '-ExecutionPolicy', 'Bypass',
        '-Command', $commandBody
    ) -WorkingDirectory $WorkingDirectory | Out-Null
}

function Test-NodeModulesInstalled {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Directory
    )

    Test-Path (Join-Path $Directory 'node_modules')
}

Write-Host '==========================================' -ForegroundColor Cyan
Write-Host '  AI Workspace One-Click Startup' -ForegroundColor Cyan
Write-Host '==========================================' -ForegroundColor Cyan
Write-Host ''

$python = Get-PythonLauncher

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js not found. Please install Node.js 18+ first.'
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw 'npm not found. Please install Node.js/npm first.'
}

Write-Host "Python launcher: $($python.Display)" -ForegroundColor DarkGray
Write-Host 'Checking backend dependencies...' -ForegroundColor Yellow
Push-Location $backendDir
try {
    & $python.FilePath @($python.ArgsPrefix + @('-m', 'pip', 'install', '-r', 'requirements.txt'))
} finally {
    Pop-Location
}

if (-not (Test-NodeModulesInstalled -Directory $frontendDir)) {
    Write-Host 'Installing frontend dependencies...' -ForegroundColor Yellow
    Push-Location $frontendDir
    try {
        & npm install
    } finally {
        Pop-Location
    }
} else {
    Write-Host 'Frontend dependencies already installed.' -ForegroundColor DarkGray
}

$backendCommand = if ($python.FilePath -eq 'py') {
    "py -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
} else {
    "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
}

$frontendCommand = "npm run dev"

Start-DevWindow -Title 'AI Workspace Backend' -WorkingDirectory $backendDir -Command $backendCommand
Start-DevWindow -Title 'AI Workspace Frontend' -WorkingDirectory $frontendDir -Command $frontendCommand

Write-Host ''
Write-Host 'Started backend and frontend in two new terminal windows.' -ForegroundColor Green
Write-Host 'Frontend: http://localhost:3000' -ForegroundColor Green
Write-Host 'Backend : http://localhost:8000' -ForegroundColor Green
Write-Host 'Docs    : http://localhost:8000/docs' -ForegroundColor Green
