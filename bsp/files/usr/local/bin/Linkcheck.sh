#!/bin/bash
# =============================================================================
# UniGr8ways SDWAN Interface & Load Balancer Management Script
# Optimized: reduced redundancy, safer variable handling, consistent style
# =============================================================================

set -o pipefail

# ---------------------------------------------------------------------------
# Constants & Paths
# ---------------------------------------------------------------------------
readonly LB_CONF="/appdata/LB.conf"
readonly SD_CONF="/appdata/SD.conf"
readonly GR8SDNAT="/appdata/GR8SDNAT.txt"
readonly LBLATENCY="/appdata/LBLATENCY"
readonly PPPOE_CONF="/appdata/PPPOE_LINK.conf"
readonly START_SCRIPT="/usr/local/bin/START"
readonly NB_CONF="/etc/network_balance.conf"
readonly LB_CHANGES_TMP="/tmp/LB_FILE_CHANGES"
readonly GR8_TMP="/tmp/gr8value"

readonly V_PEER1_IP="203.0.113.101"
readonly V_PEER1_SNAT="203.0.113.102"
readonly V_PEER2_IP="203.0.113.105"
readonly V_PEER2_SNAT="203.0.113.106"
readonly V_PEER3_IP="203.0.113.109"
readonly V_PEER3_SNAT="203.0.113.110"

readonly DNS_PRIMARY="208.67.220.220"
readonly DNS_FALLBACK="8.8.8.8"

IP_BIN=$(which ip)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
#log() { logger -t sdwan "$*"; echo "[$(date '+%T')] $*"; }
log() { echo "Finished...."; }

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


lbconfig_recover () {
LICENSE=$(uci get licence.data.lbkey)
cat >> /appdata/LB.conf <<EOF
################# LB Start ##############
################# LB Stop ##############

################# CDN Start ##############
################# CDN Stop ##############

################# LIC Start ##############
LIC:$LICENSE
################# LIC Stop ##############

############### Algorithms Start ########
LU
############### Algorithms Stop #########
EOF

}


# Get WAN latency from LBLATENCY file; $1=interface name e.g. eth0/wan/usb0
get_latency() {
    local iface="$1" default="${2:-1000}" key lat
    # Map interface name to latency key: eth0->WAN0, wan->wan, wan1->wan1, etc.
    case "$iface" in
        eth*)  key="WAN$(echo "$iface" | cut -c4-)" ;;
        wan)   key="wan" ;;
        wan[1-6]) key="$iface" ;;
        pppoe-wan) key="WAN0" ;;
        pppoe-*) key="$(echo "$iface" | cut -d- -f2)" ;;
        *)     key="$iface" ;;
    esac
    lat=$(grep -iw "$key" "$LBLATENCY" 2>/dev/null | cut -d: -f2)
    echo "${lat:-$default}"
}

# Get gateway for a WAN interface
get_eth_gw() {
    local iface="$1" router=""
    router=$(grep router /var/lib/misc/udhcpc-"${iface}".leases 2>/dev/null | awk '{print $3}' | cut -d\; -f1)
    if [[ -z "$router" ]]; then
        local uci_sec
        uci_sec=$(uci show network | grep wan | grep device | grep "${iface}" | cut -d. -f2)
        router=$(uci -q get "network.${uci_sec}.gateway")
    fi
    echo "$router"
}

is_valid_ipv4() {
    local ip="$1"
    [[ "$ip" == "0.0.0.0" ]] && return 1
    echo "$ip" | awk -F. 'NF==4 && $1<=255 && $2<=255 && $3<=255 && $4<=255 { exit 0 } { exit 1 }'
}

lb_has_interface() { grep -q "lb:${1}:" "$LB_CONF" 2>/dev/null; }

lb_get_gw() { grep "^lb:${1}:" "$LB_CONF" 2>/dev/null | cut -d: -f3 | head -1; }

lb_add_rule() {
    # $1=iface $2=gw $3=bw $4=dns $5=host $6=timeout $7=group $8=latency
    local rule="lb:${1}:${2}:${3}:${4}:${5}:${6}:${7}:${8}"
    sed -i '/^################# LB Start ##############/a '"${rule}"'' "$LB_CONF"
    log "LB rule added: $rule"
}

lb_remove_interface() {
    local iface="$1" line_no
    line_no=$(grep -n "^lb:${iface}:" "$LB_CONF" | awk -F: '{print $1}')
    [[ -n "$line_no" ]] && sed -i "${line_no}d" "$LB_CONF" && log "Removed LB entry for $iface"
}

lb_update_rule() {
    lb_remove_interface "$1"
    lb_add_rule "$@"
}

# ---------------------------------------------------------------------------
# Version / conntrack setup (runs once at top)
# ---------------------------------------------------------------------------
init_system() {
    local ver_main="/usr/local/bin/VER" ver_bel="/usr/share/cnergee/belras/VER"
    if [[ $(head -1 "$ver_main") != $(head -1 "$ver_bel") ]]; then
        cp "$ver_main" "$ver_bel"
        log "VER restored"
    fi

    sysctl -wq net.netfilter.nf_conntrack_max=524288

    md5sum "$LB_CONF"    | awk '{print $1}' > "$LB_CHANGES_TMP"
    md5sum "$GR8SDNAT"   | awk '{print $1}' > "$GR8_TMP"

    # Ensure main netns symlink exists
    [[ -f /var/run/netns/main ]] || ln -s /proc/1/ns/net /var/run/netns/main 2>/dev/null
}

