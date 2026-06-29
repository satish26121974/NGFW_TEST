# FEATURES.md — NGFW Feature Registry
> Source of truth for all features. Updated every session after code discovery.
> Cross-reference with CLAUDE.md Section 4 for full context.
> Cross-reference with TESTPLAN.md for test coverage per feature.

---

## DUT Access
> Connect to the router with key-based auth — no password needed.

```bash
ssh 10.80.80.57              # interactive shell
ssh 10.80.80.57 "command"    # run single command
```
Key: `~/.ssh/root_10_80_80_57` | Port: `19822` | User: `root`

---

## Quick Status Summary
> Updated: P1 audit — 2026-06-29

| Status | Count |
|--------|-------|
| EXISTING (claimed) | 26 |
| EXISTING (code-verified) | 23 ✅ |
| WIP / NEEDS-REVIEW | 8 ⚠️ |
| MISSING / GAP | 5 ❌ |
| NEW (undocumented) | 3 🆕 (SD-WAN, Captive Portal, 4G/LTE) |
| NEW REQUIREMENT (unimplemented) | 6 ❌ (TACACS+, SSO, SMS, WhatsApp, 2FA, Email) |

---

## F01–F16: Core Networking

| ID | Feature | Claimed | Verified | Priority | Test Cases | Module / Evidence |
|----|---------|---------|----------|----------|------------|-------------------|
| F01 | Load Balancer | Existing | ✅ | HIGH | TC-P-002 | `lb` binary + `/appdata/LB.conf` + `CHANGELB` (14KB) + `lbconfig` init |
| F02 | Stateful Firewall | Existing | ✅ | HIGH | TC-F-001 | `firewall` init + iptables/nftables conntrack |
| F02a | Firewall Zone | Existing | ✅ | HIGH | TC-X-006, TC-X-007 | `CHECKFWConf` (32KB) applies zone rules |
| F02b | Firewall Traffic Rule | Existing | ✅ | HIGH | — | `CHECKFWConf` + `RESETAD` (45KB) |
| F02c | Firewall Port Forward | Existing | ✅ | HIGH | TC-F-006 | `NATSET` + `CHECKFWConf` |
| F02d | NAT Rules (basic) | Existing | ✅ | HIGH | TC-F-005 | `NATSET` + `nat-logger` + `mikrotik-nat-logger` |
| F02e | Network Protection | Existing | ⚠️ | MEDIUM | — | Likely `ddosctl` + iptables rate-limit — needs confirm |
| F03 | ACL | Existing | ⚠️ | HIGH | — | Embedded in `CHECKFWConf`/`RESETAD` — no standalone module |
| F04 | VLAN 802.1Q | Existing | ⚠️ | HIGH | TC-X-006 | `START` script has VLAN section (empty on this unit) — needs active config test |
| F05 | Static Routing | Existing | ✅ | HIGH | TC-F-008 | `START` + `ADVANCEDIPRULE` (48KB) + `pbr_engine` |
| F06 | Dynamic Routing BGP/OSPF/VRRP/PIM/RIP | Existing | ✅ | HIGH | TC-F-003, TC-F-004 | `frr` (FRRouting) init — all protocols confirmed present |
| F07 | VRF | Existing | ⚠️ | HIGH | TC-F-007 | SDWAN network namespace used as VRF — not formal VRF config |
| F08 | NAT (DNAT/SNAT/MASQ/PAT/464XLAT/444/44) | Existing | ✅ | HIGH | TC-F-005, TC-F-006 | `NATSET` + `CHECKConf` applies from `/appdata/FWCONFIG/` |
| F09 | DNS | No status | ✅ | HIGH | — | `dnsmasq` + custom `10-dnsguard` (107KB) — full DNS filtering engine |
| F10 | NTP | No status | ✅ | MEDIUM | — | `ntpdate pool.ntp.org` in `SDOSSTART` + `sysntpd` init |
| F11 | Bridge | Existing | ⚠️ | MEDIUM | — | `ADDBRIDGESTART` present — config empty on this unit |
| F12 | DHCP Server/Client | Existing | ✅ | HIGH | — | `dnsmasq` (DHCP server) + `odhcpd` + `NSDHCPNEW` + `DHCPRES` |
| F13 | DHCP Reservation | Existing | ✅ | MEDIUM | — | `DHCPRES` script + dnsmasq static lease config |
| F14 | MAC Filtering | Existing | ⚠️ | MEDIUM | — | `/appdata/MAC_ALLOWED` — referenced in scripts, needs confirm |
| F15 | WAN/LAN (PPPoE/Static/Dynamic) | Existing | ✅ | HIGH | — | `check_pppoe.sh` (16KB) + `pppoe-watchdog` + `UNIGR8WAYS_WAN` |
| F16 | iDAM (Local/External AAA) | No status | ✅ | HIGH | TC-M-006 | `BELRAS` binary (`/usr/sbin/BELRAS`) + `CHECKiDAM` (38KB) + `radiusd` |

