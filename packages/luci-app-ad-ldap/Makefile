include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-ad-ldap
PKG_VERSION:=1.1.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=UniGr8ways <support@unigr8ways.com>
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-ad-ldap
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=UniGr8ways AD/LDAP Authentication
  PKGARCH:=all
  DEPENDS:=luci-base, python3, jq, +freeradius3
endef

define Package/luci-app-ad-ldap/description
  LuCI GUI for Active Directory and LDAP authentication via FreeRADIUS.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Compile
endef

define Package/luci-app-ad-ldap/install
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/controller
	$(INSTALL_DATA) ./root/usr/lib/lua/luci/controller/ldap.lua $(1)/usr/lib/lua/luci/controller/
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/view/admin_ldap
	$(INSTALL_DATA) ./root/usr/lib/lua/luci/view/admin_ldap/config.htm $(1)/usr/lib/lua/luci/view/admin_ldap/
	$(INSTALL_DIR) $(1)/usr/local/bin
	$(INSTALL_BIN) ./root/usr/local/bin/APPLYLDAP $(1)/usr/local/bin/
	$(INSTALL_DIR) $(1)/appdata/FWCONFIG
	$(INSTALL_DATA) ./root/appdata/FWCONFIG/LDAPConfig.json $(1)/appdata/FWCONFIG/
endef

$(eval $(call BuildPackage,luci-app-ad-ldap))
