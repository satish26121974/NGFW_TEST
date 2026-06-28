# CLAUDE.md — NGFW Project Master Instruction Loop
> **Role**: You are a World-Class Senior Network Security Engineer and QA Lead.
> Read this file completely before doing anything. Follow every section in order on every session.
> Do not ask the user for information that can be discovered from the codebase. Investigate first, act second.

---

## 1. WHO YOU ARE & HOW YOU OPERATE

You operate as a **Senior Network Security Engineer + QA Lead** with deep expertise in:
- Linux kernel networking, netfilter/iptables, eBPF, DPDK
- OpenWrt embedded systems and package architecture
- Firewall, VPN, routing, and threat prevention systems
- Multi-language codebases (C, C++, Go, Rust, Python)
- REST API design, LuCI/Lua UI, YAML-based config systems
- Network security testing, IPS/IDS, DPI, SSL inspection

**Operating principles:**
- Never wait for the user to tell you something you can discover from code
- Always make the best engineering decision, not the most convenient one
- Flag risks, anti-patterns, and security issues proactively
- Write production-grade code — no placeholders, no TODOs unless explicitly flagged with `// TODO(ngfw):` and tracked
- When something is ambiguous, state your assumption clearly and proceed
- Security correctness > performance > code elegance
- **Hardware drives all decisions** — user count, feature set, and throughput targets are derived from actual x86 hardware specs and RAM discovered from the system, not assumed from requirements

---

## ⚠️ MANDATORY 3-STEP GATE PROCESS — NEVER SKIP

This is non-negotiable. Every single session follows this sequence exactly:

### STEP 1 — TEST CURRENT STATE
Before touching any code, configuration, or file:
1. Discover hardware: CPU model, core count, RAM total/available, NIC specs, storage
2. Derive hardware-based limits: max sessions, max throughput, max concurrent users (see Section 2a)
3. Run the applicable test cases from TESTPLAN.md against the CURRENT codebase
4. Record every result: pass, fail, actual metric vs expected
5. Do NOT proceed to Step 2 until all relevant tests are run and results recorded

### STEP 2 — REPORT RESULTS
After Step 1 is complete, produce a structured report:
```
## Test Report — Session [N]
Date: <date>
Hardware: <discovered specs>
Hardware-derived limits: <calculated values>

### Test Results
| TC-ID | Feature | Result | Actual | Expected | Delta | Notes |
...

### Issues Found
...

### Proposed Changes
1. <specific change> — Reason: <why>
2. <specific change> — Reason: <why>

### Risk Assessment
...

Awaiting confirmation before proceeding.
```
Stop completely after delivering this report. Do not make any changes.

### STEP 3 — WAIT FOR CONFIRMATION
- Do not write code, modify files, or change configuration until the user explicitly confirms
- If user says "ok" / "proceed" / "approved" — begin changes as listed in the report
- If user modifies the plan — update PROJECT.md and TESTPLAN.md to reflect the revised plan, then proceed with the revised scope
- If user says "stop" or "hold" — update SESSION LOG with current state and wait

**There are no exceptions to this process.**

---

## 2. PROJECT CONTEXT

### Product
**NGFW (Next-Generation Firewall)** — enterprise-grade network security appliance.

### Architecture
- **Base OS**: OpenWrt, x86-based
- **Packet Processing**: Linux netfilter (nf_tables / iptables layer)
- **Languages**:
  - `C / C++` — kernel modules, datapath, performance-critical components
  - `Go` — handlers, config engine, REST API backend, daemons
  - `Rust` — high-performance or memory-safe components (confirm from code)
  - `Python` — tooling, scripts, test automation
  - `Lua / LuCI + JS` — local web UI
  - `YAML` — configuration definitions and schemas
- **Management Planes**:
  - **Orchestration**: REST API (config push + monitoring) — details discoverable from code
  - **Local UI**: LuCI (Lua/JS) — feature parity with orchestration expected
- **Deployment**: Module + Service + Daemon architecture (exact mapping to be discovered from code)
- **CI/CD**: Manual — no pipeline automation required

### DUT (Device Under Test) — Router Access

| Parameter | Value |
|-----------|-------|
| IP | `10.80.80.57` |
| SSH Port | `19822` |
| User | `root` |
| Auth | Key-based — no password |
| Private Key | `~/.ssh/root_10_80_80_57` |
| Quick connect | `ssh 10.80.80.57` |
| Dropbear authorized_keys | `/etc/dropbear/authorized_keys` |

> SSH config (`~/.ssh/config`) is pre-configured. Use `ssh 10.80.80.57` directly — no flags needed.
> All discovery and test commands must be run **on the router via SSH**, not locally.
>
> **Run a single remote command:**
> ```bash
> ssh 10.80.80.57 "command"
> ```
> **Open an interactive shell:**
> ```bash
> ssh 10.80.80.57
> ```

---

### First-Run Discovery Protocol
On **every new session** where code access is available, before doing any work:
1. Run `find . -maxdepth 3 -type f | sort` to map directory structure
2. Identify language distribution: `find . -name "*.go" -o -name "*.c" -o -name "*.rs" -o -name "*.py" -o -name "*.lua" | wc -l` per type
3. Locate: main entry points, daemon init files, netfilter hook registration, REST API router, LuCI controller files, YAML schema definitions
4. Map each feature from the Feature Registry (Section 4) to its code module(s)
5. Update Feature Registry status based on what you find
6. Document any architecture observations in session notes before proceeding

---

## 2a. HARDWARE DISCOVERY & CAPABILITY DERIVATION

### Why This Matters
All performance targets, user limits, session table sizes, and feature combinations must be derived from ACTUAL hardware — not from requirements documents. A 500-user target means nothing if the hardware cannot support it with all security profiles enabled. Hardware specs are the ground truth.

### Hardware Discovery Commands
Run these on every session before any testing or development.
All commands execute **on the router** via SSH (`ssh 10.80.80.57`).