# ---------------------------------------------------------------------------
# Model-specific MAC fix
# ---------------------------------------------------------------------------
set_wan_mac_for_INV_CEB_X7425E() {
    grep -q "INV-CEB-X7425E" /tmp/sysinfo/model 2>/dev/null || return
    uci -q get network.wan.macaddr && return
    local lanmac wanmac
    lanmac=$(cat /sys/class/net/eth1/address)
    wanmac="0a:$(echo "$lanmac" | cut -d: -f2-6)"
    uci set network.wan.macaddr="$wanmac"
    uci commit network
    log "WAN MAC set to $wanmac for INV-CEB-X7425E"
}

# ---------------------------------------------------------------------------
# Auto timezone detection
# ---------------------------------------------------------------------------
AUTOSETTZ() {
    touch /tmp/TZDATA
    local current_tz stored_tz
    current_tz=$(uci get system.@system[0].timezone 2>/dev/null)
    stored_tz=$(cat /tmp/TZDATA 2>/dev/null)
    [[ "$current_tz" == "$stored_tz" ]] && { log "TZDATA MATCH"; return; }

    local remote_tz
    remote_tz=$(curl -sf --max-time 10 -L "http://api.ipgeolocation.io/timezone" -e ";auto" | jq -r .timezone 2>/dev/null)
    [[ -z "$remote_tz" ]] && return

    local tz_str
    tz_str=$(grep -ri "$remote_tz" /usr/lib/lua/luci/sys/zoneinfo/tzdata.lua 2>/dev/null \
             | tr -d '{},' | awk '{print $2}' | cut -d"'" -f2 | head -1)

    uci set system.@system[0].timezone="$tz_str"
    uci set system.@system[0].zonename="$remote_tz"
    uci commit system
    echo "$tz_str" > /tmp/TZDATA
    /etc/init.d/system restart
    log "Timezone set to $remote_tz ($tz_str)"
}

# ---------------------------------------------------------------------------
# Gateway management
# ---------------------------------------------------------------------------

ADD_ETH_GW() {
    log "ADD_ETH_GW: scanning WAN interfaces"
    uci show network | grep device | grep wan | cut -d= -f2 | tr -d "'" | while read -r WANINT; do
        local lat router cur_gw
        lat=$(get_latency "$WANINT" 800)
        router=$(get_eth_gw "$WANINT")
        [[ -z "$router" ]] && continue

        if ! lb_has_interface "$WANINT"; then
            lb_add_rule "$WANINT" "$router" 100 "$DNS_FALLBACK" "google.com" 3 1 "$lat"
        else
            cur_gw=$(lb_get_gw "$WANINT")
            if [[ "$cur_gw" != "$router" ]]; then
                lb_update_rule "$WANINT" "$router" 100 "$DNS_FALLBACK" "google.com" 3 1 "$lat"
            fi
        fi
    done
}

REMOVE_DEAD_GW() {
    grep "^lb:" "$LB_CONF" | grep eth | while IFS=: read -r _ EINT GW _rest; do
        [[ -z "$EINT" ]] && continue
        if ! arping -q -c2 -I "$EINT" "$GW" &>/dev/null; then
            local proto
            proto=$(uci show network | grep wan | grep device | grep "$EINT" | cut -d. -f2 \
                    | xargs -I{} uci -q get network.{}.proto 2>/dev/null)
            if [[ "$proto" == *dhcp* ]]; then
                lb_remove_interface "$EINT"
                rm -f "/var/lib/misc/udhcpc-${EINT}.leases"
                log "Dead ETH GW removed: $EINT ($GW)"
                /usr/local/bin/SENDALERT WAN_DOWN "ETH GW dead: $EINT $GW" &
            fi
        fi
    done
}

ADD_USB_GW() {
    local LBGRP="$1"
    grep usb /proc/net/dev | awk -F: '{print $1}' | sed 's/ //g' | sort -u | while read -r USBINT; do
        lb_has_interface "$USBINT" && continue
        local router
        router=$(grep routers "/var/lib/misc/udhcpc-${USBINT}.leases" 2>/dev/null | awk '{print $3}' | tr -d ";")
        [[ -z "$router" ]] && continue
        if ping -q -c1 -W1 -I "$USBINT" "$router" &>/dev/null; then
            lb_update_rule "$USBINT" "$router" 100 "$DNS_PRIMARY" "google.com" 3 "$LBGRP" 1000
            log "USB GW added: $USBINT via $router"
        fi
    done
}

REMOVE_USB() {
    grep "^lb:" "$LB_CONF" | grep usb | while IFS=: read -r _ UINT GW _rest; do
        [[ -z "$UINT" ]] && continue
        if ! ping -q -c2 -W1 -I "$UINT" "$GW" &>/dev/null; then
            lb_remove_interface "$UINT"
            rm -f "/var/lib/misc/udhcpc-${UINT}.leases"
            log "USB interface removed: $UINT"
        fi
    done
}

