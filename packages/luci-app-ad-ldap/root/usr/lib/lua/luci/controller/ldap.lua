-- LuCI AD / LDAP Authentication Controller
-- UniGr8ways NGFW — manages /appdata/FWCONFIG/LDAPConfig.json
-- Controller: /usr/lib/lua/luci/controller/ldap.lua

module("luci.controller.ldap", package.seeall)

local CFG = "/appdata/FWCONFIG/LDAPConfig.json"
local LOG = "/tmp/applyldap.log"

function index()
    local e = entry(
        {"admin", "services", "ldap"},
        call("action_index"),
        _("AD / LDAP Auth"), 65)
    e.dependent = false

    entry({"admin", "services", "ldap", "save"},
          call("action_save"), nil).leaf = true

    entry({"admin", "services", "ldap", "test"},
          call("action_test"), nil).leaf = true

    entry({"admin", "services", "ldap", "apply"},
          call("action_apply"), nil).leaf = true
end

-- Read JSON config via jq
local function jqr(key)
    local h = io.popen(string.format(
        "jq -r '%s // empty' %s 2>/dev/null", key, CFG))
    if not h then return "" end
    local v = h:read("*a") or ""
    h:close()
    return v:match("^%s*(.-)%s*$")  -- trim whitespace
end

local function read_cfg()
    local fs = require "nixio.fs"
    if not fs.access(CFG) then
        return {
            status="DISABLE", ldap_type="AD",
            server="", port="389",
            bind_dn="", bind_pass="", base_dn="",
            user_filter="(sAMAccountName=%u)", group_filter="", tls="false"
        }
    end
    return {
        status       = jqr(".Status"),
        ldap_type    = jqr(".Type"),
        server       = jqr(".Server"),
        port         = jqr(".Port"),
        bind_dn      = jqr(".BindDN"),
        bind_pass    = jqr(".BindPass"),
        base_dn      = jqr(".BaseDN"),
        user_filter  = jqr(".UserFilter"),
        group_filter = jqr(".GroupFilter"),
        tls          = jqr(".TLS"),
    }
end

local function read_log()
    local fs = require "nixio.fs"
    return fs.readfile(LOG) or ""
end

-- GET — show config page
function action_index()
    luci.template.render("admin_ldap/config", {
        cfg  = read_cfg(),
        msg  = nil,
        msgtype = nil,
        log  = read_log()
    })
end

-- POST — save config and optionally apply
function action_save()
    local http = require "luci.http"
    local sys  = require "luci.sys"

    local status       = http.formvalue("status")       == "1" and "ENABLE" or "DISABLE"
    local ldap_type    = http.formvalue("ldap_type")    or "AD"
    local server       = http.formvalue("server")       or ""
    local port         = http.formvalue("port")         or "389"
    local bind_dn      = http.formvalue("bind_dn")      or ""
    local bind_pass    = http.formvalue("bind_pass")    or ""
    local base_dn      = http.formvalue("base_dn")      or ""
    local user_filter  = http.formvalue("user_filter")  or "(sAMAccountName=%u)"
    local group_filter = http.formvalue("group_filter") or ""
    local tls          = http.formvalue("tls") == "1" and "true" or "false"

    -- Write JSON via Python3 (handles quoting/escaping safely)
    local tmpfile = "/tmp/ldap_cfg_new.json"
    local py = string.format(
[[python3 - << 'PYEOF'
import json, sys
cfg = {
    "Status":      %q,
    "Type":        %q,
    "Server":      %q,
    "Port":        int(%q) if %q.isdigit() else 389,
    "BindDN":      %q,
    "BindPass":    %q,
    "BaseDN":      %q,
    "UserFilter":  %q,
    "GroupFilter": %q,
    "TLS":         %s
}
with open("/appdata/FWCONFIG/LDAPConfig.json", "w") as f:
    json.dump(cfg, f, indent=2)
print("saved")
PYEOF
]],
        status, ldap_type, server, port, port,
        bind_dn, bind_pass, base_dn,
        user_filter, group_filter, tls)

    local result = sys.exec(py)
    local saved  = result:find("saved") ~= nil

    local msg, msgtype
    if saved then
        msg     = "Configuration saved successfully."
        msgtype = "success"
        if status == "ENABLE" then
            sys.exec("/usr/local/bin/APPLYLDAP > " .. LOG .. " 2>&1 &")
            msg = "Configuration saved. Applying to FreeRADIUS…"
        end
    else
        msg     = "Save failed. Check /tmp/ldap_cfg_new.json"
        msgtype = "danger"
    end

    luci.template.render("admin_ldap/config", {
        cfg     = read_cfg(),
        msg     = msg,
        msgtype = msgtype,
        log     = read_log()
    })
end

-- AJAX — apply config to FreeRADIUS
function action_apply()
    local http = require "luci.http"
    local sys  = require "luci.sys"
    local out  = sys.exec("/usr/local/bin/APPLYLDAP > " .. LOG .. " 2>&1; echo done")
    http.prepare_content("application/json")
    http.write(string.format('{"ok":true,"msg":"Applied. Check log below."}'))
end

-- AJAX — test LDAP TCP reachability + bind
function action_test()
    local http = require "luci.http"
    local sys  = require "luci.sys"

    local result = sys.exec(
[[python3 - << 'PYEOF'
import json, socket, sys

try:
    cfg = json.load(open("/appdata/FWCONFIG/LDAPConfig.json"))
    host = cfg.get("Server","")
    port = int(cfg.get("Port", 389))

    if not host:
        print(json.dumps({"ok": False, "msg": "No server configured"}))
        sys.exit(0)

    # TCP reachability
    s = socket.create_connection((host, port), timeout=5)
    s.close()

    # Try LDAP bind via ldapsearch if available
    import subprocess, shutil
    if shutil.which("ldapsearch"):
        bind = subprocess.run(
            ["ldapsearch", "-x", "-H",
             "ldap://%s:%d" % (host, port),
             "-D", cfg.get("BindDN",""),
             "-w", cfg.get("BindPass",""),
             "-b", cfg.get("BaseDN",""),
             "-s", "base"],
            capture_output=True, timeout=8)
        if bind.returncode == 0:
            print(json.dumps({"ok": True,
                "msg": "TCP OK + LDAP bind successful on %s:%d" % (host,port)}))
        else:
            err = bind.stderr.decode()[:120]
            print(json.dumps({"ok": False,
                "msg": "TCP OK but LDAP bind failed: " + err}))
    else:
        print(json.dumps({"ok": True,
            "msg": "TCP reachable on %s:%d (ldapsearch not installed for full test)" % (host,port)}))

except socket.timeout:
    print(json.dumps({"ok": False, "msg": "Timeout connecting to %s:%d" % (host,port)}))
except Exception as e:
    print(json.dumps({"ok": False, "msg": str(e)}))
PYEOF
]])

    http.prepare_content("application/json")
    -- Extract the JSON line from result
    local json_line = result:match("{.-}")
    http.write(json_line or '{"ok":false,"msg":"No response"}')
end
