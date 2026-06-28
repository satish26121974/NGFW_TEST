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
> Update counts at start of each session.

| Status | Count |
|--------|-------|
| EXISTING (claimed) | 26 |
| EXISTING (code-verified) | 0 — pending code access |
| WIP | 0 — pending code access |
| MISSING / GAP | 12 identified |
| NEW REQUIREMENT | 11 |
| NEEDS-REVIEW | 0 — pending code access |

---

## F01–F16: Core Networking

| ID | Feature | Claimed | Verified | Priority | Test Cases | Notes |
|----|---------|---------|----------|----------|------------|-------|
| F01 | Load Balancer | Existing | ⬜ | HIGH | TC-P-002 | Verify algorithm: RR/ECMP/hash |
| F02 | Stateful Firewall | Existing | ⬜ | HIGH | TC-F-001 | Core — netfilter conntrack |
| F02a | Firewall Zone | Existing | ⬜ | HIGH | TC-X-006, TC-X-007 | |
| F02b | Firewall Traffic Rule | Existing | ⬜ | HIGH | — | |
| F02c | Firewall Port Forward | Existing | ⬜ | HIGH | TC-F-006 | |
| F02d | NAT Rules (basic) | Existing | ⬜ | HIGH | TC-F-005 | Overlap with F08 — review scope |
| F02e | Network Protection | Existing | ⬜ | MEDIUM | — | Scope unclear — define on code discovery |
| F03 | ACL | Existing | ⬜ | HIGH | — | |
| F04 | VLAN 802.1Q | Existing | ⬜ | HIGH | TC-X-006 | Distinct from F53 (802.1x) |
| F05 | Static Routing | Existing | ⬜ | HIGH | TC-F-008 | |
| F06 | Dynamic Routing BGP/OSPF/VRRP/PIM/RIP | Existing | ⬜ | HIGH | TC-F-003, TC-F-004 | Verify each protocol individually |
| F07 | VRF | Existing | ⬜ | HIGH | TC-F-007 | |
| F08 | NAT (DNAT/SNAT/MASQ/PAT/464XLAT/444/44) | Existing | ⬜ | HIGH | TC-F-005, TC-F-006 | Verify 464XLAT, 444, 44 variants |
| F09 | DNS | No status | ⬜ | HIGH | — | Likely dnsmasq — confirm config API exposure |
| F10 | NTP | No status | ⬜ | MEDIUM | — | Verify NTP client + server modes |
| F11 | Bridge | Existing | ⬜ | MEDIUM | — | |
| F12 | DHCP Server/Client | Existing | ⬜ | HIGH | — | |
| F13 | DHCP Reservation | Existing | ⬜ | MEDIUM | — | |
| F14 | MAC Filtering | Existing | ⬜ | MEDIUM | — | |
| F15 | WAN/LAN (PPPoE/Static/Dynamic) | Existing | ⬜ | HIGH | — | |
| F16 | IDAM (Local/External AAA) | No status | ⬜ | HIGH | TC-M-006 | PPPoE/IPoE/CP — confirm scope |

---

## F17–F27, F35–F36: Security & Filtering

| ID | Feature | Claimed | Verified | Priority | Test Cases | Notes |
|----|---------|---------|----------|----------|------------|-------|
| F17 | Domain Filter (HTTPS/SNI) | Existing | ⬜ | HIGH | — | SNI-based only — not full SSL inspection |
| F18 | URL Filter | Existing | ⬜ | HIGH | TC-T-007, TC-T-008 | |
| F19 | Category Filter | Existing | ⬜ | HIGH | TC-T-007 | |
| F20 | Application Filter (CIPS) | Existing | ⬜ | HIGH | TC-S-001, TC-S-006, TC-S-007 | Verify non-standard port detection |
| F21 | Content Filter | Existing | ⬜ | HIGH | TC-T-009 | |
| F22 | Gateway Antivirus | Existing | ⬜ | HIGH | TC-T-005 | |
| F23 | Packet Malware Detection (Hash/Fuzzy) | No status | ⬜ | HIGH | TC-T-005, TC-T-006 | Hash = known IOC, Fuzzy = similarity |
| F24 | Domain Aging | No status | ⬜ | MEDIUM | TC-T-011 | Block domains < N days old |
| F25 | Anti-Typosquatting | No status | ⬜ | MEDIUM | TC-T-010 | Homograph + lookalike detection |
| F26 | Entropy Analysis | No status | ⬜ | MEDIUM | — | DGA domain detection |
| F27 | Threat Intel | Existing | ⬜ | HIGH | TC-T-012 | Verify feed update mechanism + IOC types |
| F35 | Country Filter / Geo-IP | Existing | ⬜ | HIGH | TC-X-008 | Verify DB update cadence |
| F36 | DoS / DDoS Protection | No status | ⬜ | HIGH | TC-P-007 | SYN cookie, rate limiting, flood protection |
| F_IPS | IPS / IDS | **CONFIRMED EXISTING** | ⬜ | HIGH | TC-T-001, TC-T-002, TC-T-003, TC-T-004 | Was missing from original list |

---

## F28–F34: VPN & Tunneling

