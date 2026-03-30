# This script automatically creates a ZIP file of your extension and commits it to GitHub.
# Run this locally using PowerShell whenever you want to release a new version.

$zipName = "firefox-extension.zip"

Write-Host "Creating $zipName..."
# We explicitly include files needed for the extension, ignoring dev/test files.
$filesToZip = Get-ChildItem -Path . -Exclude @(".git", ".github", "test*.html", "have-gem.html", "out-of-gem.html", "split.js", "*.zip", "build-and-commit.ps1")

# Force overwrites the old zip if it exists
Compress-Archive -Path $filesToZip -DestinationPath $zipName -Force

Write-Host "Zip created successfully."

# Comment the following lines out if you only want to zip and don't want to auto-commit everything.
Write-Host "Committing to Git..."
git add .
git commit -m "Auto-build and commit $zipName"
git push

# Read version from manifest.json and auto tag
$manifestPath = Join-Path $PWD "manifest.json"
if (Test-Path $manifestPath) {
    $manifestData = Get-Content $manifestPath | ConvertFrom-Json
    $version = $manifestData.version
    $tagName = "v$version"

    Write-Host "Tagging as $tagName..."
    # The || true ignores error if tag already exists
    git tag $tagName
    git push origin $tagName
}

Write-Host "Done!"