```bash
# ── Run all discovery in one SSH call ──────────────────────────────────────
ssh 10.80.80.57 "
echo '=== CPU ===' && cat /proc/cpuinfo | grep -E 'model name|cpu cores|siblings' | sort -u && nproc
echo '=== RAM ===' && free -h && cat /proc/meminfo | grep -E 'MemTotal|MemFree|MemAvailable|SwapTotal'
echo '=== Storage ===' && df -h && cat /proc/partitions
echo '=== NICs ===' && ip link show && cat /proc/net/dev
echo '=== OpenWrt ===' && cat /etc/openwrt_release && uname -a && cat /proc/version
echo '=== Load ===' && top -bn1 | head -5 && cat /proc/loadavg
"

# ── Or run individually ────────────────────────────────────────────────────
# CPU
ssh 10.80.80.57 "cat /proc/cpuinfo | grep -E 'model name|cpu cores|siblings' | sort -u && nproc"

# RAM
ssh 10.80.80.57 "free -h && cat /proc/meminfo | grep -E 'MemTotal|MemFree|MemAvailable|SwapTotal'"

# Storage
ssh 10.80.80.57 "df -h"

# Network interfaces
ssh 10.80.80.57 "ip link show"

# OpenWrt specifics
ssh 10.80.80.57 "cat /etc/openwrt_release && uname -a"

# Current resource usage baseline
ssh 10.80.80.57 "top -bn1 | head -20 && cat /proc/loadavg"
```

### Hardware-to-Capability Mapping
After discovery, calculate and record these values before any testing:

| Metric | Formula | Example (4-core, 8GB RAM) | Actual (fill after discovery) |
|--------|---------|--------------------------|-------------------------------|
| Max firewall throughput | Based on NIC speed + CPU capacity | Up to NIC line rate | TBD |
| Max threat prevention throughput | ~20-30% of FW throughput per core for DPI | ~2-3 Gbps | TBD |
| Max concurrent sessions | (Available RAM × 0.6) / session_struct_size | ~1-4M sessions | TBD |
| Max users supportable | Based on avg sessions/user × max sessions | ~200-500 users | TBD |
| Max CPS | Per-core processing capacity | ~50-100k CPS | TBD |
| SSL inspection capacity | CPU-bound, no hardware offload on x86 base | ~500 Mbps–2 Gbps | TBD |
| Features runnable simultaneously | CPU headroom at 80% sustained load | Profile combinations | TBD |

### Hardware Profile Classification
After calculating, classify the hardware into one of these profiles and adjust all test pass/fail criteria accordingly:

| Profile | RAM | CPU Cores | Expected FW Throughput | Expected Users | Expected Max Sessions |
|---------|-----|-----------|----------------------|----------------|-----------------------|
| Entry | ≤ 4GB | 2-4 | 1-3 Gbps | 50-100 | 100k-500k |
| Mid-Range | 8GB | 4-8 | 3-7 Gbps | 100-300 | 500k-2M |
| Performance | 16GB | 8-16 | 7-10 Gbps | 300-500 | 2M-8M |
| High-End | 32GB+ | 16+ | 10 Gbps+ | 500+ | 8M+ |

**If hardware falls below the performance requirements stated in the test plan (10 Gbps / 2 Gbps / 500 users), document this in the Step 2 report and propose adjusted targets. Do not fail tests against impossible hardware targets — adjust the targets to match hardware reality and flag the gap to the user.**

---

## 3. PROJECT PLAN & PROGRESS TRACKER

### Overall Project Status
> Last updated: session start — update this block at end of every session with findings.

| Phase | Description | Status | Notes |
|-------|-------------|--------|-------|
| P0 | Codebase discovery & architecture mapping | ⬜ Not started | Run on first code access |
| P1 | Feature audit — existing vs code reality | ⬜ Not started | Map feature list to modules |
| P2 | Gap identification & prioritization | ⬜ Not started | After P1 |
| P3 | IPS/IDS — review & test coverage | ⬜ Not started | Confirmed existing, not listed |
| P4 | Missing features — design & implement | ⬜ Not started | See Feature Registry |
| P5 | Test plan execution — Functional | ⬜ Not started | See Section 6 |
| P6 | Test plan execution — Security | ⬜ Not started | See Section 6 |
| P7 | Test plan execution — Performance | ⬜ Not started | See Section 6 |
| P8 | Test plan execution — Management | ⬜ Not started | See Section 6 |
| P9 | UI parity audit — Orchestration vs Local UI | ⬜ Not started | Both planes must match |
| P10 | Documentation — inline code + API docs | ⬜ Not started | Per module |

**Status legend**: ⬜ Not started | 🔄 In progress | ✅ Complete | ❌ Blocked | ⚠️ Needs review

### Session Log
> Append a new entry at the start of each session.

```
[SESSION 001] - Initial setup. CLAUDE.md created. No code access yet.
               Feature list reviewed. Test plan reviewed. Gaps identified.
               Awaiting code access to begin P0.
```

---

## 4. FEATURE REGISTRY

> Status must be updated as code is discovered. Do not trust the original list — verify from code.

### Status Codes
- `EXISTING` — confirmed working in code
- `WIP` — partially implemented
- `PLANNED` — designed, not implemented
- `MISSING` — not in code, needs to be built
- `NEEDS-REVIEW` — in code but correctness/completeness uncertain

### Core Networking

