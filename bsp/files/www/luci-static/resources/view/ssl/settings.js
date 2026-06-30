'use strict';
'require view';
'require fs';
'require ui';

var CA_PEM    = '/etc/squid/ssl_cert/myCA.pem';
var WHITELIST = '/etc/squid/ssl-common-whitelist.txt';
var SSLSTART  = '/usr/local/bin/SSLBUMPSTART';

return view.extend({

	load: function() {
		return Promise.all([
			/* UCI: is SSL inspection enabled? */
			L.resolveDefault(fs.exec('/sbin/uci', ['get', 'squid.squid.gssldec']),
				{ stdout: '0' }),
			/* CA cert details */
			L.resolveDefault(fs.exec('/usr/bin/openssl', [
				'x509', '-in', CA_PEM, '-noout',
				'-subject', '-enddate', '-fingerprint', '-sha256'
			]), { stdout: '', code: 1 }),
			/* Whitelist count + first 20 entries */
			L.resolveDefault(fs.exec('/bin/sh', ['-c',
				'grep -c . ' + WHITELIST + ' 2>/dev/null || echo 0'
			]), { stdout: '0' }),
			/* Squid running? */
			L.resolveDefault(fs.exec('/bin/pidof', ['squid']),
				{ stdout: '', code: 1 })
		]);
	},

	_row: function(label, field, hint) {
		return E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, label),
			E('div',   { 'class': 'cbi-value-field' }, [
				field,
				hint ? E('div', { 'class': 'cbi-section-descr', 'style': 'margin-top:4px' }, hint) : ''
			])
		]);
	},

	handleSave: function() {
		var enabled = document.getElementById('ssl-enabled');
		var val     = (enabled && enabled.checked) ? '1' : '0';

		/* Read whitelist from textarea */
		var ta    = document.getElementById('ssl-whitelist');
		var lines = ta ? ta.value.split('\n').map(function(l) { return l.trim(); })
		                         .filter(Boolean).join('\n') + '\n' : '';

		return Promise.all([
			/* Save UCI enable flag */
			fs.exec('/bin/sh', ['-c',
				'uci set squid.squid.gssldec=' + val + ' && uci commit squid'
			]),
			/* Save whitelist */
			fs.write(WHITELIST, lines)
		])
		.then(function() {
			/* Apply: start or stop */
			if (val === '1') {
				return fs.exec(SSLSTART, [])
					.then(function(r) {
						ui.addNotification(null, E('p',
							r.code === 0
								? _('SSL Inspection enabled. Squid ssl_bump active.')
								: _('Saved but Squid start failed: ') + (r.stderr || '')),
							r.code === 0 ? 'info' : 'error');
					});
			} else {
				return fs.exec('/bin/sh', ['-c', 'squid -k shutdown 2>/dev/null; true'])
					.then(function() {
						ui.addNotification(null,
							E('p', _('SSL Inspection disabled. Squid stopped.')), 'info');
					});
			}
		})
		.catch(function(e) {
			ui.addNotification(null, E('p', _('Error: ') + e.message), 'error');
		});
	},

	render: function(data) {
		var self       = this;
		var enabled    = (data[0].stdout || '').trim() === '1';
		var certInfo   = (data[1].stdout || '').trim();
		var wlCount    = parseInt((data[2].stdout || '0').trim());
		var squidRunning = data[3].code === 0 && (data[3].stdout || '').trim() !== '';

		/* Parse cert fields */
		var certSubject = (certInfo.match(/subject=(.+)/) || [])[1] || 'N/A';
		var certExpiry  = (certInfo.match(/notAfter=(.+)/) || [])[1] || 'N/A';
		var certFP      = (certInfo.match(/SHA256 Fingerprint=(.+)/) || [])[1] || '';

		/* ── Status banner ─────────────────────────────────────── */
		var squidStatus = E('span', {
			'style': 'font-weight:700;color:' + (squidRunning ? '#27ae60' : '#e74c3c')
		}, squidRunning ? '&#9899; Running' : '&#9898; Stopped');

		var banner = E('div', {
			'class': 'alert-message ' + (enabled ? 'info' : 'warning'),
			'style': 'margin-bottom:12px'
		}, [
			enabled
				? _('SSL Inspection ENABLED — HTTPS traffic is being decrypted and inspected.')
				: _('SSL Inspection DISABLED — HTTPS traffic passes through without content inspection.'),
			' Squid: ', squidStatus
		]);

		/* ── Section: Enable ───────────────────────────────────── */
		var enableCb = E('input', {
			'id': 'ssl-enabled', 'type': 'checkbox', 'class': 'cbi-input-checkbox'
		});
		if (enabled) enableCb.setAttribute('checked', 'checked');

		var secEnable = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('Service Control')),
			E('div', { 'class': 'cbi-section-node' }, [
				this._row(
					_('Enable SSL Inspection'),
					E('span', {}, [enableCb, ' ',
						E('label', { 'for': 'ssl-enabled' },
							_('Decrypt and inspect HTTPS traffic via Squid ssl_bump'))
					]),
					_('When enabled, all HTTPS traffic is transparently intercepted. ' +
					  'Clients must trust the CA certificate below to avoid browser warnings.')
				),
				this._row(
					_('Squid Control'),
					E('div', {'style': 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:4px'}, [
						E('button', {
							'class': 'cbi-button cbi-button-apply',
							'style': 'margin-right:6px',
							'click': ui.createHandlerFn(this, function() {
								return fs.exec(SSLSTART, [])
									.then(function(r) {
										ui.addNotification(null, E('p',
											r.code === 0
												? _('Squid started (ssl_bump active).')
												: _('Start failed: ') + (r.stderr || '')),
											r.code === 0 ? 'info' : 'error');
									});
							})
						}, '&#9654; ' + _('Start')),
						E('button', {
							'class': 'cbi-button',
							'style': 'margin-right:6px',
							'click': ui.createHandlerFn(this, function() {
								return fs.exec('/bin/sh', ['-c',
									'squid -f /tmp/squid/squid.conf -k reconfigure 2>&1'
								]).then(function(r) {
									ui.addNotification(null,
										E('p', _('Squid config reloaded.')), 'info');
								});
							})
						}, '&#8635; ' + _('Reload Config')),
						E('button', {
							'class': 'cbi-button cbi-button-negative',
							'click': ui.createHandlerFn(this, function() {
								return fs.exec('/bin/sh', ['-c',
									'squid -k shutdown 2>/dev/null; true'
								]).then(function() {
									ui.addNotification(null,
										E('p', _('Squid stopped.')), 'info');
								});
							})
						}, '&#9646;&#9646; ' + _('Stop'))
					]),
					_('Start runs SSLBUMPSTART (inits ssldb + iptables redirect). ' +
					  'Reload applies squid.conf changes without dropping connections.')
				),
				this._row(
					_('Re-init SSL Database'),
					E('button', {
						'class': 'cbi-button',
						'click': ui.createHandlerFn(this, function() {
							return fs.exec('/bin/sh', ['-c',
								'squid -k shutdown 2>/dev/null; sleep 2; ' +
								'rm -rf /tmp/squid/ssldb; ' +
								'/usr/lib/squid/security_file_certgen -c -s /tmp/squid/ssldb -M 4MB && ' +
								'chown -R nobody:nogroup /tmp/squid/ssldb && ' +
								'/etc/init.d/squid restart && echo OK'
							]).then(function(r) {
								var ok = (r.stdout || '').indexOf('OK') >= 0;
								ui.addNotification(null,
									E('p', ok
										? _('SSL certificate database re-initialized and Squid restarted.')
										: _('Re-init failed: ') + (r.stderr || r.stdout || '')),
									ok ? 'info' : 'error');
							});
						})
					}, '&#128260; ' + _('Re-initialize ssldb')),
					_('Wipes and rebuilds /tmp/squid/ssldb. Use if Squid fails to start ' +
					  'with "Failed to create SSL certificate" errors.')
				)
			])
		]);

		/* ── Section: CA Certificate ───────────────────────────── */
		var secCert = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('CA Certificate')),
			E('div', { 'class': 'cbi-section-node' }, [
				E('p', { 'class': 'cbi-section-descr' },
					_('This CA certificate is used to sign dynamic certificates for each HTTPS site inspected. ' +
					  'It MUST be installed as a trusted root CA on every client device (PC, phone, tablet) ' +
					  'that goes through this router, otherwise browsers will show security warnings.')),
				this._row(_('Subject'),     E('code', {}, certSubject)),
				this._row(_('Expires'),     E('code', {
					'style': 'color:' + (certExpiry.indexOf('2025') >= 0 ? '#e74c3c' : '#27ae60')
				}, certExpiry)),
				certFP ? this._row(_('SHA256 Fingerprint'), E('code', {
					'style': 'font-size:11px'
				}, certFP)) : '',
				this._row(
					_('Download CA Cert'),
					E('div', {'style': 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:4px'}, [
						E('a', {
							'href': '/cgi-bin/luci/admin/services/ssl/cert',
							'class': 'cbi-button cbi-button-action',
							'style': 'text-decoration:none;padding:6px 14px',
							'download': 'UniGr8ways-CA.pem'
						}, '&#128196; ' + _('Download myCA.pem')),
						E('div', { 'class': 'cbi-section-descr', 'style': 'margin-top:6px' }, [
							_('Install on clients:  '),
							E('strong', {}, _('Windows')),
							_(': double-click → Install Certificate → Trusted Root CAs  |  '),
							E('strong', {}, _('Android')),
							_(': Settings → Security → Install Certificate  |  '),
							E('strong', {}, _('iOS')),
							_(': AirDrop .pem → Settings → Profile Downloaded → Install')
						])
					])
				)
			])
		]);

		/* ── Section: SSL Bypass Whitelist ─────────────────────── */
		/* Load whitelist content */
		var wlLoadBtn = E('button', {
			'class': 'cbi-button',
			'style': 'margin-bottom:8px',
			'click': ui.createHandlerFn(this, function() {
				return fs.read(WHITELIST).then(function(content) {
					var ta = document.getElementById('ssl-whitelist');
					if (ta) ta.value = content || '';
					ui.addNotification(null,
						E('p', _('Whitelist loaded (%d entries).').replace('%d',
							(content || '').split('\n').filter(Boolean).length)), 'info');
				});
			})
		}, '&#8635; ' + _('Load Current Whitelist'));

		var secWhitelist = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' },
				_('SSL Bypass Whitelist') + ' (' + wlCount + ' ' + _('entries') + ')'),
			E('div', { 'class': 'cbi-section-node' }, [
				E('p', { 'class': 'cbi-section-descr' },
					_('Domains listed here are SPLICED (bypassed) — traffic passes through ' +
					  'without decryption. Use for banking, app stores, OS updates, ' +
					  'and other sites where inspection is undesirable or causes breakage. ' +
					  'Prefix with . to match all subdomains (e.g. .microsoft.com).')),
				wlLoadBtn,
				E('br'),
				E('textarea', {
					'id': 'ssl-whitelist',
					'class': 'cbi-input-textarea',
					'style': 'width:100%;max-width:500px;height:200px;font-family:monospace;font-size:12px',
					'placeholder': '.microsoft.com\n.windows.com\n.apple.com\n.google.com'
				}, ''),
				E('div', { 'class': 'cbi-section-descr', 'style': 'margin-top:4px' },
					_('Click "Load Current Whitelist" to edit. Save changes with the Save button below.'))
			])
		]);

		/* ── Section: How SSL Inspection Works ─────────────────── */
		var secHow = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('Traffic Flow')),
			E('div', { 'class': 'cbi-section-node cbi-section-descr' }, [
				E('pre', {
					'style': 'background:#1e1e1e;color:#d4d4d4;padding:12px;border-radius:4px;font-size:12px;margin:0'
				},
'Client HTTPS request\n' +
'       ↓\n' +
'iptables REDIRECT  port 443 → Squid port 3129\n' +
'       ↓\n' +
'Squid ssl_bump  PEEK  (read SNI from ClientHello)\n' +
'       ↓\n' +
'  ┌────────────────────────────────────┐\n' +
'  │ Is domain in bypass whitelist?     │\n' +
'  └──────────┬─────────────────────────┘\n' +
'         YES │                       NO │\n' +
'             ▼                          ▼\n' +
'      SPLICE (pass-through)     BUMP (decrypt)\n' +
'      No inspection              Squid presents\n' +
'                                 dynamic cert\n' +
'                                 signed by myCA\n' +
'                                      ↓\n' +
'                               Content scanned\n' +
'                               → e2guardian\n' +
'                               → c-icap (ClamAV)\n' +
'                               → URL/Category filter')
			])
		]);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('SSL / TLS Inspection')),
			banner, secEnable, secCert, secWhitelist, secHow
		]);
	}
});