ADD_PPP_GW() {
    grep pppoe /proc/net/dev | grep -v lo | awk -F: '{print $1}' | sed 's/ //g' | sort -u | while read -r PPPINT; do
        lb_has_interface "$PPPINT" && continue
        local lat router
        lat=$(get_latency "$PPPINT" 1000)
        router=$(ip r s | grep -w "$PPPINT" | grep -v default | awk '{print $1}')
        if [[ -z "$router" ]] && ifconfig "$PPPINT" &>/dev/null; then
            router=$(ifconfig "$PPPINT" | grep "P-t-P:" | awk '{print $3}' | cut -d: -f2)
            ifup "$(echo "$PPPINT" | cut -d- -f2)"
        fi
        [[ -z "$router" ]] && continue
        lb_update_rule "$PPPINT" "$router" 100 "$DNS_PRIMARY" "google.com" 3 1 "$lat"
        log "PPP GW added: $PPPINT via $router"
    done
}

REMOVE_PPP() {
    grep "^lb:" "$LB_CONF" | grep ppp | while IFS=: read -r _ PINT GW _rest; do
        [[ -z "$PINT" ]] && continue
        if ! ping -q -c2 -W1 -I "$PINT" "$GW" &>/dev/null; then
            lb_remove_interface "$PINT"
            log "PPP interface removed: $PINT"
        fi
    done
}

# ---------------------------------------------------------------------------
# DHCP WAN check
# ---------------------------------------------------------------------------
dhcp_wan_check() {
    uci show network | grep wan | grep device | cut -d= -f2 | tr -d "'" | while read -r WANIF; do
        local router
        router=$(grep routers "/var/lib/misc/udhcpc-${WANIF}.leases" 2>/dev/null | awk '{print $3}' | tr -d ";")
        if [[ -n "$router" ]] && ! lb_has_interface "$WANIF"; then
            lb_add_rule "$WANIF" "$router" 100 "$DNS_PRIMARY" "google.com" 3 1 800
            log "DHCP WAN added: $WANIF via $router"
        fi
    done
}

# ---------------------------------------------------------------------------
# Static route checks
# ---------------------------------------------------------------------------
static_route_check() {
    ip netns exec SDWAN ifconfig &>/dev/null || return
    local NSINTF
    NSINTF=$(ip netns exec SDWAN ip link show | grep eth | grep -v ether | awk '{print $2}' \
             | cut -d: -f1 | tr '\n' '|' | sed 's/|$//')

    sed -n "/####IP ROUTE START###/,/####IP ROUTE STOP###/p" "$START_SCRIPT" \
    | grep -v "^#" | grep -v "${NSINTF:-NOMATCH}" \
    | awk '{print $4,$5,$6,$7,$8}' | while read -r POOL VIA GWR DEVICE ROUTINT; do
        if ! ip r s | grep -qw "$POOL"; then
            grep "$ROUTINT" "$START_SCRIPT" \
            | sed -n "/####IP ROUTE START###/,/####IP ROUTE STOP###/p" | grep -v "^#" \
            | while read -r LINE; do
                [[ -n $(ip link show "$ROUTINT" 2>/dev/null | awk '{print $2}' | grep eth | cut -d: -f1) ]] \
                    && eval "$LINE" &>/dev/null
            done
            log "Static route re-added for $ROUTINT"
        fi
    done
}

static_route_ns_check() {
    sed -n "/####IP ROUTE START###/,/####IP ROUTE STOP###/p" "$START_SCRIPT" \
    | grep -v "^#" | awk '{print $4,$5,$6,$7,$8}' | while read -r POOL VIA GWR DEVICE ROUTINT; do
        if ! ip netns exec SDWAN ip r s | grep -q "$POOL"; then
            grep "$ROUTINT" "$START_SCRIPT" | grep -v "^#" | while read -r LINE; do
                [[ -n $(ip netns exec SDWAN ip link show "$ROUTINT" 2>/dev/null \
                       | awk '{print $2}' | grep eth | cut -d: -f1) ]] \
                    && ip netns exec SDWAN bash -c "$LINE" &>/dev/null
            done
        fi
    done
}

# ---------------------------------------------------------------------------
# Namespace / routing helpers
# ---------------------------------------------------------------------------
shift_gwif_to_main_ns() {
    uci show network | grep gateway | cut -d. -f2 | while read -r STWANLINK; do
        local dev
        dev=$(uci get "network.${STWANLINK}.device" 2>/dev/null)
        [[ -z "$dev" ]] && continue
        if [[ -z $(grep -w "${dev}:" /proc/net/dev | grep -v "v-eth") ]]; then
            ip netns exec SDWAN ip link set "$dev" netns 1
            ip link set "$dev" up
            log "Shifted $dev to main ns"
        fi
    done
}

check_default_r() {
    ip r s | grep -q default || { /usr/local/bin/CHANGELBNF; log "No default route; triggered CHANGELBNF"; }
}