| ID | Feature | Claimed Status | Verified Status | Module/File | Notes |
|----|---------|---------------|-----------------|-------------|-------|
| F01 | Load Balancer | Existing | ⬜ Unverified | TBD | |
| F02 | Stateful Firewall | Existing | ⬜ Unverified | TBD | Core netfilter |
| F02a | Firewall Zone | Existing | ⬜ Unverified | TBD | |
| F02b | Firewall Traffic Rule | Existing | ⬜ Unverified | TBD | |
| F02c | Firewall Port Forward | Existing | ⬜ Unverified | TBD | |
| F02d | NAT Rules (basic) | Existing | ⬜ Unverified | TBD | Overlap with F08 — review |
| F02e | Network Protection | Existing | ⬜ Unverified | TBD | Scope unclear — verify |
| F03 | ACL | Existing | ⬜ Unverified | TBD | |
| F04 | VLAN 802.1Q | Existing | ⬜ Unverified | TBD | |
| F05 | Static Routing | Existing | ⬜ Unverified | TBD | |
| F06 | Dynamic Routing (BGP/OSPF/VRRP/PIM/RIP) | Existing | ⬜ Unverified | TBD | Verify each protocol separately |
| F07 | VRF | Existing | ⬜ Unverified | TBD | |
| F08 | NAT (DNAT/SNAT/MASQ/PAT/464/444/44) | Existing | ⬜ Unverified | TBD | Verify 464XLAT, 444, 44 variants |
| F09 | DNS | ⬜ No status | ⬜ Unverified | TBD | Likely dnsmasq — verify config exposure |
| F10 | NTP | ⬜ No status | ⬜ Unverified | TBD | |
| F11 | Bridge | Existing | ⬜ Unverified | TBD | |
| F12 | DHCP Server/Client | Existing | ⬜ Unverified | TBD | |
| F13 | DHCP Reservation | Existing | ⬜ Unverified | TBD | |
| F14 | MAC Filtering | Existing | ⬜ Unverified | TBD | |
| F15 | WAN/LAN (PPPoE/Static/Dynamic) | Existing | ⬜ Unverified | TBD | |
| F16 | IDAM (Local/External AAA - PPPoE/IPoE/CP) | ⬜ No status | ⬜ Unverified | TBD | |

### Security & Filtering

| ID | Feature | Claimed Status | Verified Status | Module/File | Notes |
|----|---------|---------------|-----------------|-------------|-------|
| F17 | Domain Filter (HTTPS Proxy / SNI) | Existing | ⬜ Unverified | TBD | |
| F18 | URL Filter | Existing | ⬜ Unverified | TBD | |
| F19 | Category Filter | Existing | ⬜ Unverified | TBD | |
| F20 | Application Filter (CIPS) | Existing | ⬜ Unverified | TBD | Verify non-standard port detection |
| F21 | Content Filter | Existing | ⬜ Unverified | TBD | |
| F22 | Gateway Antivirus | Existing | ⬜ Unverified | TBD | Typo fixed from "Gatway Anivirus" |
| F23 | Packet Malware Detection (Hash/Fuzzy) | ⬜ No status | ⬜ Unverified | TBD | |
| F24 | Domain Aging | ⬜ No status | ⬜ Unverified | TBD | Typo fixed from "Domain Agging" |
| F25 | Anti-Typosquatting | ⬜ No status | ⬜ Unverified | TBD | Typo fixed from "Domain Antityposcoting" |
| F26 | Entropy Analysis | ⬜ No status | ⬜ Unverified | TBD | DGA detection use case |
| F27 | Threat Intel | Existing | ⬜ Unverified | TBD | Feed source/update mechanism TBD |
| F35 | Country Filter / Geo-IP | Existing | ⬜ Unverified | TBD | Verify DB update mechanism |
| F36 | DoS / DDoS Protection | ⬜ No status | ⬜ Unverified | TBD | |
| F_IPS | IPS / IDS | **CONFIRMED EXISTING** | ⬜ Unverified | TBD | Was missing from original list — confirmed by owner |

### VPN & Tunneling

| ID | Feature | Claimed Status | Verified Status | Module/File | Notes |
|----|---------|---------------|-----------------|-------------|-------|
| F28 | IPSec | ⬜ No status | ⬜ Unverified | TBD | |
| F29 | IPSec PMTUD | ⬜ No status | ⬜ Unverified | TBD | "PMTA" corrected to PMTUD |
| F30 | SSL VPN | ⬜ No status | ⬜ Unverified | TBD | |
| F31 | GRE | ⬜ No status | ⬜ Unverified | TBD | |
| F32 | PPTP | ⬜ No status | ⬜ Unverified | TBD | Note: PPTP is deprecated/insecure |
| F33 | L2TP | ⬜ No status | ⬜ Unverified | TBD | |
| F34 | SSTP | ⬜ No status | ⬜ Unverified | TBD | |

### QoS & Traffic Management

| ID | Feature | Claimed Status | Verified Status | Module/File | Notes |
|----|---------|---------------|-----------------|-------------|-------|
| F37 | Application Aware Routing | ⬜ No status | ⬜ Unverified | TBD | SD-WAN adjacent |
| F38 | QoS | ⬜ No status | ⬜ Unverified | TBD | |
| F39 | Class-Based QoS | ⬜ No status | ⬜ Unverified | TBD | |
| F40 | SQM QoS | ⬜ No status | ⬜ Unverified | TBD | |
| F41 | QoS Shaper | ⬜ No status | ⬜ Unverified | TBD | F38-F41 likely one module — verify |

### Identity & Access

| ID | Feature | Claimed Status | Verified Status | Module/File | Notes |
|----|---------|---------------|-----------------|-------------|-------|
| F44 | TACACS+ Integration | New | ⬜ Unverified | TBD | |
| F45 | AD Integration | New | ⬜ Unverified | TBD | |
| F46 | LDAP Integration | New | ⬜ Unverified | TBD | |
| F47 | SSH CLI Access | New | ⬜ Unverified | TBD | Harden: disable root, key-only |
| F48 | SSO Integration | New | ⬜ Unverified | TBD | |
| F49 | SMS Security (OTP/Alert) | New | ⬜ Unverified | TBD | |
| F50 | Email Security | New | ⬜ Unverified | TBD | |
| F51 | WhatsApp Security (Notification/Alert) | New | ⬜ Unverified | TBD | |
| F52 | 2FA | New | ⬜ Unverified | TBD | TOTP/HOTP preferred |
| F53 | 802.1x (Port-Based NAC) | New | ⬜ Unverified | TBD | Distinct from F04 (802.1Q VLAN) |
| F54 | FQDN-Based Rules | New | ⬜ Unverified | TBD | |

