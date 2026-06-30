# luci-app-ngfw-security — Application Guide
> Version 1.1.0 | OpenWRT 23.05.x x86_64 | UniGr8ways NGFW
> All six apps live under **Services** in the LuCI web interface.

---

## BSP Package Sources

### 1. Add the local feed to `feeds.conf`
```
src-link ngfw /path/to/NGFW_TEST/packages
```

### 2. Register + install
```bash
./scripts/feeds update ngfw
./scripts/feeds install luci-app-ngfw-security
```

### 3. Enable in `.config`
```
CONFIG_PACKAGE_luci-app-ngfw-security=y
```

### 4. Required dependency packages (add to image)
```
# .config additions
CONFIG_PACKAGE_luci-base=y
CONFIG_PACKAGE_python3=y
CONFIG_PACKAGE_jq=y
CONFIG_PACKAGE_freeradius3=y
CONFIG_PACKAGE_freeradius3-default=y

# Replace wpad with full version for 802.1x support
CONFIG_PACKAGE_wpad-openssl=y
# CONFIG_PACKAGE_wpad=n   <-- remove default wpad

# TOTP (proper implementation)
CONFIG_PACKAGE_oathtool=y

# LuCI SSO / OIDC (future)
CONFIG_PACKAGE_lua-cjson=y
CONFIG_PACKAGE_luasec=y

# SMS via 4G modem
CONFIG_PACKAGE_comgt=y

# Email (more reliable than curl SMTP)
CONFIG_PACKAGE_msmtp=y

# SSH brute-force protection
CONFIG_PACKAGE_fail2ban=y
```

### 5. Image Builder equivalent
```bash
make image PROFILE=x86_64 PACKAGES="\
  luci-app-ngfw-security \
  luci-base python3 jq \
  freeradius3 freeradius3-default \
  wpad-openssl -wpad \
  oathtool lua-cjson luasec \
  comgt msmtp fail2ban"
```

### 6. Or install directly on running router
```bash
opkg install luci-app-ngfw-security_1.1.0-1_all.ipk
```

---

---

# App 1 — SSL / TLS Inspection

**Menu path:** Services → SSL Inspection → Settings / Live Status
**Config:** UCI `squid.squid.gssldec` + `/etc/squid/ssl-common-whitelist.txt`
**Backend:** Squid 6.7 (ssl_bump) + `/usr/local/bin/SSLBUMPSTART`
**Certificate DB:** `/tmp/squid/ssldb/` (tmpfs — rebuilt on every boot by SSLBUMPSTART)
**CA cert:** `/etc/squid/ssl_cert/myCA.pem` (valid until 2035)

---

## How It Works

```
Client HTTPS request (port 443)
          │
          ▼
iptables PREROUTING REDIRECT  443 → 3129
          │
          ▼
Squid 6.7 — ssl_bump PEEK  (reads SNI from TLS ClientHello)
          │
          ▼
  ┌───────────────────────────────────────┐
  │  Is domain in ssl-common-whitelist?   │
  └──────────────┬────────────────────────┘
            YES  │                   NO  │
                 ▼                       ▼
          SPLICE (pass-through)    BUMP (decrypt)
          No content inspection    Squid presents
                                   forged cert signed
                                   by myCA
                                        │
                                        ▼
                                   Content forwarded to:
                                   e2guardian (URL/category filter)
                                        │
                                        ▼
                                   c-icap → ClamAV (AV scan)
                                        │
                                        ▼
                                   Response returned to client

HTTP traffic (port 80) also redirected:
  iptables 80 → 3128 → Squid transparent proxy → e2guardian → c-icap
```

### Certificate Chain

```
myCA (root CA baked into firmware)
  └── Dynamic leaf cert generated per domain on demand
        e.g. "*.google.com" — signed by myCA — presented to client
```

Clients must trust `myCA.pem` as a root CA. Without it, browsers show
"Your connection is not private" for every HTTPS site.

---

## What You Can Achieve

| Goal | How |
|------|-----|
| Inspect HTTPS content (URLs, payloads) | Enable SSL Inspection — traffic is decrypted inline |
| Block HTTPS sites by URL (not just SNI) | Combined with URL Filter (squid + e2guardian) |
| Scan HTTPS downloads for malware | ClamAV via c-icap runs on decrypted HTTPS responses |
| Bypass inspection for trusted domains | Add domain to bypass whitelist (e.g. `.microsoft.com`) |
| Bypass for banking / sensitive sites | Add to whitelist — traffic passes encrypted, uninspected |
| Download CA cert for client deployment | Settings page → Download myCA.pem |
| See which HTTPS sites are being accessed | Live Status → Recent HTTPS Connections log |
| Reinitialise cert DB after corruption | Settings → Re-initialize ssldb button |
| Check if iptables redirects are active | Live Status → iptables REDIRECT Rules section |

---

## Dependencies

| Dependency | Required | Notes |
|-----------|----------|-------|
| `squid` (v6.7) | Yes | Pre-installed — provides ssl_bump engine |
| `squid-mod-cachemgr` | Yes | Pre-installed |
| `openssl-util` | Yes | Pre-installed — cert generation + inspection |
| `c-icap` | Yes | Pre-installed — routes traffic to ClamAV |
| `clamav` + `freshclam` | Yes | Pre-installed — AV scanning of decrypted traffic |
| `e2guardian` | Yes | Pre-installed — URL/content filter on decrypted stream |
| `iptables` | Yes | Pre-installed — REDIRECT rules |
| `/tmp/squid/ssldb/` | Yes | Created at boot by SSLBUMPSTART — lives in tmpfs |
| CA cert (`myCA.pem`) | Yes | Already present at `/etc/squid/ssl_cert/myCA.pem` |
| Client trust of CA | Yes (clients) | Must install myCA.pem on every client device |

