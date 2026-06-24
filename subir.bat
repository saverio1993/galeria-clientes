@echo off
REM ==========================================================
REM  Galeria de fotos - subir fotos nuevas con un doble click
REM  Convierte ARW/JPG de images-origen\ y sube a GitHub.
REM ==========================================================

setlocal EnableDelayedExpansion
chcp 65001 >nul

cd /d "%~dp0"

echo.
echo ============================================
echo   Galeria de Saverio - subir fotos
echo ============================================
echo.

REM 1. Comprobar que hay fotos
set "count=0"
for %%f in (images-origen\*) do set /a count+=1
if %count%==0 (
    echo [AVISO] No hay fotos en images-origen\
    echo         Arrastra tus archivos .ARW o .JPG a esa carpeta y vuelve a ejecutar.
    echo.
    pause
    exit /b 0
)

echo [INFO] %count% archivo(s) encontrado(s) en images-origen\
echo.

REM 2. Convertir
echo [1/3] Convirtiendo fotos...
py -3 scripts\convertir.py
if errorlevel 1 (
    echo.
    echo [ERROR] Fallo la conversion. Revisa que rawpy y Pillow esten instalados.
    echo         pip install rawpy Pillow
    pause
    exit /b 1
)
echo.

REM 3. Git add
echo [2/3] Preparando commit...
git add images\
if errorlevel 1 (
    echo [ERROR] git add fallo.
    pause
    exit /b 1
)

REM 4. Git commit
set "stamp=%date:~6,4%-%date:~3,2%-%date:~0,2% %time:~0,2%:%time:~3,2%"
git commit -m "subir fotos %stamp%"
if errorlevel 1 (
    echo.
    echo [AVISO] Nada que commitear (las JPGs no cambiaron).
    echo.
) else (
    echo.
    echo [3/3] Subiendo a GitHub...
    git push
    if errorlevel 1 (
        echo.
        echo [ERROR] git push fallo. Revisa tu conexion o token.
        pause
        exit /b 1
    )
    echo.
    echo ============================================
    echo   Listo! Tu galeria se actualizara en ~30s
    echo   Link: https://saverio1993.github.io/galeria-clientes/
    echo ============================================
)

echo.
pause
