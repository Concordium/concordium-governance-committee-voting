@echo off
setlocal enabledelayedexpansion

REM Check if signing is enabled
if not "%WINDOWS_SIGN%"=="1" (
    echo Skipping signing.
    exit /b 0
)

REM Ensure that SM_CODE_SIGNING_CERT_SHA1_HASH and WINDOWS_PKCS11_CONFIG are set in the environment
if "%SM_CODE_SIGNING_CERT_SHA1_HASH%"=="" (
    echo Error: SM_CODE_SIGNING_CERT_SHA1_HASH environment variable must be set.
    exit /b 1
)

if "%WINDOWS_PKCS11_CONFIG%"=="" (
    echo Error: WINDOWS_PKCS11_CONFIG environment variable must be set.
    exit /b 1
)

if "%~1"=="" (
    echo Error: No input path provided.
    exit /b 1
)

REM Assign environment variables to script variables
set FINGERPRINT=%SM_CODE_SIGNING_CERT_SHA1_HASH%
set CONFIG=%WINDOWS_PKCS11_CONFIG%
set INPUT=%~1

echo Signing environment:
echo - Input file: %INPUT%
echo - File exists:
if exist "%INPUT%" (echo YES) else (echo NO)
echo - Using config file: %CONFIG%
echo - Config file exists:
if exist "%CONFIG%" (echo YES) else (echo NO)

smctl sign --fingerprint %FINGERPRINT% --input "%INPUT%" --config-file "%CONFIG%" --verbose --exit-non-zero-on-fail --failfast

if %ERRORLEVEL% neq 0 (
    echo Signing failed with error code %ERRORLEVEL%.
    exit /b %ERRORLEVEL%
)

echo Signing completed successfully.
exit /b 0