---

## F17–F27, F35–F36: Security & Filtering

| ID | Feature | Claimed | Verified | Priority | Test Cases | Module / Evidence |
|----|---------|---------|----------|----------|------------|-------------------|
| F17 | Domain Filter (HTTPS/SNI) | Existing | ✅ | HIGH | — | `domainfilter` init + `10-dnsguard` (107KB) — DNS-based + SNI inspection |
| F18 | URL Filter | Existing | ✅ | HIGH | TC-T-007, TC-T-008 | `squid` proxy + `e2guardian` content filter |
| F19 | Category Filter (HTTPS) | Existing | ✅ | HIGH | TC-T-007 | `httpscatfilt` init + `HTTPSCATFILT` (76KB) + `HTTPSCATFILT_NOBYPASS` |
| F20 | Application Filter (CIPS) | Existing | ✅ | HIGH | TC-S-001, TC-S-006, TC-S-007 | `/usr/sbin/CIPS` binary — NFQUEUE-based DPI, queue 0, port 8191 |
| F21 | Content Filter | Existing | ✅ | HIGH | TC-T-009 | `e2guardian` + `Contentgroupadd` (103KB) |
| F22 | Gateway Antivirus | Existing | ✅ | HIGH | TC-T-005 | `clamd`+`freshclam`+`c-icap` (ICAP scan chain via squid) |
| F23 | Packet Malware Detection (Hash/Fuzzy) | No status | ⚠️ | HIGH | TC-T-005, TC-T-006 | ClamAV handles hash signatures — fuzzy/similarity not confirmed |
| F24 | Domain Aging | No status | ⚠️ | MEDIUM | TC-T-011 | Likely in `10-dnsguard` — needs deep read to confirm |
| F25 | Anti-Typosquatting | No status | ⚠️ | MEDIUM | TC-T-010 | Likely in `10-dnsguard` — needs deep read to confirm |
| F26 | Entropy Analysis (DGA) | No status | ⚠️ | MEDIUM | — | May be in Snort rules (`/etc/snort/rules/`) — needs confirm |
| F27 | Threat Intel | Existing | ✅ | HIGH | TC-T-012 | Snort Talos rules (`talos.lua`) + `ipset-dns` + `UNIGR8WAYS_IPSEC` |
| F35 | Country Filter / Geo-IP | Existing | ✅ | HIGH | TC-X-008 | `CountryBlockSet.sh` + ipset + `UNIGR8WAYS_GEOTAG` |
| F36 | DoS / DDoS Protection | No status | ✅ | HIGH | TC-P-007 | `ddosctl` + `ddosctl-cloud` init daemons |
| F_IPS | IPS / IDS | CONFIRMED | ✅ | HIGH | TC-T-001–TC-T-004 | **Snort 3** via NFQUEUE — 4 policy levels (connectivity/balanced/security/max_detect) — multi-core — Talos rules — config: `/appdata/IPSCONFIG.json` |

---

## F28–F34: VPN & Tunneling