check_ns_default() {
    ip netns exec SDWAN ifconfig &>/dev/null || return
    local sdnat
    sdnat=$(cat "$GR8SDNAT")
    local has_default
    has_default=$(ip netns exec SDWAN ip r s | grep default | awk '{print $1}')

    if [[ -z "$has_default" ]]; then
        if [[ "$sdnat" == "NOACCESS" ]]; then
            sed -n "/####IP ROUTE START###/,/####IP ROUTE STOP###/p" "$START_SCRIPT" \
            | grep -v "^#" | grep "0.0.0.0" | while read -r LINE; do
                ip netns exec SDWAN bash -c "$LINE"
            done
        elif [[ "$sdnat" == "DISABLE" ]]; then
            if ip netns exec SDWAN ip link show tun4100 &>/dev/null; then
                ip netns exec SDWAN ip r s | grep -q "default.*tun" || /usr/local/bin/CHANGELBNF
            fi
        fi
    else
        if [[ "$sdnat" == "DISABLE" ]] && ip netns exec SDWAN ip link show tun4100 &>/dev/null; then
            if ! ip netns exec SDWAN ip r s | grep -q "default.*tun"; then
                ip netns exec SDWAN ip r del default
                ip netns exec SDWAN ip addr show 2>/dev/null | grep tun | grep inet \
                | while read -r _ _ _ IPGW _ _ IPINT; do
                    local gw="${IPGW%%/*}"
                    ip netns exec SDWAN ip route add default nexthop via "$gw" dev "$IPINT" 2>/dev/null
                done
            fi
        fi
    fi
}

check_tun_def_gw() {
    ip netns exec SDWAN ifconfig &>/dev/null || return
    local client_tu_count sdnat
    client_tu_count=$(sed -n "/############## SD CLIENT TU START/,/############## SD CLIENT TU STOP/p" "$SD_CONF" \
                      | grep -v "^#" | wc -l)
    [[ "$client_tu_count" -eq 0 ]] && return

    sdnat=$(cat "$GR8SDNAT")
    [[ "$sdnat" != "DISABLE" ]] && return

    if ! ip netns exec SDWAN ip r s 2>/dev/null | grep -q "default.*tun"; then
        ip netns exec SDWAN ip addr show 2>/dev/null | grep tun | grep inet \
        | while read -r _ _ _ IPGW _ _ IPINT; do
            local gw="${IPGW%%/*}"
            ip netns exec SDWAN ip route add default nexthop via "$gw" dev "$IPINT" 2>/dev/null
        done
    fi
}

check_ns_lanroute() {
    ip netns exec SDWAN ifconfig &>/dev/null || return
    local sdnat has_default
    sdnat=$(cat "$GR8SDNAT")
    has_default=$(ip netns exec SDWAN ip r s | grep default | awk '{print $1}')

    if [[ -z "$has_default" && "$sdnat" != "ENABLE" && "$sdnat" == "NOACCESS" ]]; then
        sed -n "/####IP ROUTE START###/,/####IP ROUTE STOP###/p" "$START_SCRIPT" \
        | grep -v "^#" | grep "0.0.0.0" | while read -r LINE; do
            ip netns exec SDWAN bash -c "$LINE"
        done
    elif [[ -n "$has_default" && "$sdnat" != "ENABLE" ]]; then
        [[ $(ip netns exec SDWAN ip r s | grep -c nexthop) -gt 1 ]] \
            && ip netns exec SDWAN ip route del default
    fi
}


