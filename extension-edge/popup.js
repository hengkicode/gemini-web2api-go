// popup.js - Gemini Cookie Auto-Sync untuk Microsoft Edge & Chromium

document.addEventListener('DOMContentLoaded', () => {
  const syncBtn = document.getElementById('syncBtn');
  const serverUrlInput = document.getElementById('serverUrl');
  const statusCard = document.getElementById('status-card');

  // Load last used server URL if saved
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['serverUrl'], (res) => {
      if (res && res.serverUrl) {
        serverUrlInput.value = res.serverUrl;
      }
    });
  }

  syncBtn.addEventListener('click', async () => {
    let serverUrl = serverUrlInput.value.trim().replace(/\/+$/, '');
    if (!serverUrl) serverUrl = 'http://localhost:8083';

    // Save server URL
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ serverUrl });
    }

    syncBtn.disabled = true;
    statusCard.style.color = '';
    statusCard.innerText = '🔍 Memeriksa tab Gemini & membaca cookie browser...';

    try {
      // 1. Deteksi nomor akun (authuser) dari tab gemini yang terbuka
      let authuser = 0;
      const tabs = await chrome.tabs.query({ url: "*://gemini.google.com/*" });
      if (tabs.length > 0) {
        const activeOrFirst = tabs.find(t => t.active) || tabs[0];
        const match = activeOrFirst.url.match(/gemini\.google\.com\/u\/(\d+)\//);
        if (match) {
          authuser = parseInt(match[1], 10);
        }
      }

      // 2. Ambil seluruh cookie google.com
      const cookies = await chrome.cookies.getAll({ domain: 'google.com' });
      if (!cookies || cookies.length === 0) {
        throw new Error('Tidak ditemukan cookie google.com di Microsoft Edge. Pastikan Anda sudah login di gemini.google.com.');
      }

      // 3. Sanitasi: Buang OSID konflik dan deduplikasi kunci cookie
      const seen = new Set();
      const cleanPairs = [];
      let found1PSID = false;
      let found1PSIDTS = false;
      let found1PSIDCC = false;

      for (const c of cookies) {
        if (c.name === 'OSID' || c.name === '__Secure-OSID') continue;
        if (seen.has(c.name)) continue;
        seen.add(c.name);

        if (c.name === '__Secure-1PSID') found1PSID = true;
        if (c.name === '__Secure-1PSIDTS') found1PSIDTS = true;
        if (c.name === '__Secure-1PSIDCC') found1PSIDCC = true;

        cleanPairs.push(`${c.name}=${c.value}`);
      }

      if (!found1PSID) {
        throw new Error('Cookie tidak memuat __Secure-1PSID. Pastikan Anda sudah login ke akun Google di Edge.');
      }

      const cookieStr = cleanPairs.join('; ');
      statusCard.innerText = `Mengirim ${cleanPairs.length} cookie (AuthUser=${authuser}) ke ${serverUrl}...`;

      // 4. Kirim ke admin API cookie pool
      const postRes = await fetch(`${serverUrl}/admin/api/cookies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: `Edge-Auto (${new Date().toLocaleTimeString()})`,
          cookie: cookieStr,
          authuser: authuser
        })
      });

      if (!postRes.ok) {
        const errText = await postRes.text();
        throw new Error(`Server ${postRes.status}: ${errText}`);
      }

      const postData = await postRes.json();
      if (!postData.id) {
        throw new Error(`Respon tidak valid: ${JSON.stringify(postData)}`);
      }

      // 5. Verifikasi sesi langsung ke upstream Google
      statusCard.innerText = `Akun #${postData.id} tersimpan. Memverifikasi status login ke Google...`;

      const checkRes = await fetch(`${serverUrl}/admin/api/cookies/${postData.id}/check`, {
        method: 'POST'
      });
      const checkData = await checkRes.json();

      if (checkData.ok) {
        statusCard.style.color = '#107c41';
        statusCard.innerText = `✅ SUKSES!\nStatus: ${checkData.detail}\nProxy: ${checkData.proxy_name || 'Direct'} (${checkData.took_ms}ms)\n\n🚀 Model gemini-4-neon aktif & siap dipakai!`;
      } else {
        statusCard.style.color = '#d13438';
        statusCard.innerText = `⚠️ Verifikasi Gagal:\n${checkData.detail}\n\nPastikan tab gemini.google.com Anda aktif dan tidak dalam keadaan ter-logout.`;
      }
    } catch (err) {
      statusCard.style.color = '#d13438';
      statusCard.innerText = `❌ Error: ${err.message}`;
    } finally {
      syncBtn.disabled = false;
    }
  });
});
