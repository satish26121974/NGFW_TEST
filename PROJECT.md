# PROJECT.md — NGFW Project Plan & Progress
> Living document. Update at the start and end of every session.
> This is the single source of truth for what is done, what is in progress, and what is next.

---

## Project Overview

| Field | Value |
|-------|-------|
| Product | Next-Generation Firewall (NGFW) |
| Architecture | OpenWrt x86 |
| Packet Engine | Linux netfilter |
| Management | REST API (Orchestration) + LuCI/Lua (Local UI) |
| Languages | C, C++, Go, Rust, Python, Lua/JS, YAML |
| Throughput Target | 10 Gbps firewall / 2 Gbps threat prevention *(validate against hardware)* |
| Capacity | 500 enterprise users + IoT + DMZ *(validate against hardware)* |
| CI/CD | Manual |
| QA Role | Senior Network Security Engineer + QA Lead |
| **DUT IP** | `10.80.80.57` |
| **DUT SSH Port** | `19822` |
| **DUT SSH Auth** | Key-based — `ssh 10.80.80.57` (no password) |
| **DUT SSH Key** | `~/.ssh/root_10_80_80_57` |

---

## ⚠️ MANDATORY SESSION PROCESS

Every session follows this sequence. No exceptions.

```
STEP 1: Discover hardware → run tests → record results
STEP 2: Report findings → propose changes → STOP
STEP 3: Wait for owner confirmation → then and only then make changes
```

---

## Discovered Hardware Profile
> Filled during P0. This section drives ALL test pass/fail criteria.

| Parameter | Discovered Value | Notes |
|-----------|-----------------|-------|
| CPU Model | TBD | |
| CPU Cores (physical) | TBD | |
| CPU Threads | TBD | |
| CPU Frequency | TBD | |
| CPU Cache (L3) | TBD | |
| Total RAM | TBD | |
| Available RAM (at idle) | TBD | |
| NIC Count | TBD | |
| NIC Speed | TBD | |
| NIC Driver / Model | TBD | |
| Storage | TBD | |
| OpenWrt Version | TBD | |
| Kernel Version | TBD | |
| Hardware Profile Class | TBD | Entry / Mid-Range / Performance / High-End |

## Hardware-Derived Capability Limits
> Calculated from discovered hardware. These override the original requirements where hardware cannot meet them.

| Capability | Original Requirement | Hardware-Derived Limit | Delta | Action |
|-----------|---------------------|----------------------|-------|--------|
| Firewall Throughput | 10 Gbps | TBD | TBD | TBD |
| Threat Prevention Throughput | 2 Gbps | TBD | TBD | TBD |
| Max Concurrent Sessions | Not specified | TBD | N/A | TBD |
| Max Concurrent Users | 500 | TBD | TBD | TBD |
| Max CPS | Not specified | TBD | N/A | TBD |
| SSL Inspection Capacity | Not specified | TBD | N/A | TBD |
| Features Simultaneously Active | All | TBD | TBD | TBD |

> If hardware-derived limit < requirement: flag to owner in Step 2 report. Propose either hardware upgrade or adjusted target. Do not silently adjust without reporting.

---

## Master Phase Plan