# ---------------------------------------------------------------------------
# NAT rules
# ---------------------------------------------------------------------------
set_nat_rules() {
    ip netns exec SDWAN ifconfig &>/dev/null || return
    local sdnat
    sdnat=$(cat "$GR8SDNAT")

    case "$sdnat" in
        ENABLE)
            local def_count
            def_count=$(ip netns exec SDWAN ip route show default 0.0.0.0/0 | wc -l)
            if [[ "$def_count" != "4" ]]; then
                ip netns exec SDWAN ip route del default 2>/dev/null
                if [[ $(ip netns exec SDWAN iptables -t nat --list-rules | grep -c FILTERRULE) -eq 0 ]]; then
                    ip netns exec SDWAN iptables -t nat -F
                    ip netns exec SDWAN iptables -t nat -X
                fi
                ip netns exec SDWAN ip route add default \
                    nexthop via "$V_PEER1_IP" dev v-peer1 weight 1 \
                    nexthop via "$V_PEER2_IP" dev v-peer2 weight 1 \
                    nexthop via "$V_PEER3_IP" dev v-peer3 weight 1
            fi
            if [[ $(ip netns exec SDWAN iptables -t nat -L -nv | grep -c NAT) -eq 0 ]]; then
                ip netns exec SDWAN iptables -t nat -A POSTROUTING -o v-peer1 -j SNAT --to "$V_PEER1_SNAT" 2>/dev/null
                ip netns exec SDWAN iptables -t nat -A POSTROUTING -o v-peer2 -j SNAT --to "$V_PEER2_SNAT" 2>/dev/null
                ip netns exec SDWAN iptables -t nat -A POSTROUTING -o v-peer3 -j SNAT --to "$V_PEER3_SNAT" 2>/dev/null
            fi
            ;;
        DISABLE)
            local link_count
            link_count=$(sed -n "/############## SD CLIENT TU START/,/############## SD CLIENT TU STOP/p" "$SD_CONF" \
                         | grep -v "^#" | awk -F: '{print $4}' | wc -l)
            ip netns exec SDWAN ip route del default 2>/dev/null
            if [[ "$link_count" -gt 0 ]]; then
                ip netns exec SDWAN ip addr show 2>/dev/null | grep tun | grep inet \
                | while read -r _ _ _ IPGW _ _ IPINT; do
                    local gw="${IPGW%%/*}"
                    ip netns exec SDWAN ip route add default nexthop via "$gw" dev "$IPINT" 2>/dev/null
                done
            fi
            ip netns exec SDWAN iptables -t nat -D POSTROUTING -o v-peer1 -j SNAT --to "$V_PEER1_SNAT" 2>/dev/null
            ip netns exec SDWAN iptables -t nat -D POSTROUTING -o v-peer2 -j SNAT --to "$V_PEER2_SNAT" 2>/dev/null
            ip netns exec SDWAN iptables -t nat -D POSTROUTING -o v-peer3 -j SNAT --to "$V_PEER3_SNAT" 2>/dev/null
            ;;
        NOACCESS)
            local default_tun
            default_tun=$(ip netns exec SDWAN ip route show | grep default | grep tun | awk '{print $1}')
            if [[ -z "$default_tun" ]]; then
                ip netns exec SDWAN ip route del default 2>/dev/null
                ip netns exec SDWAN iptables -t nat -D POSTROUTING -o v-peer1 -j SNAT --to "$V_PEER1_SNAT" 2>/dev/null
                ip netns exec SDWAN iptables -t nat -D POSTROUTING -o v-peer2 -j SNAT --to "$V_PEER2_SNAT" 2>/dev/null
                ip netns exec SDWAN iptables -t nat -D POSTROUTING -o v-peer3 -j SNAT --to "$V_PEER3_SNAT" 2>/dev/null
                check_ns_default
            else
                check_ns_default
                ip netns exec SDWAN iptables -t nat -D POSTROUTING -o v-peer1 -j SNAT --to "$V_PEER1_SNAT" 2>/dev/null
                ip netns exec SDWAN iptables -t nat -D POSTROUTING -o v-peer2 -j SNAT --to "$V_PEER2_SNAT" 2>/dev/null
                ip netns exec SDWAN iptables -t nat -D POSTROUTING -o v-peer3 -j SNAT --to "$V_PEER3_SNAT" 2>/dev/null
            fi
            ;;
        *)
            local link_count default_tun
            link_count=$(sed -n "/############## SD CLIENT TU START/,/############## SD CLIENT TU STOP/p" "$SD_CONF" \
                         | grep -v "^#" | awk -F: '{print $4}' | wc -l)
            [[ "$link_count" -eq 0 ]] && return
            default_tun=$(ip netns exec SDWAN ip route show | grep default | grep tun | awk '{print $1}')
            if [[ -z "$default_tun" ]]; then
                ip netns exec SDWAN ip route del default 2>/dev/null
                local new_default_ip
                new_default_ip=$(sed -n "/############## SD CLIENT TU START/,/############## SD CLIENT TU STOP/p" "$SD_CONF" \
                                 | grep -v "^#" | awk -F: '{print $4}' | head -1)
                ip netns exec SDWAN ip addr show 2>/dev/null | grep tun | grep inet \
                | while read -r _ _ _ IPGW _ _ IPINT; do
                    local gw="${IPGW%%/*}"
                    [[ "$new_default_ip" == "$gw" ]] \
                        && ip netns exec SDWAN ip route add default nexthop via "$gw" dev "$IPINT" 2>/dev/null
                done
                ip netns exec SDWAN iptables -t nat -F
                ip netns exec SDWAN iptables -t nat -X
                ip netns exec SDWAN iptables -t nat -D POSTROUTING -o v-peer1 -j SNAT --to "$V_PEER1_SNAT" 2>/dev/null
                ip netns exec SDWAN iptables -t nat -D POSTROUTING -o v-peer2 -j SNAT --to "$V_PEER2_SNAT" 2>/dev/null
                ip netns exec SDWAN iptables -t nat -D POSTROUTING -o v-peer3 -j SNAT --to "$V_PEER3_SNAT" 2>/dev/null
            fi
            ;;
    esac
}

maybe_set_nat_rules() {
    local sdnat vpeer_count
    sdnat=$(cat "$GR8SDNAT")
    vpeer_count=$(ip netns exec SDWAN iptables -t nat -L -nv 2>/dev/null | grep -c v-peer)

    if [[ "$sdnat" == "ENABLE" && "$vpeer_count" -eq 0 ]]; then
        set_nat_rules
    elif [[ "$sdnat" == "DISABLE" || "$sdnat" == "NOACCESS" ]] && [[ "$vpeer_count" -ne 0 ]]; then
        set_nat_rules
    fi
}

# ---------------------------------------------------------------------------
# Policy SNAT (no SDWAN ns)
# ---------------------------------------------------------------------------
check_snat_rule_if_nosdwan() {
    [[ $(cat "$GR8SDNAT") != "NOACCESS" ]] && return
    local rule_count policy_count
    rule_count=$(iptables -t nat -L -nv 2>/dev/null | grep -c "PoliCySnATRulE")
    policy_count=$(wc -l < /www/POLICYNAT 2>/dev/null || echo 0)
    if [[ "$rule_count" -eq 0 && "$policy_count" -gt 0 ]]; then
        ip netns exec SDWAN ifconfig &>/dev/null && return
        grep -v "LOCAL" /www/POLICYNAT | while IFS=: read -r SUBNET SNET; do
            iptables -t nat -I POSTROUTING -m comment --comment "PoliCySnATRulE" \
                -s "$SUBNET" -j SNAT --to "$SNET"
        done
    fi
}