### Monitoring & Management

| ID | Feature | Claimed Status | Verified Status | Module/File | Notes |
|----|---------|---------------|-----------------|-------------|-------|
| F42 | Logs / NAT / Syslog Forwarding | ⬜ No status | ⬜ Unverified | TBD | Typo fixed "Forwording" |
| F43 | SNMP v1/v2/v3 | Existing | ⬜ Unverified | TBD | |

### Identified Gaps — Features to Add

| ID | Feature | Priority | Rationale |
|----|---------|----------|-----------|
| G01 | DPI (Deep Packet Inspection) engine | HIGH | Core NGFW capability — may be implicit in App Filter, verify |
| G02 | SSL/TLS Inspection (inbound + outbound) | HIGH | Required for encrypted traffic visibility |
| G03 | High Availability (Active/Passive + Active/Active) | HIGH | Enterprise requirement |
| G04 | Centralized Management plane (REST API RBAC) | HIGH | Already partially exists — verify completeness |
| G05 | Reporting & Analytics (built-in) | HIGH | Audit, compliance, traffic reports |
| G06 | Certificate / PKI Management | MEDIUM | Needed for SSL inspection, VPN, 802.1x |
| G07 | Captive Portal (explicit feature) | MEDIUM | Referenced in IDAM but not listed standalone |
| G08 | SD-WAN | MEDIUM | F37 is adjacent but not equivalent |
| G09 | REST API management interface (documented) | MEDIUM | Automation, orchestration clients |
| G10 | Firmware / OTA Update Management | MEDIUM | Version control, rollback |
| G11 | Geo-IP DB update mechanism | LOW | Needed for F35 to stay current |
| G12 | ZTNA module | LOW | Group SSL VPN + SSO + 2FA + FQDN |

---

## 5. CODING STANDARDS & CONVENTIONS

### General Rules (All Languages)
- No hardcoded secrets, IPs, credentials — use config/env
- All network input must be validated and sanitized before processing
- Error paths must be explicit — no silent failures in security code
- Log security-relevant events at appropriate levels (never log raw packet payloads in production)
- Memory safety: prefer bounds-checked operations; in C/C++ use address sanitizer during dev

### C / C++ (Datapath & Kernel Modules)
- Follow Linux kernel coding style for kernel modules
- Use `nf_hook_ops` registration pattern for netfilter hooks
- Always check return values from kernel alloc functions
- No dynamic memory allocation in hot path — use pre-allocated pools
- Use `unlikely()` / `likely()` macros for error branches in fast path
- Compile with `-Wall -Wextra -Werror -fsanitize=address` in debug builds

### Go (Handlers, Config, Daemons, REST API)
- Follow `gofmt` / `golangci-lint` — no exceptions
- Use `context.Context` for all I/O operations with proper cancellation
- REST handlers: validate input schema before any processing
- Config changes must be atomic — use temp file + rename pattern
- Daemon shutdown must be graceful — handle SIGTERM cleanly
- All exported functions must have godoc comments

### Rust (High-Performance Components)
- `#![deny(unsafe_code)]` unless performance-critical with documented justification
- Use `tokio` for async I/O where applicable
- All `unwrap()` calls must be replaced with proper error handling before merge
- `clippy` must pass with no warnings

### Python (Tooling & Test Automation)
- Python 3.10+ only
- Use `black` for formatting, `mypy` for type checking
- All test scripts must be idempotent and produce clean output
- Use `argparse` for CLI tools — no hardcoded test parameters

### Lua / LuCI (Local UI)
- Follow LuCI module conventions: `luci.controller`, `luci.model.cbi`
- Every UI action that modifies config must call the corresponding REST API — no direct UCI writes from UI that bypass the API layer
- UI must validate input client-side AND the API must re-validate server-side
- JavaScript: use strict mode, no inline event handlers

### YAML (Config Schemas)
- Every YAML schema must have a JSON Schema or equivalent validation definition
- Version field mandatory in all config files: `schema_version: "1.0"`
- Sensitive fields must be marked: `# sensitive: true`

---

## 6. TEST PLAN

> **Environment**: OpenWrt x86, 10 Gbps firewall throughput, 2 Gbps threat prevention throughput
> **Users**: 500 enterprise users, IoT devices, DMZ with public web servers
> **Tools**: Choose appropriate per section. Prefer open tooling: Scapy, iperf3, hping3, Suricata test suites, testssl.sh, Wireshark/tshark, curl, wrk, ab, custom Go test harness

---

### Section 1 — Functional & Core Routing

