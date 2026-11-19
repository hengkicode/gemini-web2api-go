"""
virtual_browser.py - Virtual Browser Mandiri untuk Gemini Web2API
Menggunakan Chromium terisolasi (Playwright) tanpa menyentuh Chrome/Edge bawaan Windows.
"""

import os
import sys
import time
import json
import urllib.request
from playwright.sync_api import sync_playwright

PROFILE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "virtual_browser_profile")
SERVER_URL = "http://localhost:8083"

def post_to_web2api(cookie_str, authuser=0):
    url = f"{SERVER_URL}/admin/api/cookies"
    payload = json.dumps({
        "label": f"Virtual-Browser ({time.strftime('%H:%M:%S')})",
        "cookie": cookie_str,
        "authuser": authuser
    }).encode("utf-8")

    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            account_id = data.get("id")
            if not account_id:
                print(f"[-] Gagal menyimpan ke server: {data}")
                return False

            print(f"[+] Cookie tersimpan di Akun #{account_id}. Memvalidasi status...")
            check_req = urllib.request.Request(f"{SERVER_URL}/admin/api/cookies/{account_id}/check", data=b"", headers={})
            with urllib.request.urlopen(check_req) as check_resp:
                check_data = json.loads(check_resp.read().decode("utf-8"))
                if check_data.get("ok"):
                    print(f"\n=======================================================")
                    print(f" [SUCCESS] LOGIN VALID! STATUS: {check_data.get('detail')}")
                    print(f" [READY] Model Gemini 4 Neon aktif & siap digunakan!")
                    print(f"=======================================================\n")
                    return True
                else:
                    print(f"[-] Validasi gagal: {check_data.get('detail')}")
                    return False
    except Exception as e:
        print(f"[-] Error saat mengirim ke {SERVER_URL}: {e}")
        return False

def run_virtual_browser(headless=False):
    os.makedirs(PROFILE_DIR, exist_ok=True)
    print(f"[*] Menjalankan Virtual Browser Chromium terisolasi...")
    print(f"[*] Profile Directory: {PROFILE_DIR}")

    with sync_playwright() as p:
        # Jalankan Chromium mandiri
        context = p.chromium.launch_persistent_context(
            user_data_dir=PROFILE_DIR,
            headless=headless,
            channel=None, # Menggunakan bundle Playwright murni
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-default-browser-check",
                "--no-first-run"
            ],
            viewport={"width": 1280, "height": 800}
        )

        page = context.pages[0] if context.pages else context.new_page()
        print(f"[*] Membuka https://gemini.google.com/app di jendela virtual browser...")
        page.goto("https://gemini.google.com/app")

        print("\n>>> PANDUAN:")
        print(">>> 1. Jika belum login, silakan login ke Akun Google Anda di jendela browser virtual yang terbuka.")
        print(">>> 2. Script ini akan otomatis mendeteksi ketika Anda sudah masuk ke Gemini.")
        print(">>> 3. Setelah login berhasil, cookie akan otomatis disedot dan disinkronkan ke gemini-web2api!")

        synced = False
        last_check = 0

        try:
            while True:
                time.sleep(2)
                # Cek URL dan cookie setiap beberapa detik
                cur_url = page.url
                if "gemini.google.com" in cur_url and not synced:
                    cookies = context.cookies(["https://gemini.google.com", "https://google.com"])
                    cookie_dict = {}
                    for c in cookies:
                        # Buang OSID konflik dari subdomain lain
                        if c["name"] in ("OSID", "__Secure-OSID"):
                            continue
                        cookie_dict[c["name"]] = c["value"]

                    if "__Secure-1PSID" in cookie_dict and "__Secure-1PSIDTS" in cookie_dict:
                        print(f"\n[+] Sesi login terdeteksi! Ditemukan {len(cookie_dict)} cookie.")
                        # Deteksi authuser
                        authuser = 0
                        if "/u/" in cur_url:
                            try:
                                authuser = int(cur_url.split("/u/")[1].split("/")[0])
                            except:
                                pass

                        cookie_str = "; ".join([f"{k}={v}" for k, v in cookie_dict.items()])
                        ok = post_to_web2api(cookie_str, authuser)
                        if ok:
                            synced = True
                            print("[*] Sinkronisasi selesai. Anda bisa menutup jendela browser virtual,")
                            print("[*] atau biarkan jendela ini tetap terbuka untuk auto-renewal.")
                            if headless:
                                break
                
                # Cek jika halaman ditutup oleh user
                if page.is_closed():
                    print("[*] Jendela virtual browser ditutup oleh pengguna.")
                    break
        except KeyboardInterrupt:
            print("\n[*] Script dihentikan.")
        finally:
            context.close()

if __name__ == "__main__":
    is_headless = "--headless" in sys.argv
    run_virtual_browser(headless=is_headless)