# ---------------------------------------------------------------------------
# DHCP/Static interface check for main loop
# ---------------------------------------------------------------------------
DHSTATICHK() {
    sed -n "/######START IP ADDRESS######/,/######STOP IP ADDRESS######/p" "$START_SCRIPT" \
    | grep -v "^#" | awk '{print $8}' | while read -r STINT; do
        local sec proto
        sec=$(uci show network 2>/dev/null | grep wan | grep -v _dev | grep device \
              | awk -F. '{print $2,$3}' | grep "$STINT" | awk '{print $1}')
        proto=$(uci get "network.${sec}.proto" 2>/dev/null)
        if [[ "$proto" == "dhcp" ]]; then
            local line_no
            line_no=$(grep -n "dev $STINT" "$START_SCRIPT" | awk -F: '{print $1}')
            [[ -n "$line_no" ]] && sed -i "${line_no}d" "$START_SCRIPT"
        fi
    done
}

# ---------------------------------------------------------------------------
# PPPoE MSS clamping
# ---------------------------------------------------------------------------
PPPOESETMSS() {
    uci show network | grep pppoe | cut -d. -f2 | while read -r PPPWAN; do
        local dev mss
        dev=$(uci get "network.${PPPWAN}.device")
        mss=$(grep "$dev" "$PPPOE_CONF" 2>/dev/null | cut -d: -f8)
        [[ "$mss" == "DISABLE" || -z "$mss" ]] && mss=1440
        iptables -t mangle -C FORWARD -o "pppoe-${PPPWAN}" -p tcp \
            -m comment --comment "PPPTCPMSS" -m tcp --tcp-flags SYN,RST SYN \
            -j TCPMSS --set-mss "$mss" 2>/dev/null \
        || iptables -t mangle -A FORWARD -o "pppoe-${PPPWAN}" -p tcp \
            -m comment --comment "PPPTCPMSS" -m tcp --tcp-flags SYN,RST SYN \
            -j TCPMSS --set-mss "$mss"
    done

    if [[ $(grep -c eth "$PPPOE_CONF" 2>/dev/null) -eq 0 ]] \
       && [[ $(uci show network | grep -c pppoe) -eq 0 ]]; then
        iptables -t mangle --list-rules | grep PPPTCPMSS \
        | sed 's/^-A/iptables -t mangle -D /;s/$/ ;/' | bash
    fi
}

# ---------------------------------------------------------------------------
# ETH interface LB scan (main loop body)
# ---------------------------------------------------------------------------
scan_eth_interfaces() {
    local LBGRP="$1"

    grep eth /proc/net/dev | grep -v "v-eth" | awk '{print $1}' | cut -d: -f1 \
    | sed 's/ //g' | grep -v "^eth1$" | sort -u | while read -r INT; do

        local CHK_PPP lat INTWAN STATICCHK
        CHK_PPP=$(grep "$INT" "$PPPOE_CONF" 2>/dev/null | awk -F: '{print $2}')
        lat=$(get_latency "$INT" 1000)

        if [[ -n "$CHK_PPP" ]]; then
            ADD_PPP_GW
            continue
        fi

        INTWAN=$(uci show network | grep "$INT" | cut -d. -f2)
        STATICCHK=$(uci get "network.${INTWAN}.ipaddr" 2>/dev/null)

        if [[ -z "$STATICCHK" ]]; then
            # DHCP path
            lb_has_interface "$INT" && {
                # Check if IP is still valid
                local IPDCHEK IPACHK
                IPDCHEK=$(grep "fixed-address" "/var/lib/misc/udhcpc-${INT}.leases" 2>/dev/null | awk '{print $2}' | tr -d ";")
                IPACHK=$(ip addr show "$INT" 2>/dev/null | grep "inet " | grep -v inet6 | awk '{print $2}' | cut -d/ -f1)
                if [[ -z "$IPACHK" ]]; then
                    lb_remove_interface "$INT"
                fi
                continue
            }
            local router
            router=$(grep routers "/var/lib/misc/udhcpc-${INT}.leases" 2>/dev/null | awk '{print $3}' | tr -d ";")
            [[ -z "$router" ]] && continue

            local IPDCHEK IPACHK
            IPDCHEK=$(grep "fixed-address" "/var/lib/misc/udhcpc-${INT}.leases" 2>/dev/null | awk '{print $2}' | tr -d ";")
            IPACHK=$(ip addr show "$INT" 2>/dev/null | grep "inet " | grep -v inet6 | awk '{print $2}' | cut -d/ -f1)
            [[ "$IPDCHEK" != "$IPACHK" ]] && continue

            lb_add_rule "$INT" "$router" 100 "$DNS_PRIMARY" "google.com" 3 1 "$lat"
        else
            # Static IP path
            local router
            router=$(uci get "network.${INTWAN}.gateway" 2>/dev/null)
            [[ -n "$router" ]] && {
                local ns_check
                ns_check=$(ip netns exec SDWAN ip link show "$INT" 2>/dev/null | awk '{print $2}')
                [[ -n "$ns_check" ]] && ip netns exec SDWAN ip link set "$INT" netns 1 && ip link set "$INT" up
            }
            lb_has_interface "$INT" && continue
            if [[ -n "$router" ]]; then
                lb_add_rule "$INT" "$router" 100 "$DNS_PRIMARY" "google.com" 3 1 "$lat"
                log "Static GW added for $INT: $router"
            else
                log "No gateway found for static interface $INT"
            fi
        fi
    done
}