| ID | Feature | Claimed | Verified | Priority | Test Cases | Module / Evidence |
|----|---------|---------|----------|----------|------------|-------------------|
| F28 | IPSec | No status | ✅ | HIGH | TC-X-003 | `swanctl` (StrongSwan IKEv2) + `ipsec-watchdog` + `addtunipsec.sh` + `GENIPSECCERT.sh` |
| F29 | IPSec PMTUD | No status | ⚠️ | MEDIUM | — | StrongSwan supports PMTUD — needs config verification |
| F30 | SSL VPN | No status | ✅ | HIGH | TC-X-003 | `openvpn` init + `univpnserver.sh` + `add_univpn_client.sh` + `UNIVPNADDUSERAPI.sh` |
| F31 | GRE | No status | ✅ | MEDIUM | — | `greconfig` init + `GetSetgre.sh` + `tunnel-routing.sh` variants |
| F32 | PPTP | No status | ⚠️ | LOW | TC-X-005 | `rasvpn` init — ⚠️ DEPRECATED/insecure — must add warning on enable |
| F33 | L2TP | No status | ⚠️ | MEDIUM | — | `rasvpn` init likely handles L2TP — needs confirm |
| F34 | SSTP | No status | ❌ | MEDIUM | — | Not found — no binary or init script |

---

## F37–F41: QoS & Traffic Management

| ID | Feature | Claimed | Verified | Priority | Test Cases | Module / Evidence |
|----|---------|---------|----------|----------|------------|-------------------|
| F37 | Application Aware Routing | No status | ✅ | HIGH | — | `pbr_engine` init + `ADVANCEDIPRULE` (48KB) + `ADVANCEDIPRULESDWAN` |
| F38 | QoS | No status | ✅ | HIGH | TC-P-008 | `qos` + `qosctl` init + `ifb0`/`ifb1` (HTB qdisc confirmed active) |
| F39 | Class-Based QoS | No status | ✅ | HIGH | TC-P-008 | `SHAPEIPGROUPS.sh` + HTB class-based shaping on ifb0/ifb1 |
| F40 | SQM QoS | No status | ✅ | MEDIUM | TC-P-008 | `sqm` init present (cake/fq_codel) |
| F41 | QoS Shaper | No status | ✅ | HIGH | TC-P-008 | All F38–F41 use same HTB+ifb infrastructure — one engine |

---

## F42–F43: Monitoring & Management

| ID | Feature | Claimed | Verified | Priority | Test Cases | Module / Evidence |
|----|---------|---------|----------|----------|------------|-------------------|
| F42 | Logs / Syslog Forwarding | No status | ✅ | HIGH | TC-M-004 | `ulogd` + `set_log_server.sh` + `UNIGR8WAYS_LOGCHECK.sh` |
| F43 | SNMP v1/v2/v3 | Existing | ✅ | HIGH | TC-M-005 | `snmpd` + `snmptrapd` init + `UNIGR8WAYS_SWALK` (SNMP walk monitor) |

---

## F44–F54: Identity, Access & New Requirements

| ID | Feature | Claimed | Verified | Priority | Test Cases | Module / Evidence |
|----|---------|---------|----------|----------|------------|-------------------|
| F44 | TACACS+ Integration | New | ❌ | HIGH | TC-M-006 | **NOT FOUND** — no binary, no init, no script reference |
| F45 | AD Integration | New | ⚠️ | HIGH | TC-S-008 | `CHECKiDAM` (38KB) + `BELRAS` — scope unclear, needs deep read |
| F46 | LDAP Integration | New | ⚠️ | HIGH | — | Likely in `BELRAS` or `CHECKiDAM` — needs confirm |
| F47 | SSH CLI Access | New | ✅ | HIGH | TC-X-009 | Dropbear running — key auth set up — hardening (no-root, 2FA) still needed |
| F48 | SSO Integration | New | ❌ | HIGH | — | **NOT FOUND** — no SAML/OIDC binary or config |
| F49 | SMS Security (OTP/Alert) | New | ❌ | MEDIUM | — | **NOT FOUND** — 4G modem present (ttyUSB4) but no SMS API script |
| F50 | Email Security (Alert/Notification) | New | ❌ | MEDIUM | — | **NOT FOUND** — no sendmail/postfix/SMTP script |
| F51 | WhatsApp Security (Notification) | New | ❌ | MEDIUM | — | **NOT FOUND** — no WhatsApp API integration |
| F52 | 2FA (TOTP/HOTP) | New | ❌ | HIGH | TC-M-007 | **NOT FOUND** — no TOTP/HOTP binary or config |
| F53 | 802.1x (Port-Based NAC) | New | ⚠️ | HIGH | TC-X-001 | `wpad` init present — needs config verification |
| F54 | FQDN-Based Rules | New | ⬜ | HIGH | TC-X-002 | Dynamic IP tracking per DNS TTL |

