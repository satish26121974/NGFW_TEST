include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-sms-gateway
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=UniGr8ways <support@unigr8ways.com>
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-sms-gateway
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=UniGr8ways SMS Gateway Integration
  PKGARCH:=all
  DEPENDS:=+luci-base +python3
endef

define Package/luci-app-sms-gateway/description
  LuCI GUI and backend for HTTP SMS Gateway integration.

  Supported providers:
    - Fast2SMS  (India — DLT registered, low cost)
    - MSG91     (India — enterprise, template-based)
    - Twilio    (Global — most reliable)
    - Vonage    (Global — good coverage)
    - TextLocal (India — bulk SMS)
    - Custom    (any HTTP webhook / REST API)

  Features:
    - Provider dropdown with dynamic fields per provider
    - DLT sender ID and route configuration for India
    - Fallback to 4G USB modem if HTTP gateway fails
    - Live test send with per-number result
    - Send log viewer and clear
    - Backend: /usr/local/bin/SENDSMS_GW (Python3, stdlib only)

  Config: /appdata/FWCONFIG/SMSGateway.json
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Compile
endef

define Package/luci-app-sms-gateway/conffiles
/appdata/FWCONFIG/SMSGateway.json
endef

define Package/luci-app-sms-gateway/install
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/sms-gateway
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/sms-gateway/*.js \
	    $(1)/www/luci-static/resources/view/sms-gateway/

	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-sms-gateway.json \
	    $(1)/usr/share/luci/menu.d/

	$(INSTALL_DIR) $(1)/usr/local/bin
	$(INSTALL_BIN) ./root/usr/local/bin/SENDSMS_GW $(1)/usr/local/bin/

	$(INSTALL_DIR) $(1)/appdata/FWCONFIG
	$(INSTALL_DATA) ./root/appdata/FWCONFIG/SMSGateway.json $(1)/appdata/FWCONFIG/
endef

$(eval $(call BuildPackage,luci-app-sms-gateway))
