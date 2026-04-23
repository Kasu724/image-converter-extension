$ErrorActionPreference = "Stop"

$root = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$dist = [System.IO.Path]::GetFullPath((Join-Path $root "dist"))
$packageDirectory = Join-Path $dist "image-converter-extension"
$zipPath = Join-Path $dist "image-converter-extension.zip"

if (-not $dist.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to package outside the project directory."
}

if (Test-Path -LiteralPath $dist) {
    Remove-Item -LiteralPath $dist -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $packageDirectory | Out-Null

$pathsToCopy = @(
    "manifest.json",
    "LICENSE",
    "README.md",
    "background",
    "icons",
    "offscreen",
    "options",
    "shared",
    "ui"
)

foreach ($relativePath in $pathsToCopy) {
    $source = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $source)) {
        throw "Missing package input: $relativePath"
    }

    $destination = Join-Path $packageDirectory $relativePath
    Copy-Item -LiteralPath $source -Destination $destination -Recurse -Force
}

Compress-Archive -Path (Join-Path $packageDirectory "*") -DestinationPath $zipPath -Force
Write-Host "Created $zipPath"
