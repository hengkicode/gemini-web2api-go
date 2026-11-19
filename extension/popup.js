document.getElementById('syncBtn').addEventListener('click', async () => {
  const statusEl = document.getElementById('status');
  statusEl.innerText = 'Mengambil cookie...';

  try {
    // Cari tab gemini yang sedang aktif atau terbuka
    let authuser = 0;
    const geminiTabs = await chrome.tabs.query({ url: "*://gemini.google.com/*" });
    if (geminiTabs.length > 0) {
      const match = geminiTabs[0].url.match(/gemini\.google\.com\/u\/(\d+)\//);
      if (match) {
        authuser = parseInt(match[1], 10);
      }
    }

    const cookies = await chrome.cookies.getAll({ domain: 'google.com' });
    if (!cookies || cookies.length === 0) {
      statusEl.innerText = 'Tidak ada cookie google.com ditemukan.';
      return;
    }

    // Hindari OSID & __Secure-OSID dari subdomain lain yang memicu 302 CookieMismatch
    const seen = new Set();
    const cookiePairs = [];
    for (const c of cookies) {
      if (c.name === 'OSID' || c.name === '__Secure-OSID') continue;
      if (seen.has(c.name)) continue;
      seen.add(c.name);
      cookiePairs.push(`${c.name}=${c.value}`);
    }
    const cookieStr = cookiePairs.join('; ');

    statusEl.innerText = `Mengirim ${cookiePairs.length} cookie bersih (authuser=${authuser})...`;

    const res = await fetch('http://localhost:8083/admin/api/cookies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: 'Auto-Extension',
        cookie: cookieStr,
        authuser: authuser
      })
    });

    const data = await res.json();
    if (data.id) {
      statusEl.innerText = 'Memverifikasi status...';
      const checkRes = await fetch(`http://localhost:8083/admin/api/cookies/${data.id}/check`, { method: 'POST' });
      const checkData = await checkRes.json();
      if (checkData.ok) {
        statusEl.innerText = `✅ SUKSES!\n${checkData.detail}\nModel gemini-4-neon SIAP!`;
        statusEl.style.color = 'green';
      } else {
        statusEl.innerText = `⚠️ Gagal verifikasi:\n${checkData.detail}`;
        statusEl.style.color = 'red';
      }
    } else {
      statusEl.innerText = `Error: ${JSON.stringify(data)}`;
      statusEl.style.color = 'red';
    }
  } catch (err) {
    statusEl.innerText = `Error: ${err.message}`;
    statusEl.style.color = 'red';
  }
});
