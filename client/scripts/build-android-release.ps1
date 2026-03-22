$ErrorActionPreference = 'Stop'

$clientRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $clientRoot '.env'
$androidRoot = Join-Path $clientRoot 'android'
$gradleWrapper = Join-Path $androidRoot 'gradlew.bat'
$apkPath = Join-Path $androidRoot 'app\build\outputs\apk\release\app-release.apk'
$debugKeystorePath = Join-Path $androidRoot 'app\debug.keystore'
$androidPackage = 'com.anonymous.sakaiapp'

if (-not (Test-Path -LiteralPath $envPath)) {
  throw "Missing client/.env. Copy client/.env.example to client/.env and fill in the release values before building."
}

if (-not (Test-Path -LiteralPath $gradleWrapper)) {
  throw "Missing Android Gradle wrapper at $gradleWrapper."
}

function Read-DotEnvFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $values = @{}

  foreach ($line in Get-Content -LiteralPath $Path) {
    if ([string]::IsNullOrWhiteSpace($line)) {
      continue
    }

    $trimmedLine = $line.Trim()
    if ($trimmedLine.StartsWith('#')) {
      continue
    }

    $match = [regex]::Match($line, '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$')
    if (-not $match.Success) {
      continue
    }

    $name = $match.Groups[1].Value
    $value = $match.Groups[2].Value.Trim()

    if ($value.Length -ge 2) {
      $startsWithDoubleQuote = $value.StartsWith('"')
      $endsWithDoubleQuote = $value.EndsWith('"')
      $startsWithSingleQuote = $value.StartsWith("'")
      $endsWithSingleQuote = $value.EndsWith("'")

      if (($startsWithDoubleQuote -and $endsWithDoubleQuote) -or ($startsWithSingleQuote -and $endsWithSingleQuote)) {
        $value = $value.Substring(1, $value.Length - 2)
      }
    }

    $values[$name] = $value.Trim()
  }

  return $values
}

function Assert-RequiredValue {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$Values,
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  if (-not $Values.ContainsKey($Name)) {
    throw "Missing $Name in client/.env."
  }

  $value = [string]$Values[$Name]
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "$Name in client/.env is blank."
  }

  $normalizedValue = $value.Trim()
  $placeholderPatterns = @(
    '^your-',
    '^example$',
    '^changeme$',
    '^replace-',
    '^<.+>$'
  )

  foreach ($pattern in $placeholderPatterns) {
    if ($normalizedValue -match $pattern) {
      throw "$Name in client/.env still looks like a placeholder value."
    }
  }

  return $normalizedValue
}

function Assert-ReleaseApiBaseUrl {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  $uriKind = [System.UriKind]::Absolute
  $parsedUri = $null

  if (-not [System.Uri]::TryCreate($Value, $uriKind, [ref]$parsedUri)) {
    throw "EXPO_PUBLIC_API_BASE_URL must be an absolute URL."
  }

  $hostName = $parsedUri.Host.ToLowerInvariant()
  $disallowedHosts = @('localhost', '127.0.0.1', '0.0.0.0', '10.0.2.2', '::1')
  if ($disallowedHosts -contains $hostName) {
    throw "EXPO_PUBLIC_API_BASE_URL points to a local-only host ($hostName). Use a reachable backend URL for a release APK."
  }
}

function Get-KeytoolPath {
  if (-not [string]::IsNullOrWhiteSpace($env:JAVA_HOME)) {
    $javaHomeKeytool = Join-Path $env:JAVA_HOME 'bin\keytool.exe'
    if (Test-Path -LiteralPath $javaHomeKeytool) {
      return $javaHomeKeytool
    }
  }

  $keytoolCommand = Get-Command keytool.exe -ErrorAction SilentlyContinue
  if ($null -ne $keytoolCommand) {
    return $keytoolCommand.Source
  }

  throw 'Unable to find keytool.exe. Ensure JAVA_HOME points to a JDK installation.'
}

$envValues = Read-DotEnvFile -Path $envPath

$apiBaseUrl = Assert-RequiredValue -Values $envValues -Name 'EXPO_PUBLIC_API_BASE_URL'
$googleMapsApiKey = Assert-RequiredValue -Values $envValues -Name 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY'
$googlePlacesApiKey = Assert-RequiredValue -Values $envValues -Name 'EXPO_PUBLIC_GOOGLE_PLACES_API_KEY'
Assert-ReleaseApiBaseUrl -Value $apiBaseUrl

$env:EXPO_PUBLIC_API_BASE_URL = $apiBaseUrl
$env:EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = $googleMapsApiKey
$env:EXPO_PUBLIC_GOOGLE_PLACES_API_KEY = $googlePlacesApiKey
$env:NODE_ENV = 'production'

Write-Host "Building local Android release APK for $androidPackage..."
Write-Host "Using env from $envPath"

Push-Location $androidRoot
try {
  & $gradleWrapper assembleRelease
  if ($LASTEXITCODE -ne 0) {
    throw "Gradle release build failed with exit code $LASTEXITCODE."
  }
}
finally {
  Pop-Location
}

if (-not (Test-Path -LiteralPath $apkPath)) {
  throw "Release APK was not created at $apkPath."
}

$apkHash = (Get-FileHash -LiteralPath $apkPath -Algorithm SHA256).Hash
$keytoolPath = Get-KeytoolPath
$keystoreOutput = & $keytoolPath -list -v -keystore $debugKeystorePath -alias androiddebugkey -storepass android -keypass android
$sha1Match = [regex]::Match(($keystoreOutput -join [Environment]::NewLine), 'SHA1:\s*([A-F0-9:]+)')

if (-not $sha1Match.Success) {
  throw 'Unable to read the debug keystore SHA-1 fingerprint.'
}

$debugSha1 = $sha1Match.Groups[1].Value

Write-Host ''
Write-Host 'Local release build complete.'
Write-Host "APK: $apkPath"
Write-Host "SHA-256: $apkHash"
Write-Host "Android package: $androidPackage"
Write-Host "Debug keystore SHA-1: $debugSha1"
Write-Host 'If Google Maps does not render, confirm your Android app restriction matches the package name and SHA-1 above.'