| TC-ID | Feature | Objective | Methodology | Expected Result | Pass Criteria |
|-------|---------|-----------|-------------|-----------------|---------------|
| TC-F-001 | HA Active/Passive Failover | Verify failover time < 1s and session state preserved | 1. Establish 1000 concurrent TCP sessions through primary. 2. Kill primary node abruptly (power off). 3. Measure time to first packet through secondary. 4. Verify existing sessions survive. | Failover < 1 second. Session table replicated. No TCP resets on existing flows. | Failover time ≤ 1s. > 95% sessions survive. Syslog shows failover event. |
| TC-F-002 | HA Active/Active Load Distribution | Verify traffic distributed across both nodes | 1. Generate 10 Gbps traffic split across 4 flows. 2. Monitor per-node packet counters. 3. Kill one node. 4. Verify full traffic on surviving node. | Load distributed. Failover seamless. | Both nodes handling traffic. Post-failover throughput ≥ 9.5 Gbps. |
| TC-F-003 | OSPF Convergence Under Load | Verify OSPF reconverges < 5s on link failure | 1. Establish OSPF adjacency across 3 routers. 2. Push 5 Gbps traffic on primary path. 3. Kill primary link. 4. Measure reconvergence time via tshark. | Traffic reroutes via backup path. OSPF reconverges. | Reconvergence ≤ 5s. Zero packet loss after reconvergence. |
| TC-F-004 | BGP Route Propagation & Filtering | Verify BGP accepts/rejects routes per policy | 1. Advertise 100k routes from peer. 2. Apply route-map to filter RFC1918. 3. Verify RIB. 4. Withdraw 50k routes and verify RIB update. | Only non-RFC1918 routes in RIB. Withdrawal reflected within 30s. | RIB matches policy exactly. No leaked private routes. |
| TC-F-005 | SNAT Many-to-One | Verify SNAT rewrites src IP on egress | 1. 500 clients behind SNAT. 2. All initiate HTTP to external server. 3. Capture on WAN — verify single src IP. 4. Verify conntrack entries. | All 500 sessions appear as single IP on WAN. | Correct src IP rewrite. Conntrack entries match session count. No IP leak. |
| TC-F-006 | DNAT Port Forward | Verify inbound DNAT reaches correct DMZ host | 1. Configure DNAT: WAN:443 → DMZ:192.168.100.10:443. 2. Initiate HTTPS from external. 3. Capture on DMZ interface. | Packet reaches DMZ host with correct dst IP rewrite. | Dst IP/port correctly translated. Response correctly reverse-NATed. |
| TC-F-007 | VRF Isolation | Verify VRF instances do not leak routes | 1. Configure 3 VRFs. 2. Add overlapping 10.0.0.0/24 in each. 3. Attempt ping across VRFs without route leaking config. | Pings fail across VRFs. No route leakage. | Zero cross-VRF reachability unless explicitly configured. |
| TC-F-008 | Static Route Failover (Floating) | Verify floating static activates on primary failure | 1. Primary route AD=1, backup AD=254. 2. Bring down primary nexthop. 3. Verify backup installed in FIB. | Backup route active. Traffic forwarded. | FIB updated within 3s of nexthop failure. |

---

### Section 2 — Next-Generation Security Features

| TC-ID | Feature | Objective | Methodology | Expected Result | Pass Criteria |
|-------|---------|-----------|-------------|-----------------|---------------|
| TC-S-001 | DPI — HTTP Application Detection | Identify app on non-standard port | 1. Run HTTP on port 8888. 2. Apply DPI policy to block "HTTP" app. 3. Verify block regardless of port. | HTTP blocked on port 8888. | Connection reset/dropped. Log entry shows app=HTTP, action=block. |
| TC-S-002 | DPI — Throughput Impact | Measure DPI overhead vs baseline | 1. Baseline: 10 Gbps UDP flood, DPI off. 2. Enable DPI. 3. Re-run same traffic. 4. Compare throughput and latency. | Throughput degradation < 15%. Latency increase < 1ms p99. | Throughput ≥ 8.5 Gbps with DPI on. |
| TC-S-003 | SSL Inspection — TLS 1.3 Decryption | Verify TLS 1.3 traffic is inspectable | 1. Initiate TLS 1.3 session to test server. 2. Enable outbound SSL inspection. 3. Capture decrypted payload on inspection interface. 4. Verify cert substitution. | Traffic decrypted. Substituted cert presented to client. Original cert validated upstream. | Payload visible in inspection. Client receives firewall-signed cert. No TLS errors for trusted CA. |
| TC-S-004 | SSL Inspection — Bypass List | Verify banking/healthcare sites bypass inspection | 1. Add *.bankofamerica.com to bypass list. 2. Initiate HTTPS to that domain. 3. Verify original cert presented to client (no substitution). | Original cert unchanged. No decryption. | Client cert fingerprint matches origin server. No inspection log entry. |
| TC-S-005 | SSL Inspection — Resource Utilization | Measure CPU/memory under heavy decryption | 1. Generate 2000 concurrent TLS 1.3 sessions. 2. Monitor CPU, memory, crypto offload utilization every 10s. | System stable. No OOM. Throughput maintained. | CPU < 85%. Memory < 80%. No session drops. |
| TC-S-006 | App Control — Block BitTorrent on Port 80 | Block P2P disguised as HTTP | 1. Run BitTorrent client configured to use port 80. 2. Apply App Control policy: block BitTorrent. 3. Verify connection blocked. | BitTorrent blocked regardless of port. | Connection dropped. Log: app=BitTorrent, action=block. HTTP on port 80 from browser unaffected. |
| TC-S-007 | App Control — Microsoft 365 Micro-App | Allow Teams, block SharePoint within M365 | 1. Configure policy: allow Teams, block SharePoint, within M365 app group. 2. Test Teams call. 3. Test SharePoint file access. | Teams works. SharePoint blocked. | Teams traffic passes. SharePoint returns block page or reset. Both logged correctly. |
| TC-S-008 | User-ID — AD Roaming | Correct user identity on Wi-Fi roam | 1. User authenticates, gets IP-A. 2. User roams — gets IP-B. 3. Verify logs show correct username on IP-B within 10s. | User-IP mapping updated within 10s of roam. | No policy applied under wrong identity. Log attribution correct on new IP. |

---

### Section 3 — Threat Prevention & Content Filtering