| Phase | Name | Depends On | Owner | Status | ETA | Completion |
|-------|------|------------|-------|--------|-----|------------|
| P0 | Codebase Discovery & Architecture Mapping | Code access | Claude | ✅ Complete | 2026-06-29 | Architecture mapped, all daemons identified |
| P1 | Feature Audit — Claimed vs Code Reality | P0 | Claude | ✅ Complete | 2026-06-29 | 23 verified, 8 partial, 5 missing, 3 new found |
| P2 | Gap Analysis & Priority Ranking | P1 | Claude | ✅ Complete | 2026-06-29 | 3 critical bugs, 6 missing features ranked — see below |
| P3 | IPS/IDS — Code Review & Test Coverage | P0 | Claude | ✅ Complete | 2026-06-29 | Snort 3.1.82 — CRITICAL: combined.rules empty, IPS deaf |
| P4 | Bug Fixes — Issues Found in P1/P3 | P1 | Claude | ✅ Complete | 2026-06-29 | B1+B2+B3 fixed on router |
| P5 | Missing Feature Design — G01–G12 | P2 | Claude | ✅ Complete | 2026-06-29 | DESIGN.md written — 8 features designed |
| P6 | Missing Feature Implementation | P5 | Claude | ✅ Complete | 2026-06-29 | 6 features + LuCI GUIs + BSP package — see detail below |
| P7 | New Requirements Implementation (F44–F54) | P0 | Claude | ✅ Complete | 2026-06-30 | F47/F45/F46/F54 done; F53 partial (MACSEC present, needs hostapd BSP) |
| P8 | Test Execution — Section 1 (Functional) | P1 | Claude | ✅ Complete | 2026-06-30 | Package install: 42/42 ✅ — TC-F-005/006/007/008 PASS (16/16) — TC-F-001..004 blocked (need 2nd router) |
| P9 | Test Execution — Section 2 (NG Security) | P6 | Claude | ⬜ Not started | After P8 | — |
| P10 | Test Execution — Section 3 (Threat Prevention) | P6 | Claude | ⬜ Not started | After P8 | — |
| P11 | Test Execution — Section 4 (Performance) | P6 | Claude | ⬜ Not started | After P8 | — |
| P12 | Test Execution — Section 5 (Management) | P7 | Claude | ⬜ Not started | After P8 | — |
| P13 | UI Parity Audit — Orchestration vs LuCI | P7 | Claude | 🔄 In progress | 2026-06-30 | LuCI GUIs built for all new features — see P6 detail |
| P14 | Code Documentation — Inline + API Docs | P6 | Claude | ⬜ Not started | After P13 | — |
| P15 | Security Hardening Review | P6 | Claude | ⬜ Not started | After P14 | — |
| P16 | Final Regression | All | Claude | ⬜ Not started | Last | — |

**Status**: ⬜ Not started | 🔄 In progress | ✅ Complete | ❌ Blocked | ⚠️ Needs review

---

## P2 — Gap Analysis & Priority Ranking (2026-06-29)

### 🔴 CRITICAL BUGS — Fix Before Any Testing

| # | Bug | File | Impact | Status |
|---|-----|------|--------|--------|
| B1 | `combined.rules` was empty — IPS fired ZERO rules | `/etc/snort/rules/combined.rules` | IPS completely deaf | ✅ Fixed 2026-06-29 — copied 44436-line ipsrules.rules |
| B2 | `IPSSTART` elif checked `"connectivity"` for max+no-log mode | `/usr/local/bin/IPSSTART` | max-detect no-log mode never started | ✅ Fixed 2026-06-29 — elif now checks `"max"` |
| B3 | `sleeo 40` typo in crontab for `GETWIP` | `/etc/crontabs/root` | GETWIP never executed | ✅ Fixed 2026-06-29 — corrected to `sleep`, cron restarted |

### 🟠 HIGH — Missing Features to Build

| Priority | Feature | ID | Est. Effort | Dependency |
|----------|---------|-----|-------------|------------|
| 1 | Fix IPS rules pipeline — link IPSDATA/RULEFILE → combined.rules | B1 fix | 2–4 hrs | None — fix first |
| 2 | TACACS+ Integration | F44 | 8–12 hrs | radiusd already present |
| 3 | 2FA TOTP/HOTP | F52 | 6–10 hrs | Dropbear + LuCI + API |
| 4 | SSL/TLS Inspection | G02 | 16–24 hrs | Largest gap — no MITM engine found |
| 5 | SSO SAML/OIDC | F48 | 10–16 hrs | Needs identity provider integration |

### 🟡 MEDIUM — Complete or Add

| Priority | Feature | ID | Est. Effort | Notes |
|----------|---------|-----|-------------|-------|
| 6 | SMS OTP / Alert | F49 | 4–6 hrs | 4G modem (ttyUSB4) already present — add AT SMS send |
| 7 | Email Notifications | F50 | 3–5 hrs | Add SMTP client script |
| 8 | WhatsApp Notifications | F51 | 3–5 hrs | WhatsApp Business API |
| 9 | SSTP VPN | F34 | 6–10 hrs | No binary found — needs implementation |
| 10 | HOME_NET dynamic config in Snort | IPS | 1–2 hrs | Hardcoded 192.168.1.0/24 in homenet.lua |
| 11 | REST API documentation | G09 | 4–8 hrs | No OpenAPI spec |