**No additional packages needed** — all dependencies are already in the firmware.

---

## Settings Page Features

| Control | What It Does |
|---------|-------------|
| Enable toggle | Sets `uci squid.squid.gssldec=1` and runs `SSLBUMPSTART` |
| Start button | Runs `/usr/local/bin/SSLBUMPSTART` (inits ssldb + iptables + starts Squid) |
| Reload Config button | Runs `squid -k reconfigure` — applies changes without dropping connections |
| Stop button | Runs `squid -k shutdown` — stops inspection, traffic no longer intercepted |
| Re-initialize ssldb | Wipes `/tmp/squid/ssldb/`, rebuilds it, restarts Squid — fixes cert DB corruption |
| Download CA cert | Serves `myCA.pem` for distribution to client devices |
| Bypass Whitelist | Load + edit `ssl-common-whitelist.txt` (139 entries pre-configured) |

---

## Live Status Page Features

| Card / Section | Shows |
|---------------|-------|
| Squid Status card | Running / Stopped + PID |
| SSL Cert DB card | Ready (ssldb exists) / Missing |
| Active HTTPS card | Current ESTABLISHED connections on port 3129 |
| Dynamic Certs card | Count of certs issued from ssldb index |
| Bypass Rules card | Number of domains in whitelist |
| iptables REDIRECT | 443→3129 and 80→3128 Active / Missing status |
| CA Certificate | Subject, expiry date, certs issued count |
| HTTPS access log | Last 10 CONNECT/TUNNEL entries from Squid access.log |

---

## Expected Behaviour

| Action | Expected Result |
|--------|----------------|
| Enable + Save | Squid starts, iptables REDIRECT added, ssldb initialised |
| Browser opens HTTPS site | Squid presents dynamic cert signed by myCA |
| Client trusts myCA | Page loads normally, traffic decrypted and scanned |
| Client does NOT trust myCA | Browser shows certificate warning — user must install CA |
| Domain in bypass whitelist | Traffic SPLICED — passes through uninspected |
| Disable + Save | Squid stops, iptables REDIRECT removed, HTTPS bypasses Squid |
| Squid crashes | ssldb in /tmp lost on reboot — SSLBUMPSTART rebuilds on next start |
| Reboot | SSLBUMPSTART runs at boot, rebuilds ssldb, restores iptables |
| Download CA cert | Browser downloads `myCA.pem` for manual client installation |
| Re-init ssldb | Old dynamic certs wiped, fresh DB created, Squid restarted |

## What Is NOT Supported

- **Certificate pinning bypass** — apps that use cert pinning (e.g. some banking apps, Google Chrome on mobile) will fail even with CA installed. Add those domains to the whitelist.
- **QUIC / HTTP3** — QUIC runs over UDP port 443, not TCP. Only TCP HTTPS is intercepted; QUIC traffic passes uninspected. Recommend blocking UDP 443 (`iptables -I FORWARD -p udp --dport 443 -j DROP`).
- **Mutual TLS (mTLS)** — client certificates cannot be proxied through Squid ssl_bump.
- **HPKP (HTTP Public Key Pinning)** — browsers that enforce HPKP will reject the dynamic cert.
- **Inbound HTTPS inspection** — only outbound client traffic is intercepted; inbound traffic to the router itself is not inspected.
- **CA cert auto-deployment** — clients must manually install myCA.pem. SCEP / MDM auto-deployment is not built in.
- **SSL inspection of SDWAN namespace traffic** — traffic within the SDWAN netns uses a separate path; only LAN-to-WAN traffic is intercepted.
- **TLS 1.3 0-RTT** — Squid may downgrade 0-RTT connections.

---

## Test Cases

| TC | Test | Steps | Expected |
|----|------|-------|----------|
| SSL-01 | Settings page loads | Navigate to Services → SSL Inspection → Settings | Page renders with current UCI state |
| SSL-02 | Enable SSL Inspection | Toggle ON, click Save | Squid starts, notification "SSL Inspection enabled" |
| SSL-03 | Disable SSL Inspection | Toggle OFF, click Save | Squid stops, notification "disabled" |
| SSL-04 | Start button | Click Start | SSLBUMPSTART runs, notification "Squid started" |
| SSL-05 | Stop button | Click Stop | Squid stopped, notification confirmed |
| SSL-06 | Reload Config | Click Reload Config | `squid -k reconfigure` runs, no connection drops |
| SSL-07 | Re-init ssldb | Click Re-initialize ssldb | ssldb wiped + rebuilt, Squid restarted |
| SSL-08 | Download CA cert | Click Download myCA.pem | Browser downloads the PEM file |
| SSL-09 | Load whitelist | Click Load Current Whitelist | Textarea populates with 139 entries |
| SSL-10 | Add to whitelist | Add `.newdomain.com`, Save | Domain added to ssl-common-whitelist.txt |
| SSL-11 | Remove from whitelist | Delete entry, Save | Domain removed, Squid reloaded |
| SSL-12 | Status page loads | Navigate to Live Status | 5 summary cards shown |
| SSL-13 | Squid running card | With Squid running | Card shows "Running" in green |
| SSL-14 | Squid stopped card | Stop Squid, reload page | Card shows "Stopped" in red |
| SSL-15 | ssldb card | ssldb present at /tmp/squid/ssldb | Card shows "Ready" |
| SSL-16 | ssldb missing card | Delete /tmp/squid/ssldb, reload page | Card shows "Missing" in red |
| SSL-17 | iptables redirect active | With SSLBUMPSTART run | Both 443→3129 and 80→3128 show "Active" |
| SSL-18 | iptables redirect missing | Flush nat table, reload page | Rules show "Missing" with warning |
| SSL-19 | HTTPS traffic intercepted | Enable, LAN client browses HTTPS | Squid cert presented (check browser padlock) |
| SSL-20 | CA trusted client | Install myCA.pem on client, browse | No browser warning, traffic decrypted |
| SSL-21 | CA untrusted client | Browse without installing CA | Browser shows certificate warning |
| SSL-22 | Whitelisted domain bypassed | Add domain to whitelist, browse to it | Server's real cert presented (not Squid cert) |
| SSL-23 | AV scan via ClamAV | Download EICAR test file over HTTPS | ClamAV blocks the download |
| SSL-24 | Access log entries | Browse HTTPS sites, check Live Status log | CONNECT entries appear for each domain |
| SSL-25 | Boot persistence | Reboot router | ssldb rebuilt and iptables restored by SSLBUMPSTART |

