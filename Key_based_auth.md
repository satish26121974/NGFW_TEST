# SSH Key-Based Authentication for OpenWRT Dropbear — Implementation Reference

> Documented from actual implementation on 2026-06-28.
> Router: `10.80.80.57` | Port: `19822` | User: `root`
> Goal: Passwordless SSH login using ED25519 key pair.

---

## The Critical Difference — Why Standard Guides Fail on OpenWRT

OpenWRT uses **Dropbear**, not OpenSSH. This one difference breaks every standard SSH key setup guide:

| | Standard Linux (OpenSSH) | OpenWRT (Dropbear) |
|---|---|---|
| SSH daemon | `sshd` | `dropbear` |
| Authorized keys path | `~/.ssh/authorized_keys` | `/etc/dropbear/authorized_keys` |
| Config file | `/etc/ssh/sshd_config` | startup arguments only |
| Key generation | `ssh-keygen` | `dropbearkey` |

> `ssh-copy-id` places keys in `~/.ssh/authorized_keys` — **Dropbear never reads this file**.
> The key will be there, permissions will look correct, but login will still fail with `Permission denied (publickey,password)`.

---

## What Was Set Up

### Key Pair Generated (Management Workstation)

```
Private key : C:\Users\Satish\.ssh\root_10_80_80_57
Public key  : C:\Users\Satish\.ssh\root_10_80_80_57.pub
Type        : ED25519
Comment     : root@10.80.80.57
```

Generated with:
```powershell
"`n`n" | ssh-keygen -t ed25519 -f "C:\Users\Satish\.ssh\root_10_80_80_57" -C "root@10.80.80.57" -q
```

> On Windows, empty passphrase must be fed via stdin (`\`n\`n`) — the `-N ""` flag does not work reliably with Windows OpenSSH.

### Public Key Installed on Router

Installed to: `/etc/dropbear/authorized_keys`

