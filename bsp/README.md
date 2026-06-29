# BSP Overlay Files

Drop these into your OpenWRT BSP build before compiling.

## Directory Structure

```
bsp/
├── files/                          ← copy contents into BSP files/ overlay
│   └── etc/
│       ├── uci-defaults/
│       │   └── 99-ssh-key-auth     ← runs once on first boot
│       └── dropbear/
│           └── authorized_keys     ← management public key baked into image
└── client/
    ├── CLIENT_SETUP.md             ← send this to every admin who needs access
    └── ngfw_management_key         ← PRIVATE KEY — NOT in git, get from admin
```

## How to Use

### Image Builder
```bash
cp -r bsp/files/* /path/to/image-builder/files/
make image PROFILE=x86_64 PACKAGES="..."
```

### Full Build System
```bash
cp -r bsp/files/* openwrt/files/
make -j$(nproc)
```

## What the BSP Script Does (99-ssh-key-auth)

On **first boot** of every router built from this image:

1. Writes the management public key to `/etc/dropbear/authorized_keys`
2. Sets `PasswordAuth=off` via UCI → no password logins ever
3. Sets `RootPasswordAuth=off` via UCI
4. Restarts Dropbear
5. Logs the event
6. **Self-removes** (uci-defaults scripts delete themselves after exit 0)

## Public Key (safe to store in git)

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIH4UiIVS4UkwMuj2ICZkjYx/s0kLztyt/heog1FyqoXJ ngfw-management
```

Key type: ED25519 | Generated: 2026-06-28 | Algorithm: RFC 8709

## Private Key Location (NOT in git)

```
C:\Users\Satish\.ssh\root_10_80_80_57
```

Distribute to admins as `ngfw_management_key` — see `client/CLIENT_SETUP.md`.
