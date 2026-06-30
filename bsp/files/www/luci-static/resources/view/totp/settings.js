'use strict';
'require view';
'require fs';
'require ui';

var CFG       = '/appdata/FWCONFIG/2FA.json';
var TOTP_BIN  = '/usr/local/bin/TOTP';
var SEC_DIR   = '/etc/totp_secrets';

return view.extend({

	load: function() {
		return Promise.all([
			/* Read 2FA config */
			L.resolveDefault(fs.read(CFG).then(function(d) {
				try { return JSON.parse(d); } catch(e) { return {}; }
			}), {}),
			/* Count enrolled users */
			L.resolveDefault(fs.exec('/bin/sh', ['-c',
				'ls ' + SEC_DIR + '/ 2>/dev/null | grep -v .gitkeep | wc -l'
			]), { stdout: '0' })
		]);
	},

	handleSave: function() {
		var chk = function(id) {
			var el = document.getElementById(id);
			return el && el.checked;
		};
		var val = function(id) {
			var el = document.getElementById(id);
			return el ? el.value.trim() : '';
		};

		var cfg = {
			Status:        chk('totp_enabled') ? 'ENABLE' : 'DISABLE',
			EnforceSSH:    chk('totp_ssh')     ? true : false,
			EnforceLuCI:   chk('totp_luci')    ? true : false,
			EnforceAPI:    chk('totp_api')      ? true : false,
			MaxFailures:   parseInt(val('totp_maxfail'))  || 5,
			LockoutSec:    parseInt(val('totp_lockout'))  || 300
		};

		return fs.write(CFG, JSON.stringify(cfg, null, 2))
			.then(function() {
				ui.addNotification(null,
					E('p', _('2FA / TOTP settings saved.')), 'info');
			})
			.catch(function(e) {
				ui.addNotification(null,
					E('p', _('Save failed: ') + e.message), 'error');
			});
	},

	render: function(data) {
		var cfg         = data[0];
		var enrolled    = parseInt((data[1].stdout || '0').trim());
		var enabled     = cfg.Status === 'ENABLE';

		/* Status banner */
		var banner = E('div', {
			'class': 'alert-message ' + (enabled ? 'info' : 'warning'),
			'style': 'margin-bottom:16px'
		}, enabled
			? _('2FA is ENABLED. Users on enforced planes must supply a TOTP code after password. Enrolled users: ') + enrolled
			: _('2FA is DISABLED. Admin logins require password only. Enrolled users: ') + enrolled
		);

		/* Helper: toggle row */
		var toggleRow = function(id, label, hint, checked) {
			var cb = E('input', { 'id': id, 'type': 'checkbox', 'class': 'cbi-input-checkbox' });
			if (checked) cb.setAttribute('checked', 'checked');
			return E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, label),
				E('div',   { 'class': 'cbi-value-field' }, [
					E('span', {}, [cb, ' ', E('label', { 'for': id }, '')]),
					hint ? E('div', { 'class': 'cbi-section-descr', 'style': 'margin-top:4px' }, hint) : ''
				])
			]);
		};

		/* Helper: number row */
		var numRow = function(id, label, hint, val, placeholder) {
			return E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, label),
				E('div',   { 'class': 'cbi-value-field' }, [
					E('input', {
						'id': id, 'type': 'number', 'value': val || '',
						'placeholder': placeholder || '',
						'class': 'cbi-input-text', 'style': 'max-width:120px'
					}),
					hint ? E('div', { 'class': 'cbi-section-descr', 'style': 'margin-top:4px' }, hint) : ''
				])
			]);
		};

		/* ── Section: Enable ──────────────────────────────────── */
		var secEnable = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('Service Control')),
			E('div', { 'class': 'cbi-section-node' }, [
				toggleRow('totp_enabled', _('Enable 2FA / TOTP'),
					_('Globally enables time-based OTP enforcement. Individual users must be enrolled on the Manage Users page.'),
					enabled)
			])
		]);

		/* ── Section: Enforcement planes ─────────────────────── */
		var secEnforce = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('Enforcement Planes')),
			E('div', { 'class': 'cbi-section-node' }, [
				E('p', { 'class': 'cbi-section-descr' },
					_('Select which management interfaces require TOTP. At least one should be selected when 2FA is enabled.')),
				toggleRow('totp_luci', _('LuCI Web Interface'),
					_('Require OTP after password on LuCI admin login.'),
					cfg.EnforceLuCI !== false),
				toggleRow('totp_api', _('REST API'),
					_('Require OTP field in API authentication requests.'),
					cfg.EnforceAPI !== false),
				toggleRow('totp_ssh', _('SSH (via forced command)'),
					_('SSH key auth is already enforced. Enable this to additionally verify TOTP via interactive prompt.'),
					cfg.EnforceSSH === true)
			])
		]);

		/* ── Section: Security policy ────────────────────────── */
		var secPolicy = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('Security Policy')),
			E('div', { 'class': 'cbi-section-node' }, [
				numRow('totp_maxfail',  _('Max OTP Failures'),
					_('Failed OTP attempts before the account is temporarily locked. Each window is 30 seconds.'),
					cfg.MaxFailures || 5, '5'),
				numRow('totp_lockout',  _('Lockout Duration (seconds)'),
					_('How long a user is locked out after exceeding max failures.'),
					cfg.LockoutSec || 300, '300')
			])
		]);

		/* ── Section: How it works ───────────────────────────── */
		var secHow = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('How It Works')),
			E('div', { 'class': 'cbi-section-node cbi-section-descr' }, [
				E('ul', { 'style': 'margin:0;padding-left:20px' }, [
					E('li', {}, _('Algorithm: TOTP (RFC 6238) — SHA-1 HMAC, 30-second window, 6-digit code')),
					E('li', {}, _('Secret storage: /etc/totp_secrets/<username> (chmod 600)')),
					E('li', {}, _('Compatible apps: Google Authenticator, Microsoft Authenticator, Authy, any RFC 6238 app')),
					E('li', {}, _('Clock tolerance: ±1 window (30 s) to handle minor clock drift')),
					E('li', {}, _('Brute-force: account locked after MaxFailures wrong codes for LockoutSec seconds'))
				])
			])
		]);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('2FA / TOTP Authentication')),
			banner, secEnable, secEnforce, secPolicy, secHow
		]);
	}
});