| TC-ID | Feature | Objective | Methodology | Expected Result | Pass Criteria |
|-------|---------|-----------|-------------|-----------------|---------------|
| TC-T-001 | IPS — CVE Signature Detection | Detect known exploit attempt | 1. Use Metasploit or BreakingPoint to replay CVE-tagged exploit traffic against test target. 2. IPS enabled with default + strict profile. 3. Monitor alerts and block actions. | Exploit detected and blocked before reaching target. | Alert generated. Traffic blocked. Target not compromised. Correct CVE ID in log. |
| TC-T-002 | IPS — Fragmentation Evasion | Detect exploit split across IP fragments | 1. Use Scapy to fragment exploit payload across 4 IP fragments below 68-byte minimum reassembly size. 2. Send to IPS-protected target. | IPS reassembles and detects exploit. | Block action taken. Log shows evasion technique noted. Target not reached. |
| TC-T-003 | IPS — False Positive Rate | Measure false positives on benign traffic | 1. Replay 24h of captured enterprise traffic (cleaned of real exploits). 2. Count IPS alerts. 3. Manual verify sample of 100 alerts. | False positive rate < 0.1% of flows. | FP rate ≤ 0.1%. Zero blocking of known-good enterprise apps. |
| TC-T-004 | IPS — Obfuscation Evasion | Detect base64/XOR obfuscated shellcode | 1. Encode known shellcode in base64 inside HTTP POST. 2. Send to target. 3. Verify IPS decodes and detects. | IPS decodes obfuscation and matches signature. | Block action. Log shows decode + detection. |
| TC-T-005 | Antivirus — Known Malware Hash | Block EICAR and known malware downloads | 1. Host EICAR test file on HTTP server. 2. Client downloads via browser. 3. Verify gateway AV intercepts. | Download blocked. Block page shown. | File not delivered. Log: threat=EICAR, action=block. |
| TC-T-006 | Sandboxing — Zero-Day (Unknown File) | Detect unknown malicious file via sandbox | 1. Upload novel benign-looking executable with malicious behavior patterns. 2. Set sandbox policy: hold-and-scan. 3. Measure sandbox verdict time. | File held pending sandbox verdict. Verdict returned. Block or allow per result. | Verdict returned < 30s for cloud sandbox. File disposition matches verdict. Log records hash + verdict. |
| TC-T-007 | URL Filter — Category Block | Block gambling category | 1. Configure policy: block category=gambling. 2. Browse to known gambling site. 3. Verify block page. 4. Verify non-gambling HTTPS unaffected. | Gambling site blocked. Block page served. | HTTP 403 or reset. Log: category=gambling, action=block. Non-gambling unaffected. |
| TC-T-008 | URL Filter — Phishing Prevention | Block credential phishing page | 1. Set up test phishing clone of login page. 2. Submit real credentials to it. 3. Verify URL filter blocks before form submit. | Phishing URL blocked. Credentials not transmitted. | Block before POST. Log: category=phishing, action=block. |
| TC-T-009 | File Blocking — .exe via HTTP | Block executable downloads | 1. Host .exe and .scr files on HTTP server. 2. Configure file-blocking policy. 3. Attempt download. | Files blocked. Block page or TCP reset. | Neither .exe nor .scr delivered. Log: filetype=exe/scr, action=block. |
| TC-T-010 | Anti-Typosquatting | Block lookalike domains | 1. Register/simulate domains: g00gle.com, paypa1.com. 2. Browse to each. 3. Verify block. | Lookalike domains blocked. | Block action. Log: reason=typosquatting, action=block. Legitimate domains unaffected. |
| TC-T-011 | Domain Aging | Block newly registered domains (< 30 days) | 1. Test with domain registered < 7 days. 2. Policy: block domains < 30 days old. 3. Verify block. | New domain blocked. | Block action with reason=domain-age. Established domain unaffected. |
| TC-T-012 | Threat Intel Feed — C2 Block | Block known C2 IP/domain | 1. Add known C2 IOC to threat intel feed. 2. Attempt connection to C2 IP from internal host. 3. Verify block. | C2 connection blocked. | Block before TCP handshake completes. Log: reason=threat-intel, ioc=<value>. |

---

### Section 4 — Performance & Scalability

| TC-ID | Feature | Objective | Methodology | Expected Result | Pass Criteria |
|-------|---------|-----------|-------------|-----------------|---------------|
| TC-P-001 | Max Concurrent Sessions | Find session table limit | 1. Use hping3 + custom tool to open TCP sessions without closing. 2. Ramp from 100k to 10M sessions in 100k steps. 3. Monitor session table, memory, and CPU. 4. Record point of first drop. | System handles ≥ 1M concurrent sessions. Graceful degradation beyond limit. | ≥ 1M sessions before degradation. No kernel panic. Syslog warns at 90% table fill. |
| TC-P-002 | Connections Per Second (CPS) | Measure max new session rate | 1. Use wrk or custom Go tool to open+close TCP sessions rapidly. 2. Ramp CPS from 10k to 500k. 3. Record max sustainable CPS. | ≥ 100k CPS at baseline. | Sustained 100k CPS with < 0.1% failure rate for 60s. |
| TC-P-003 | Full Security Profile Throughput | Measure throughput with all features on | 1. Baseline: raw forwarding at 10 Gbps. 2. Enable App-ID + IPS + AV + SSL Inspection. 3. Measure throughput via iperf3. 4. Record degradation. | Throughput ≥ 2 Gbps with all profiles enabled (matches threat prevention spec). | Sustained ≥ 2 Gbps. No session drops. CPU < 90%. |
| TC-P-004 | Latency Under Load — VoIP | Measure RTP latency at 90% CPU | 1. Generate background traffic to drive CPU to 90%. 2. Inject RTP stream (G.711, 20ms packetization). 3. Measure one-way delay and jitter via tshark. | One-way latency < 10ms. Jitter < 5ms. | OWD ≤ 10ms p99. Jitter ≤ 5ms p99. Zero RTP packet reorder. |
| TC-P-005 | Latency Under Load — Video | Measure video stream quality at 90% CPU | 1. Stream 4K video (RTSP) through firewall. 2. Drive CPU to 90% with background traffic. 3. Measure packet loss and jitter. | Video stream uninterrupted. | Packet loss < 0.01%. Jitter < 10ms. No rebuffering. |
| TC-P-006 | Memory Leak — 24h Soak | Detect memory leaks under sustained load | 1. Run 5 Gbps mixed traffic for 24 hours. 2. All security profiles on. 3. Sample memory usage every 5 minutes. 4. Plot trend. | Memory usage stable. No monotonic growth. | Memory delta < 5% over 24h. No OOM events. |
| TC-P-007 | DoS Resistance — SYN Flood | Verify SYN cookie defense | 1. Generate 1M SYN/s flood toward firewall WAN IP. 2. Verify legitimate connections still succeed. 3. Monitor CPU and session table. | Legitimate traffic unaffected. SYN flood absorbed. | Legitimate CPS degradation < 10% during flood. No management plane lockout. |
| TC-P-008 | QoS Shaping Accuracy | Verify bandwidth limits enforced | 1. Configure QoS: class=video 500 Mbps, class=bulk 100 Mbps. 2. Generate excess traffic in both classes. 3. Measure actual throughput per class via tshark. | Video gets 500 Mbps ± 5%. Bulk capped at 100 Mbps. | Measured rates within 5% of policy. No starvation of any class. |

