include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-alerts
PKG_VERSION:=1.1.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=UniGr8ways <support@unigr8ways.com>
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-alerts
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=UniGr8ways Alert Notifications
  PKGARCH:=all
  DEPENDS:=luci-base, jq
endef

define Package/luci-app-alerts/description
  LuCI GUI for SMS, Email and WhatsApp alert notifications.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Compile
endef

define Package/luci-app-alerts/install
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/alerts
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/alerts/*.js $(1)/www/luci-static/resources/view/alerts/
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-alerts.json $(1)/usr/share/luci/menu.d/
	$(INSTALL_DIR) $(1)/usr/local/bin
	$(INSTALL_BIN) ./root/usr/local/bin/SENDALERT $(1)/usr/local/bin/
	$(INSTALL_BIN) ./root/usr/local/bin/SENDSMS $(1)/usr/local/bin/
	$(INSTALL_BIN) ./root/usr/local/bin/SENDEMAIL $(1)/usr/local/bin/
	$(INSTALL_BIN) ./root/usr/local/bin/SENDWHATSAPP $(1)/usr/local/bin/
	$(INSTALL_DIR) $(1)/appdata/FWCONFIG
	$(INSTALL_DATA) ./root/appdata/FWCONFIG/SMSAlert.json $(1)/appdata/FWCONFIG/
	$(INSTALL_DATA) ./root/appdata/FWCONFIG/EmailAlert.json $(1)/appdata/FWCONFIG/
	$(INSTALL_DATA) ./root/appdata/FWCONFIG/WhatsAppAlert.json $(1)/appdata/FWCONFIG/
endef

$(eval $(call BuildPackage,luci-app-alerts))
