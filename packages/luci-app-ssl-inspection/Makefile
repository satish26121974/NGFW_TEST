include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-ssl-inspection
PKG_VERSION:=1.1.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=UniGr8ways <support@unigr8ways.com>
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-ssl-inspection
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=UniGr8ways SSL/TLS Inspection
  PKGARCH:=all
  DEPENDS:=luci-base, python3, +squid
endef

define Package/luci-app-ssl-inspection/description
  LuCI GUI for Squid ssl_bump SSL/TLS inspection. Settings + Live Status pages.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Compile
endef

define Package/luci-app-ssl-inspection/install
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/ssl
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/ssl/*.js $(1)/www/luci-static/resources/view/ssl/
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-ssl.json $(1)/usr/share/luci/menu.d/
	$(INSTALL_DIR) $(1)/usr/local/bin
	$(INSTALL_BIN) ./root/usr/local/bin/SSLBUMPSTART $(1)/usr/local/bin/
	$(INSTALL_BIN) ./root/usr/local/bin/UPDATEHOMENET $(1)/usr/local/bin/
endef

$(eval $(call BuildPackage,luci-app-ssl-inspection))
