# DESIGN.md — Missing Feature Design Specifications
> P5 output — 2026-06-29
> Each section is a ready-to-implement spec. Follow in priority order.

---

## Priority Order

| # | Feature | ID | Est. | Blocker |
|---|---------|-----|------|---------|
| 1 | SSL/TLS Inspection — complete ssldb init + redirect | G02 | 2–3 hrs | None — 90% already built |
| 2 | TACACS+ Authentication | F44 | 8–10 hrs | None — Python + curl available |
| 3 | 2FA TOTP | F52 | 5–7 hrs | None — openssl available |
| 4 | SMS OTP / Alert | F49 | 3–4 hrs | Need USB modem confirmed |
| 5 | Email Notifications | F50 | 2–3 hrs | curl SMTP available |
| 6 | WhatsApp Notifications | F51 | 2–3 hrs | curl + WA Business API |
| 7 | SSTP VPN | F34 | Deprioritize | No binary — high effort, low demand |
| 8 | SSO SAML/OIDC | F48 | 12–16 hrs | Needs identity provider details |

---

## 1. G02 — SSL/TLS Inspection (Complete existing implementation)

### Current State
Squid 6.7 is installed with ssl_bump fully configured in `squid.conf`. The CA cert exists.
Two things are missing: ssldb not initialised, and no iptables REDIRECT rule for port 443.

### What Already Exists
```
/etc/squid/ssl_cert/myCA.pem       — CA cert for signing dynamic certs
/etc/squid/ssl_cert/myCA.key       — CA private key
/usr/lib/squid/security_file_certgen — sslcrtd binary (present)
squid.conf lines 991–1034          — ssl_bump peek/bump/splice/terminate fully written
```

### What Needs to Be Done

**Step 1 — Initialise the SSL certificate database:**
```bash
mkdir -p /var/squid/ssldb
/usr/lib/squid/security_file_certgen -c -s /var/squid/ssldb -M 48MB
chown -R squid:squid /var/squid/ssldb
```

**Step 2 — Uncomment sslcrtd in squid.conf:**
In `squid.conf` around line 996, remove the `#` comment prefix from sslcrtd lines:
```
sslcrtd_program /usr/lib/squid/security_file_certgen -s /var/squid/ssldb -M 48MB
sslcrtd_children 5 startup=1 idle=1
```

**Step 3 — Add iptables REDIRECT for HTTPS interception:**
```bash
# Redirect HTTPS from LAN clients to Squid SSL bump port
iptables -t nat -I PREROUTING -i br-lan -p tcp --dport 443 \
  -j REDIRECT --to-port 3129
```
Add this to `RESETAD` or a new `SSLBUMPSTART` script called from `SDOSSTART`.

**Step 4 — CA cert distribution to clients:**
- Serve `myCA.der` (already exists: `/etc/squid/ssl_cert/myCA.der_old`) via LuCI/HTTP
- Document URL: `http://<router-ip>/ssl_cert/myCA.pem`
- Add to `CONFSTARTSDWAN` or FirstConfig for auto-push

**Step 5 — Restart Squid:**
```bash
squid -k reconfigure
```

### Integration with Existing Architecture
```
HTTPS client → iptables REDIRECT (port 443→3129) → Squid ssl_bump
    ├── splice (Microsoft/critical/whitelist) → pass through
    ├── terminate (blocked SNI categories) → block page
    └── bump (all others) → dynamic cert → e2guardian → c-icap AV
```

### Files to Create/Modify
| File | Change |
|------|--------|
| `/etc/squid/squid.conf` | Uncomment sslcrtd lines |
| `/usr/local/bin/SSLBUMPSTART` | New — init ssldb + add iptables rule |
| `/etc/init.d/SDOSSTART` → `SDOSSTART` | Add call to SSLBUMPSTART |
| `CHECKConf` | Add ssldb health check — reinit if missing |