---

---

# App 2 — AD / LDAP Authentication

**Menu path:** Services → AD / LDAP Auth
**Config file:** `/appdata/FWCONFIG/LDAPConfig.json`
**Backend:** FreeRADIUS3 + `/usr/local/bin/APPLYLDAP`

---

## How It Works

```
LuCI Save button
      │
      ▼
LDAPConfig.json  ──►  APPLYLDAP script
                            │
                            ▼
              /etc/freeradius3/mods-enabled/ldap
              (FreeRADIUS LDAP module config)
                            │
                            ▼
              FreeRADIUS3 daemon (radiusd)
                            │
              ┌─────────────┼──────────────┐
              ▼             ▼              ▼
          Active       OpenLDAP      Generic LDAP
          Directory    server         server
          (port 389)   (port 389)    (any port)
```

The Lua CBI page reads the JSON config, renders it as an HTML form, and on Save:
1. Writes the updated JSON via Python3 (handles special characters safely)
2. Calls `APPLYLDAP` which rewrites `/etc/freeradius3/mods-enabled/ldap` with the new server/credentials
3. Sends `reload` to FreeRADIUS

---

## What You Can Achieve

| Goal | How |
|------|-----|
| Authenticate admins against Active Directory | Set Type=AD, point to domain controller IP, use sAMAccountName filter |
| Authenticate against OpenLDAP | Set Type=OpenLDAP, use uid filter |
| Restrict login to a specific AD group | Set Group Filter to the AD group DN |
| Allow all users in the directory | Leave Group Filter blank |
| Encrypted LDAP (LDAPS) | Enable TLS toggle, set port to 636 |
| Fallback to local password if AD is down | Local fallback is in FreeRADIUS config via `unix` module |

---

## Dependencies

| Dependency | Required | Notes |
|-----------|----------|-------|
| `freeradius3` | Yes | Core RADIUS/LDAP daemon |
| `freeradius3-default` | Yes | Includes default site config |
| `python3` | Yes | Used by save handler for JSON writing |
| `jq` | Yes | Used by APPLYLDAP to read JSON |
| AD/LDAP server | Yes (remote) | Must be reachable from router WAN/LAN |
| Lua controller (`ldap.lua`) | Yes | Registers menu entry |
| LuCI Lua runtime | Yes | Runs the Lua CBI page |

---

## Expected Behaviour

| Action | Expected Result |
|--------|----------------|
| Open page | Form loads with current `LDAPConfig.json` values |
| Save with Status=DISABLE | JSON saved, FreeRADIUS NOT reconfigured |
| Save with Status=ENABLE | JSON saved, FreeRADIUS LDAP module updated + reloaded |
| Test Connection button | TCP connect to Server:Port — shows Reachable / Timeout |
| Apply to FreeRADIUS button | Runs APPLYLDAP, log shown below form |
| FreeRADIUS not running | Apply will fail silently — log shows error |

## What Is NOT Supported

- Cannot authenticate SSH logins via LDAP (Dropbear has no PAM on this build)
- Cannot authenticate LuCI login via LDAP (LuCI uses local auth only)
- LDAP currently configures FreeRADIUS for **RADIUS clients** — direct LuCI/SSH LDAP auth needs additional integration work
- SAML / Kerberos / NTLM — not implemented
- LDAP over STARTTLS (only LDAPS on port 636 via TLS toggle)

---

## Test Cases

| TC | Test | Steps | Expected |
|----|------|-------|----------|
| LDAP-01 | Page loads | Navigate to Services → AD/LDAP Auth | Form renders, current config shown |
| LDAP-02 | Save disabled | Toggle OFF, click Save | JSON Status=DISABLE, no FreeRADIUS change |
| LDAP-03 | Save enabled | Fill server/port/credentials, toggle ON, Save | JSON saved, Apply log shows "LDAP config applied" |
| LDAP-04 | Test unreachable server | Enter wrong IP, click Test Connection | "Timeout connecting to x.x.x.x:389" shown |
| LDAP-05 | Test reachable server | Enter correct AD IP, click Test Connection | "TCP reachable on x.x.x.x:389" shown |
| LDAP-06 | Full bind test (ldapsearch) | With correct creds, click Test Connection | "TCP OK + LDAP bind successful" |
| LDAP-07 | Wrong password | Correct server, wrong bind password | "TCP OK but LDAP bind failed: Invalid credentials" |
| LDAP-08 | TLS toggle | Enable TLS, port 636, correct LDAPS server | "TCP reachable" without cert error |
| LDAP-09 | Group filter | Set group filter to non-existent group | FreeRADIUS rejects users not in group |
| LDAP-10 | Config persistence | Save, navigate away, return | All fields show saved values |