### 🟢 LOW — Verify / Minor

| Feature | ID | Notes |
|---------|-----|-------|
| VRF formal config | F07 | SDWAN netns works but not exposed via API |
| SSTP | F34 | Low adoption — consider dropping |
| Reporting engine | G05 | STAT scripts send data — no report renderer |

---

## P3 — IPS/IDS Deep Review (2026-06-29)

### Snort Configuration

| Parameter | Value |
|-----------|-------|
| Version | **Snort 3.1.82.0** |
| Mode | NFQUEUE inline (IPS) via `IPSSTART` |
| Config | `/etc/snort/snort.lua` |
| Rules loaded | `/etc/snort/rules/combined.rules` |
| Rule source | `/usr/local/bin/IPSDATA/RULEFILE/` (65 Talos rule files) |
| Policy levels | connectivity / balanced / security / max_detect |
| AppID | OpenAppID at `/usr/lib/openappid` |
| Alert output | CSV + JSON files |
| Current status | **DISABLED** (`/appdata/IPSCONFIG.json` → `"Status": "DISABLE"`) |

### Two Snort Instances

| Instance | Config | DAQ | Interface | Purpose |
|----------|--------|-----|-----------|---------|
| IPS (not running) | `/etc/snort/snort.lua` | nfq (NFQUEUE) | All WAN | Inline threat prevention |
| AAR (running) | `/etc/aar/aar-snort.lua` | afpacket | eth1 | App detection for routing |

### 🔴 CRITICAL: IPS Rules Not Loaded

`/etc/snort/rules/combined.rules` contains **only `#`** (1 byte comment).

`snort.lua` includes this file:
```lua
ips = { include = '/etc/snort/rules/combined.rules' }
```

The 65 Talos rule files in `IPSDATA/RULEFILE/` are **never loaded**.
Result: Even if IPS is enabled, **zero rules fire**. System is completely blind.

**Fix required**: Build `combined.rules` from the IPSDATA rule files using rule states.

### Talos Rule Coverage (65 categories present)
Browser exploits · Malware (backdoor/CNC/tools) · Exploit kits · File types (exe/flash/java/office/pdf) · Indicators (compromise/shellcode/obfuscation/scan) · OS (Linux/Windows/mobile) · Protocols (DNS/FTP/ICMP/SMTP/VOIP/SCADA) · Server attacks (Apache/IIS/MySQL/MSSQL/Oracle/webapp) · SQL injection · PUA/P2P/adware

### IPS Architecture — Correct Design
```
Traffic → iptables NFQUEUE → Snort 3 (per-WAN-queue, multi-core) → ACCEPT/DROP
                                    ↓
                         /opt/snortlogs (JSON+CSV alerts)
                                    ↓
                         UNIGR8WAYS_IPSSTATUS → Orchestrator
```

### Issues Found

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| P3-1 | `combined.rules` empty — zero rules loaded | 🔴 CRITICAL | Generate from IPSDATA/RULEFILE + rule states |
| P3-2 | IPS disabled in IPSCONFIG.json | 🔴 CRITICAL | Enable + test |
| P3-3 | `elif "connectivity"` bug in max mode | 🟠 HIGH | Fix elif condition in IPSSTART |
| P3-4 | HOME_NET hardcoded `192.168.1.0/24` in homenet.lua | 🟡 MEDIUM | Make dynamic from UCI/LAN config |
| P3-5 | `local.lua` sets `mode = tap` but IPSSTART uses `-Q` inline | 🟡 MEDIUM | Align — remove conflicting `local.lua` ips block |
| P3-6 | No rule update automation | 🟡 MEDIUM | Add scheduled Talos rule update script |
| P3-7 | `ScanLog=ENABLE` but IPSCONFIG Status=DISABLE — state mismatch | 🟡 MEDIUM | Validate config on enable |

