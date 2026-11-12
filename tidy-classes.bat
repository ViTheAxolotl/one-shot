@echo off
rem Double-click to tidy class names. Keep this next to tidy-classes.ps1 in the repo root.
cd /d "%~dp0"
title Tidy class names

echo Checking what would change...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tidy-classes.ps1" -Dry
echo.

choice /C YN /M "Apply these changes"
if errorlevel 2 (
    echo.
    echo Nothing was changed.
    goto done
)

echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tidy-classes.ps1"

:done
echo.
pause