---

---

# App 3 — TACACS+ Authentication

**Menu path:** Services → TACACS+ Auth → Settings / Test & Status
**Config file:** `/appdata/FWCONFIG/TACACS.json`
**Backend:** `/usr/local/bin/TACAUTH` (Python, RFC 1492)

---

## How It Works

```
Admin login attempt (LuCI / API)
          │
          ▼
   /usr/local/bin/TACAUTH <username> <password>
          │
          ▼
   TCP connect to TACACS+ server port 49
          │
          ▼
   Build AUTHEN_START packet (RFC 1492)
   Encrypt body with shared secret (MD5 XOR)
          │
          ▼
   Server response:
   ┌────────────┬──────────────┬─────────────────────┐
   │   PASS     │    FAIL      │   TIMEOUT/ERROR     │
   │ Allow login│ Deny login   │ LocalFallback?       │
   └────────────┴──────────────┴──────────────────────┘
                                      │
                              ┌───────┴────────┐
                         ENABLE=yes        ENABLE=no
                              │                │
                         Check /etc/shadow   Deny
```

The Test & Status tab runs this flow live with credentials you enter, so you can verify the server responds correctly before enabling it.

---

## What You Can Achieve

| Goal | How |
|------|-----|
| Centralize admin authentication via Cisco ISE | Set Server to ISE IP, Key to shared secret |
| Use tac_plus / FreeRADIUS-TACACS as server | Same — just point to the server IP |
| Fall back to local password if TACACS+ is down | LocalFallback=ENABLE (default) |
| Enforce TACACS+ only (no fallback) | LocalFallback=DISABLE |
| Audit every admin login attempt | All results logged to `/var/log/BELRAS/tacacs.log` |
| Test server before enabling | Use Test & Status tab — run a live auth without enabling |

---

## Dependencies

| Dependency | Required | Notes |
|-----------|----------|-------|
| `python3` | Yes | TACAUTH is a Python script |
| TACACS+ server (remote) | Yes | Cisco ISE, tac_plus, or FreeRADIUS with TACACS |
| TCP port 49 open | Yes | Must be reachable from router |
| `/var/log/BELRAS/` dir | Yes | Created by package install |

---

## Expected Behaviour

| Action | Expected Result |
|--------|----------------|
| Save with Status=DISABLE | Config saved, TACAUTH never called for logins |
| Save with Status=ENABLE | Config saved — TACAUTH now used for authentication |
| Server unreachable | Returns FALLBACK → local /etc/shadow used (if LocalFallback=ENABLE) |
| Server reachable, correct creds | Returns PASS → login allowed |
| Server reachable, wrong creds | Returns FAIL → login denied |
| FallbackTimeout exceeded | Same as unreachable — FALLBACK returned |
| Test tab — TCP Ping | Shows TCP reachable / not reachable |
| Test tab — Auth Test | Shows PASS / FAIL / FALLBACK with live result |
| Log viewer | Shows last 30 auth events with timestamp and result |

## What Is NOT Supported

- TACACS+ authorization (privilege levels, command authorisation) — only authentication
- TACACS+ accounting — not implemented
- SSH-level TACACS+ (Dropbear has no plugin system) — auth at API/LuCI layer only
- Multiple TACACS+ servers / failover list — single server only
- TACACS+ version 2 (XAuth) — only ASCII password authentication

---

## Test Cases

| TC | Test | Steps | Expected |
|----|------|-------|----------|
| TAC-01 | Page loads | Navigate to Settings | Form loads with current config |
| TAC-02 | Save disabled | Status=DISABLE, Save | JSON saved, TACAUTH not invoked |
| TAC-03 | TCP Ping pass | Correct server IP/port, click Ping | "TCP reachable on x.x.x.x:49" |
| TAC-04 | TCP Ping fail | Wrong IP, click Ping | "Timeout connecting to x.x.x.x:49" |
| TAC-05 | Auth PASS | Correct user/pass, correct server, Run Test | Result shows PASS |
| TAC-06 | Auth FAIL | Correct server, wrong password | Result shows FAIL |
| TAC-07 | Auth FALLBACK | Server unreachable, LocalFallback=ENABLE | Result shows FALLBACK |
| TAC-08 | Auth FALLBACK blocked | Server unreachable, LocalFallback=DISABLE | Result shows FAIL |
| TAC-09 | Log populated | Run auth tests, view log | Last 30 events shown with outcome |
| TAC-10 | Log clear | Click Clear Log | Log section empties |
| TAC-11 | Config persist | Save server/port/key, navigate away, return | All values preserved |
| TAC-12 | Wrong shared key | Correct server IP, wrong key | FAIL (server rejects packet) |

---

---

# App 4 — 2FA / TOTP

