include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-2fa
PKG_VERSION:=1.1.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=UniGr8ways <support@unigr8ways.com>
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-2fa
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=UniGr8ways 2FA TOTP Authentication
  PKGARCH:=all
  DEPENDS:=+luci-base +python3
endef

define Package/luci-app-2fa/description
  LuCI GUI for RFC6238 TOTP two-factor authentication. Enrol/verify/revoke users.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Compile
endef

define Package/luci-app-2fa/install
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/totp
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/totp/*.js $(1)/www/luci-static/resources/view/totp/
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-totp.json $(1)/usr/share/luci/menu.d/
	$(INSTALL_DIR) $(1)/usr/local/bin
	$(INSTALL_BIN) ./root/usr/local/bin/TOTP $(1)/usr/local/bin/
	$(INSTALL_DIR) $(1)/etc/totp_secrets
	$(INSTALL_DIR) $(1)/appdata/FWCONFIG
	$(INSTALL_DATA) ./root/appdata/FWCONFIG/2FA.json $(1)/appdata/FWCONFIG/
endef

$(eval $(call BuildPackage,luci-app-2fa))