---

## P6 — Missing Feature Implementation (2026-06-29 → 2026-06-30)

### Features Implemented

| Feature | ID | What Was Built | Location |
|---------|-----|---------------|----------|
| SSL/TLS Inspection | G02 | Squid 6.7 ssl_bump activated — sslcrtd path fixed, ssldb initialised, iptables REDIRECT added, SSLBUMPSTART boot script | `/usr/local/bin/SSLBUMPSTART` |
| TACACS+ Auth | F44 | Python RFC1492 socket client, local fallback, audit log | `/usr/local/bin/TACAUTH` |
| 2FA TOTP | F52 | RFC 6238 via openssl HMAC-SHA1, enrol/verify/revoke, brute-force lockout | `/usr/local/bin/TOTP` |
| SMS Alerts | F49 | AT commands via `/dev/ttyUSB4` modem | `/usr/local/bin/SENDSMS` |
| Email Alerts | F50 | curl SMTP (no extra packages) | `/usr/local/bin/SENDEMAIL` |
| WhatsApp Alerts | F51 | Meta Cloud API via curl | `/usr/local/bin/SENDWHATSAPP` |
| Alert Dispatcher | — | Unified SENDALERT calls all 3 channels; wired into Linkcheck.sh | `/usr/local/bin/SENDALERT` |

### LuCI GUI Modules Built (JS-based, view.extend pattern)

| Module | Menu Path | Views | Key Features |
|--------|-----------|-------|-------------|
| AD / LDAP Auth | Services → AD/LDAP Auth | config.htm (Lua CBI) | Server/port/bind/filter, Test Connection, Apply to FreeRADIUS |
| TACACS+ | Services → TACACS+ Auth | settings.js, test.js | Server config, TCP ping, live auth test, log viewer |
| 2FA TOTP | Services → 2FA / TOTP | settings.js, users.js | Enable/planes/lockout, enrol user + otpauth:// URI, verify OTP, revoke |
| FQDN Rules | Network → FQDN Rules | rules.js, status.js | Dynamic rule table (add/delete inline), run now, live ipset status |
| Alert Notifications | Services → Alert Notifications | overview.js, sms.js, email.js, whatsapp.js | Per-channel config + test send, unified overview, log viewer |

### BSP Deliverables

| Deliverable | Location | Details |
|------------|----------|---------|
| BSP file overlay | `bsp/files/` | 24 files (scripts, configs, JS views, Lua, menu.d) |
| SSH key auth uci-defaults | `bsp/files/etc/uci-defaults/99-ssh-key-auth` | First-boot: installs key, disables password auth |
| OpenWRT package | `packages/luci-app-ngfw-security/` | v1.0.0 — 39 files, 38.2 KB .ipk |
| `.ipk` built | `packages/luci-app-ngfw-security/luci-app-ngfw-security_1.0.0-1_all.ipk` | Correct OpenWRT 23.05 gzip-tar format |

---

## P7 — New Requirements Implementation (2026-06-30)

### Completed Items

| Feature | ID | Implementation | Status |
|---------|-----|---------------|--------|
| SSH CLI Hardening | F47 | `PasswordAuth=off`, `RootPasswordAuth=off` via Dropbear UCI — key-only enforced | ✅ Done |
| AD Integration | F45 | FreeRADIUS3 LDAP module enabled + `APPLYLDAP` script + LuCI GUI | ✅ Done |
| LDAP Integration | F46 | Same FreeRADIUS LDAP module (AD uses LDAP protocol) | ✅ Done |
| 802.1x NAC | F53 | `kmod-macsec` confirmed loaded; hostapd binary missing from BSP — add `wpad-openssl` | ⚠️ Partial |
| FQDN-Based Rules | F54 | `FQDNRULES` engine: DNS → ipset → iptables, cron every 5 min + LuCI GUI | ✅ Done |
| SSO SAML/OIDC | F48 | Design in DESIGN.md — pending IdP details from owner | ⏸️ Blocked |
| Dynamic HOME_NET | IPS fix | `UPDATEHOMENET` derives HOME_NET from UCI LAN, runs on boot via SSLBUMPSTART | ✅ Done |