**Menu path:** Services → 2FA / TOTP → Settings / Manage Users
**Config file:** `/appdata/FWCONFIG/2FA.json`
**Backend:** `/usr/local/bin/TOTP` (shell + openssl HMAC-SHA1)
**Secrets:** `/etc/totp_secrets/<username>` (base32, chmod 600)

---

## How It Works

```
TOTP Algorithm (RFC 6238):
  1. Read base32 secret from /etc/totp_secrets/<user>
  2. T = floor(current_unix_time / 30)         ← 30-second window
  3. HMAC = HMAC-SHA1(secret_bytes, T_as_8_bytes)
  4. offset = last nibble of HMAC
  5. code = (HMAC[offset..offset+4] & 0x7FFFFFFF) mod 1000000
  6. Zero-pad to 6 digits

Verification accepts T-1, T, T+1 (±30s clock tolerance)

Lockout: after MaxFailures wrong codes → write timestamp to
         /tmp/totp_lockout/<user> → all verifications return FAIL
         for LockoutSec seconds regardless of code
```

### Enrollment Flow
```
Admin clicks "Enroll & Generate Secret"
          │
          ▼
TOTP enroll <username>
  → generates 20 random bytes
  → base32-encodes them
  → saves to /etc/totp_secrets/<username>
  → prints: Secret: XXXXX...
             otpauth://totp/UniGr8ways:<user>?secret=XXX&issuer=UniGr8ways
          │
          ▼
UI shows secret + URI + QR code link
User scans into Google Authenticator / Authy / any RFC 6238 app
```

---

## What You Can Achieve

| Goal | How |
|------|-----|
| Enforce 2FA on LuCI web login | Settings → Enable, check LuCI plane |
| Enforce 2FA on REST API calls | Settings → Enable, check API plane |
| Enrol an admin | Manage Users → enter username → Enroll |
| Give user a QR code | After enrol, copy the otpauth:// URI or use QR link |
| Verify a code before going live | Manage Users → enter 6-digit code next to user → Verify |
| Revoke a user's 2FA | Manage Users → Revoke button (with confirm dialog) |
| Unlock a locked account | Manage Users → Unlock (appears when locked) or Unlock All |

---

## Dependencies

| Dependency | Required | Notes |
|-----------|----------|-------|
| `python3` | Yes | TOTP script uses Python for HMAC calculation |
| `openssl` | Yes | Fallback SHA1 HMAC if Python unavailable |
| `xxd` | Yes | Hex encoding in TOTP shell script |
| `oathtool` (recommended) | No | Cleaner implementation — add to BSP |
| `/etc/totp_secrets/` dir | Yes | Created by package install, chmod 700 |
| `/tmp/totp_lockout/` dir | Yes | Created at runtime by TOTP script |
| Authenticator app | Yes (user) | Google Authenticator, Authy, Microsoft Authenticator |

---

## Expected Behaviour

| Action | Expected Result |
|--------|----------------|
| Enable with no users enrolled | 2FA enabled but no one is blocked (no secret = no check) |
| Enrol user | Secret file created, URI and QR link displayed once |
| User enters correct code | TOTP verify returns PASS |
| User enters wrong code | TOTP verify returns FAIL, fail counter incremented |
| 5 wrong codes in a row | Account locked for LockoutSec (default 300s) |
| Locked account any code | FAIL immediately without checking code |
| Unlock account | Lockout file deleted, counter reset |
| Revoke user | Secret file deleted, user no longer challenged |
| Navigate away and return | Enrolled users listed in table |

## What Is NOT Supported

- HOTP (counter-based) — only TOTP (time-based)
- TOTP over SMS fallback — not built-in
- Backup codes — not implemented
- TOTP enforcement on SSH (Dropbear has no challenge-response by default)
- Per-user enable/disable — it's all-or-nothing per enforcement plane
- QR code rendered in-browser (requires external QR API or add `qrencode` to BSP)

---

## Test Cases

| TC | Test | Steps | Expected |
|----|------|-------|----------|
| TOTP-01 | Settings page | Open Settings | Status/planes/lockout policy shown |
| TOTP-02 | Enable saves | Toggle ON, save | 2FA.json Status=ENABLE |
| TOTP-03 | Enrol new user | Enter username, click Enroll | Secret + otpauth:// URI shown |
| TOTP-04 | Verify valid OTP | Open authenticator, enter 6-digit code, click Verify | "OTP valid for <user>" notification |
| TOTP-05 | Verify invalid OTP | Enter wrong code (e.g. 000000), click Verify | "OTP invalid for <user>" notification |
| TOTP-06 | Lockout triggers | Enter wrong code 5 times | User row shows LOCKED badge |
| TOTP-07 | Locked account verify | Enter correct code for locked user | Still fails (locked) |
| TOTP-08 | Unlock single user | Click Unlock on locked user | LOCKED badge disappears |
| TOTP-09 | Unlock all | Click Unlock All Accounts | All LOCKED badges cleared |
| TOTP-10 | Revoke user | Click Revoke, confirm | User disappears from table |
| TOTP-11 | QR link works | Click Generate QR Code link | New tab opens with QR image |
| TOTP-12 | Secret not re-shown | Enrol user, navigate away, return | Secret NOT shown again (security) |
| TOTP-13 | Clock drift tolerance | Enter code from 30s ago or 30s ahead | PASS (±1 window accepted) |
| TOTP-14 | Refresh user list | Click Refresh | Table reloads with current enrolled users |

---

---

# App 5 — FQDN Rules

