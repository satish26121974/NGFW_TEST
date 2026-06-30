include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-fqdn
PKG_VERSION:=1.1.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=UniGr8ways <support@unigr8ways.com>
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-fqdn
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=UniGr8ways FQDN-Based Firewall Rules
  PKGARCH:=all
  DEPENDS:=luci-base, jq
endef

define Package/luci-app-fqdn/description
  LuCI GUI for FQDN firewall rules using ipset and DNS resolution.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Compile
endef

define Package/luci-app-fqdn/install
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/fqdn
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/fqdn/*.js $(1)/www/luci-static/resources/view/fqdn/
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-fqdn.json $(1)/usr/share/luci/menu.d/
	$(INSTALL_DIR) $(1)/usr/local/bin
	$(INSTALL_BIN) ./root/usr/local/bin/FQDNRULES $(1)/usr/local/bin/
	$(INSTALL_DIR) $(1)/appdata/FWCONFIG
	$(INSTALL_DATA) ./root/appdata/FWCONFIG/FQDNRules.json $(1)/appdata/FWCONFIG/
endef

$(eval $(call BuildPackage,luci-app-fqdn))
