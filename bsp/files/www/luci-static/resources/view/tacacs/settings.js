'use strict';
'require view';
'require fs';
'require ui';

var CFG = '/appdata/FWCONFIG/TACACS.json';

return view.extend({

	load: function() {
		return L.resolveDefault(
			fs.read(CFG).then(function(d) {
				try { return JSON.parse(d); } catch(e) { return {}; }
			}),
			{}
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
			'class': 'cbi-input-text', 'style': 'max-width:380px'
		});
	},

	_toggle: function(id, checked, label) {
		var cb = E('input', { 'id': id, 'type': 'checkbox', 'class': 'cbi-input-checkbox' });
		if (checked) cb.setAttribute('checked', 'checked');
		return E('span', {}, [
			cb, ' ',
			E('label', { 'for': id }, label || '')
		]);
	},

	/* ── save handler ───────────────────────────────────────────── */
	handleSave: function() {
		var get   = function(id) { return document.getElementById(id); };
		var val   = function(id) { return get(id) ? get(id).value.trim() : ''; };
		var chk   = function(id) { return get(id) && get(id).checked; };

		var cfg = {
			Status:          chk('tac_enabled') ? 'ENABLE' : 'DISABLE',
			Server:          val('tac_server'),
			Port:            parseInt(val('tac_port')) || 49,
			Key:             val('tac_key'),
			LocalFallback:   chk('tac_fallback') ? 'ENABLE' : 'DISABLE',
			FallbackTimeout: parseInt(val('tac_timeout')) || 5
		};

		var json = JSON.stringify(cfg, null, 2);

		return fs.write(CFG, json)
			.then(function() {
				ui.addNotification(null,
					E('p', _('TACACS+ configuration saved.')), 'info');
			})
			.catch(function(e) {
				ui.addNotification(null,
					E('p', _('Save failed: ') + e.message), 'error');
			});
	},

	/* ── render ─────────────────────────────────────────────────── */
	render: function(cfg) {
		var self = this;

		/* Status banner */
		var enabled = cfg.Status === 'ENABLE';
		var banner  = E('div', {
			'class': 'alert-message ' + (enabled ? 'info' : 'warning'),
			'style': 'margin-bottom:12px'
		}, enabled
			? _('TACACS+ authentication is ENABLED. Admin logins are forwarded to the TACACS+ server with local fallback.')
			: _('TACACS+ authentication is DISABLED. Admins log in using local credentials only.')
		);

		/* Section: Service Control */
		var secControl = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('Service Control')),
			E('div', { 'class': 'cbi-section-node' }, [
				this._field(
					_('Enable TACACS+'),
					_('When enabled, SSH and LuCI admin authentication is forwarded to the TACACS+ server. Local auth is used as fallback on server timeout.'),
					this._toggle('tac_enabled', enabled)
				)
			])
		]);

		/* Section: Server Settings */
		var secServer = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('TACACS+ Server')),
			E('div', { 'class': 'cbi-section-node' }, [
				this._field(
					_('Server IP / Hostname'),
					_('IP address or FQDN of the TACACS+ server (Cisco ISE, FreeRADIUS TACACS, tac_plus, etc.)'),
					this._input('tac_server', 'text', cfg.Server || '', '192.168.1.100')
				),
				this._field(
					_('Port'),
					_('Default TACACS+ port is 49.'),
					this._input('tac_port', 'number', cfg.Port || 49, '49')
				),
				this._field(
					_('Shared Secret Key'),
					_('Shared secret configured on both the TACACS+ server and this device.'),
					this._input('tac_key', 'password', cfg.Key || '', 'shared_secret')
				)
			])
		]);

		/* Section: Fallback */
		var secFallback = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('Fallback Behaviour')),
			E('div', { 'class': 'cbi-section-node' }, [
				this._field(
					_('Local Fallback'),
					_('If the TACACS+ server is unreachable (timeout/refused), fall back to local /etc/shadow credentials.'),
					this._toggle('tac_fallback', cfg.LocalFallback !== 'DISABLE', _('Enable local fallback'))
				),
				this._field(
					_('Fallback Timeout (seconds)'),
					_('How long to wait for a TACACS+ response before triggering fallback.'),
					this._input('tac_timeout', 'number', cfg.FallbackTimeout || 5, '5')
				)
			])
		]);

		/* Section: How It Works */
		var secInfo = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('How It Works')),
			E('div', { 'class': 'cbi-section-node cbi-section-descr' }, [
				E('p', {}, _('The TACACS+ client (/usr/local/bin/TACAUTH) implements RFC 1492 over TCP port 49.')),
				E('p', {}, _('Auth flow: TACAUTH <user> <pass> → returns PASS / FAIL / FALLBACK')),
				E('p', {}, [
					_('Configure your TACACS+ server to allow this device\'s IP as a NAS/client with the same shared secret. '),
					E('strong', {}, _('Use the Test & Status tab to verify connectivity before enabling.'))
				])
			])
		]);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('TACACS+ Authentication')),
			banner, secControl, secServer, secFallback, secInfo
		]);
	}
});
