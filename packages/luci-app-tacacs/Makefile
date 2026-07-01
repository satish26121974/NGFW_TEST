include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-tacacs
PKG_VERSION:=1.1.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=UniGr8ways <support@unigr8ways.com>
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-tacacs
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=UniGr8ways TACACS+ Authentication
  PKGARCH:=all
  DEPENDS:=+luci-base +python3
endef

define Package/luci-app-tacacs/description
  LuCI GUI for TACACS+ authentication with live test and audit log.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Compile
endef

define Package/luci-app-tacacs/install
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/tacacs
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/tacacs/*.js $(1)/www/luci-static/resources/view/tacacs/
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-tacacs.json $(1)/usr/share/luci/menu.d/
	$(INSTALL_DIR) $(1)/usr/local/bin
	$(INSTALL_BIN) ./root/usr/local/bin/TACAUTH $(1)/usr/local/bin/
	$(INSTALL_DIR) $(1)/appdata/FWCONFIG
	$(INSTALL_DATA) ./root/appdata/FWCONFIG/TACACS.json $(1)/appdata/FWCONFIG/
endef

$(eval $(call BuildPackage,luci-app-tacacs))
