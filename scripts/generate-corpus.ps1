$ErrorActionPreference = "Stop"

$rootPath = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $rootPath "constitution-source.html"
$outputDirectory = Join-Path $rootPath "src\data"
$outputPath = Join-Path $outputDirectory "constitution.json"

if (-not (Test-Path -LiteralPath $sourcePath)) {
  throw "constitution-source.html is missing. Download the Lawphil source first."
}

$source = [IO.File]::ReadAllText($sourcePath)
$bodyStart = $source.IndexOf("<blockquote>", [StringComparison]::OrdinalIgnoreCase)
$bodyEnd = $source.LastIndexOf("</blockquote>", [StringComparison]::OrdinalIgnoreCase)
if ($bodyStart -lt 0 -or $bodyEnd -le $bodyStart) {
  throw "Could not locate the constitutional text."
}
$bodyStart += "<blockquote>".Length
$body = $source.Substring($bodyStart, $bodyEnd - $bodyStart)

function ConvertTo-PlainText([string]$html) {
  $text = [regex]::Replace($html, "<br\s*/?>", " ", "IgnoreCase")
  $text = [regex]::Replace($text, "</(?:p|li)>", " ", "IgnoreCase")
  $text = [regex]::Replace($text, "<[^>]+>", " ")
  $text = [Net.WebUtility]::HtmlDecode($text)
  return [regex]::Replace($text, "\s+", " ").Trim()
}

function ConvertTo-CleanHtml([string]$html) {
  $clean = [regex]::Replace($html, "<!--[\s\S]*?-->", "")
  $clean = [regex]::Replace($clean, "<a\b[^>]*>|</a>", "", "IgnoreCase")
  $clean = [regex]::Replace($clean, "</?center\b[^>]*>", "", "IgnoreCase")
  $clean = [regex]::Replace($clean, "<p\b[^>]*>", "<p>", "IgnoreCase")
  $clean = [regex]::Replace($clean, "<ol\b[^>]*>", "<ol>", "IgnoreCase")
  $clean = [regex]::Replace($clean, "<li\b[^>]*>", "<li>", "IgnoreCase")
  $clean = [regex]::Replace($clean, "<br\s*/?>", "<br>", "IgnoreCase")
  $clean = [regex]::Replace($clean, "<(?!/?(?:p|ol|li|b|br)\b)[^>]+>", "", "IgnoreCase")
  $clean = [Net.WebUtility]::HtmlDecode($clean)
  return [regex]::Replace($clean, "<p>\s*</p>", "").Trim()
}

$articlePattern = "<p\s+align=[""']?center[""']?\s*>\s*<b>\s*ARTICLE\s+([IVX]+)\s*<br\s*/?>\s*([^<]*?)</b>"
$articleMatches = [regex]::Matches($body, $articlePattern, "IgnoreCase")
if ($articleMatches.Count -ne 18) {
  throw "Expected 18 articles but found $($articleMatches.Count)."
}

$preambleHeading = [regex]::Match($body, "<p\s+align=[""']?center[""']?\s*>\s*<b>\s*PREAMBLE\s*</b>", "IgnoreCase")
$preambleBodyStart = $body.IndexOf("</p>", $preambleHeading.Index) + 4
$preambleRaw = $body.Substring($preambleBodyStart, $articleMatches[0].Index - $preambleBodyStart)
$preambleHtml = ConvertTo-CleanHtml $preambleRaw

$articles = @()
for ($articleIndex = 0; $articleIndex -lt $articleMatches.Count; $articleIndex++) {
  $articleMatch = $articleMatches[$articleIndex]
  $roman = $articleMatch.Groups[1].Value
  $title = ConvertTo-PlainText $articleMatch.Groups[2].Value
  $start = $articleMatch.Index + $articleMatch.Length
  $end = if ($articleIndex + 1 -lt $articleMatches.Count) { $articleMatches[$articleIndex + 1].Index } else { $body.Length }
  $articleRaw = $body.Substring($start, $end - $start)
  $sectionMatches = [regex]::Matches($articleRaw, "<b>\s*Section\s+(\d+)\.\s*</b>", "IgnoreCase")
  $sections = @()

  if ($sectionMatches.Count -eq 0) {
    $clean = ConvertTo-CleanHtml $articleRaw
    $sections += [ordered]@{
      number = $null
      ordinal = 1
      html = $clean
      text = ConvertTo-PlainText $clean
    }
  }
  else {
    $prefatoryRaw = $articleRaw.Substring(0, $sectionMatches[0].Index)
    $prefatoryHtml = ConvertTo-CleanHtml $prefatoryRaw
    if ((ConvertTo-PlainText $prefatoryHtml).Length -gt 0) {
      $sections += [ordered]@{
        number = $null
        ordinal = 0
        label = "Introductory text"
        html = $prefatoryHtml
        text = ConvertTo-PlainText $prefatoryHtml
      }
    }

    for ($sectionIndex = 0; $sectionIndex -lt $sectionMatches.Count; $sectionIndex++) {
      $sectionMatch = $sectionMatches[$sectionIndex]
      $sectionStart = $sectionMatch.Index + $sectionMatch.Length
      $sectionEnd = if ($sectionIndex + 1 -lt $sectionMatches.Count) { $sectionMatches[$sectionIndex + 1].Index } else { $articleRaw.Length }
      $sectionRaw = $articleRaw.Substring($sectionStart, $sectionEnd - $sectionStart)
      $sectionHtml = ConvertTo-CleanHtml $sectionRaw
      $sections += [ordered]@{
        number = [int]$sectionMatch.Groups[1].Value
        ordinal = $sectionIndex + 1
        html = $sectionHtml
        text = ConvertTo-PlainText $sectionHtml
      }
    }
  }

  $articles += [ordered]@{
    roman = $roman
    number = $articleIndex + 1
    title = $title
    sections = $sections
  }
}

$corpus = [ordered]@{
  title = "1987 Constitution of the Republic of the Philippines"
  source = "The Lawphil Project, Arellano Law Foundation"
  sourceUrl = "https://lawphil.net/consti/cons1987.html"
  retrieved = (Get-Date -Format "yyyy-MM-dd")
  preamble = [ordered]@{
    html = $preambleHtml
    text = ConvertTo-PlainText $preambleHtml
  }
  articles = $articles
}

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
[IO.File]::WriteAllText($outputPath, ($corpus | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
$blockCount = ($articles | ForEach-Object { $_.sections.Count } | Measure-Object -Sum).Sum
Write-Output "Generated $($articles.Count) articles and $blockCount provision blocks."
