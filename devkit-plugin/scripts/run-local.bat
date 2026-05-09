@echo off
REM DevKit 한 번 실행 (Windows)
REM 더블클릭하거나 명령 프롬프트에서 실행하세요.
REM 사전 준비물: Node.js (LTS) + Git
REM   - https://nodejs.org
REM   - https://git-scm.com/downloads

setlocal
set BRANCH=claude/explore-power-platform-methods-3gfYL
set REPO_URL=https://github.com/Jl-seo/power-platform.git
set WORKDIR=%USERPROFILE%\devkit-preview
if "%PORT%"=="" set PORT=5173

echo.
echo ▸ 필요한 프로그램이 깔려 있는지 확인
where git >nul 2>nul || (echo ❌ git 이 없어요. https://git-scm.com/downloads 에서 설치 후 다시 실행. & exit /b 1)
where node >nul 2>nul || (echo ❌ Node.js 가 없어요. https://nodejs.org 에서 LTS 설치 후 다시 실행. & exit /b 1)
where npm >nul 2>nul || (echo ❌ npm 이 없어요. & exit /b 1)

if exist "%WORKDIR%\.git" (
  echo.
  echo ▸ 최신으로 갱신 (%WORKDIR%)
  git -C "%WORKDIR%" fetch origin %BRANCH%
  git -C "%WORKDIR%" checkout %BRANCH%
  git -C "%WORKDIR%" reset --hard origin/%BRANCH%
) else (
  echo.
  echo ▸ PR 브랜치 다운로드 (%WORKDIR%)
  git clone --branch %BRANCH% --depth 1 %REPO_URL% "%WORKDIR%"
)

cd /d "%WORKDIR%\devkit-plugin"

echo.
echo ▸ 필요한 부속 설치 (1~2분)
call npm install --no-fund --no-audit || (echo ❌ 설치 실패 & exit /b 1)

echo.
echo ▸ 자체 점검
call npm run smoke

echo.
echo ▸ 웹 서버 시작 — http://localhost:%PORT%
echo   끄려면 Ctrl+C
start "" "http://localhost:%PORT%"
call npm run web
