'use strict';
'require view';
'require fs';
'require ui';

var CFG = '/appdata/FWCONFIG/SNMPV3.json';

return view.extend({

	load: function() {
		return L.resolveDefault(
			fs.read(CFG).then(function(d) {
				try { return JSON.parse(d); } catch(e) { return { users: [] }; }
			}),
			{ users: [] }
		);
	},

	/* ── helpers ────────────────────────────────────────────────── */
	_field: function(label, hint, inputEl) {
		return E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, label),
			E('div',   { 'class': 'cbi-value-field' }, [
				inputEl,
				hint ? E('div', { 'class': 'cbi-section-descr', 'style': 'margin-top:4px' }, hint) : ''
			])
		]);
	},

	_input: function(id, type, val, placeholder) {
		return E('input', {
			'id': id, 'type': type || 'text',
			'value': val || '', 'placeholder': placeholder || '',
			'class': 'cbi-input-text', 'style': 'max-width:320px'
		});
	},

	_select: function(id, options, selected) {
		return E('select', { 'id': id, 'class': 'cbi-input-select' },
			options.map(function(o) {
				return E('option', {
					'value': o.value,
					'selected': o.value === selected ? '' : null
				}, o.label);
			})
		);
	},

	/* ── state ──────────────────────────────────────────────────── */
	_users: null,

	/* ── save handler ───────────────────────────────────────────── */
	handleSave: function() {
		var users = this._users || [];
		var json  = JSON.stringify({ users: users }, null, 2);

		return fs.write(CFG, json)
			.then(function() {
				return fs.exec('/usr/local/bin/SNMPAPPLY', []);
			})
			.then(function(res) {
				var status = (res.stdout || '').trim();
				if (status === 'RUNNING') {
					ui.addNotification(null, E('p', _('SNMPv3 users saved and service restarted.')), 'info');
				} else {
					ui.addNotification(null, E('p', _('Users saved but snmpd may not be running. Check Status tab.')), 'warning');
				}
			})
			.catch(function(e) {
				ui.addNotification(null, E('p', _('Save failed: ') + e.message), 'error');
			});
	},

	/* ── render user row ────────────────────────────────────────── */
	_userRow: function(u, idx) {
		var self = this;
		var secLevel = { authPriv: 'Auth+Priv', authNoPriv: 'Auth only', noAuthNoPriv: 'No Auth/Priv' };
		var authBadge = E('span', {
			'style': 'display:inline-block;padding:2px 6px;border-radius:4px;font-size:11px;' +
			         'background:#5e72e4;color:#fff;font-weight:600;margin-right:4px'
		}, u.auth_proto || 'SHA');
		var privBadge = u.priv_proto ? E('span', {
			'style': 'display:inline-block;padding:2px 6px;border-radius:4px;font-size:11px;' +
			         'background:#11cdef;color:#fff;font-weight:600'
		}, u.priv_proto) : '';
		var accessBadge = E('span', {
			'style': 'display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;' +
			         'background:' + (u.access === 'rw' ? '#f5a623' : '#2dce89') + ';color:#fff;font-weight:600'
		}, u.access === 'rw' ? 'RW' : 'RO');

		return E('tr', { 'data-idx': idx }, [
			E('td', { 'style': 'padding:8px 12px;border-bottom:1px solid #e5e5e5;font-weight:600' }, u.name),
			E('td', { 'style': 'padding:8px 12px;border-bottom:1px solid #e5e5e5' }, [authBadge, privBadge]),
			E('td', { 'style': 'padding:8px 12px;border-bottom:1px solid #e5e5e5' }, secLevel[u.sec_level] || u.sec_level),
			E('td', { 'style': 'padding:8px 12px;border-bottom:1px solid #e5e5e5' }, [accessBadge]),
			E('td', { 'style': 'padding:8px 12px;border-bottom:1px solid #e5e5e5' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-negative',
					'style': 'padding:3px 10px;font-size:12px',
					'click': function() {
						self._users.splice(idx, 1);
						self.handleSave().then(function() { location.reload(); });
					}
				}, _('Delete'))
			])
		]);
	},

	/* ── render ─────────────────────────────────────────────────── */
	render: function(cfg) {
		var self  = this;
		var users = cfg.users || [];
		this._users = users;

		/* Existing users table */
		var rows = users.map(function(u, i) { return self._userRow(u, i); });
		var table = E('div', { 'style': 'overflow-x:auto;margin-bottom:16px' }, [
			E('table', { 'style': 'width:100%;border-collapse:collapse' }, [
				E('thead', {}, [
					E('tr', { 'style': 'background:#f8f9fa' }, [
						E('th', { 'style': 'padding:8px 12px;text-align:left;border-bottom:2px solid #ddd' }, _('Username')),
						E('th', { 'style': 'padding:8px 12px;text-align:left;border-bottom:2px solid #ddd' }, _('Protocols')),
						E('th', { 'style': 'padding:8px 12px;text-align:left;border-bottom:2px solid #ddd' }, _('Security Level')),
						E('th', { 'style': 'padding:8px 12px;text-align:left;border-bottom:2px solid #ddd' }, _('Access')),
						E('th', { 'style': 'padding:8px 12px;text-align:left;border-bottom:2px solid #ddd' }, _('Actions'))
					])
				]),
				E('tbody', {}, rows.length ? rows : [
					E('tr', {}, [E('td', {
						'colspan': '5',
						'style': 'padding:16px;text-align:center;color:#888'
					}, _('No SNMPv3 users configured'))])
				])
			])
		]);

		/* Add user form — shown/hidden via toggle */
		var formVisible = false;
		var formDiv = E('div', { 'id': 'v3_add_form', 'style': 'display:none' }, [
			E('div', { 'class': 'cbi-section-node', 'style': 'padding-top:0' }, [
				this._field(
					_('Username'),
					_('SNMPv3 username (USM security name). Case-sensitive, no spaces.'),
					this._input('v3_name', 'text', '', 'snmpv3user')
				),
				this._field(
					_('Security Level'),
					_('authPriv provides both authentication and encryption (recommended). authNoPriv provides authentication only. noAuthNoPriv provides no security (not recommended).'),
					this._select('v3_seclevel', [
						{ value: 'authNoPriv',  label: 'authNoPriv — Auth Only (Recommended for this device)' },
						{ value: 'authPriv',    label: 'authPriv — Auth + DES Encryption' },
						{ value: 'noAuthNoPriv',label: 'noAuthNoPriv — No Security' }
					], 'authNoPriv')
				),
				this._field(
					_('Auth Protocol'),
					_('Authentication hash algorithm. SHA is recommended; MD5 is legacy. SHA-256/SHA-512 are supported by snmpd but not all v3 clients.'),
					this._select('v3_authproto', [
						{ value: 'SHA',     label: 'SHA (Recommended)' },
						{ value: 'SHA-256', label: 'SHA-256' },
						{ value: 'MD5',     label: 'MD5 (Legacy)' }
					], 'SHA')
				),
				this._field(
					_('Auth Password'),
					_('Minimum 8 characters. Used to derive authentication keys.'),
					this._input('v3_authpass', 'password', '', 'auth_passphrase')
				),
				this._field(
					_('Privacy Protocol'),
					_('Encryption protocol. Note: this device\'s net-snmp build supports DES only (AES not available). Ignored if security level is authNoPriv.'),
					this._select('v3_privproto', [
						{ value: 'DES', label: 'DES (only option on this device)' }
					], 'DES')
				),
				this._field(
					_('Privacy Password'),
					_('Minimum 8 characters. Used to derive encryption keys. Ignored if security level is not authPriv.'),
					this._input('v3_privpass', 'password', '', 'priv_passphrase')
				),
				this._field(
					_('Access Level'),
					_('Read Only: can poll SNMP OIDs but cannot set values. Read/Write: can both poll and set OIDs.'),
					this._select('v3_access', [
						{ value: 'ro', label: 'Read Only' },
						{ value: 'rw', label: 'Read/Write' }
					], 'ro')
				),
				E('div', { 'style': 'margin-top:12px;display:flex;gap:8px' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-positive',
						'click': function() {
							var get = function(id) { return document.getElementById(id); };
							var val = function(id) { return get(id) ? get(id).value.trim() : ''; };

							var name      = val('v3_name');
							var secLevel  = val('v3_seclevel');
							var authProto = val('v3_authproto');
							var authPass  = val('v3_authpass');
							var privProto = val('v3_privproto');
							var privPass  = val('v3_privpass');
							var access    = val('v3_access');

							if (!name) {
								ui.addNotification(null, E('p', _('Username is required.')), 'warning');
								return;
							}
							if (secLevel !== 'noAuthNoPriv' && authPass.length < 8) {
								ui.addNotification(null, E('p', _('Auth password must be at least 8 characters.')), 'warning');
								return;
							}
							if (secLevel === 'authPriv' && privPass.length < 8) {
								ui.addNotification(null, E('p', _('Privacy password must be at least 8 characters.')), 'warning');
								return;
							}
							if (self._users.some(function(u) { return u.name === name; })) {
								ui.addNotification(null, E('p', _('A user with that name already exists.')), 'warning');
								return;
							}

							var newUser = {
								name:       name,
								auth_proto: authProto,
								auth_pass:  authPass,
								priv_proto: secLevel === 'authPriv' ? privProto : '',
								priv_pass:  secLevel === 'authPriv' ? privPass  : '',
								sec_level:  secLevel,
								access:     access
							};
							self._users.push(newUser);
							self.handleSave().then(function() { location.reload(); });
						}
					}, _('Add User')),
					E('button', {
						'class': 'btn cbi-button',
						'click': function() {
							formDiv.style.display = 'none';
							toggleBtn.textContent = '+ ' + _('Add SNMPv3 User');
							formVisible = false;
						}
					}, _('Cancel'))
				])
			])
		]);

		var toggleBtn = E('button', {
			'class': 'btn cbi-button cbi-button-neutral',
			'style': 'margin-bottom:12px',
			'click': function() {
				formVisible = !formVisible;
				formDiv.style.display = formVisible ? '' : 'none';
				toggleBtn.textContent = formVisible ? '▲ ' + _('Cancel') : '+ ' + _('Add SNMPv3 User');
			}
		}, '+ ' + _('Add SNMPv3 User'));

		var secAdd = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('Add SNMPv3 User')),
			E('div', { 'class': 'cbi-section-node' }, [toggleBtn, formDiv])
		]);

		var secInfo = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('SNMPv3 Security Notes')),
			E('div', { 'class': 'cbi-section-node cbi-section-descr' }, [
				E('p', {}, _('SNMPv3 provides strong authentication (HMAC-MD5/SHA) and payload encryption (DES/AES). Always use authPriv for production monitoring.')),
				E('p', {}, _('Passwords are stored in /appdata/FWCONFIG/SNMPV3.json. The snmpd service derives and stores keys at startup in /usr/lib/snmp/snmpd.conf.')),
				E('p', {}, [
					E('strong', {}, _('After adding users: ')),
					_('SNMP is restarted automatically. Test authNoPriv: '),
					E('code', { 'style': 'background:#f4f4f4;padding:2px 6px;border-radius:3px;font-size:13px' },
						'snmpwalk -v3 -l authNoPriv -u USERNAME -a SHA -A AUTHPASS 127.0.0.1'),
					E('br'), _(' Test authPriv (DES): '),
					E('code', { 'style': 'background:#f4f4f4;padding:2px 6px;border-radius:3px;font-size:13px' },
						'snmpwalk -v3 -l authPriv -u USERNAME -a SHA -A AUTHPASS -x DES -X PRIVPASS 127.0.0.1')
				])
			])
		]);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('SNMPv3 Users')),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', { 'class': 'cbi-section-node' }, _('Configured Users')),
				E('div', { 'class': 'cbi-section-node' }, [table])
			]),
			secAdd, secInfo
		]);
	}
});
