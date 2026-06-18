# Network Speed Test Client PowerShell Script
# Usage: .\client.ps1 <server-url> [options]
# Example: .\client.ps1 http://192.168.1.100:3001

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$ServerUrl,
    
    [int]$DownloadSizeKB = 1000,
    [int]$UploadSizeKB = 1000,
    [int]$PingCount = 5,
    [switch]$NoDownload,
    [switch]$NoUpload,
    [switch]$NoLatency
)

# Remove trailing slash from URL
$ServerUrl = $ServerUrl.TrimEnd('/')

# Helper function to make HTTP requests
function Make-Request {
    param(
        [string]$Path,
        [string]$Method = 'GET',
        [object]$Body = $null
    )
    
    $url = "$ServerUrl$Path"
    $headers = @{
        'Content-Type' = 'application/json'
    }
    
    try {
        $params = @{
            Uri = $url
            Method = $Method
            Headers = $headers
            TimeoutSec = 120
            UseBasicParsing = $true
        }
        
        if ($Body -and $Method -eq 'POST') {
            $params['Body'] = ($Body | ConvertTo-Json)
        }
        
        $response = Invoke-RestMethod @params
        return $response
    }
    catch {
        throw "Request failed: $($_.Exception.Message)"
    }
}

# Helper function for sleep
function Start-SleepMs {
    param([int]$Milliseconds)
    Start-Sleep -Milliseconds $Milliseconds
}

# Test latency with multiple pings
function Test-Latency {
    param([int]$Samples = 5)
    
    Write-Host "Testing latency with $Samples samples..."
    $latencies = @()
    
    for ($i = 1; $i -le $Samples; $i++) {
        try {
            $startTime = Get-Date
            $null = Make-Request -Path '/api/ping'
            $endTime = Get-Date
            $latency = ($endTime - $startTime).TotalMilliseconds
            $latencies += [math]::Round($latency, 2)
            
            Write-Host "Ping ${i}: $([math]::Round($latency, 2))ms"
            
            # Small delay between pings
            if ($i -lt $Samples) {
                Start-SleepMs -Milliseconds 100
            }
        }
        catch {
            Write-Host "Ping ${i} failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    if ($latencies.Count -eq 0) {
        throw 'All ping attempts failed'
    }
    
    $avgLatency = ($latencies | Measure-Object -Average).Average
    $minLatency = ($latencies | Measure-Object -Minimum).Minimum
    $maxLatency = ($latencies | Measure-Object -Maximum).Maximum
    
    return @{
        average = [math]::Round($avgLatency)
        min = [math]::Round($minLatency)
        max = [math]::Round($maxLatency)
        n_samples = $Samples
    }
}

# Test download speed
function Test-DownloadSpeed {
    param([int]$SizeKB = 1000)
    
    Write-Host "Testing download speed with ${SizeKB}KB..."
    
    $startTime = Get-Date
    $response = Make-Request -Path "/api/download/$SizeKB"
    $endTime = Get-Date
    
    $transferTime = ($endTime - $startTime).TotalMilliseconds
    $sizeBytes = $SizeKB * 1024
    $speedBps = $sizeBytes / ($transferTime / 1000)
    $speedKbps = ($speedBps * 8) / 1000
    $speedMbps = $speedKbps / 1000
    
    return @{
        sizeKB = $SizeKB
        transferTime = [math]::Round($transferTime)
        speedBps = [math]::Round($speedBps)
        speedKbps = [math]::Round($speedKbps)
        speedMbps = [math]::Round($speedMbps, 2)
    }
}

# Test upload speed
function Test-UploadSpeed {
    param([int]$SizeKB = 1000)
    
    Write-Host "Testing upload speed with ${SizeKB}KB..."
    
    # Generate random test data (Base64 encoded)
    $sizeBytes = $SizeKB * 1024
    $randomBytes = New-Object byte[] $sizeBytes
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($randomBytes)
    $testData = [Convert]::ToBase64String($randomBytes)
    $rng.Dispose()
    
    $payload = @{
        data = $testData
        timestamp = ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
        size = $SizeKB
    }
    
    $startTime = Get-Date
    $response = Make-Request -Path '/api/upload' -Method 'POST' -Body $payload
    $endTime = Get-Date
    
    $transferTime = ($endTime - $startTime).TotalMilliseconds
    $speedBps = $sizeBytes / ($transferTime / 1000)
    $speedKbps = ($speedBps * 8) / 1000
    $speedMbps = $speedKbps / 1000
    
    return @{
        sizeKB = $SizeKB
        transferTime = [math]::Round($transferTime)
        speedBps = [math]::Round($speedBps)
        speedKbps = [math]::Round($speedKbps)
        speedMbps = [math]::Round($speedMbps, 2)
        serverProcessingTime = $response.transferTime
    }
}

# Get network information
function Get-NetworkInfo {
    return Make-Request -Path '/api/network-info'
}

# Run comprehensive speed test
function Run-FullTest {
    param(
        [int]$LatencySamples = 5,
        [int]$DownloadSizeKB = 1000,
        [int]$UploadSizeKB = 1000,
        [bool]$TestDownload = $true,
        [bool]$TestUpload = $true,
        [bool]$TestLatency = $true
    )
    
    Write-Host "`n=== Network Speed Test ==="
    Write-Host "Server: $ServerUrl"
    Write-Host "Time: $(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')`n"
    
    $results = @{
        serverUrl = $ServerUrl
        timestamp = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')
        tests = @{}
    }
    
    try {
        # Test latency
        if ($TestLatency) {
            Write-Host '1. Testing Latency...'
            $results.tests.latency = Test-Latency -Samples $LatencySamples
            Write-Host "   Average: $($results.tests.latency.average)ms (min: $($results.tests.latency.min)ms, max: $($results.tests.latency.max)ms)`n"
        }
        
        # Test download speed
        if ($TestDownload) {
            Write-Host '2. Testing Download Speed...'
            $results.tests.download = Test-DownloadSpeed -SizeKB $DownloadSizeKB
            Write-Host "   Speed: $($results.tests.download.speedMbps) Mbps ($($results.tests.download.speedKbps) Kbps)`n"
        }
        
        # Test upload speed
        if ($TestUpload) {
            Write-Host '3. Testing Upload Speed...'
            $results.tests.upload = Test-UploadSpeed -SizeKB $UploadSizeKB
            Write-Host "   Speed: $($results.tests.upload.speedMbps) Mbps ($($results.tests.upload.speedKbps) Kbps)`n"
        }
        
        # Get network info
        Write-Host '4. Getting Network Info...'
        $results.networkInfo = Get-NetworkInfo
        Write-Host "   Client IP: $($results.networkInfo.clientIP)`n"
    }
    catch {
        Write-Host "Test failed: $($_.Exception.Message)" -ForegroundColor Red
        $results.error = $_.Exception.Message
    }
    
    return $results
}

# Main execution
Write-Host "Network Speed Test Client (PowerShell)"
Write-Host "=====================================`n"

# Prepare test options
$testOptions = @{
    LatencySamples = $PingCount
    DownloadSizeKB = $DownloadSizeKB
    UploadSizeKB = $UploadSizeKB
    TestDownload = -not $NoDownload
    TestUpload = -not $NoUpload
    TestLatency = -not $NoLatency
}

# Run the test
try {
    $results = Run-FullTest @testOptions
    Write-Host '=== Test Complete ==='
    $results | ConvertTo-Json -Depth 10
}
catch {
    Write-Host "Test failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