| ID | Feature | Claimed | Verified | Priority | Test Cases | Notes |
|----|---------|---------|----------|----------|------------|-------|
| F28 | IPSec | No status | ⬜ | HIGH | TC-X-003 | IKEv1 + IKEv2 — verify both |
| F29 | IPSec PMTUD | No status | ⬜ | MEDIUM | — | Path MTU Discovery — "PMTA" was a typo |
| F30 | SSL VPN | No status | ⬜ | HIGH | TC-X-003 | OpenVPN or custom — check implementation |
| F31 | GRE | No status | ⬜ | MEDIUM | — | With and without IPSec encapsulation |
| F32 | PPTP | No status | ⬜ | LOW | TC-X-005 | ⚠️ DEPRECATED — cryptographically broken. Must show warning on enable. |
| F33 | L2TP | No status | ⬜ | MEDIUM | — | L2TP/IPSec preferred |
| F34 | SSTP | No status | ⬜ | MEDIUM | — | |

---

## F37–F41: QoS & Traffic Management

| ID | Feature | Claimed | Verified | Priority | Test Cases | Notes |
|----|---------|---------|----------|----------|------------|-------|
| F37 | Application Aware Routing | No status | ⬜ | HIGH | — | SD-WAN adjacent — verify scope |
| F38 | QoS | No status | ⬜ | HIGH | TC-P-008 | |
| F39 | Class-Based QoS | No status | ⬜ | HIGH | TC-P-008 | |
| F40 | SQM QoS | No status | ⬜ | MEDIUM | TC-P-008 | Smart Queue Management — cake/fq_codel |
| F41 | QoS Shaper | No status | ⬜ | HIGH | TC-P-008 | F38-F41 likely one module — confirm |

---

## F42–F43: Monitoring & Management

| ID | Feature | Claimed | Verified | Priority | Test Cases | Notes |
|----|---------|---------|----------|----------|------------|-------|
| F42 | Logs / Syslog Forwarding | No status | ⬜ | HIGH | TC-M-004 | "Forwording" was a typo |
| F43 | SNMP v1/v2/v3 | Existing | ⬜ | HIGH | TC-M-005 | Verify v3 AuthPriv (SHA + AES) |

---

## F44–F54: Identity, Access & New Requirements

| ID | Feature | Claimed | Verified | Priority | Test Cases | Notes |
|----|---------|---------|----------|----------|------------|-------|
| F44 | TACACS+ Integration | New | ⬜ | HIGH | TC-M-006 | |
| F45 | AD Integration | New | ⬜ | HIGH | TC-S-008 | Azure AD + on-prem |
| F46 | LDAP Integration | New | ⬜ | HIGH | — | |
| F47 | SSH CLI Access | New | ⬜ | HIGH | TC-X-009 | Harden: no root, key-only, 2FA |
| F48 | SSO Integration | New | ⬜ | HIGH | — | SAML / OIDC — specify provider |
| F49 | SMS Security (OTP/Alert) | New | ⬜ | MEDIUM | — | OTP delivery + alerting |
| F50 | Email Security (Alert/Notification) | New | ⬜ | MEDIUM | — | Security event notification |
| F51 | WhatsApp Security (Notification) | New | ⬜ | MEDIUM | — | Alert channel via WhatsApp API |
| F52 | 2FA (TOTP/HOTP) | New | ⬜ | HIGH | TC-M-007 | Enforce on SSH + UI + API |
| F53 | 802.1x (Port-Based NAC) | New | ⬜ | HIGH | TC-X-001 | Distinct from F04 (802.1Q VLAN) |
| F54 | FQDN-Based Rules | New | ⬜ | HIGH | TC-X-002 | Dynamic IP tracking per DNS TTL |

---

## Gaps — Features to Add

| ID | Feature | Priority | Owner | Status | Test Cases | Notes |
|----|---------|----------|-------|--------|------------|-------|
| G01 | DPI Engine (explicit) | HIGH | TBD | ⬜ | TC-S-001, TC-S-002 | May be embedded in F20 — verify |
| G02 | SSL/TLS Inspection (inbound + outbound) | HIGH | TBD | ⬜ | TC-S-003, TC-S-004, TC-S-005 | Full MITM decryption engine |
| G03 | High Availability (Active/Passive + Active/Active) | HIGH | TBD | ⬜ | TC-F-001, TC-F-002 | Session sync required |
| G04 | Centralized Management / REST API RBAC | HIGH | TBD | ⬜ | TC-M-001, TC-M-002, TC-M-003 | May partially exist — verify |
| G05 | Reporting & Analytics | HIGH | TBD | ⬜ | TC-M-008 | Traffic reports, threat summaries, audit |
| G06 | Certificate / PKI Management | MEDIUM | TBD | ⬜ | TC-X-004 | CA, cert store, expiry alerts |
| G07 | Captive Portal (standalone) | MEDIUM | TBD | ⬜ | — | Referenced in F16 but not explicit |
| G08 | SD-WAN | MEDIUM | TBD | ⬜ | — | F37 is adjacent — clarify boundary |
| G09 | REST API Documentation | MEDIUM | TBD | ⬜ | — | OpenAPI spec |
| G10 | Firmware / OTA Update Management | MEDIUM | TBD | ⬜ | — | Version control + rollback |
| G11 | Geo-IP DB Auto-Update | LOW | TBD | ⬜ | TC-X-008 | Required for F35 to stay current |
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
