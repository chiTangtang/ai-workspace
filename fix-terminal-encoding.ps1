$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
$PSDefaultParameterValues['Set-Content:Encoding'] = 'utf8'
$PSDefaultParameterValues['Add-Content:Encoding'] = 'utf8'

$env:PYTHONIOENCODING = 'utf-8'
$env:PYTHONUTF8 = '1'
$env:NPM_CONFIG_UNICODE = 'true'
$env:LESSCHARSET = 'utf-8'

try {
    chcp 65001 > $null
} catch {
    # Ignore code page failures in restricted hosts.
}

Write-Host 'Terminal encoding set to UTF-8.' -ForegroundColor Green