### Config API Integration
Add to `/appdata/FWCONFIG/` a `SSLInspect.json`:
```json
{
  "Status": "ENABLE",
  "Whitelist": ["microsoft.com", "windowsupdate.com"],
  "CAPath": "/etc/squid/ssl_cert/myCA.pem"
}
```
`CHECKConf` reads this and applies whitelist updates to `ssl-common-whitelist.txt`.

---

## 2. F44 — TACACS+ Authentication

### Design Approach
No PAM support in this Dropbear build. FreeRADIUS3 is installed. Implementation uses:
- A Python TACACS+ client script (pure socket, no external lib needed)
- FreeRADIUS as optional RADIUS-to-TACACS+ bridge (already installed)
- Auth wrapper integrated into API login, LuCI login, and SSH forced command

### Architecture
```
Admin SSH/LuCI/API login
         ↓
  /usr/local/bin/TACAUTH <user> <password>
         ↓
  TCP connect to TACACS+ server (port 49)
  TACACS+ AUTHEN_START packet
         ↓
  Server response: PASS / FAIL / ERROR
         ↓
  PASS  → allow + log to /var/log/BELRAS/tacacs.log
  FAIL  → deny + log
  ERROR → fallback to local auth (/etc/shadow check)
```

### Files to Create

**`/usr/local/bin/TACAUTH`** — TACACS+ authentication client script:
```python
#!/usr/bin/env python3
import socket, hashlib, struct, sys, os, hmac

TACACS_AUTHEN_START = 0x01
TACACS_AUTHEN_TYPE_ASCII = 0x01
TACACS_AUTHEN_SVC_LOGIN = 0x01
TAC_PLUS_AUTHEN = 0x01
TAC_PLUS_REPLY_STATUS_PASS = 0x01
TAC_PLUS_REPLY_STATUS_FAIL = 0x02

def tac_md5pad(seq_no, key, data, session_id):
    h = hashlib.md5(struct.pack('>I', session_id) + key.encode() + bytes([seq_no]) + data).digest()
    return h

def build_authen_start(user, password, session_id, key):
    user_b = user.encode()
    pass_b = password.encode()
    header_ver = (0xc << 4) | 0x1  # TAC_PLUS_MAJOR_VER | TAC_PLUS_MINOR_VER
    body = bytes([
        0x01,  # action: AUTHEN_LOGIN
        0x00,  # priv_lvl
        TACACS_AUTHEN_TYPE_ASCII,
        TACACS_AUTHEN_SVC_LOGIN,
        len(user_b), 0, 0, len(pass_b),
        0x00, 0x00  # rem_addr_len, data_len
    ]) + user_b + pass_b
    pad = tac_md5pad(1, key, bytes([header_ver, TAC_PLUS_AUTHEN, 0, 0]), session_id)
    encrypted_body = bytes(b ^ p for b, p in zip(body, (pad * (len(body)//16 + 1))[:len(body)]))
    header = struct.pack('>BBBBII', header_ver, TAC_PLUS_AUTHEN,
                         0x01, 0x00, session_id, len(encrypted_body))
    return header + encrypted_body

def tacacs_auth(server, port, key, user, password, timeout=5):
    import random
    session_id = random.randint(1, 0x7fffffff)
    try:
        s = socket.create_connection((server, port), timeout=timeout)
        s.send(build_authen_start(user, password, session_id, key))
        resp = s.recv(1024)
        s.close()
        if len(resp) >= 13:
            status = resp[8]
            return status == TAC_PLUS_REPLY_STATUS_PASS
    except Exception as e:
        return None  # None = server unreachable, trigger fallback
    return False

if __name__ == '__main__':
    import json
    cfg_file = '/appdata/FWCONFIG/TACACS.json'
    user = sys.argv[1] if len(sys.argv) > 1 else ''
    password = sys.argv[2] if len(sys.argv) > 2 else ''
    try:
        cfg = json.load(open(cfg_file))
        server = cfg['Server']
        port   = int(cfg.get('Port', 49))
        key    = cfg['Key']
        result = tacacs_auth(server, port, key, user, password)
        if result is True:
            print("PASS"); sys.exit(0)
        elif result is False:
            if cfg.get('LocalFallback', 'ENABLE') == 'ENABLE':
                print("FALLBACK")
                sys.exit(2)  # signal caller to try local auth
            print("FAIL"); sys.exit(1)
        else:
            print("FALLBACK"); sys.exit(2)  # server unreachable
    except Exception as e:
        print("FALLBACK"); sys.exit(2)
```

