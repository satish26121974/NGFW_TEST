include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-countryfilter
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=UniGr8ways <support@unigr8ways.com>
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-countryfilter
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=UniGr8ways Country Filter
  PKGARCH:=all
  DEPENDS:=+luci-base +jq
endef

define Package/luci-app-countryfilter/description
  LuCI GUI for country-based firewall filtering with interactive world map.
  Manages /appdata/BlockCountry.txt and calls CountryBlockSet.sh to apply rules.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Compile
endef

define Package/luci-app-countryfilter/install
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/countryfilter
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/countryfilter/settings.js \
		$(1)/www/luci-static/resources/view/countryfilter/
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/countryfilter/world-map-paths.js \
		$(1)/www/luci-static/resources/view/countryfilter/
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-countryfilter.json \
		$(1)/usr/share/luci/menu.d/
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-countryfilter.json \
		$(1)/usr/share/rpcd/acl.d/
	$(INSTALL_DIR) $(1)/usr/local/bin
	$(INSTALL_BIN) ./root/usr/local/bin/COUNTRYFILT $(1)/usr/local/bin/
endef

$(eval $(call BuildPackage,luci-app-countryfilter))
