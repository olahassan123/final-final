Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root "MeDay_Smart_Platform_A1_Poster.pptx"
$work = Join-Path $root ".poster-pptx-build"

if (Test-Path $work) {
    Remove-Item -LiteralPath $work -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $work | Out-Null

function New-Dir($path) {
    New-Item -ItemType Directory -Force -Path (Join-Path $work $path) | Out-Null
}

function Write-Utf8($relativePath, $content) {
    $path = Join-Path $work $relativePath
    $dir = Split-Path -Parent $path
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    [System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
}

function E($text) {
    return [System.Security.SecurityElement]::Escape([string]$text)
}

function Emu($cm) {
    return [int64][Math]::Round([double]$cm * 360000)
}

$script:shapeId = 1
function Next-Id {
    $script:shapeId += 1
    return $script:shapeId
}

function RPr($size, $color, $bold = $false) {
    $b = if ($bold) { ' b="1"' } else { '' }
    return "<a:rPr lang=""en-US"" sz=""$([int]($size * 100))""$b><a:solidFill><a:srgbClr val=""$color""/></a:solidFill><a:latin typeface=""Aptos""/><a:cs typeface=""Aptos""/></a:rPr>"
}

function TextRun($text, $size, $color, $bold = $false) {
    return "<a:r>$(RPr $size $color $bold)<a:t>$(E $text)</a:t></a:r>"
}

function Para($text, $size, $color, $bold = $false, $align = "l") {
    return "<a:p><a:pPr algn=""$align""/>$(TextRun $text $size $color $bold)<a:endParaRPr lang=""en-US"" sz=""$([int]($size * 100))""/></a:p>"
}

function Lines($lines, $size, $color, $boldFirst = $false, $align = "l") {
    $xml = ""
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $xml += Para $lines[$i] $size $color ($boldFirst -and $i -eq 0) $align
    }
    return $xml
}

function Shape($name, $x, $y, $w, $h, $fill, $line, $radius, $bodyXml, $lineWidth = 1.2, $anchor = "t") {
    $id = Next-Id
    $geom = if ($radius) { "roundRect" } else { "rect" }
    if ([string]::IsNullOrWhiteSpace($bodyXml)) {
        $bodyXml = "<a:p/>"
    }
    $ln = if ($line -eq "none") {
        "<a:ln><a:noFill/></a:ln>"
    } else {
        "<a:ln w=""$([int]($lineWidth * 12700))""><a:solidFill><a:srgbClr val=""$line""/></a:solidFill></a:ln>"
    }
    $fillXml = if ($fill -eq "none") {
        "<a:noFill/>"
    } else {
        "<a:solidFill><a:srgbClr val=""$fill""/></a:solidFill>"
    }
    return @"
<p:sp>
  <p:nvSpPr><p:cNvPr id="$id" name="$(E $name)"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="$(Emu $x)" y="$(Emu $y)"/><a:ext cx="$(Emu $w)" cy="$(Emu $h)"/></a:xfrm>
    <a:prstGeom prst="$geom"><a:avLst/></a:prstGeom>
    $fillXml
    $ln
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="$anchor" lIns="91440" tIns="60960" rIns="91440" bIns="60960"/>
    <a:lstStyle/>
    $bodyXml
  </p:txBody>
</p:sp>
"@
}

function TextBox($name, $x, $y, $w, $h, $bodyXml, $anchor = "t") {
    return Shape $name $x $y $w $h "none" "none" $false $bodyXml 0 $anchor
}

function Pill($text, $x, $y, $w, $h, $fill, $color = "FFFFFF") {
    return Shape "Pill - $text" $x $y $w $h $fill "none" $true (Para $text 15 $color $true "ctr") 0 "mid"
}

function IconCircle($icon, $x, $y, $fill, $color = "FFFFFF") {
    return Shape "Icon - $icon" $x $y 1.45 1.45 $fill "none" $true (Para $icon 18 $color $true "ctr") 0 "mid"
}

function Section($title, $icon, $x, $y, $w, $h, $accent, $bodyXml) {
    $xml = ""
    $xml += Shape "Section Card - $title" $x $y $w $h "FFFFFF" "DCE7F7" $true "" 0.9
    $xml += Shape "Section Accent - $title" $x $y 0.28 $h $accent "none" $false "" 0
    $xml += IconCircle $icon ($x + 0.72) ($y + 0.58) $accent
    $xml += TextBox "Section Title - $title" ($x + 2.45) ($y + 0.55) ($w - 3) 1.25 (Para $title 17 "173B67" $true)
    if ($bodyXml -match "<p:") {
        $xml += $bodyXml
    } else {
        $xml += TextBox "Section Body - $title" ($x + 0.75) ($y + 2.15) ($w - 1.5) ($h - 2.45) $bodyXml
    }
    return $xml
}

function Placeholder($label, $x, $y, $w, $h) {
    $xml = ""
    $xml += Shape "Placeholder - $label" $x $y $w $h "F6FAFE" "83D8D8" $true (Lines @($label, "Insert screenshot / diagram") 11 "637083" $true "ctr") 1.1 "mid"
    $xml += Shape "Placeholder inner frame - $label" ($x + 0.35) ($y + 0.35) ($w - 0.7) ($h - 0.7) "none" "B8DDEB" $true "" 0.7
    return $xml
}

function BulletList($items, $size = 11.5, $color = "233142") {
    $xml = ""
    foreach ($item in $items) {
        $xml += Para "• $item" $size $color $false
    }
    return $xml
}

function KeyValue($pairs) {
    $xml = ""
    foreach ($pair in $pairs) {
        $xml += "<a:p><a:pPr/>$(TextRun $pair[0] 11.5 "173B67" $true)$(TextRun "  $($pair[1])" 11.5 "233142" $false)<a:endParaRPr lang=""en-US"" sz=""1150""/></a:p>"
    }
    return $xml
}

$darkBlue = "173B67"
$turquoise = "22B8CF"
$softPurple = "8B7DDA"
$paleBlue = "EFF8FF"
$ink = "233142"
$muted = "637083"

$slide = ""

# Background and header.
$slide += Shape "Poster Background" 0 0 84.1 59.4 "FFFFFF" "none" $false "" 0
$slide += Shape "Header Band" 0 0 84.1 8.3 "F7FBFF" "none" $false "" 0
$slide += Shape "Header Rule Blue" 0 8.1 84.1 0.14 $darkBlue "none" $false "" 0
$slide += Shape "Header Rule Turquoise" 0 8.24 84.1 0.12 $turquoise "none" $false "" 0
$slide += TextBox "Main Title" 2.0 1.0 53.0 2.4 (Para "MeDay Smart Platform" 39 $darkBlue $true)
$slide += TextBox "Subtitle" 2.05 3.6 51.5 1.25 (Para "AI-powered beauty clinic management and personalized client care" 17 $muted $false)
$slide += TextBox "Team Members" 2.05 5.2 40.0 1.2 (Para "Team Members: [ADD NAMES]" 15 $ink $true)
$slide += Shape "University Placeholder" 64.4 1.1 17.4 5.6 "FFFFFF" "DCE7F7" $true (Lines @("University / Department", "Graduation Project Poster", "Academic Year 2026") 12 $darkBlue $true "ctr") 1 "mid"
$slide += Pill "Medical Beauty" 51.8 5.55 7.3 1.15 $turquoise
$slide += Pill "AI Platform" 60.0 5.55 6.4 1.15 $softPurple
$slide += Pill "Responsive UI" 67.2 5.55 7.2 1.15 $darkBlue

# Layout measurements.
$m = 1.55
$gap = 1.0
$cw = 26.33
$x1 = $m
$x2 = $m + $cw + $gap
$x3 = $m + (2 * ($cw + $gap))
$top = 9.2

$overview = KeyValue @(
    @("Problem Statement:", "Beauty clinics need unified scheduling, client history, service discovery, and smarter personalization."),
    @("Solution:", "A full-stack platform connecting clients, clinic admins, AI guidance, and operational workflows."),
    @("Target Users:", "Clients, clinic managers, beauty specialists, and administrators."),
    @("Value Proposition:", "Modern care journey, centralized management, and data-informed recommendations.")
)
$slide += Section "Project Overview" "01" $x1 $top $cw 10.0 $turquoise $overview

$archXml = ""
$archXml += Placeholder "Architecture Diagram" ($x2 + 0.5) ($top + 2.0) ($cw - 1.0) 4.7
$archXml += TextBox "Architecture Bullets" ($x2 + 0.75) ($top + 7.1) ($cw - 1.5) 2.4 (BulletList @("Frontend: React + Vite client experience", "Backend: FastAPI service layer", "Database: users, clinics, bookings, treatments", "AI Module: recommendations and assistant", "External APIs: OpenAI, authentication, future messaging") 10.5)
$slide += Section "System Architecture" "02" $x2 $top $cw 10.0 $darkBlue $archXml

$techXml = ""
$techXml += Pill "React (Vite)" ($x3 + 0.8) ($top + 2.2) 7.3 1.25 $turquoise
$techXml += Pill "FastAPI" ($x3 + 9.0) ($top + 2.2) 6.1 1.25 $darkBlue
$techXml += Pill "Python" ($x3 + 15.8) ($top + 2.2) 5.5 1.25 $softPurple
$techXml += Pill "Database" ($x3 + 0.8) ($top + 4.0) 6.7 1.25 "4CB3A7"
$techXml += Pill "GitHub" ($x3 + 8.2) ($top + 4.0) 5.9 1.25 "415A77"
$techXml += Pill "OpenAI APIs" ($x3 + 14.8) ($top + 4.0) 7.6 1.25 "6D5DD3"
$techXml += TextBox "Tech note" ($x3 + 0.9) ($top + 6.2) ($cw - 1.8) 2.0 (Para "Editable technology chips for adding database type, deployment stack, and integrations." 10.5 $muted)
$slide += Section "Technologies" "03" $x3 $top $cw 10.0 $softPurple $techXml

$uiXml = ""
$uiXml += Placeholder "Homepage Screenshot" ($x1 + 0.6) 22.0 7.65 5.0
$uiXml += Placeholder "Login Screenshot" ($x1 + 9.35) 22.0 7.65 5.0
$uiXml += Placeholder "Client Dashboard" ($x1 + 18.1) 22.0 7.65 5.0
$uiXml += Placeholder "Admin Dashboard" ($x1 + 2.0) 28.1 10.2 5.6
$uiXml += Placeholder "AI Recommendation Screen" ($x1 + 14.1) 28.1 10.2 5.6
$slide += Section "User Interfaces" "04" $x1 20.25 $cw 14.4 $turquoise $uiXml

$aiXml = TextBox "AI Feature Bullets" ($x2 + 0.75) 22.4 ($cw - 1.5) 5.2 (BulletList @("Personalized treatment recommendations", "Smart assistant for client questions", "User behavior and preference analysis", "Treatment discovery based on goals, history, and availability") 12)
$aiXml += Shape "AI Flow" ($x2 + 1.2) 28.6 ($cw - 2.4) 3.1 "F4F0FF" "D7CEFA" $true (Lines @("Client Profile  →  AI Module  →  Recommended Treatments", "Intent, skin goals, service history, clinic rules") 11 $darkBlue $true "ctr") 0.8 "mid"
$slide += Section "AI Features" "05" $x2 20.25 $cw 14.4 $softPurple $aiXml

$testXml = TextBox "Testing Bullets" ($x3 + 0.75) 22.4 ($cw - 1.5) 4.8 (BulletList @("Functional Testing", "Usability Testing", "Security Checks", "Performance Validation") 12)
$testXml += Shape "Validation bar" ($x3 + 1.2) 28.2 ($cw - 2.4) 0.75 $turquoise "none" $true "" 0
$testXml += Shape "Validation split 1" ($x3 + 1.2) 28.2 (($cw - 2.4) * 0.76) 0.75 $darkBlue "none" $true "" 0
$testXml += TextBox "Validation caption" ($x3 + 1.1) 29.35 ($cw - 2.2) 1.8 (Para "Use this area for test metrics, pass rate, Lighthouse score, or user feedback summary." 10.5 $muted $false "l")
$slide += Section "Testing & Validation" "06" $x3 20.25 $cw 14.4 $darkBlue $testXml

$highXml = ""
$highXml += Shape "Metric 1" ($x1 + 0.9) 39.2 11.6 4.2 "EFFBFB" "BFEDEE" $true (Lines @("Client Experience", "Improved booking and service journey") 12 $darkBlue $true "ctr") 0.8 "mid"
$highXml += Shape "Metric 2" ($x1 + 13.9) 39.2 11.6 4.2 "F4F0FF" "D7CEFA" $true (Lines @("Clinic Management", "Centralized admin operations") 12 $darkBlue $true "ctr") 0.8 "mid"
$highXml += TextBox "Highlights Bullets" ($x1 + 0.75) 43.95 ($cw - 1.5) 1.85 (BulletList @("AI-powered recommendations", "Responsive modern user interface", "Clear separation between client and admin workflows") 11.5)
$slide += Section "Highlights & Results" "07" $x1 36.1 $cw 10.0 $turquoise $highXml

$futureXml = TextBox "Future Bullets" ($x2 + 0.75) 38.35 ($cw - 1.5) 3.5 (BulletList @("Mobile Application", "Advanced Analytics", "Multi-clinic Support", "WhatsApp Integration") 12.5)
$futureXml += Shape "Roadmap" ($x2 + 1.1) 42.1 ($cw - 2.2) 1.0 "EAF7FF" "B8DDEB" $true (Para "MVP  →  Analytics  →  Scale  →  Omnichannel Care" 11 $darkBlue $true "ctr") 0.8 "mid"
$slide += Section "Future Development" "08" $x2 36.1 $cw 10.0 $softPurple $futureXml

$contactXml = ""
$contactXml += TextBox "Repo Label" ($x3 + 0.9) 39.05 11.0 1.1 (Para "GitHub Repository:" 12 $darkBlue $true)
$contactXml += Shape "Repo URL Placeholder" ($x3 + 0.9) 40.35 12.6 1.3 "F6FAFE" "DCE7F7" $true (Para "[ADD REPOSITORY URL]" 10.5 $muted $false "ctr") 0.8 "mid"
$contactXml += Shape "QR Code Placeholder" ($x3 + 15.4) 38.85 7.5 7.5 "FFFFFF" "173B67" $false (Lines @("QR", "Code", "Placeholder") 14 $darkBlue $true "ctr") 1.1 "mid"
$contactXml += TextBox "Contact details" ($x3 + 0.9) 42.3 12.6 2.3 (Lines @("Contact Information", "Email: [ADD EMAIL]", "Supervisor: [ADD NAME]") 10.5 $ink $true)
$slide += Section "Contact Information" "09" $x3 36.1 $cw 10.0 $darkBlue $contactXml

$footerY = 56.6
$slide += Shape "Footer Rule" 1.55 55.85 81.0 0.08 "DCE7F7" "none" $false "" 0
$slide += TextBox "Poster Specs" 1.8 $footerY 35.0 1.2 (Para "A1 landscape poster: 84.1 x 59.4 cm | Print-ready editable PowerPoint layout" 9.5 $muted)
$slide += TextBox "Palette" 48.8 $footerY 33.0 1.2 (Para "Palette: Dark Blue #173B67 | Turquoise #22B8CF | Soft Purple #8B7DDA | White #FFFFFF" 9.5 $muted $false "r")

$slideXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm>
      </p:grpSpPr>
      $slide
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>
"@

New-Dir "_rels"
New-Dir "docProps"
New-Dir "ppt/_rels"
New-Dir "ppt/slides"
New-Dir "ppt/slides/_rels"

Write-Utf8 "[Content_Types].xml" @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>
"@

Write-Utf8 "_rels/.rels" @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"@

$created = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
Write-Utf8 "docProps/core.xml" @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>MeDay Smart Platform A1 Academic Poster</dc:title>
  <dc:subject>Graduation project poster</dc:subject>
  <dc:creator>Codex</dc:creator>
  <cp:keywords>MeDay, AI, FastAPI, React, academic poster</cp:keywords>
  <dcterms:created xsi:type="dcterms:W3CDTF">$created</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">$created</dcterms:modified>
</cp:coreProperties>
"@

Write-Utf8 "docProps/app.xml" @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft PowerPoint</Application>
  <PresentationFormat>A1 Landscape</PresentationFormat>
  <Slides>1</Slides>
  <Company>MeDay Smart Platform</Company>
</Properties>
"@

Write-Utf8 "ppt/presentation.xml" @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
  </p:sldIdLst>
  <p:sldSz cx="$(Emu 84.1)" cy="$(Emu 59.4)" type="custom"/>
  <p:notesSz cx="6858000" cy="9144000"/>
  <p:defaultTextStyle/>
</p:presentation>
"@

Write-Utf8 "ppt/_rels/presentation.xml.rels" @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>
"@

Write-Utf8 "ppt/slides/slide1.xml" $slideXml
Write-Utf8 "ppt/slides/_rels/slide1.xml.rels" @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>
"@

if (Test-Path $out) {
    Remove-Item -LiteralPath $out -Force
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$zip = [System.IO.Compression.ZipFile]::Open($out, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    Get-ChildItem -LiteralPath $work -Recurse -File | ForEach-Object {
        $relative = $_.FullName.Substring($work.Length + 1).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $relative) | Out-Null
    }
}
finally {
    $zip.Dispose()
}
Remove-Item -LiteralPath $work -Recurse -Force

Write-Host "Created $out"