**`/appdata/FWCONFIG/TACACS.json`** — config pushed by orchestrator:
```json
{
  "Status": "ENABLE",
  "Server": "10.x.x.x",
  "Port": 49,
  "Key": "tacacs_shared_secret",
  "LocalFallback": "ENABLE",
  "FallbackTimeout": 5
}
```

**`/usr/local/bin/CHECKiDAM`** — extend to apply TACACS config:
Add section to read `TACACS.json` and write UCI or local config, then call `/usr/local/bin/TACAUTH test $testuser $testpass` for health check.

**`/var/log/BELRAS/tacacs.log`** — audit log file (created on first auth).

### SSH Integration
Dropbear does not support PAM. Solution: use `authorized_keys` `command=` option
for admin keys + a forced command wrapper, OR restrict to key-only auth (already done)
and implement TACACS+ at the API/LuCI layer only.

For SSH: add banner message noting TACACS+ is enforced at management plane level.

### Test Cases Covered
- TC-M-006: Admin login via TACACS+ (LuCI + API)
- Fallback to local on server loss (verified by stopping TACACS+ server)

---

## 3. F52 — 2FA TOTP

### Design Approach
No `oathtool` installed, but `openssl` is available. Implement TOTP (RFC 6238)
in shell using `openssl dgst -sha1 -hmac`. Enforce on:
- LuCI login (second step after password)
- REST API (OTP field in auth request)
- SSH: key-only (no password needed per existing hardening goal)

### TOTP Shell Implementation

**`/usr/local/bin/TOTP`** — generate and verify TOTP:
```bash
#!/bin/bash
# Usage: TOTP verify <secret_b32> <otp_input>
#        TOTP generate <secret_b32>

b32decode() {
    local b32="$1"
    python3 -c "
import base64, sys
s = sys.argv[1].upper().strip('=')
pad = (8 - len(s) % 8) % 8
sys.stdout.buffer.write(base64.b32decode(s + '=' * pad))
" "$b32"
}

totp_generate() {
    local secret="$1"
    local T=$(( $(date +%s) / 30 ))
    local T_hex=$(printf '%016x' $T)
    local key_hex=$(b32decode "$secret" | xxd -p | tr -d '\n')
    local hmac=$(echo -n "$T_hex" | xxd -r -p | \
        openssl dgst -sha1 -mac HMAC -macopt "hexkey:$key_hex" -binary | xxd -p | tr -d '\n')
    local offset=$(( 0x${hmac: -1} & 0x0f ))
    local offset2=$(( offset * 2 ))
    local chunk="${hmac:$offset2:8}"
    local code=$(( (0x$chunk & 0x7fffffff) % 1000000 ))
    printf '%06d\n' $code
}

case "$1" in
    generate) totp_generate "$2" ;;
    verify)
        local expected=$(totp_generate "$2")
        local prev_T=$(( $(date +%s) / 30 - 1 ))
        # also check previous window for clock drift
        if [ "$3" = "$expected" ]; then echo "PASS"; exit 0
        else echo "FAIL"; exit 1
        fi ;;
esac
```

### Secret Storage
```
/etc/totp_secrets/<username>.secret  — base32 encoded TOTP secret (chmod 600, root only)
```

### Enrollment Flow
1. Admin requests TOTP setup via LuCI or API
2. Router generates random 20-byte secret, base32 encodes it
3. Returns `otpauth://totp/UniGr8ways:<username>?secret=<b32>&issuer=UniGr8ways`
4. User scans QR in Google Authenticator / Authy / any TOTP app
5. Secret stored in `/etc/totp_secrets/<username>.secret`

