param(
  [int]$MaxWidth = 1280,
  [int]$JpegQuality = 65
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$screenW = $screen.Width
$screenH = $screen.Height
$bmp = New-Object System.Drawing.Bitmap $screenW, $screenH
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)

$imgW = $screenW
$imgH = $screenH
if ($bmp.Width -gt $MaxWidth) {
  $ratio = $MaxWidth / [double]$bmp.Width
  $imgW = $MaxWidth
  $imgH = [int]($bmp.Height * $ratio)
  $scaled = New-Object System.Drawing.Bitmap $imgW, $imgH
  $gs = [System.Drawing.Graphics]::FromImage($scaled)
  $gs.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $gs.DrawImage($bmp, 0, 0, $imgW, $imgH)
  $gs.Dispose()
  $bmp.Dispose()
  $bmp = $scaled
}

$ms = New-Object System.IO.MemoryStream
$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
$p = New-Object System.Drawing.Imaging.EncoderParameters 1
$p.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), $JpegQuality
$bmp.Save($ms, $enc, $p)
$g.Dispose()
$bmp.Dispose()
$b64 = [Convert]::ToBase64String($ms.ToArray())
$ms.Dispose()

Write-Output "$screenW|$screenH|$imgW|$imgH|$b64"