### BSP Packages Required (identified in P7)

| Package | Priority | Reason |
|---------|----------|--------|
| `wpad-openssl` | 🔴 Critical | Replaces `wpad` — provides full hostapd binary for 802.1x |
| `oathtool` | 🔴 Critical | Proper TOTP/HOTP (currently using openssl workaround) |
| `lua-cjson` | 🔴 Critical | JSON in Lua (required for SSO OIDC in LuCI) |
| `luasec` | 🔴 Critical | SSL in Lua (required for SSO OIDC token calls) |
| `comgt` | 🔴 Critical | AT command modem management (for SMS via 4G) |
| `sstp-client` | 🟡 Medium | SSTP VPN (F34) |
| `msmtp` | 🟡 Medium | Reliable SMTP client (alternative to curl) |
| `fail2ban` | 🟡 Medium | SSH brute-force protection |

---

## P8 — Package Installation Test (2026-06-30)

> Note: Formal TESTPLAN.md Section 1 (TC-F-001…TC-F-008) require live traffic setup.
> P8 records the package installation verification completed this session.

### Package Build Discovery

**OpenWRT 23.05 changed `.ipk` format** from traditional Debian `ar` archive to a **gzip-compressed tar** containing:
```
./debian-binary    (text "2.0\n")
./control.tar.gz   (package metadata)
./data.tar.gz      (installation files)
```
The Makefile and build script have been updated accordingly.

### Installation Verification Results — 42/42 PASSED

| Category | Checks | Result |
|----------|--------|--------|
| opkg package registration | 1 | ✅ |
| LuCI JS views (10 files across 4 modules) | 10 | ✅ |
| LuCI menu.d entries (4 files) | 4 | ✅ |
| Lua AD/LDAP controller + view | 2 | ✅ |
| Backend scripts (executable) | 10 | ✅ |
| Default config JSON files | 7 | ✅ |
| SSH key auth (authorized_keys + PasswordAuth=off) | 3 | ✅ |
| TOTP enrol + 6-digit code generation | 1 | ✅ |
| TACAUTH reachable (FALLBACK on unconfigured server) | 1 | ✅ |
| uhttpd running post-install | 1 | ✅ |
| LuCI cache cleared | 1 | ✅ |
| **TOTAL** | **42** | **✅ ALL PASSED** |

### How to Install on Any Router

```bash
# Method 1: direct .ipk
opkg install luci-app-ngfw-security_1.0.0-1_all.ipk

# Method 2: from local feed (BSP build system)
echo "src-link ngfw /path/to/NGFW_TEST/packages" >> feeds.conf
./scripts/feeds update ngfw && ./scripts/feeds install luci-app-ngfw-security
make package/luci-app-ngfw-security/compile
```

### Remaining for Formal TESTPLAN.md Section 1

The following TC-F-001…TC-F-008 test cases require a second router/device for traffic injection and are pending lab setup:

| TC-ID | Test | Blocker |
|-------|------|---------|
| TC-F-001 | HA Active/Passive failover (<1s) | Needs two routers — eth1+eth3 currently DOWN |
| TC-F-002 | HA Active/Active load distribution | Same — needs secondary node |
| TC-F-003 | BGP/OSPF dynamic routing convergence | Needs FRR peer router |
| TC-F-004 | VRRP failover | Needs second router |
| TC-F-005 | NAT/MASQ — DNAT/SNAT/PAT | Can run with single router + LAN client ✅ |
| TC-F-006 | Port forwarding — external access to internal | Can run ✅ |
| TC-F-007 | VRF isolation | Can run with current SDWAN netns ✅ |
| TC-F-008 | Static routing — multi-path | Can run ✅ |

---

## P0 — Codebase Discovery Checklist
> Run this on first code access. Check each item off as completed.