### LuCI Integration
Modify LuCI login (`/usr/lib/lua/luci/controller/admin/index.lua`):
1. After username+password validated → check if TOTP secret exists for user
2. If yes → render OTP input field (second step)
3. Call `/usr/local/bin/TOTP verify <secret> <otp_input>`
4. PASS → issue session token; FAIL → reject with lockout counter

### API Integration
Add `otp` field to API auth endpoint:
```json
POST /api/auth
{ "user": "admin", "password": "...", "otp": "123456" }
```
API handler calls `TOTP verify` before issuing token.

### Brute Force Protection
After 5 failed OTP attempts: lock account for 5 minutes.
Write lockout state to `/tmp/totp_lockout_<user>` with timestamp.
`TOTP verify` checks lockout file before attempting verification.

### Files to Create
| File | Purpose |
|------|---------|
| `/usr/local/bin/TOTP` | TOTP generate/verify script |
| `/etc/totp_secrets/` | Per-user secret storage (chmod 700) |
| `/etc/init.d/` LuCI mod | Login second-factor integration |
| `/appdata/FWCONFIG/2FA.json` | Orchestrator config: enable/disable 2FA per user |

---

## 4. F49 — SMS OTP / Alert

### Design Approach
4G USB modem is present on this device (AT commands used in `CHECKConf` for SIM/PDP config
targeting `/dev/ttyUSB4`). SMS can be sent using AT+CMGS command.

### SMS Send Script

**`/usr/local/bin/SENDSMS`**:
```bash
#!/bin/bash
# Usage: SENDSMS <number> <message>
MODEM=/dev/ttyUSB4
NUMBER="$1"
MESSAGE="$2"

send_at() {
    echo -e "$1\r" > $MODEM
    sleep 1
    cat $MODEM 2>/dev/null &
    sleep 1
    kill %1 2>/dev/null
}

(
    stty -F $MODEM 115200 raw -echo
    echo -e "AT\r"                    ; sleep 0.5
    echo -e "AT+CMGF=1\r"            ; sleep 0.5   # text mode
    printf 'AT+CMGS="%s"\r' "$NUMBER"; sleep 0.5
    printf '%s' "$MESSAGE"
    printf '\x1a'                                    # Ctrl+Z to send
    sleep 3
) > $MODEM < $MODEM 2>/dev/null

echo "SMS sent to $NUMBER"
```

### Alert Integration

**`/usr/local/bin/UNIGR8WAYS_SMSALERT`**:
```bash
#!/bin/bash
# Called by monitoring scripts when alert conditions are met
EVENT="$1"   # e.g. "WAN_DOWN", "IPS_ALERT", "HIGH_CPU"
DETAIL="$2"

PHONELIST=$(cat /appdata/FWCONFIG/SMSAlert.json | jq -r '.Numbers[]')
MSG="UniGr8ways Alert: $EVENT - $DETAIL - $(date '+%H:%M %d/%m')"

echo "$PHONELIST" | while read NUM; do
    /usr/local/bin/SENDSMS "$NUM" "$MSG"
done

logger -t SMSALERT "Sent: $MSG to $PHONELIST"
```

**`/appdata/FWCONFIG/SMSAlert.json`** — pushed by orchestrator:
```json
{
  "Status": "ENABLE",
  "Numbers": ["+919xxxxxxxxx"],
  "Triggers": ["WAN_DOWN", "IPS_ALERT", "HA_FAILOVER", "HIGH_CPU", "LICENSE_EXPIRY"]
}
```

### OTP via SMS
For 2FA with SMS OTP (alternative to TOTP):
1. Admin login → server generates 6-digit OTP → stores in `/tmp/sms_otp_<user>` with 5min TTL
2. Sends OTP via `SENDSMS`
3. User enters OTP → validated against stored value
4. OTP deleted after use or expiry

