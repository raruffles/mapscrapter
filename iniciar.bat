@echo off
title KAPTAR Leads Scraper
cd /d "%~dp0"
echo ========================================================
echo   Iniciando KAPTAR Leads Scraper & CRM Localmente...
echo   Pasta: D:\sites-vibe-code\data-scrapter-google
echo   Acesse: http://localhost:3333
echo ========================================================
start "" "http://localhost:3333"
node server.js
pause