# ---------------------------------------------------------------------------
# ARP notify for eth interfaces
# ---------------------------------------------------------------------------
set_arp_notify() {
    grep eth /proc/net/dev | grep -v "v-eth" | awk '{print $1}' | cut -d: -f1 | sort -u | while read -r EINT; do
        echo 1 > "/proc/sys/net/ipv4/conf/${EINT}/arp_notify" 2>/dev/null
    done
    ip netns exec SDWAN cat /proc/net/dev 2>/dev/null | grep eth | grep -v "v-eth" \
    | awk '{print $1}' | cut -d: -f1 | sort -u | while read -r EINT; do
        ip netns exec SDWAN bash -c "echo 1 > /proc/sys/net/ipv4/conf/${EINT}/arp_notify" 2>/dev/null
    done
}

# ---------------------------------------------------------------------------
# LB process health check
# ---------------------------------------------------------------------------
ensure_lb_running() {
    # Kill duplicate lb instances
    #if [[ $(pgrep lb | wc -l) -gt 1 ]]; then
    #    killall lb
    #    lb -d -c "$NB_CONF" --port 5333
    #    sleep 60
    #    return
    #fi

    ## Restart if no default route but lb is configured with gw
    #if pgrep lb &>/dev/null; then
    #    if ! ip r s | grep default | grep -v 464 | grep -q metric; then
    #        if grep -q "gw" "$NB_CONF"; then
    #            killall lb && lb -d -c "$NB_CONF" --port 5333 && sleep 30
    #	sleep 30
    #            fi
    #      fi
    #fi

    ## Start lb if not running
    #if ! pgrep lb &>/dev/null; then
    #    if ! ip r s | grep -q default; then
    #        uci show network | grep wan | grep info | grep -v LAN | cut -d. -f2 | while read -r WANIFACE; do
    #            [[ -n "$WANIFACE" ]] && ifup "$WANIFACE"
    #        done
    #    fi
        pidof lb || {
	lb -d -c "$NB_CONF" --port 5333
	sleep 30
	}
    #fi
}

# ---------------------------------------------------------------------------
# LB config sanity check
# ---------------------------------------------------------------------------
check_lb_conf() {
    if [[ -z $(grep LIC "$LB_CONF" 2>/dev/null | grep -v "^#") ]]; then
        log "LB.conf blank — restoring defaults"
        cp /usr/share/cnergee/belras/defaults/LB.conf "$LB_CONF"
    fi
}

# ---------------------------------------------------------------------------
# MPLS route maintenance
# ---------------------------------------------------------------------------
check_mpls_routes() {
    sed -n "/####MPLS ROUTE START###/,/####MPLS ROUTE STOP###/p" "$START_SCRIPT" \
    | grep -v "^#" | while read -r _IP _RO _AD POOL _VIA GW _DEV INT; do
        ip r s | grep -qw "$POOL" && continue
        ip route add "$POOL" via "$GW" dev "$INT" 2>/dev/null
    done
}

# ---------------------------------------------------------------------------
# static wan gateway sync # This function is removed from 
# ---------------------------------------------------------------------------
sync_static_wan_gw_oldforonlyoneif() {
    local proto gw lbgw
    proto=$(uci get network.wan.proto 2>/dev/null)
    [[ "$proto" != "static" ]] && return
    gw=$(uci get network.wan.gateway 2>/dev/null)
    lbgw=$(grep "$gw" "$LB_CONF" 2>/dev/null)
    if [[ -z "$lbgw" ]]; then
        sed -i '/eth0/d' "$LB_CONF"
        log "Removed stale eth0 LB entry (static WAN GW mismatch)"
    fi
}

sync_static_wan_gw() {
    local sec proto iface gw lbgw
    local gw_count gw_secs gw_ifaces existing_sec

    # ── Step 1: Build a map of gateway → "sec1 sec2 ..." for all static wan* ──
    # We use a temp file since POSIX sh has no associative arrays.
    local GW_MAP="/tmp/sync_gw_map_$$"
    > "$GW_MAP"

    for sec in $(uci show network 2>/dev/null \
                 | awk -F'[.=]' '/=interface$/{print $2}' \
                 | grep -E '^wan([0-9]+)?$'); do

        proto=$(uci get "network.${sec}.proto" 2>/dev/null)
        [ "$proto" != "static" ] && continue

        gw=$(uci get "network.${sec}.gateway" 2>/dev/null)
        [ -z "$gw" ] && continue

        iface=$(uci get "network.${sec}.device" 2>/dev/null)
        [ -z "$iface" ] && iface=$(uci get "network.${sec}.ifname" 2>/dev/null)
        [ -z "$iface" ] && {
            log "WARN: ${sec} has no device/ifname — skipping"
            continue
        }

        # Format per line in GW_MAP:  <gateway> <sec>:<iface>
        echo "${gw} ${sec}:${iface}" >> "$GW_MAP"
    done

    # ── Step 2: Process each unique gateway ───────────────────────────────────
    local gw_list
    gw_list=$(awk '{print $1}' "$GW_MAP" | sort -u)

    for gw in $gw_list; do
        gw_secs=$(awk -v g="$gw" '$1==g{print $2}' "$GW_MAP")
        gw_count=$(echo "$gw_secs" | wc -l | tr -d ' ')

        lbgw=$(grep "$gw" "$LB_CONF" 2>/dev/null)

        if [ "$gw_count" -gt 1 ]; then
            # ── Shared gateway across multiple WAN interfaces ──────────────────
            log "INFO: Gateway ${gw} is shared by ${gw_count} WAN interfaces:"

            local shared_ifaces=""
            for pair in $gw_secs; do
                sec="${pair%%:*}"; iface="${pair##*:}"
                log "  → ${sec} (${iface})"
                shared_ifaces="${shared_ifaces:+$shared_ifaces }$iface"
            done

            if [ -z "$lbgw" ]; then
                # Gateway missing from LB — remove ALL iface entries for this gw
                log "WARN: Shared GW ${gw} missing from LB — removing all associated ifaces"
                for iface in $shared_ifaces; do
                    sed -i "/${iface}/d" "$LB_CONF"
                    log "  Removed stale ${iface} LB entry (shared GW ${gw} mismatch)"
                done
            else
                # Gateway present — verify each iface has its own LB entry
                for pair in $gw_secs; do
                    sec="${pair%%:*}"; iface="${pair##*:}"
                    if ! grep -q "$iface" "$LB_CONF" 2>/dev/null; then
                        log "WARN: ${sec} iface ${iface} missing from LB (shared GW ${gw})"
                        # Gateway is valid — flag only, do not remove
                    fi
                done
            fi

        else
            # ── Single WAN interface for this gateway ──────────────────────────
            sec="${gw_secs%%:*}"; iface="${gw_secs##*:}"
            if [ -z "$lbgw" ]; then
                sed -i "/${iface}/d" "$LB_CONF"
                log "Removed stale ${iface} LB entry (${sec} static WAN GW mismatch: ${gw})"
            fi
        fi
    done

    rm -f "$GW_MAP"
}