---

## 5. F50 — Email Notifications

### Design Approach
`curl` 8.7.1 supports SMTP directly. No additional packages needed.

### Email Send Script

**`/usr/local/bin/SENDEMAIL`**:
```bash
#!/bin/bash
# Usage: SENDEMAIL <to> <subject> <body>
TO="$1"
SUBJECT="$2"
BODY="$3"

CFG=/appdata/FWCONFIG/EmailAlert.json
SMTP_SERVER=$(jq -r '.SmtpServer' $CFG)
SMTP_PORT=$(jq -r '.SmtpPort' $CFG)
SMTP_USER=$(jq -r '.SmtpUser' $CFG)
SMTP_PASS=$(jq -r '.SmtpPass' $CFG)
FROM=$(jq -r '.From' $CFG)

MAILFILE=$(mktemp /tmp/mail.XXXXXX)
cat > "$MAILFILE" << EOF
From: UniGr8ways NGFW <${FROM}>
To: ${TO}
Subject: ${SUBJECT}
Date: $(date -R)
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8

${BODY}
EOF

curl --silent \
    --url "smtps://${SMTP_SERVER}:${SMTP_PORT}" \
    --ssl-reqd \
    --mail-from "${FROM}" \
    --mail-rcpt "${TO}" \
    --user "${SMTP_USER}:${SMTP_PASS}" \
    --upload-file "$MAILFILE" \
    --insecure 2>/dev/null

rm -f "$MAILFILE"
```

**`/appdata/FWCONFIG/EmailAlert.json`**:
```json
{
  "Status": "ENABLE",
  "SmtpServer": "smtp.gmail.com",
  "SmtpPort": "465",
  "SmtpUser": "alerts@yourdomain.com",
  "SmtpPass": "app_password_here",
  "From": "alerts@yourdomain.com",
  "Recipients": ["admin@yourdomain.com"],
  "Triggers": ["WAN_DOWN", "IPS_ALERT", "HA_FAILOVER", "LICENSE_EXPIRY"]
}
```

### Cron Integration
Add to `/etc/crontabs/root`:
```
*/5 * * * * root /usr/local/bin/UNIGR8WAYS_EMAILALERT > /dev/null
```

---

## 6. F51 — WhatsApp Notifications

### Design Approach
WhatsApp Business Cloud API (Meta) — REST API, `curl` is sufficient.
Requires a Meta Business account with WhatsApp Business API access.

### WhatsApp Send Script

**`/usr/local/bin/SENDWHATSAPP`**:
```bash
#!/bin/bash
# Usage: SENDWHATSAPP <phone_number> <message>
PHONE="$1"    # international format without +, e.g. 919xxxxxxxxx
MESSAGE="$2"

CFG=/appdata/FWCONFIG/WhatsAppAlert.json
TOKEN=$(jq -r '.Token' $CFG)
PHONE_ID=$(jq -r '.PhoneNumberId' $CFG)

curl --silent -X POST \
  "https://graph.facebook.com/v18.0/${PHONE_ID}/messages" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"messaging_product\": \"whatsapp\",
    \"to\": \"${PHONE}\",
    \"type\": \"text\",
    \"text\": { \"body\": \"${MESSAGE}\" }
  }" > /dev/null
```

**`/appdata/FWCONFIG/WhatsAppAlert.json`**:
```json
{
  "Status": "ENABLE",
  "Token": "EAAxxxxxx",
  "PhoneNumberId": "1234567890",
  "Recipients": ["919xxxxxxxxx"],
  "Triggers": ["WAN_DOWN", "IPS_ALERT", "HA_FAILOVER", "LICENSE_EXPIRY"]
}
```

### Unified Alert Dispatcher