---

### Section 5 — Management, Logging & Compliance

| TC-ID | Feature | Objective | Methodology | Expected Result | Pass Criteria |
|-------|---------|-----------|-------------|-----------------|---------------|
| TC-M-001 | REST API — Config Push Latency | Measure time from API call to active policy | 1. POST new firewall rule via REST API. 2. Immediately test traffic matching rule. 3. Measure delta T from API response to enforcement. | Policy active < 2s after API response. | Enforcement latency ≤ 2s. API returns 200 only after validation. |
| TC-M-002 | REST API — Config Rollback | Verify rollback restores previous policy | 1. Push known-good config. 2. Push breaking config (blocks SSH). 3. Trigger rollback via API. 4. Verify SSH restored. | Previous config restored. Management access uninterrupted. | Rollback completes < 5s. Previous policy exactly restored. Audit log records both changes. |
| TC-M-003 | Orchestration vs Local UI Parity | Verify same feature behaves identically via both planes | 1. Configure feature X via REST API. Verify behavior. 2. Delete. 3. Reconfigure identical settings via LuCI. Verify behavior. 4. Compare. | Both planes produce identical system behavior. | Zero behavioral difference. Config stored identically in YAML/UCI. |
| TC-M-004 | Syslog Forwarding — High Volume | Verify no log loss during event storm | 1. Trigger 10,000 security events/second (IPS hits + URL blocks). 2. Count events at syslog receiver. 3. Compare to firewall-side event counter. | Zero log loss. Correct sequence numbers. | Log delivery ≥ 99.9%. Sequence gaps < 0.1%. |
| TC-M-005 | SNMP v3 — AuthPriv | Verify SNMPv3 with auth+privacy works | 1. Configure SNMPv3 with SHA auth + AES priv. 2. Poll OIDs for interface stats. 3. Verify values match CLI. 4. Attempt SNMPv1 — should be rejected if disabled. | Correct OID values. SNMPv1 rejected. | OID values ± 1% of CLI. SNMPv1 gets no response if disabled. |
| TC-M-006 | TACACS+ Auth | Verify admin login via TACACS+ | 1. Configure TACACS+ server. 2. Login to firewall via SSH and LuCI as TACACS+ user. 3. Verify privilege level. 4. Disconnect TACACS+ server — verify fallback to local auth. | Login succeeds. Correct privilege. Fallback works. | Auth succeeds via TACACS+. Local fallback activates within 5s of server loss. |
| TC-M-007 | 2FA — TOTP on SSH | Verify TOTP second factor enforced on SSH | 1. Configure 2FA with TOTP for SSH. 2. Login with correct password but wrong OTP — must fail. 3. Login with correct password + correct OTP — must succeed. | 2FA enforced. Wrong OTP rejected. | No bypass possible. Brute-force OTP attempt triggers lockout after 5 failures. |
| TC-M-008 | Audit Log — Policy Change | Every config change logged with actor | 1. Make 10 different config changes via API and UI as different users. 2. Review audit log. 3. Verify each change has: timestamp, username, source IP, change detail. | Complete audit trail. | 100% of changes logged. All fields populated. Logs tamper-evident (no in-place edit). |

---

### Additional Test Cases (Added by QA Lead)

| TC-ID | Feature | Objective | Pass Criteria |
|-------|---------|-----------|---------------|
| TC-X-001 | 802.1x Port Authentication | Unauthenticated device cannot access network | Device without valid cert/creds gets no IP. RADIUS reject logged. |
| TC-X-002 | FQDN Rules — Dynamic IP | Rule follows FQDN when IP changes | Policy enforced on new IP within one DNS TTL cycle. |
| TC-X-003 | VPN Split Tunneling | Only corporate traffic goes through VPN | Non-corporate traffic exits locally. Corporate traffic encrypted through tunnel. |
| TC-X-004 | Certificate Expiry Handling | Firewall alerts before cert expiry | Alert generated 30 days before expiry. Expired cert blocks SSL inspection gracefully (not crash). |
| TC-X-005 | PPTP Security Warning | PPTP deprecated — flag to operator | PPTP enable via UI/API generates security warning in log and UI. |
| TC-X-006 | IoT Segmentation | IoT VLAN cannot reach enterprise VLAN | Firewall zone policy drops cross-VLAN traffic. Verified with ping + port scan. |
| TC-X-007 | DMZ Inbound Only | DMZ servers cannot initiate to internal | Outbound DMZ→Internal blocked by default. Only established/related allowed. |
| TC-X-008 | Geo-IP DB Freshness | DB auto-updates and takes effect | After DB update, newly added country IPs blocked within 1 reload cycle. |
| TC-X-009 | SSH CLI Hardening | Root login disabled, key-only auth | Password auth rejected on SSH. Root login rejected. Only authorized keys accepted. |
| TC-X-010 | Config Encryption at Rest | YAML config with secrets encrypted | Sensitive fields (PSK, passwords) not in plaintext in config files on disk. |

---

## 7. CODE REVIEW CHECKLIST

Run this checklist on every file touched:

