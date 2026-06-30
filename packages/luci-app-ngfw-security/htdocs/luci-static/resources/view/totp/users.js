'use strict';
'require view';
'require fs';
'require ui';

var TOTP_BIN = '/usr/local/bin/TOTP';
var SEC_DIR  = '/etc/totp_secrets';
var LOCK_DIR = '/tmp/totp_lockout';

return view.extend({

	load: function() {
		return Promise.all([
			/* List enrolled users */
			L.resolveDefault(fs.exec('/bin/sh', ['-c',
				'ls ' + SEC_DIR + '/ 2>/dev/null | grep -v .gitkeep'
			]), { stdout: '' }),
			/* List locked out users */
			L.resolveDefault(fs.exec('/bin/sh', ['-c',
				'ls ' + LOCK_DIR + '/ 2>/dev/null | grep -v "_fails$"'
			]), { stdout: '' })
		]);
	},

	handleSave:      null,
	handleSaveApply: null,
	handleReset:     null,

	/* ── enroll a user ───────────────────────────────────────────── */
	_enroll: function(username) {
		if (!username) {
			ui.addNotification(null, E('p', _('Enter a username to enroll.')), 'warning');
			return;
		}

		return fs.exec(TOTP_BIN, ['enroll', username])
			.then(function(res) {
				if (res.code !== 0) {
					ui.addNotification(null,
						E('p', _('Enroll failed: ') + (res.stderr || '')), 'error');
					return;
				}

				var out     = res.stdout || '';
				var secret  = (out.match(/Secret:\s*(\S+)/) || [])[1] || '';
				var uri     = (out.match(/(otpauth:\/\/[^\s]+)/) || [])[1] || '';

				/* Build QR display */
				var qrSection = E('div', { 'style': 'margin-top:12px' }, [
					E('p', { 'style': 'font-weight:bold;color:#27ae60' },
						'&#10003; ' + _('User enrolled: ') + username),
					secret ? E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, _('Secret Key')),
						E('div',   { 'class': 'cbi-value-field' }, [
							E('code', { 'style': 'font-size:14px;letter-spacing:2px' }, secret),
							E('div',  { 'class': 'cbi-section-descr' },
								_('This key is shown ONCE. Share it via secure channel for manual entry in authenticator apps.'))
						])
					]) : '',
					uri ? E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, _('OTP Auth URI')),
						E('div',   { 'class': 'cbi-value-field' }, [
							E('textarea', {
								'readonly': 'readonly',
								'style': 'width:100%;max-width:520px;height:60px;font-size:11px;font-family:monospace',
								'onclick': 'this.select()'
							}, uri),
							E('div', { 'class': 'cbi-section-descr' }, [
								_('Copy this URI into your authenticator app, or use a QR generator. '),
								E('a', {
									'href': '#',
									'onclick': function(ev) {
										ev.preventDefault();
										/* Open QR code in new tab using a client-side QR lib URL */
										var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data='
										          + encodeURIComponent(uri);
										window.open(qrUrl, '_blank');
									}
								}, _('Generate QR Code ↗'))
							])
						])
					]) : '',
					E('button', {
						'class': 'cbi-button',
						'click': function() { location.reload(); }
					}, _('Reload User List'))
				]);

				var resultEl = document.getElementById('enroll-result');
				if (resultEl) {
					resultEl.innerHTML = '';
					resultEl.appendChild(qrSection);
					resultEl.style.display = 'block';
				}
			})
			.catch(function(e) {
				ui.addNotification(null,
					E('p', _('Enroll error: ') + e.message), 'error');
			});
	},

	/* ── revoke a user ───────────────────────────────────────────── */
	_revoke: function(username) {
		return fs.exec('/bin/rm', ['-f',
			SEC_DIR + '/' + username,
			LOCK_DIR + '/' + username,
			LOCK_DIR + '/' + username + '_fails'
		])
			.then(function(res) {
				ui.addNotification(null,
					E('p', _('TOTP revoked for user: ') + username), 'info');
				setTimeout(function() { location.reload(); }, 800);
			})
			.catch(function(e) {
				ui.addNotification(null,
					E('p', _('Revoke error: ') + e.message), 'error');
			});
	},

	/* ── unlock a user ───────────────────────────────────────────── */
	_unlock: function(username) {
		return fs.exec('/bin/rm', ['-f',
			LOCK_DIR + '/' + username,
			LOCK_DIR + '/' + username + '_fails'
		])
			.then(function() {
				ui.addNotification(null,
					E('p', _('Lockout cleared for user: ') + username), 'info');
				setTimeout(function() { location.reload(); }, 800);
			});
	},

	/* ── test OTP ────────────────────────────────────────────────── */
	_testOTP: function(username, code) {
		return fs.exec(TOTP_BIN, ['verify', '--user', username, code])
			.then(function(res) {
				var ok = (res.stdout || '').trim() === 'PASS';
				ui.addNotification(null, E('p',
					ok
					? '&#10003; ' + _('OTP valid for ') + username
					: '&#10007; ' + _('OTP invalid for ') + username
				), ok ? 'info' : 'error');
			});
	},

	render: function(data) {
		var self     = this;
		var users    = (data[0].stdout || '').trim().split('\n').filter(Boolean);
		var locked   = (data[1].stdout || '').trim().split('\n').filter(Boolean);

		/* ── Enroll new user card ─────────────────────────────── */
		var enrollCard = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('Enroll New User')),
			E('div', { 'class': 'cbi-section-node' }, [
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'for': 'enroll-user' }, _('Username')),
					E('div',   { 'class': 'cbi-value-field' }, [
						E('input', {
							'id': 'enroll-user', 'type': 'text',
							'class': 'cbi-input-text', 'placeholder': 'admin',
							'style': 'max-width:240px'
						})
					])
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, ''),
					E('div',   { 'class': 'cbi-value-field' }, [
						E('button', {
							'class': 'cbi-button cbi-button-apply',
							'click': ui.createHandlerFn(this, function() {
								var u = document.getElementById('enroll-user').value.trim();
								return self._enroll(u);
							})
						}, _('Enroll & Generate Secret')),
						E('div', { 'class': 'cbi-section-descr', 'style': 'margin-top:6px' },
							_('Generates a new TOTP secret. Share the secret key or OTP Auth URI with the user to scan into their authenticator app.'))
					])
				]),
				E('div', { 'id': 'enroll-result', 'style': 'display:none;margin-top:12px' })
			])
		]);

		/* ── Enrolled users table ────────────────────────────── */
		var userRows = users.length
			? users.map(function(u) {
				var isLocked = locked.indexOf(u) >= 0;
				var testInput = E('input', {
					'id': 'otp-test-' + u, 'type': 'text',
					'class': 'cbi-input-text',
					'placeholder': '000000',
					'maxlength': '6',
					'style': 'width:90px;margin-right:6px'
				});
				return E('tr', {}, [
					/* Username */
					E('td', { 'style': 'padding:8px 12px;font-weight:600' }, u),
					/* Status */
					E('td', { 'style': 'padding:8px 12px' }, [
						isLocked
							? E('span', { 'style': 'color:#e74c3c;font-weight:bold' }, '&#128274; ' + _('LOCKED'))
							: E('span', { 'style': 'color:#27ae60;font-weight:bold' }, '&#10003; ' + _('Active'))
					]),
					/* Test OTP */
					E('td', { 'style': 'padding:8px 12px' }, [
						testInput,
						E('button', {
							'class': 'cbi-button',
							'style': 'padding:4px 10px',
							'click': ui.createHandlerFn(self, function() {
								var code = testInput.value.trim();
								if (!code) {
									ui.addNotification(null,
										E('p', _('Enter the 6-digit OTP to verify.')), 'warning');
									return;
								}
								return self._testOTP(u, code);
							})
						}, _('Verify'))
					]),
					/* Actions */
					E('td', { 'style': 'padding:8px 12px' }, [
						isLocked
							? E('button', {
								'class': 'cbi-button',
								'style': 'margin-right:6px',
								'click': ui.createHandlerFn(self, function() {
									return self._unlock(u);
								})
							}, '&#128275; ' + _('Unlock'))
							: '',
						E('button', {
							'class': 'cbi-button cbi-button-negative',
							'onclick': function() {
								if (window.confirm(_('Revoke TOTP for user "' + u + '"? They will lose 2FA access.'))) {
									self._revoke(u);
								}
							}
						}, '&#128465; ' + _('Revoke'))
					])
				]);
			})
			: [E('tr', {}, [
				E('td', {
					'colspan': '4',
					'style': 'padding:16px;text-align:center;color:#888'
				}, _('No users enrolled yet. Use the form above to enroll an admin.'))
			])];

		var usersCard = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' },
				_('Enrolled Users') + (users.length ? ' (' + users.length + ')' : '')),
			E('div', { 'class': 'cbi-section-node' }, [
				E('table', { 'style': 'width:100%;border-collapse:collapse' }, [
					E('thead', {}, [
						E('tr', { 'style': 'border-bottom:2px solid #ddd;background:#f5f5f5' }, [
							E('th', { 'style': 'padding:8px 12px;text-align:left' }, _('Username')),
							E('th', { 'style': 'padding:8px 12px;text-align:left' }, _('Status')),
							E('th', { 'style': 'padding:8px 12px;text-align:left' }, _('Verify OTP')),
							E('th', { 'style': 'padding:8px 12px;text-align:left' }, _('Actions'))
						])
					]),
					E('tbody', {}, userRows)
				]),
				E('br'),
				E('button', {
					'class': 'cbi-button',
					'click': function() { location.reload(); }
				}, '&#8635; ' + _('Refresh'))
			])
		]);

		/* ── Bulk unlock card (if any locked) ────────────────── */
		var lockCard = locked.length
			? E('div', { 'class': 'cbi-section' }, [
				E('h3', { 'class': 'cbi-section-node' },
					'&#128274; ' + _('Locked Accounts (') + locked.length + ')'),
				E('div', { 'class': 'cbi-section-node' }, [
					E('p', { 'class': 'cbi-section-descr' },
						_('These accounts are temporarily locked due to too many failed OTP attempts.')),
					E('button', {
						'class': 'cbi-button cbi-button-action',
						'click': ui.createHandlerFn(self, function() {
							return fs.exec('/bin/sh', ['-c',
								'rm -f ' + LOCK_DIR + '/*'
							]).then(function() {
								ui.addNotification(null,
									E('p', _('All lockouts cleared.')), 'info');
								setTimeout(function() { location.reload(); }, 600);
							});
						})
					}, _('Unlock All Accounts'))
				])
			])
			: null;

		var children = [
			E('h2', {}, _('2FA / TOTP — User Management')),
			enrollCard,
			usersCard
		];
		if (lockCard) children.push(lockCard);

		return E('div', { 'class': 'cbi-map' }, children);
	}
});
