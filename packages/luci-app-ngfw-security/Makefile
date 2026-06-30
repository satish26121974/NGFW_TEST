include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-ngfw-security
PKG_VERSION:=1.1.0
PKG_RELEASE:=1

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=UniGr8ways <support@unigr8ways.com>
# NOTE: OpenWRT 23.05+ changed .ipk format from ar archive to gzip tar.
# The outer .ipk is now a gzip-compressed tar containing:
#   ./debian-binary, ./control.tar.gz, ./data.tar.gz
# Build this package with: make package/luci-app-ngfw-security/compile

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-ngfw-security
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=UniGr8ways NGFW Security (meta-package)
  PKGARCH:=all
  DEPENDS:=+luci-app-ssl-inspection +luci-app-ad-ldap +luci-app-tacacs +luci-app-2fa +luci-app-fqdn +luci-app-alerts
endef

define Package/luci-app-ngfw-security/description
  Meta-package that installs all UniGr8ways NGFW LuCI security apps:
    - luci-app-ssl-inspection  (SSL/TLS Inspection)
    - luci-app-ad-ldap         (AD/LDAP Authentication)
    - luci-app-tacacs          (TACACS+ Authentication)
    - luci-app-2fa             (2FA TOTP)
    - luci-app-fqdn            (FQDN-Based Firewall Rules)
    - luci-app-alerts          (Alert Notifications: SMS/Email/WhatsApp)

  Also includes SSH key-based auth (uci-defaults) and
  modified system scripts (IPSSTART, SDOSSTART, Linkcheck.sh).

  Install individual packages directly for selective deployment.
endef

# No compile step — all files are pre-built scripts and JS
define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Compile
endef

define Package/luci-app-ngfw-security/conffiles
/appdata/FWCONFIG/TACACS.json
/appdata/FWCONFIG/LDAPConfig.json
/appdata/FWCONFIG/2FA.json
/appdata/FWCONFIG/SMSAlert.json
/appdata/FWCONFIG/EmailAlert.json
/appdata/FWCONFIG/WhatsAppAlert.json
/appdata/FWCONFIG/FQDNRules.json
/appdata/FWCONFIG/Dot1xConfig.json
/etc/dropbear/authorized_keys
endef

define Package/luci-app-ngfw-security/install
	# ── LuCI JS views ────────────────────────────────────────────────
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/tacacs
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/tacacs/*.js \
	    $(1)/www/luci-static/resources/view/tacacs/

	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/totp
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/totp/*.js \
	    $(1)/www/luci-static/resources/view/totp/

	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/fqdn
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/fqdn/*.js \
	    $(1)/www/luci-static/resources/view/fqdn/

	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/alerts
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/alerts/*.js \
	    $(1)/www/luci-static/resources/view/alerts/

	# ── LuCI menu entries ────────────────────────────────────────────
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/*.json \
	    $(1)/usr/share/luci/menu.d/

	# ── Lua controller + view (AD/LDAP) ─────────────────────────────
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/controller
	$(INSTALL_DATA) ./root/usr/lib/lua/luci/controller/ldap.lua \
	    $(1)/usr/lib/lua/luci/controller/

	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/view/admin_ldap
	$(INSTALL_DATA) ./root/usr/lib/lua/luci/view/admin_ldap/config.htm \
	    $(1)/usr/lib/lua/luci/view/admin_ldap/

	# ── Backend scripts ──────────────────────────────────────────────
	$(INSTALL_DIR) $(1)/usr/local/bin
	$(INSTALL_BIN) ./root/usr/local/bin/* \
	    $(1)/usr/local/bin/

	# ── SSH key-auth first-boot script ───────────────────────────────
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./root/etc/uci-defaults/99-ssh-key-auth \
	    $(1)/etc/uci-defaults/

	# ── Dropbear authorised keys (baked into image) ──────────────────
	$(INSTALL_DIR) $(1)/etc/dropbear
	$(INSTALL_DATA) ./root/etc/dropbear/authorized_keys \
	    $(1)/etc/dropbear/

	# ── Default config JSON files ─────────────────────────────────────
	$(INSTALL_DIR) $(1)/appdata/FWCONFIG
	$(INSTALL_DATA) ./root/appdata/FWCONFIG/*.json \
	    $(1)/appdata/FWCONFIG/

	# ── Empty dirs needed at runtime ─────────────────────────────────
	$(INSTALL_DIR) $(1)/etc/totp_secrets
	$(INSTALL_DIR) $(1)/var/log/BELRAS
endef

$(eval $(call BuildPackage,luci-app-ngfw-security))
