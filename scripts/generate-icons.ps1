$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$iconsDirectory = Join-Path $root "icons"
New-Item -ItemType Directory -Force -Path $iconsDirectory | Out-Null

Add-Type -AssemblyName System.Drawing

$sizes = @(16, 32, 48, 128)

foreach ($size in $sizes) {
    $bitmap = New-Object System.Drawing.Bitmap $size, $size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $background = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.RectangleF]::new(0, 0, $size, $size),
        [System.Drawing.Color]::FromArgb(255, 13, 107, 87),
        [System.Drawing.Color]::FromArgb(255, 8, 70, 56),
        45
    )
    $graphics.FillEllipse($background, 1, 1, $size - 2, $size - 2)

    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(235, 255, 250, 241)), ([Math]::Max(1.4, $size / 18))
    $graphics.DrawEllipse($pen, 2.5, 2.5, $size - 5, $size - 5)

    $whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 255, 250, 241))
    $accentBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 244, 184, 75))

    $graphics.FillRectangle($whiteBrush, $size * 0.28, $size * 0.28, $size * 0.36, $size * 0.44)
    $graphics.FillPolygon($accentBrush, @(
        [System.Drawing.PointF]::new($size * 0.47, $size * 0.22),
        [System.Drawing.PointF]::new($size * 0.78, $size * 0.50),
        [System.Drawing.PointF]::new($size * 0.47, $size * 0.78)
    ))

    $path = Join-Path $iconsDirectory "icon$size.png"
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)

    $accentBrush.Dispose()
    $whiteBrush.Dispose()
    $pen.Dispose()
    $background.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}

Write-Host "Generated extension icons in $iconsDirectory"
