# tidy-classes.ps1  -  run once from the repo root (the folder with index.html):
#
#     powershell -ExecutionPolicy Bypass -File .\tidy-classes.ps1 -Dry    (preview only)
#     powershell -ExecutionPolicy Bypass -File .\tidy-classes.ps1         (apply)
#
# 1. Renames the old colour classes to the new palette names in every
#    .html / .js file (skips node_modules, js\bootstrap and css\).
# 2. Lists the script-only CSS classes that nothing in the repo uses, so you
#    can decide whether to delete them from css\Styles.css.

param([switch]$Dry)

$root = (Get-Location).Path
$utf8 = New-Object System.Text.UTF8Encoding($false)   # keep files UTF-8 without BOM

$renames = [ordered]@{
    'bg-UP-purple'    = 'bg-oak'
    'bg-UP-blue'      = 'bg-oak-deep'
    'bg-UP-grey'      = 'bg-stone'
    'bg-UP-yellow'    = 'bg-oak'
    'bg-UP-white'     = 'bg-oak'
    'color-UP-black'  = 'text-parchment'
    'color-UP-yellow' = 'text-brass'
    'color-UP-blue'   = 'text-brass'
    'color-UP-purple' = 'text-parchment'
    'color-UP-white'  = 'text-parchment'
    'color-I-button'  = 'text-brass'
    'color-I-label'   = 'text-parchment'
}

$scriptOnly = @('complete', 'noCircle', 'spell-slot-label', 'spell-check-hidden', 'topHalf', 'inlineDisplay', 'hide')

$files = Get-ChildItem -Path $root -Recurse -File -Include *.html, *.js | Where-Object {
    $rel = $_.FullName.Substring($root.Length).TrimStart('\', '/')
    -not ($rel -like 'node_modules*' -or $rel -like 'js\bootstrap*' -or $rel -like 'js/bootstrap*' -or
          $rel -like 'css*' -or $rel -like '.git*')
}

$changed = 0
$allText = New-Object System.Text.StringBuilder

foreach ($file in $files) {
    $text = [System.IO.File]::ReadAllText($file.FullName)
    $before = $text

    # notes.js had "card .bg-UP-blue notes" - the dot made it a dead class
    $text = $text.Replace('card .bg-UP-blue notes', 'card notes')

    foreach ($old in $renames.Keys) {
        $pattern = '(?<![\w-])' + [regex]::Escape($old) + '(?![\w-])'
        $text = [regex]::Replace($text, $pattern, $renames[$old])
    }

    if ($text -ne $before) {
        $changed++
        $rel = $file.FullName.Substring($root.Length).TrimStart('\', '/')
        if ($Dry) { Write-Host "would update  $rel" }
        else {
            [System.IO.File]::WriteAllText($file.FullName, $text, $utf8)
            Write-Host "updated  $rel"
        }
    }
    [void]$allText.Append($text).Append("`n")
}

if ($Dry) { Write-Host "`n$changed file(s) would change." } else { Write-Host "`n$changed file(s) changed." }

$all = $allText.ToString()
$unused = $scriptOnly | Where-Object { -not [regex]::IsMatch($all, '(?<![\w-])' + [regex]::Escape($_) + '(?![\w-])') }
if ($unused) {
    Write-Host "`nThese classes are in Styles.css but nothing in the repo uses them."
    Write-Host ("Safe to delete from css\Styles.css:  " + (($unused | ForEach-Object { ".$_" }) -join '  '))
} else {
    Write-Host "`nEvery script-only class in Styles.css is still used somewhere. Keep them."
}