**Menu path:** Services → FQDN Rules → Rules / Live Status
**Config file:** `/appdata/FWCONFIG/FQDNRules.json`
**Backend:** `/usr/local/bin/FQDNRULES`
**Cron:** Every 5 minutes

---

## How It Works

```
FQDNRules.json
  │  (list of rules: FQDN + action + chain)
  ▼
FQDNRULES script (runs every 5 min via cron)
  │
  For each rule:
  ├── 1. Resolve FQDN → IP list via DNS (dig/nslookup)
  ├── 2. Flush old IPs from ipset "fqdn_<domain>"
  ├── 3. Add fresh IPs with 360s timeout
  └── 4. Apply iptables rule matching ipset → DROP or ACCEPT
          │
          ▼
   iptables FORWARD chain
   Traffic to/from those IPs is blocked or allowed

ipset timeout: 360s → IPs auto-expire if FQDNRULES stops running
```

**Why ipset instead of direct iptables IP rules?**
A single domain (e.g. google.com) can resolve to 50+ IPs across CDN nodes. ipset handles thousands of IPs efficiently with O(1) lookup — direct iptables rules would be O(n).

---

## What You Can Achieve

| Goal | How |
|------|-----|
| Block traffic to a domain by name | Add rule: FQDN=bad-domain.com, Action=block, Chain=FORWARD |
| Always allow a trusted domain even if category-blocked | Add rule: Action=allow, place before block rules |
| Block domains that change IP frequently | Engine re-resolves every 5 minutes automatically |
| Block outbound C2 domains | Add known C2 FQDNs with Action=block |
| Emergency allow a domain | Add allow rule, click Run FQDNRULES Now |
| See which IPs a domain resolved to | Live Status tab → ipset column shows active/inactive |

---

## Dependencies

| Dependency | Required | Notes |
|-----------|----------|-------|
| `ipset` | Yes | Pre-installed on this router |
| `iptables` | Yes | Pre-installed |
| `dig` or `nslookup` | Yes | For DNS resolution — `bind-dig` or `busybox` |
| `jq` | Yes | Reading FQDNRules.json |
| Cron (`/etc/init.d/cron`) | Yes | Runs FQDNRULES every 5 min |
| Working DNS (`127.0.0.1`) | Yes | Router's dnsmasq must be running |

---

## Expected Behaviour

| Action | Expected Result |
|--------|----------------|
| Add a block rule, Save | Rule appears in table, JSON saved |
| Click Run FQDNRULES Now | DNS resolved, ipset populated, iptables rule added |
| Traffic to blocked domain | Packets dropped at FORWARD chain |
| DNS TTL expires | FQDNRULES cron re-resolves and refreshes ipset (every 5 min) |
| ipset times out (360s) | IPs auto-removed — FQDNRULES must keep running |
| Domain resolves to 0 IPs | Warning logged, no ipset entry, traffic NOT blocked |
| FQDNRULES stops running | ipset entries expire after 360s, rules become inactive |
| Live Status tab | Shows per-rule ipset status (Active / No ipset) |
| Delete a rule | Remove row, Save — rule no longer applied on next run |
| Disable engine | Status=DISABLE, Save — FQDNRULES exits immediately on cron |

## What Is NOT Supported

- Wildcard domains (`*.example.com`) — exact FQDN matching only
- IPv6 AAAA record resolution — only A records (IPv4)
- Domain aging / newly-registered domain detection — see F24 (not yet implemented)
- Real-time resolution (sub-5-minute) — cron minimum is 1 minute
- Blocking HTTPS SNI directly — this is IP-based; for SNI blocking use the HTTPSCATFILT module

---

## Test Cases

| TC | Test | Steps | Expected |
|----|------|-------|----------|
| FQDN-01 | Rules page loads | Open FQDN Rules → Rules | Current rules shown in table |
| FQDN-02 | Add rule | Click + Add FQDN Rule, fill FQDN + action | New row appears in table |
| FQDN-03 | Delete rule | Click trash icon on a rule | Row removed from table |
| FQDN-04 | Save | Click Save | FQDNRules.json updated, notification shown |
| FQDN-05 | Enable engine | Toggle ON, Save | Status=ENABLE in JSON |
| FQDN-06 | Run now | Click Run FQDNRULES Now | DNS resolves, notification "Rules applied" |
| FQDN-07 | Live Status | Open Live Status tab | Rule table shows ipset Active/No ipset |
| FQDN-08 | Block traffic | Add block rule for test domain, run now, curl from LAN client | Connection refused / timeout |
| FQDN-09 | Allow overrides block | Add allow rule before block for same domain | Traffic passes |
| FQDN-10 | iptables rules shown | Open Live Status, check iptables section | FQDN_ rules visible |
| FQDN-11 | Log entries | Open Live Status, check Resolution Log | Timestamps + resolved IPs shown |
| FQDN-12 | Domain unreachable | Add rule for non-existent domain (e.g. xxx.invalid) | "WARN no IPs resolved" in log, no ipset |
| FQDN-13 | Auto-refresh | Wait 5 minutes after adding rule | ipset refreshed (check via Status tab) |
| FQDN-14 | Disable engine | Toggle OFF, Save | FQDNRULES exits on next cron run, ipsets expire |
| FQDN-15 | Refresh button | Click Refresh on Status tab | Page reloads with current ipset state |

---

---

# App 6 — Alert Notifications