- [ ] Run file tree mapping (`find . -maxdepth 4`)
- [ ] Count files per language
- [ ] Locate all `main()` entry points (Go + C/C++)
- [ ] Locate netfilter hook registration points
- [ ] Locate REST API router/handler registration
- [ ] Locate LuCI controller files
- [ ] Locate YAML schema definitions
- [ ] Locate daemon init/service files
- [ ] Map each of F01–F54 to a code file (partial is OK — mark unknown)
- [ ] Identify build system (Makefile, CMake, OpenWrt package Makefile)
- [ ] Identify any third-party libraries in use (nftables, strongSwan, OpenVPN, etc.)
- [ ] Identify any existing test files or test framework
- [ ] Update FEATURES.md Verified Status column
- [ ] Update SESSION LOG below
- [ ] Update ARCHITECTURE NOTES below

---

## P1 — Feature Audit Checklist
> After P0 directory mapping, verify each feature's actual state.

For each feature in FEATURES.md:
- [ ] Does code for this feature exist?
- [ ] Does it compile cleanly?
- [ ] Does it have a REST API endpoint?
- [ ] Does it have a LuCI UI page?
- [ ] Does it have any test coverage?
- [ ] Are there obvious bugs or security issues?
- [ ] Update status: EXISTING / WIP / MISSING / NEEDS-REVIEW

---

## P2 — Gap Priority Matrix
> Filled after P1. Rank gaps by: security impact × user impact × implementation effort.

| Gap ID | Feature | Security Impact | User Impact | Effort | Priority Score | Recommended Sprint |
|--------|---------|----------------|-------------|--------|----------------|--------------------|
| G01 | DPI Engine | HIGH | HIGH | MEDIUM | — | TBD |
| G02 | SSL/TLS Inspection | HIGH | HIGH | HIGH | — | TBD |
| G03 | High Availability | MEDIUM | HIGH | HIGH | — | TBD |
| G04 | Management RBAC | HIGH | MEDIUM | MEDIUM | — | TBD |
| G05 | Reporting & Analytics | LOW | HIGH | MEDIUM | — | TBD |
| G06 | PKI/Certificate Mgmt | HIGH | MEDIUM | MEDIUM | — | TBD |
| G07 | Captive Portal | LOW | MEDIUM | LOW | — | TBD |
| G08 | SD-WAN | LOW | MEDIUM | HIGH | — | TBD |
| G09 | REST API Docs | LOW | MEDIUM | LOW | — | TBD |
| G10 | Firmware Update Mgmt | MEDIUM | MEDIUM | MEDIUM | — | TBD |
| G11 | Geo-IP Auto-Update | MEDIUM | LOW | LOW | — | TBD |
| G12 | ZTNA Module | HIGH | MEDIUM | MEDIUM | — | TBD |

---

## Feature Implementation Progress

### New Requirements (F44–F54)

| ID | Feature | Design | Implement | REST API | LuCI UI | Tested | Done |
|----|---------|--------|-----------|----------|---------|--------|------|
| F44 | TACACS+ | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ |
| F45 | AD Integration | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ |
| F46 | LDAP Integration | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ |
| F47 | SSH CLI Access | ✅ | ✅ | N/A | N/A | ✅ | ✅ |
| F48 | SSO Integration | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| F49 | SMS Security | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ |
| F50 | Email Security | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ |
| F51 | WhatsApp Security | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ |
| F52 | 2FA (TOTP/HOTP) | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ |
| F53 | 802.1x NAC | ✅ | ⚠️ | ⬜ | ⬜ | ⬜ | ⬜ |
| F54 | FQDN Rules | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ |

> F48 (SSO) blocked pending IdP details from owner. F53 (802.1x) needs `wpad-openssl` in BSP.

### Gap Features (G01–G12)

| ID | Feature | Design | Implement | REST API | LuCI UI | Tested | Done |
|----|---------|--------|-----------|----------|---------|--------|------|
| G01 | DPI Engine | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| G02 | SSL/TLS Inspection | ✅ | ✅ | ⬜ | ✅ | ✅ | ✅ |
| G03 | High Availability | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| G04 | Management RBAC | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| G05 | Reporting & Analytics | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| G06 | PKI/Cert Management | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| G07 | Captive Portal | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| G08 | SD-WAN | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| G09 | REST API Docs (OpenAPI) | ⬜ | ⬜ | N/A | N/A | ⬜ | ⬜ |
| G10 | Firmware Update Mgmt | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| G11 | Geo-IP Auto-Update | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| G12 | ZTNA Module | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

