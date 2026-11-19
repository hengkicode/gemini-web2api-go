# sync_cookie.ps1 - Otomatis mengambil cookie dari clipboard dan push ke gemini-web2api
$clip = Get-Clipboard -Raw

if ([string]::IsNullOrWhiteSpace($clip)) {
    Write-Host "[!] Clipboard kosong. Buka Network Tab di F12 -> Klik kanan request 'app' -> Copy as cURL (bash), lalu jalankan script ini lagi." -ForegroundColor Yellow
    exit 1
}

$cookie = ""
if ($clip -match '(?i)-H\s+["'']cookie:\s*([^"'']+)["'']') {
    $cookie = $matches[1]
} elseif ($clip -match '(?i)cookie:\s*([^\r\n]+)') {
    $cookie = $matches[1]
} elseif ($clip -match '__Secure-1PSID=') {
    $cookie = $clip.Trim()
}

if (-not $cookie) {
    Write-Host "[!] Tidak ditemukan string cookie di clipboard." -ForegroundColor Red
    Write-Host "    Cara cepat: Di Chrome F12 Network tab, klik kanan request 'app' atau 'batchexecute' -> Copy -> Copy as cURL (bash)." -ForegroundColor Gray
    exit 1
}

# Deteksi authuser dari cURL jika ada /u/1/ dsb
$authuser = 0
if ($clip -match 'gemini\.google\.com/u/(\d+)/') {
    $authuser = [int]$matches[1]
}

Write-Host "[*] Cookie terdeteksi di clipboard (AuthUser=$authuser). Mengirim ke gemini-web2api..." -ForegroundColor Cyan

$body = @{
    label = "Chrome-Auto"
    cookie = $cookie
    authuser = $authuser
} | ConvertTo-Json

try {
    $resp = Invoke-RestMethod -Uri "http://localhost:8083/admin/api/cookies" -Method Post -Body $body -ContentType "application/json"
    $id = $resp.id
    Write-Host "[+] Tersimpan sebagai Akun #$id. Melakukan validasi status (SNlM0e)..." -ForegroundColor Green
    
    $check = Invoke-RestMethod -Uri "http://localhost:8083/admin/api/cookies/$id/check" -Method Post
    if ($check.ok) {
        Write-Host "[SUCCESS] $($check.detail)!" -ForegroundColor Green
        Write-Host "[READY] Model gemini-4-neon siap digunakan!" -ForegroundColor Cyan
    } else {
        Write-Host "[FAIL] $($check.detail)" -ForegroundColor Red
    }
} catch {
    Write-Host "[!] Gagal mengirim ke server: $_" -ForegroundColor Red
}
