@echo off
setlocal
set "RUNTIME=%~dp0tools\node-v22.14.0-win-x64"
set "PATH=%RUNTIME%;%PATH%"
call "%RUNTIME%\npm.cmd" run dev
