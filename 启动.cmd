@echo off
where node.exe >nul 2>nul
if errorlevel 1 (
  powershell.exe -NoProfile -Command "Write-Host ([char]0x8BF7+[string][char]0x5148+[char]0x5B89+[char]0x88C5+' Node.js LTS'); Read-Host 'Enter'"
  exit /b
)
set "PHI_CHAPTER_ENTRY=%~dp0server.cjs"
powershell.exe -NoProfile -Command "Start-Process -FilePath 'node.exe' -ArgumentList ([char]34 + $env:PHI_CHAPTER_ENTRY + [char]34) -WindowStyle Hidden"
exit /b