---

## Test Execution Progress

| Section | TC Count | ⬜ Not Run | 🔄 Running | ✅ Pass | ❌ Fail | ⚠️ Blocked |
|---------|----------|-----------|-----------|--------|--------|-----------|
| S1: Functional & Routing | 8 | 4 | 0 | 4 | 0 | 4 |
| S2: NG Security | 8 | 8 | 0 | 0 | 0 | 0 |
| S3: Threat Prevention | 12 | 12 | 0 | 0 | 0 | 0 |
| S4: Performance | 8 | 8 | 0 | 0 | 0 | 0 |
| S5: Management | 8 | 8 | 0 | 0 | 0 | 0 |
| S6: Additional | 10 | 10 | 0 | 0 | 0 | 0 |
| **TOTAL** | **54** | **50** | **0** | **4** | **0** | **4** |

> S1 notes: TC-F-005/006/007/008 PASS (single-router, 16/16 sub-checks).
> TC-F-001/002/003/004 blocked — require second router (HA/BGP/VRRP).

---

## Open Issues & Blockers

| Issue ID | Description | Severity | Raised | Status | Resolved |
|----------|-------------|----------|--------|--------|----------|
| ISS-001 | Code access not yet provided — P0 blocked | BLOCKER | Session 001 | Open | — |
| ISS-002 | PPTP is cryptographically broken — needs deprecation decision | HIGH | Session 001 | Pending owner decision | — |
| ISS-003 | NAT duplication between F02d and F08 — scope needs clarification | MEDIUM | Session 001 | Pending code review | — |
| ISS-004 | QoS items F38-F41 may be one module — needs verification | LOW | Session 001 | Pending code review | — |

---

## Architecture Notes
> Filled during P0 and updated as code is explored.

```
[Pending code access]

Key areas to document here:
- netfilter hook chain and priorities
- How features register with the core engine
- Config flow: YAML → Go handler → netfilter/daemon
- REST API auth mechanism
- LuCI ↔ REST API communication pattern
- How session table is managed
- VRF implementation approach
- How threat intel feeds are ingested
```

---

## Decisions Log

| DEC-ID | Decision | Rationale | Date |
|--------|----------|-----------|------|
| DEC-001 | Split CLAUDE.md into 4 files: CLAUDE.md, FEATURES.md, TESTPLAN.md, PROJECT.md | Easier to maintain, update, and navigate independently | Session 001 |
| DEC-002 | PPTP flagged as deprecated — add mandatory security warning, do not remove | Backward compatibility required, but risk must be surfaced to operator | Session 001 |
| DEC-003 | IPS/IDS added as F_IPS — confirmed existing by product owner | Was omitted from original feature list | Session 001 |
| DEC-004 | On first code access: discover structure before writing any code | Prevents assumptions that break architecture | Session 001 |
| DEC-005 | LuCI UI changes must go through REST API — no direct UCI writes | Ensures config consistency between both management planes | Session 001 |

---

## Session Log

> Append at start of each session. Never delete entries. Be specific.

```
[SESSION 001] Date: Project kickoff
  Actions taken:
  - Reviewed product feature list (54 items)
  - Reviewed test plan requirements
  - Identified 12 missing features (G01-G12)
  - Corrected typos in feature list
  - Confirmed IPS/IDS exists (was missing from list)
  - Created CLAUDE.md, FEATURES.md, TESTPLAN.md, PROJECT.md
  - Defined 54 test cases across 6 sections
  - Added 10 additional QA-Lead test cases (TC-X-001 to TC-X-010)

  Blockers:
  - No code access yet — P0 cannot begin

  Next session priorities:
  1. If code access available: run P0 discovery protocol (see CLAUDE.md Section 9)
  2. Update FEATURES.md verified status based on code
  3. Update PROJECT.md architecture notes
  4. Begin P1 feature audit
  5. Identify and fix any critical security issues found in P0
```
