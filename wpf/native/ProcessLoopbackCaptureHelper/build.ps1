param(
    [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"

$source = Join-Path $PSScriptRoot "ProcessLoopbackCaptureHelper.cpp"
$outDir = Join-Path $PSScriptRoot "out"
$exe = Join-Path $outDir "ProcessLoopbackCaptureHelper.exe"

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$vsRoots = @(
    "C:\Program Files\Microsoft Visual Studio\18\Community",
    "C:\Program Files\Microsoft Visual Studio\18\Professional",
    "C:\Program Files\Microsoft Visual Studio\18\Enterprise",
    "C:\Program Files\Microsoft Visual Studio\2022\Community",
    "C:\Program Files\Microsoft Visual Studio\2022\Professional",
    "C:\Program Files\Microsoft Visual Studio\2022\Enterprise"
)

$vcvars = $vsRoots |
    ForEach-Object { Join-Path $_ "VC\Auxiliary\Build\vcvars64.bat" } |
    Where-Object { Test-Path $_ } |
    Select-Object -First 1

if (-not $vcvars) {
    throw "Visual Studio C++ Build Tools were not found. Install MSVC x64 tools or build the helper manually."
}

$optimization = if ($Configuration -ieq "Debug") { "/Od /Zi" } else { "/O2" }
$obj = Join-Path $outDir "ProcessLoopbackCaptureHelper.obj"
$command = "`"$vcvars`" >nul && cl /nologo /EHsc /std:c++20 /W4 $optimization /DUNICODE /D_UNICODE /DWINVER=0x0A00 /D_WIN32_WINNT=0x0A00 /Fo:`"$obj`" /Fe:`"$exe`" `"$source`" mmdevapi.lib ole32.lib"

cmd.exe /c $command
if ($LASTEXITCODE -ne 0) {
    throw "ProcessLoopbackCaptureHelper build failed with exit code $LASTEXITCODE."
}

Write-Host "Built $exe"