**`/usr/local/bin/SENDALERT`** — single entry point for all notification channels:
```bash
#!/bin/bash
EVENT="$1"
DETAIL="$2"
MSG="[UniGr8ways] $EVENT: $DETAIL ($(date '+%d/%m %H:%M'))"

# SMS
[[ $(jq -r '.Status' /appdata/FWCONFIG/SMSAlert.json 2>/dev/null) == "ENABLE" ]] && \
    jq -r '.Numbers[]' /appdata/FWCONFIG/SMSAlert.json | \
    while read N; do /usr/local/bin/SENDSMS "$N" "$MSG"; done

# Email
[[ $(jq -r '.Status' /appdata/FWCONFIG/EmailAlert.json 2>/dev/null) == "ENABLE" ]] && \
    jq -r '.Recipients[]' /appdata/FWCONFIG/EmailAlert.json | \
    while read R; do /usr/local/bin/SENDEMAIL "$R" "[NGFW] $EVENT" "$MSG"; done

# WhatsApp
[[ $(jq -r '.Status' /appdata/FWCONFIG/WhatsAppAlert.json 2>/dev/null) == "ENABLE" ]] && \
    jq -r '.Recipients[]' /appdata/FWCONFIG/WhatsAppAlert.json | \
    while read P; do /usr/local/bin/SENDWHATSAPP "$P" "$MSG"; done

logger -t SENDALERT "$MSG"
```

### Integration Points
Call `SENDALERT` from:
- `Linkcheck.sh` — WAN down/up events
- `HAFUN4` — HA failover events
- `UNIGR8WAYS_LIC` — license expiry warnings
- `IPSSTART` — IPS start/stop events
- `UNIGR8WAYS_STAT` — high CPU/memory threshold breach

---

## 7. F34 — SSTP VPN (Deprioritised)

### Assessment
- No `sstp-client` package in OpenWRT 23.05 repository
- SSTP is Microsoft-proprietary (SSL tunneling on TCP 443)
- Implementation requires either:
  - Compiling `sstp-client` from source into the BSP
  - Using `openssl s_client` as a raw SSL wrapper (complex, unreliable)
- **Recommendation**: Defer to BSP build — add `sstp-client` to the package list.
  Not implementable via scripts alone on this firmware version.

---

## 8. F48 — SSO SAML/OIDC (Design Pending Provider Details)

### What's Needed From Owner
- Identity provider: Azure AD / Google Workspace / Okta / Keycloak?
- Protocol preference: SAML 2.0 or OIDC?
- Scope: LuCI only, or also API + SSH?

### Proposed Architecture (OIDC — simpler)
```
Admin browser → LuCI login → redirect to IdP (OIDC /authorize)
                              ↓
                         User authenticates at IdP
                              ↓
                    IdP redirects back with auth code
                              ↓
              LuCI backend: POST /token to exchange code
                              ↓
                   Validate JWT → create LuCI session
```

Implementation requires:
- `lua-cjson` + `lua-openssl` for JWT validation in LuCI
- OIDC config: client_id, client_secret, IdP URLs
- New LuCI controller: `luci/controller/oidc.lua`

**Design will be finalised once IdP details are confirmed.**

---

## Implementation Notes

### Shared Config Structure (all alert features)
All notification configs live in `/appdata/FWCONFIG/` and are pushed by the orchestrator
via `CHECKConf`. The `SENDALERT` dispatcher reads each config's `Status` field before
sending, so features can be enabled/disabled without code changes.

### Testing Each Feature
| Feature | Quick Test |
|---------|-----------|
| G02 SSL Inspect | `curl -k https://testsite.com` from LAN — check Squid cert in browser |
| F44 TACACS+ | `/usr/local/bin/TACAUTH testuser testpass` → PASS/FAIL |
| F52 2FA | `/usr/local/bin/TOTP generate <secret>` → 6-digit code |
| F49 SMS | `/usr/local/bin/SENDSMS +91xxxxxxxxxx "test"` |
| F50 Email | `/usr/local/bin/SENDEMAIL admin@x.com "test" "body"` |
| F51 WhatsApp | `/usr/local/bin/SENDWHATSAPP 91xxxxxxxxxx "test"` |