**Menu path:** Services → Alert Notifications → Overview / SMS / Email / WhatsApp
**Config files:** `/appdata/FWCONFIG/SMSAlert.json`, `EmailAlert.json`, `WhatsAppAlert.json`
**Backend:** `/usr/local/bin/SENDALERT` (dispatcher), `SENDSMS`, `SENDEMAIL`, `SENDWHATSAPP`

---

## How It Works

```
Any monitoring script detects an event:
  Linkcheck.sh → WAN_DOWN
  HAFUN4       → HA_FAILOVER
  UNIGR8WAYS_LIC → LICENSE_EXPIRY
  (user-defined) → any event name

          │
          ▼
   /usr/local/bin/SENDALERT <EVENT> <DETAIL>
          │
          ├──► SMS enabled?  → SENDSMS to each number
          │        │
          │        ▼
          │    AT+CMGS via /dev/ttyUSB4 (4G modem)
          │
          ├──► Email enabled? → SENDEMAIL to each recipient
          │        │
          │        ▼
          │    curl --url smtps://server:465 (SMTP)
          │
          └──► WhatsApp enabled? → SENDWHATSAPP to each recipient
                   │
                   ▼
               curl POST to graph.facebook.com/v18.0 (Meta API)

All three run in background (&) simultaneously — non-blocking
All events logged via syslog: logger -t SENDALERT
```

---

## What You Can Achieve

| Goal | How |
|------|-----|
| Get SMS when WAN goes down | SMS → Enable, add phone number, trigger=WAN_DOWN |
| Get email on IPS alert | Email → Enable, add recipient, trigger=IPS_ALERT |
| Get WhatsApp on HA failover | WhatsApp → Enable, add recipient, trigger=HA_FAILOVER |
| Alert on license expiry | Any channel → trigger=LICENSE_EXPIRY |
| Test all channels at once | Overview → Send Test to All Channels |
| Use different channels for different events | Configure triggers independently per channel |
| Broadcast to multiple contacts | Add multiple numbers/emails/recipients (one per line) |

---

## Channel Comparison

| Feature | SMS | Email | WhatsApp |
|---------|-----|-------|---------|
| Requires external account | No | Yes (SMTP) | Yes (Meta Business) |
| Works without internet | Yes (4G modem) | No | No |
| Cost | SIM data/SMS | Free (Gmail) | Free (Meta API) |
| Setup complexity | Low | Medium | High |
| Message length | ~160 chars | Unlimited | Unlimited |
| Delivery speed | Instant | 1–30s | 1–5s |
| Requires hardware | Yes (USB modem) | No | No |

---

## Dependencies

### SMS
| Dependency | Required | Notes |
|-----------|----------|-------|
| 4G USB modem | Yes | Must appear as `/dev/ttyUSBx` |
| SIM card with SMS | Yes | Active SIM with SMS capability |
| `comgt` or `at-cmd` | Recommended | Add to BSP for modem management |
| `stty` (busybox) | Yes | Serial port configuration |

### Email
| Dependency | Required | Notes |
|-----------|----------|-------|
| `curl` with SMTP support | Yes | Pre-installed |
| SMTP relay/server | Yes | Gmail, Outlook, or self-hosted |
| Port 465 open outbound | Yes | Or 587 for STARTTLS |
| Gmail: App Password | Yes | Not regular password — requires 2-step on Google account |

### WhatsApp
| Dependency | Required | Notes |
|-----------|----------|-------|
| `curl` | Yes | Pre-installed |
| Meta Business account | Yes | Free tier available |
| WhatsApp Business app | Yes | Linked to Meta Business |
| Access Token | Yes | Temporary (24h) or permanent System User token |
| Phone Number ID | Yes | From Meta Developer Console |
| Recipient opt-in | Yes | Recipient must message your WA number first |

---

## Expected Behaviour

| Action | Expected Result |
|--------|----------------|
| Open Overview | Status cards for each channel (green=enabled, grey=disabled) |
| Click channel card | Navigates to that channel's config page |
| Send Test (Overview) | All enabled channels receive "TEST_ALERT: Test message" |
| Save SMS config | SMSAlert.json updated |
| Send Test SMS | SMS dispatched via modem, confirmation shown |
| Modem not present | SENDSMS logs "Modem /dev/ttyUSB4 not found", exits 1 |
| Save Email config | EmailAlert.json updated |
| Send Test Email | Email sent via curl SMTP, confirmation shown |
| Wrong SMTP password | curl SMTP fails, error shown in notification |
| Save WhatsApp config | WhatsAppAlert.json updated |
| Send Test WhatsApp | curl POST to Meta API, success or error shown |
| Expired token | Meta API returns 401, error shown |
| Load Log (Overview) | Last 20 SENDALERT/SENDSMS/SENDEMAIL/SENDWHATSAPP syslog entries |
| WAN_DOWN event fires | All enabled channels receive WAN down message |

## What Is NOT Supported

- Telegram / Signal / other messaging platforms
- Incoming alerts (router cannot receive SMS and act on it)
- Alert throttling / deduplication (same event fires every time it occurs)
- Rich formatting in SMS (plain text only, 160 chars)
- WhatsApp template messages (only free-form text, subject to 24h session window)
- Email attachments or HTML email (plain text only)
- Scheduled alerts (time-based, not event-based)
- WhatsApp without opt-in from recipient (Meta requirement)

---

## Test Cases

