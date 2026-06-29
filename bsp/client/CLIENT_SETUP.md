# NGFW Router — Client SSH Setup Guide

## What You Need

You need **one file** to connect to any UniGr8ways NGFW router:

```
ngfw_management_key      ← private key (get this from your administrator)
```

The public key is already baked into every router firmware image.  
No password is needed — ever.

---

## Step 1 — Get the Private Key

Ask your administrator for the file: **`ngfw_management_key`**

> Administrator: the file is at `C:\Users\Satish\.ssh\root_10_80_80_57`  
> Copy it and rename to `ngfw_management_key` before distributing.

---

## Step 2 — Place the Key File

### Windows
```
Copy ngfw_management_key to:   C:\Users\<YourName>\.ssh\ngfw_management_key
```

### Linux / Mac
```bash
cp ngfw_management_key ~/.ssh/ngfw_management_key
chmod 600 ~/.ssh/ngfw_management_key
```

---

## Step 3 — Add SSH Config Entry

### Windows — Edit `C:\Users\<YourName>\.ssh\config`
### Linux/Mac — Edit `~/.ssh/config`

Add an entry for each router:

```
Host <router-ip-or-nickname>
    HostName <router-ip>
    User root
    Port 19822
    IdentityFile ~/.ssh/ngfw_management_key
    IdentitiesOnly yes
    ServerAliveInterval 30
```

**Example for multiple routers:**
```
Host ngfw-hq
    HostName 10.80.80.57
    User root
    Port 19822
    IdentityFile ~/.ssh/ngfw_management_key
    IdentitiesOnly yes

Host ngfw-branch1
    HostName 192.168.10.1
    User root
    Port 19822
    IdentityFile ~/.ssh/ngfw_management_key
    IdentitiesOnly yes

Host ngfw-branch2
    HostName 192.168.20.1
    User root
    Port 19822
    IdentityFile ~/.ssh/ngfw_management_key
    IdentitiesOnly yes
```

---

## Step 4 — Connect

```bash
# By IP
ssh -i ~/.ssh/ngfw_management_key -p 19822 root@10.80.80.57

# Or by nickname (after SSH config is set up)
ssh ngfw-hq
ssh ngfw-branch1
```

No password prompt. You are in.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Permission denied (publickey)` | Key file permissions wrong — run `chmod 600 ~/.ssh/ngfw_management_key` |
| `WARNING: UNPROTECTED PRIVATE KEY FILE` | Same fix — `chmod 600` the key |
| `Connection refused` | Wrong port — confirm router uses port `19822` |
| `Host key verification failed` | Router was replaced — run `ssh-keygen -R [ip]:19822` then reconnect |
| Still failing | Check if router firmware version includes the BSP key baked in |

---

## Windows PuTTY Users

The key needs to be converted to PuTTY format (.ppk):

1. Open **PuTTYgen**
2. Click **Load** → select `ngfw_management_key`
3. Click **Save private key** → save as `ngfw_management_key.ppk`
4. In PuTTY: Connection → SSH → Auth → Browse to the `.ppk` file
5. Host: `10.80.80.57`, Port: `19822`, User: `root`

---

## Security Notes

- **Never share the private key over email or chat** — use a secure file transfer
- If a key is compromised: add a new public key to `/etc/dropbear/authorized_keys` on all routers, then remove the old one
- The key uses **ED25519** — modern, compact, and secure
- Password authentication is **disabled** on all routers — the key is the only way in