---

## Gaps — Features to Add

| ID | Feature | Priority | Status | Test Cases | Notes |
|----|---------|----------|--------|------------|-------|
| G01 | DPI Engine (explicit) | HIGH | ✅ CLOSED | TC-S-001, TC-S-002 | `/usr/sbin/CIPS` binary IS the DPI engine — NFQUEUE-based |
| G02 | SSL/TLS Inspection (inbound + outbound) | HIGH | ❌ OPEN | TC-S-003, TC-S-004, TC-S-005 | Not found — no MITM/intercept engine |
| G03 | High Availability (Active/Passive) | HIGH | ✅ CLOSED | TC-F-001, TC-F-002 | `HAFUN4` implements HA — Active/Active unclear |
| G04 | Centralized Management / REST API RBAC | HIGH | ⚠️ PARTIAL | TC-M-001–TC-M-003 | RUNCONF/RUNLIC poll orchestrator — RBAC unclear |
| G05 | Reporting & Analytics | HIGH | ⚠️ PARTIAL | TC-M-008 | `UNIGR8WAYS_STAT` + `BELRAS` billing logs — no report engine found |
| G06 | Certificate / PKI Management | MEDIUM | ⚠️ PARTIAL | TC-X-004 | `GENIPSECCERT.sh` for IPSec — no general PKI manager |
| G07 | Captive Portal | MEDIUM | ✅ CLOSED | — | `BELRAS` binary — full captive portal + subscriber auth |
| G08 | SD-WAN | MEDIUM | ✅ CLOSED | — | `GR8WANDV2` binary + `SD.conf` + SDWAN namespace — full SD-WAN |
| G09 | REST API Documentation | MEDIUM | ❌ OPEN | — | No OpenAPI spec found |
| G10 | Firmware / OTA Update Management | MEDIUM | ⚠️ PARTIAL | — | `SYSUPDATE` script exists — scope unclear |
| G11 | Geo-IP DB Auto-Update | LOW | ⚠️ PARTIAL | TC-X-008 | `CFilterDownload` script — verify if Geo-IP included |

### 🆕 Undocumented Features Found During P1

| ID | Feature | Evidence | Action |
|----|---------|----------|--------|
| F_NEW1 | SD-WAN (full) | `GR8WANDV2` binary + SDWAN netns + `SD.conf` | Add to feature list, add test cases |
| F_NEW2 | Captive Portal / Subscriber Mgmt | `/usr/sbin/BELRAS` + `/etc/BELRAS.conf` + billing logs | Add to feature list |
| F_NEW3 | 4G/LTE WAN (USB modem) | AT commands in `CHECKConf` targeting `ttyUSB4` | Add to feature list, add test cases |
| G12 | ZTNA Module (composed) | LOW | TBD | ⬜ | — | Group F30+F48+F52+F54 |

---

## Change Log

```
[v0.1] Initial registry created from feature list provided by product owner.
       Typos corrected: Domain Agging→Aging, Antityposcoting→Anti-Typosquatting,
       PMTA→PMTUD, Forwording→Forwarding.
       IPS/IDS added as F_IPS — confirmed existing by product owner.
       12 gaps identified (G01–G12).
       All verified statuses pending code access.
```