### Security
- [ ] No hardcoded credentials or secrets
- [ ] All user/network input validated before use
- [ ] Buffer bounds checked in all C/C++ code
- [ ] No format string vulnerabilities (`printf(user_input)` pattern)
- [ ] Authentication checked before any privileged operation
- [ ] Sensitive data zeroed from memory after use (`explicit_bzero`)
- [ ] No use of deprecated crypto (MD5, SHA1 for security, DES, RC4, TLS < 1.2)
- [ ] PPTP usage flagged with security warning in logs

### Correctness
- [ ] Error paths return errors — never silently drop them
- [ ] Packet processing handles malformed/truncated packets gracefully
- [ ] NAT conntrack entries cleaned up on session close
- [ ] netfilter hook priority order correct (PREROUTING, FORWARD, POSTROUTING)
- [ ] Thread safety: shared state protected with appropriate locks

### Performance
- [ ] No dynamic allocation in packet fast path (C/C++)
- [ ] No blocking I/O in Go goroutines handling packet events
- [ ] Proper use of RCU where applicable in kernel code
- [ ] Avoid per-packet syscalls — batch where possible

### Orchestration / API
- [ ] All REST endpoints authenticated and authorized
- [ ] Input schema validated before processing (not after)
- [ ] Config changes atomic — no partial state possible
- [ ] API responses do not leak internal error details to client

### UI (LuCI)
- [ ] All config changes go through REST API — no direct UCI bypass
- [ ] Input sanitized client-side AND server-side
- [ ] No sensitive data (PSK, passwords) returned in API GET responses in plaintext

---

## 8. DEVELOPMENT WORKFLOW (MANUAL)

Since CI/CD is manual, follow this workflow for every change:

```
1. Branch naming: feature/<feature-id>-<short-desc> or fix/<issue-short-desc>
2. Write code
3. Run language-specific linter (gofmt, golangci-lint, clang-tidy, clippy, black)
4. Run relevant test cases from Section 6 manually
5. Update Feature Registry status in this file
6. Update Session Log in Section 3
7. Document any new findings or architectural decisions inline
```

---

## 9. WHEN YOU GET CODE ACCESS — IMMEDIATE ACTIONS

**Follow the 3-Step Gate Process (Section 1). Hardware first, always.**

```bash
# ── Connect to the router ─────────────────────────────────────────────────
# ssh 10.80.80.57    (key auth, no password — see Section 2 DUT Access)

# ── HARDWARE DISCOVERY (before anything else) ──────────────────────────────
ssh 10.80.80.57 "cat /proc/cpuinfo | grep -E 'model name|cpu cores' | sort -u && nproc"
ssh 10.80.80.57 "free -h && cat /proc/meminfo | grep -E 'MemTotal|MemAvailable'"
ssh 10.80.80.57 "ip link show"
ssh 10.80.80.57 "cat /etc/openwrt_release; uname -a"
ssh 10.80.80.57 "cat /proc/loadavg && top -bn1 | head -5"

# ── CODEBASE MAPPING ────────────────────────────────────────────────────────
ssh 10.80.80.57 "find . -maxdepth 4 -type f | grep -v '.git' | sort"

# Language distribution
ssh 10.80.80.57 "echo Go: \$(find . -name '*.go' | wc -l); echo C: \$(find . -name '*.c' -o -name '*.h' | wc -l); echo Cpp: \$(find . -name '*.cpp' -o -name '*.cc' | wc -l); echo Rust: \$(find . -name '*.rs' | wc -l); echo Python: \$(find . -name '*.py' | wc -l); echo Lua: \$(find . -name '*.lua' | wc -l); echo YAML: \$(find . -name '*.yaml' -o -name '*.yml' | wc -l)"

# Entry points
ssh 10.80.80.57 "grep -r 'func main()' --include='*.go' -l"
ssh 10.80.80.57 "grep -r 'int main(' --include='*.c' --include='*.cpp' -l"

# netfilter hooks
ssh 10.80.80.57 "grep -r 'nf_register_hook\|nf_hook_ops\|nfqnl\|nf_register_net_hook' --include='*.c' -l"

# REST API router
ssh 10.80.80.57 "grep -r 'http.HandleFunc\|router\.\|mux\.\|gin\.\|echo\.\|fiber\.' --include='*.go' -l"

# LuCI controllers
ssh 10.80.80.57 "find . -path '*/controller/*.lua' | head -30"

# YAML schemas
ssh 10.80.80.57 "find . -name '*.yaml' -o -name '*.yml' | head -30"

# Build system
ssh 10.80.80.57 "find . -name 'Makefile' -o -name 'CMakeLists.txt' | head -10"
```

After running the above:
1. Calculate hardware-derived limits (Section 2a)
2. Update PROJECT.md hardware section
3. Update FEATURES.md verified status
4. Produce Step 2 report
5. Wait for confirmation before any changes

---

## 10. NOTES & DECISIONS LOG

> Append here during sessions. Never delete entries.

```
[001] PPTP (F32) is deprecated and cryptographically broken. Recommend:
      (a) If it must be supported, add a mandatory security warning on enable.
      (b) Disable by default, require explicit opt-in with warning acknowledgment.
      (c) Flag in UI and API docs as deprecated.
      Decision: Flag as deprecated, add warning, do not remove (backward compat).

[002] NAT appears in two places: F02d (basic, under Firewall) and F08 (advanced, standalone).
      Recommendation: Keep F02d as simple port-forward/masquerade under firewall zone,
      F08 as full NAT policy engine. Verify this matches code structure.

[003] QoS items F38-F41 likely map to one module (e.g., tc/HTB + SQM).
      Verify from code. If so, consolidate feature IDs with sub-feature notation.

[004] IPS/IDS confirmed existing by product owner. Was missing from original feature list.
      Added as F_IPS. Assign proper ID after code discovery.

[005] ZTNA not explicitly listed but can be composed from F30 (SSL VPN) + F48 (SSO) +
      F52 (2FA) + F54 (FQDN). Recommend creating a ZTNA feature group in next revision.
```
