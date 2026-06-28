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
| P0 | Codebase Discovery & Architecture Mapping | Code access | Claude | ⬜ Not started | On code access | — |
| P1 | Feature Audit — Claimed vs Code Reality | P0 | Claude | ⬜ Not started | After P0 | — |
| P2 | Gap Analysis & Priority Ranking | P1 | Claude | ⬜ Not started | After P1 | — |
| P3 | IPS/IDS — Code Review & Test Coverage | P0 | Claude | ⬜ Not started | After P0 | — |
| P4 | Bug Fixes — Issues Found in P1 | P1 | Claude | ⬜ Not started | After P1 | — |
| P5 | Missing Feature Design — G01–G12 | P2 | Claude | ⬜ Not started | After P2 | — |
| P6 | Missing Feature Implementation | P5 | Claude | ⬜ Not started | After P5 | — |
| P7 | New Requirements Implementation (F44–F54) | P0 | Claude | ⬜ Not started | After P0 | — |
| P8 | Test Execution — Section 1 (Functional) | P1 | Claude | ⬜ Not started | After P1 | — |
| P9 | Test Execution — Section 2 (NG Security) | P6 | Claude | ⬜ Not started | After P6 | — |
| P10 | Test Execution — Section 3 (Threat Prevention) | P6 | Claude | ⬜ Not started | After P6 | — |
| P11 | Test Execution — Section 4 (Performance) | P6 | Claude | ⬜ Not started | After P6 | — |
| P12 | Test Execution — Section 5 (Management) | P7 | Claude | ⬜ Not started | After P7 | — |
| P13 | UI Parity Audit — Orchestration vs LuCI | P7 | Claude | ⬜ Not started | After P7 | — |
| P14 | Code Documentation — Inline + API Docs | P6 | Claude | ⬜ Not started | After P6 | — |
| P15 | Security Hardening Review | P6 | Claude | ⬜ Not started | After P6 | — |
| P16 | Final Regression | All | Claude | ⬜ Not started | Last | — |

**Status**: ⬜ Not started | 🔄 In progress | ✅ Complete | ❌ Blocked | ⚠️ Needs review

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
| F44 | TACACS+ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| F45 | AD Integration | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| F46 | LDAP Integration | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| F47 | SSH CLI Access | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| F48 | SSO Integration | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| F49 | SMS Security | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| F50 | Email Security | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| F51 | WhatsApp Security | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| F52 | 2FA (TOTP/HOTP) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| F53 | 802.1x NAC | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| F54 | FQDN Rules | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

### Gap Features (G01–G12)

| ID | Feature | Design | Implement | REST API | LuCI UI | Tested | Done |
|----|---------|--------|-----------|----------|---------|--------|------|
| G01 | DPI Engine | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| G02 | SSL/TLS Inspection | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
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
| S1: Functional & Routing | 8 | 8 | 0 | 0 | 0 | 0 |
| S2: NG Security | 8 | 8 | 0 | 0 | 0 | 0 |
| S3: Threat Prevention | 12 | 12 | 0 | 0 | 0 | 0 |
| S4: Performance | 8 | 8 | 0 | 0 | 0 | 0 |
| S5: Management | 8 | 8 | 0 | 0 | 0 | 0 |
| S6: Additional | 10 | 10 | 0 | 0 | 0 | 0 |
| **TOTAL** | **54** | **54** | **0** | **0** | **0** | **0** |

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
