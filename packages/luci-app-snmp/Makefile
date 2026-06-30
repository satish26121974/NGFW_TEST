include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-snmp
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=UniGr8ways <support@unigr8ways.com>
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-snmp
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=UniGr8ways SNMP Configuration
  PKGARCH:=all
  DEPENDS:=luci-base python3
endef

define Package/luci-app-snmp/description
  LuCI GUI for SNMP v1/v2c/v3 configuration with SNMPv3 user management.
  Provides system settings, community string management, SNMPv3 USM user
  management (createUser with auth/priv protocols), and live status/test view.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Compile
endef

define Package/luci-app-snmp/install
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/snmp
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/snmp/*.js \
	    $(1)/www/luci-static/resources/view/snmp/

	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-snmp.json \
	    $(1)/usr/share/luci/menu.d/

	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-snmp.json \
	    $(1)/usr/share/rpcd/acl.d/

	$(INSTALL_DIR) $(1)/usr/local/bin
	$(INSTALL_BIN) ./root/usr/local/bin/SNMPV3INJECT $(1)/usr/local/bin/
	$(INSTALL_BIN) ./root/usr/local/bin/SNMPAPPLY    $(1)/usr/local/bin/
	$(INSTALL_BIN) ./root/usr/local/bin/SNMPSYS      $(1)/usr/local/bin/

	$(INSTALL_DIR) $(1)/appdata/FWCONFIG
	$(INSTALL_DATA) ./root/appdata/FWCONFIG/SNMPV3.json \
	    $(1)/appdata/FWCONFIG/SNMPV3.json.default
endef

$(eval $(call BuildPackage,luci-app-snmp))