Done via Python + Paramiko (because Windows has no `ssh-copy-id` and SSH password prompts can't be automated in a non-interactive shell):

```python
import paramiko

pubkey = open(r"C:\Users\Satish\.ssh\root_10_80_80_57.pub").read().strip()

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.80.80.57', port=19822, username='root', password='admin', timeout=15)

cmds = [
    "mkdir -p /etc/dropbear",
    f"echo '{pubkey}' >> /etc/dropbear/authorized_keys",
    "sort -u /etc/dropbear/authorized_keys -o /etc/dropbear/authorized_keys",
    "chmod 600 /etc/dropbear/authorized_keys",
]
for cmd in cmds:
    stdin, stdout, stderr = client.exec_command(cmd)
    stdout.channel.recv_exit_status()

client.close()
```

> `sort -u` deduplicates the file — safe to run the script multiple times without adding duplicate keys.

### SSH Client Config (Windows)

File: `C:\Users\Satish\.ssh\config`

```
Host 10.80.80.57
    HostName 10.80.80.57
    User root
    Port 19822
    IdentityFile ~/.ssh/root_10_80_80_57
    IdentitiesOnly yes
```

With this config, connecting is simply:
```bash
ssh 10.80.80.57
```

---

## Verified Working

```
$ ssh -o BatchMode=yes 10.80.80.57 "id"
uid=0(root) gid=0(root)
```

No password prompt. Key auth confirmed.

> `whoami` and `hostname` are not available on this OpenWRT build — use `id` instead.

---

## Troubleshooting Reference

### Symptom: `Permission denied (publickey,password)` — key offered but rejected

**Diagnosis steps:**

1. Verify the key is in the correct file:
```bash
ssh 10.80.80.57 "cat /etc/dropbear/authorized_keys"
```

2. Verify it matches your local public key:
```bash
cat C:\Users\Satish\.ssh\root_10_80_80_57.pub
```
Both should show the same `AAAA...` base64 string.

3. Verify permissions:
```bash
ssh 10.80.80.57 "ls -la /etc/dropbear/"
```
Expected: `authorized_keys` should be `-rw-------` (600), `/etc/dropbear/` should be `drwx------` (700) or `drwxr-xr-x`.

4. Check Dropbear is reading the right file:
```bash
ssh 10.80.80.57 "ps | grep drop"
```
Look at the startup flags. No `-A` flag means it uses the default `/etc/dropbear/authorized_keys`.

**Root cause in our case:** Key was initially placed in `~/.ssh/authorized_keys` (wrong). Moving it to `/etc/dropbear/authorized_keys` fixed it immediately.

---

### Symptom: Initial connection with password also fails

Check if Dropbear was started with `-s` (disable password auth) or `-g` (disable root password login):
```bash
ssh 10.80.80.57 "ps | grep drop"
```
Default password for this router: `admin`

---

### Symptom: `Too many arguments` error from ssh-keygen on Windows

Use stdin to supply the empty passphrase instead of `-N ""`:
```powershell
"`n`n" | ssh-keygen -t ed25519 -f "path\to\key" -C "comment" -q
```

---

## Replicating for a New Router

For each additional OpenWRT router, run this script (change `HOST`, `PORT`, `PASSWORD`):

```python
import paramiko

HOST     = "192.168.x.x"   # router IP
PORT     = 22               # router SSH port
PASSWORD = "admin"          # current root password
PUBKEY   = open(r"C:\Users\Satish\.ssh\root_10_80_80_57.pub").read().strip()

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username='root', password=PASSWORD, timeout=15)

for cmd in [
    "mkdir -p /etc/dropbear",
    f"grep -qxF '{PUBKEY}' /etc/dropbear/authorized_keys 2>/dev/null || echo '{PUBKEY}' >> /etc/dropbear/authorized_keys",
    "chmod 600 /etc/dropbear/authorized_keys",
]:
    stdin, stdout, stderr = client.exec_command(cmd)
    stdout.channel.recv_exit_status()

client.close()
print(f"[OK] Key installed on {HOST}")
```

Then add an entry to `~/.ssh/config`:
```
Host <ROUTER_IP>
    HostName <ROUTER_IP>
    User root
    Port <PORT>
    IdentityFile ~/.ssh/root_10_80_80_57
    IdentitiesOnly yes
```

---

## BSP Integration — Bake Key into Firmware at Build Time

To ship all routers with key auth pre-configured, add the public key to the OpenWRT build overlay:

### Method 1: Files Overlay (key baked into image)

```
openwrt-build/
└── files/
    └── etc/
        └── dropbear/
            └── authorized_keys    ← paste public key content here
```

The file lands at `/etc/dropbear/authorized_keys` in the built image.

### Method 2: uci-defaults First-Boot Script

Create `files/etc/uci-defaults/99-ssh-key`:
```sh
#!/bin/sh
mkdir -p /etc/dropbear
cat >> /etc/dropbear/authorized_keys << 'EOF'
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIH4UiIVS4UkwMuj2ICZkjYx/s0kLztyt/heog1FyqoXJ root@10.80.80.57
EOF
chmod 600 /etc/dropbear/authorized_keys
exit 0
```

Runs once on first boot, self-removes. Use this when the key must not be hardcoded in the image binary.

### Disable Password Auth After Key is Confirmed (Hardening)

```bash
uci set dropbear.@dropbear[0].PasswordAuth='off'
uci set dropbear.@dropbear[0].RootPasswordAuth='off'
uci commit dropbear
/etc/init.d/dropbear restart
```

Add these to a uci-defaults script to enforce from factory.

---

## Current Router SSH Details

| Parameter | Value |
|-----------|-------|
| IP | `10.80.80.57` |
| Port | `19822` |
| User | `root` |
| Default Password (pre-key) | `admin` |
| Auth Method | ED25519 key, no password |
| Private Key | `C:\Users\Satish\.ssh\root_10_80_80_57` |
| Public Key | `C:\Users\Satish\.ssh\root_10_80_80_57.pub` |
| Router authorized_keys | `/etc/dropbear/authorized_keys` |
| SSH Config | `C:\Users\Satish\.ssh\config` |
| Connect Command | `ssh 10.80.80.57` |