check_no_default_route (){
echo ""
ip r s | grep default || killall lb
}


check_route_tablelist () {
pidof lb && grep "gw" /etc/network_balance.conf && {
ip rule show | grep fwmark | grep 101 || killall lb
}
}


# ===========================================================================
# MAIN
# ===========================================================================
init_system

# Determine LB group
if [[ $(head -1 /appdata/GRPLB) == "ENABLE" ]]; then LBGRP=2; else LBGRP=1; fi

while true; do

    # Model-specific MAC setup
    ethtool -i eth0 2>/dev/null | grep -q "st_gmac" && set_wan_mac_for_INV_CEB_X7425E

    # LB process check / restart if needed
    #if pgrep lb &>/dev/null; then
    #    ip r s | grep default 2>/dev/null | grep -v linkdown | grep -q metric || {
    #        killall lb
    #        lb -d -c "$NB_CONF" --port 5333 && sleep 30
    #    }
    #fi

    /usr/local/bin/USBINT.sh
    sleep 2
    check_lb_conf
    

    AUTOSETTZ

    log "--- Begin interface scan ---"
    shift_gwif_to_main_ns
    ADD_USB_GW "$LBGRP"
    REMOVE_USB

    ADD_PPP_GW
    REMOVE_PPP

    scan_eth_interfaces "$LBGRP"

    sleep 1
    ADD_ETH_GW
    ADD_PPP_GW
    REMOVE_DEAD_GW

    # Reload LB if config changed
    LB_NEW=$(md5sum "$LB_CONF" | awk '{print $1}')
    LB_OLD=$(cat "$LB_CHANGES_TMP" 2>/dev/null)
    if [[ "$LB_NEW" != "$LB_OLD" ]]; then
        /usr/local/bin/CHANGELB &>/dev/null
        killall -HUP lb 2>/dev/null
        log "LB config changed — reloaded"
        echo "$LB_NEW" > "$LB_CHANGES_TMP"
    else
        log "LB config unchanged"
    fi

    maybe_set_nat_rules

    GR8_NEW=$(md5sum "$GR8SDNAT" | awk '{print $1}')
    GR8_OLD=$(cat "$GR8_TMP" 2>/dev/null)
    [[ "$GR8_NEW" != "$GR8_OLD" ]] && log "GR8SDNAT changed" && echo "$GR8_NEW" > "$GR8_TMP"

    REMOVE_PPP
    REMOVE_USB
    static_route_check
    check_ns_default
    static_route_ns_check
    check_default_r
    check_mpls_routes
    dhcp_wan_check
    check_tun_def_gw
    DHSTATICHK
    PPPOESETMSS
sleep 5

    [[ -f /var/run/netns/main ]] || ln -s /proc/1/ns/net /var/run/netns/main 2>/dev/null

    set_arp_notify
    check_snat_rule_if_nosdwan
    ##########################################################################sync_static_wan_gw
###############################################################################ip r s | grep -q default || killall lb
    check_no_default_route
    check_route_tablelist
	sleep 1
    ensure_lb_running
/usr/local/bin/check_lb_tables.sh
sleep 3
/usr/local/bin/check_lb_mangle.sh
cat /appdata/LB.conf | grep "lb:" | cut -f2 -d: | while read wif; do grep $wif /etc/network_balance.conf || /usr/local/bin/CHANGELB; sleep 1; done
cat /appdata/ALLOWED.txt | while read IP; do ipset add ALLOWED $IP 2> /dev/null; done
	###############################/usr/local/bin/check_default_routes.sh check
grep -qw Valid /appdata/check_lic || ip r s | grep default | egrep -v metric | grep linkdown | while read line; do ip r d $(echo $line | sed 's/ linkdown//g'); done
if [[ $(cat /appdata/LB.conf | wc -l) -eq "0" ]] ; then
lbconfig_recover
fi

    log "--- Interface check complete ---"
    sleep 3
done