#Requires -Version 5.1
<#
.SYNOPSIS
  Enable Sheets + Drive APIs, create service account, write secrets/google-sa.json and .env stubs.
#>
param(
    [string]$Project = $env:GOOGLE_CLOUD_PROJECT,
    [string]$ShareEmail = $env:GOOGLE_SHARE_WITH_EMAIL,
    [string]$SaName = "li-harvester"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Assert-Command($Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Missing required command: $Name. Install Google Cloud SDK first."
    }
}

Assert-Command gcloud

if (-not $Project) {
    $Project = (gcloud config get-value project 2>$null).Trim()
}
if (-not $Project -or $Project -eq "(unset)") {
    $Project = Read-Host "GCP project ID"
}
if (-not $Project) { throw "Project ID is required." }

if (-not $ShareEmail) {
    $ShareEmail = Read-Host "Google email to share the spreadsheet with"
}
if (-not $ShareEmail) { throw "GOOGLE_SHARE_WITH_EMAIL is required." }

Write-Host "Using project: $Project"
gcloud config set project $Project | Out-Null

Write-Host "Enabling Sheets + Drive APIs..."
gcloud services enable sheets.googleapis.com drive.googleapis.com --project $Project

$SaEmail = "$SaName@$Project.iam.gserviceaccount.com"
$Existing = gcloud iam service-accounts list --project $Project --filter="email:$SaEmail" --format="value(email)"
if (-not $Existing) {
    Write-Host "Creating service account $SaEmail ..."
    gcloud iam service-accounts create $SaName `
        --project $Project `
        --display-name "LinkedIn Lead Harvester"
} else {
    Write-Host "Service account already exists: $SaEmail"
}

$SecretsDir = Join-Path $Root "secrets"
New-Item -ItemType Directory -Force -Path $SecretsDir | Out-Null
$KeyPath = Join-Path $SecretsDir "google-sa.json"

if (Test-Path $KeyPath) {
    Write-Host "Key already exists at $KeyPath (leaving in place)."
} else {
    Write-Host "Creating JSON key -> $KeyPath"
    gcloud iam service-accounts keys create $KeyPath `
        --iam-account $SaEmail `
        --project $Project
}

$EnvPath = Join-Path $Root ".env"
if (-not (Test-Path $EnvPath)) {
    Copy-Item (Join-Path $Root ".env.example") $EnvPath
}

function Set-EnvLine([string]$Key, [string]$Value) {
    $content = Get-Content $EnvPath -ErrorAction SilentlyContinue
    if (-not $content) { $content = @() }
    $found = $false
    $out = @()
    foreach ($line in $content) {
        if ($line -match "^$Key\s*=") {
            $out += "$Key=$Value"
            $found = $true
        } else {
            $out += $line
        }
    }
    if (-not $found) { $out += "$Key=$Value" }
    $out | Set-Content -Path $EnvPath -Encoding UTF8
}

Set-EnvLine "GOOGLE_SERVICE_ACCOUNT_JSON" "secrets/google-sa.json"
Set-EnvLine "GOOGLE_SHARE_WITH_EMAIL" $ShareEmail

Write-Host ""
Write-Host "Done."
Write-Host "  SA:      $SaEmail"
Write-Host "  Key:     $KeyPath"
Write-Host "  Share:   $ShareEmail"
Write-Host "  .env:    updated"
Write-Host ""
Write-Host "Next:"
Write-Host "  1. Put APIFY_TOKEN in .env"
Write-Host "  2. python -m venv .venv && .\.venv\Scripts\Activate.ps1 && pip install -r requirements.txt"
Write-Host "  3. python scripts\init_workbook.py"