| TC | Test | Steps | Expected |
|----|------|-------|----------|
| ALT-01 | Overview loads | Open Overview tab | 3 channel cards shown with status |
| ALT-02 | Card click | Click SMS card | Navigates to SMS config page |
| ALT-03 | Send test all | Overview → Send Test, all channels enabled | Each enabled channel receives message |
| ALT-04 | Send test all (none enabled) | All channels DISABLE, click Send Test | No messages sent (all disabled) |
| ALT-05 | Load log | Overview → Load Log | Syslog entries shown |
| SMS-01 | Save SMS config | Fill modem/numbers/triggers, Save | SMSAlert.json updated |
| SMS-02 | Send test SMS | Enter number, click Send Test SMS | SMS dispatched, notification OK |
| SMS-03 | No modem | Remove USB modem, send test | Error: modem not found |
| SMS-04 | Multiple numbers | Add 3 numbers, send test | All 3 numbers receive SMS |
| SMS-05 | Trigger fires | Simulate WAN down (bring eth0 down briefly) | SMS received within 30s |
| EML-01 | Save email config | Fill SMTP/credentials, Save | EmailAlert.json updated |
| EML-02 | Send test email | Enter recipient, click Send Test | Email received in inbox |
| EML-03 | Wrong SMTP pass | Incorrect password, send test | "535 Authentication failed" error |
| EML-04 | Multiple recipients | Add 3 emails, send test | All 3 receive email |
| WA-01 | Save WA config | Fill token/phoneID/recipients, Save | WhatsAppAlert.json updated |
| WA-02 | Send test WA | Enter recipient, click Send Test | WhatsApp message received |
| WA-03 | Expired token | Use expired EAA token, send test | "401 Unauthorized" error shown |
| WA-04 | No opt-in | Send to number that never messaged WA number | Meta returns error 131047 |
| WA-05 | Multiple recipients | Add 3 WA numbers, send test | All 3 receive message |

---

---

# Inter-App Dependencies and Interactions

```
SSL Inspection (Squid ssl_bump)
  └──► e2guardian (URL/content filter on decrypted traffic)
         └──► c-icap ──► ClamAV (AV scan on decrypted traffic)

┌─────────────────────────────────────────────────────┐
│                SENDALERT dispatcher                  │
│  Called by: Linkcheck.sh, HAFUN4, UNIGR8WAYS_LIC   │
└──────┬───────────────────┬──────────────────────────┘
       │                   │
       ▼                   ▼
  SENDSMS              SENDEMAIL / SENDWHATSAPP
  (SMS App)            (Alerts App)

 TACACS+ ──► FreeRADIUS3 ◄── LDAP App
             (same daemon)

  2FA TOTP ─── independent ─── no shared state

  FQDN Rules ─── ipset/iptables ─── independent
```

| If this app is disabled/broken | These apps are affected |
|-------------------------------|------------------------|
| Squid not running | SSL Inspection inactive — HTTPS bypasses uninspected |
| ssldb missing (/tmp wiped) | Squid cannot issue dynamic certs — SSLBUMPSTART rebuilds on next start |
| myCA not trusted on clients | Browser warnings on every HTTPS site — SSL Inspection still works server-side |
| iptables REDIRECT missing | HTTPS traffic bypasses Squid — run SSLBUMPSTART to restore |
| e2guardian / c-icap down | SSL Inspection still decrypts but URL/AV filtering disabled |
| FreeRADIUS3 not running | LDAP auth fails (TACACS+ unaffected) |
| No 4G modem | SMS channel fails (Email/WhatsApp unaffected) |
| dnsmasq not running | FQDN Rules cannot resolve domains |
| cron not running | FQDN Rules never refreshes (manually OK) |
| SENDALERT dispatcher fails | No alerts on any channel |
| 2FA enabled, user not enrolled | User is NOT blocked (no secret = no check) |

---

# Summary Quick Reference

| # | App | Menu | Config / Control | Key Script | Enable Flag |
|---|-----|------|-----------------|------------|-------------|
| 1 | SSL Inspection | Services → SSL Inspection | UCI `squid.squid.gssldec` + `ssl-common-whitelist.txt` | `SSLBUMPSTART` | UCI gssldec=1 |
| 2 | AD/LDAP | Services → AD/LDAP Auth | `LDAPConfig.json` | `APPLYLDAP` | Status=ENABLE |
| 3 | TACACS+ | Services → TACACS+ Auth | `TACACS.json` | `TACAUTH` | Status=ENABLE |
| 4 | 2FA TOTP | Services → 2FA/TOTP | `2FA.json` | `TOTP` | Status=ENABLE |
| 5 | FQDN Rules | Services → FQDN Rules | `FQDNRules.json` | `FQDNRULES` | Status=ENABLE |
| 6 | Alerts | Services → Alert Notifications | `SMSAlert.json` `EmailAlert.json` `WhatsAppAlert.json` | `SENDALERT` | Per-channel Status |

> **Orchestrator note:** All `/appdata/FWCONFIG/*.json` files are pushed and overwritten by the orchestrator on each sync. Local LuCI edits will be overridden on the next push unless the orchestrator config is also updated.
>
> **SSL exception:** SSL Inspection uses UCI (`uci set squid.squid.gssldec`) which is NOT managed by the orchestrator — LuCI changes persist permanently.

---

## Total Test Case Count

| App | Test Cases |
|-----|-----------|
| SSL Inspection | 25 |
| AD / LDAP | 10 |
| TACACS+ | 12 |
| 2FA TOTP | 14 |
| FQDN Rules | 15 |
| Alert Notifications | 21 |
| **Total** | **97** |
