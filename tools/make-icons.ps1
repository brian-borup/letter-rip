# Makes the app icons from icon-source.webp, the Letter Rip! artwork: a
# rounded-square icon on a dark background. The square is cut out and saved at
# each size the app needs.
# Run from anywhere on Windows:  pwsh letter-rip/tools/make-icons.ps1
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName PresentationCore

$out = Join-Path $PSScriptRoot '..\icons'
$source = Join-Path $PSScriptRoot 'icon-source.webp'

# Where the rounded square sits in icon-source.webp, and its corner radius.
$CROP_X = 194; $CROP_Y = 65; $CROP_SIZE = 636; $CROP_RADIUS = 125

# System.Drawing can't read WebP, so decode it with Windows' own codecs first.
function LoadWebp($path) {
  $fs = [System.IO.File]::OpenRead($path)
  $frame = [System.Windows.Media.Imaging.BitmapDecoder]::Create($fs, 'PreservePixelFormat', 'OnLoad').Frames[0]
  $fs.Close()
  $enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
  $enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($frame))
  $ms = New-Object System.IO.MemoryStream
  $enc.Save($ms)
  return [System.Drawing.Bitmap]::FromStream($ms)
}

function RoundRect($x, $y, $w, $h, $r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc($x, $y, 2 * $r, 2 * $r, 180, 90)
  $p.AddArc($x + $w - 2 * $r, $y, 2 * $r, 2 * $r, 270, 90)
  $p.AddArc($x + $w - 2 * $r, $y + $h - 2 * $r, 2 * $r, 2 * $r, 0, 90)
  $p.AddArc($x, $y + $h - 2 * $r, 2 * $r, 2 * $r, 90, 90)
  $p.CloseFigure()
  return $p
}

$art = LoadWebp $source

# Draws the rounded square $scale times the icon size, centered on $background.
# Phones round icon corners themselves, so at full size the corners outside the
# artwork's own rounding are filled with a deep blue instead of the dark
# background. Maskable icons get a smaller square so circle crops keep the title.
function Icon($px, $name, $scale, $background) {
  $bmp = New-Object System.Drawing.Bitmap $px, $px
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.PixelOffsetMode = 'HighQuality'
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml($background))

  $size = [int][math]::Round($px * $scale)
  $offset = ($px - $size) / 2
  $k = $size / $CROP_SIZE

  # Paint the artwork through a rounded-square brush so the corners stay smooth.
  $square = New-Object System.Drawing.Bitmap $size, $size
  $sg = [System.Drawing.Graphics]::FromImage($square)
  $sg.InterpolationMode = 'HighQualityBicubic'
  $sg.PixelOffsetMode = 'HighQuality'
  $sg.DrawImage($art, (New-Object System.Drawing.RectangleF 0, 0, $size, $size), (New-Object System.Drawing.RectangleF $CROP_X, $CROP_Y, $CROP_SIZE, $CROP_SIZE), 'Pixel')
  $sg.Dispose()
  $brush = New-Object System.Drawing.TextureBrush $square
  $brush.TranslateTransform($offset, $offset)
  # Inset a pixel so none of the dark background along the edge comes along.
  $g.FillPath($brush, (RoundRect ($offset + $k) ($offset + $k) ($size - 2 * $k) ($size - 2 * $k) ($CROP_RADIUS * $k)))

  $bmp.Save((Join-Path $out $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $square.Dispose(); $g.Dispose(); $bmp.Dispose()
}

Icon 512 'icon-512.png' 1 '#0a1f78'
Icon 192 'icon-192.png' 1 '#0a1f78'
Icon 180 'apple-touch-icon.png' 1 '#0a1f78'
Icon 512 'icon-maskable-512.png' 0.72 '#0a0f1b'

$art.Dispose()
