'use strict';
'require view';
'require fs';
'require ui';

return view.extend({

	load: function() {
		return Promise.all([
			/* Squid PID */
			L.resolveDefault(fs.exec('/bin/pidof', ['squid']), { stdout:'', code:1 }),
			/* ssldb status */
			L.resolveDefault(fs.exec('/bin/sh', ['-c',
				'test -f /tmp/squid/ssldb/size && echo INIT || echo MISSING'
			]), { stdout:'MISSING' }),
			/* iptables REDIRECT rules */
			L.resolveDefault(fs.exec('/bin/sh', ['-c',
				'iptables -t nat -L PREROUTING -n 2>/dev/null | grep -E "3129|3128"'
			]), { stdout:'' }),
			/* ssldb cert count */
			L.resolveDefault(fs.exec('/bin/sh', ['-c',
				'wc -l /tmp/squid/ssldb/index.txt 2>/dev/null | awk \'{print $1}\' || echo 0'
			]), { stdout:'0' }),
			/* Squid cache info */
			L.resolveDefault(fs.exec('/bin/sh', ['-c',
				'squid -f /tmp/squid/squid.conf -k check 2>&1 | grep -v "^$" | head -5'
			]), { stdout:'' }),
			/* CA cert expiry */
			L.resolveDefault(fs.exec('/usr/bin/openssl', [
				'x509', '-in', '/etc/squid/ssl_cert/myCA.pem',
				'-noout', '-subject', '-enddate'
			]), { stdout:'' }),
			/* Active HTTPS connections estimate */
			L.resolveDefault(fs.exec('/bin/sh', ['-c',
				'netstat -tn 2>/dev/null | grep ":3129 " | grep ESTABLISHED | wc -l || echo 0'
			]), { stdout:'0' }),
			/* Whitelist entry count */
			L.resolveDefault(fs.exec('/bin/sh', ['-c',
				'grep -c . /etc/squid/ssl-common-whitelist.txt 2>/dev/null || echo 0'
			]), { stdout:'0' }),
			/* Log: last 15 Squid access.log entries for HTTPS */
			L.resolveDefault(fs.exec('/bin/sh', ['-c',
				'tail -15 /var/log/squid/access.log 2>/dev/null | grep "CONNECT\\|TUNNEL" | tail -10 || echo "(no log)"'
			]), { stdout:'(no log)' })
		]);
	},

	handleSave:      null,
	handleSaveApply: null,
	handleReset:     null,

	_card: function(icon, value, label, color) {
		return E('div', {
			'style': 'flex:1;min-width:130px;background:#fff;border:1px solid #ddd;' +
			         'border-radius:4px;padding:16px;text-align:center'
		}, [
			E('div', { 'style': 'font-size:24px;margin-bottom:4px' }, icon),
			E('div', { 'style': 'font-size:28px;font-weight:700;color:' + (color || '#337ab7') }, value),
			E('div', { 'style': 'font-size:12px;color:#666;margin-top:4px' }, label)
		]);
	},

	render: function(data) {
		var squidRunning  = data[0].code === 0 && (data[0].stdout || '').trim() !== '';
		var squidPID      = (data[0].stdout || '').trim() || '—';
		var ssldbOk       = (data[1].stdout || '').trim() === 'INIT';
		var ipt           = (data[2].stdout || '').trim();
		var certCount     = (data[3].stdout || '0').trim();
		var squidConf     = (data[4].stdout || '').trim();
		var certInfo      = (data[5].stdout || '').trim();
		var activeConns   = (data[6].stdout || '0').trim();
		var wlCount       = (data[7].stdout || '0').trim();
		var accessLog     = (data[8].stdout || '(no log)').trim();

		var certExpiry = (certInfo.match(/notAfter=(.+)/) || [])[1] || 'N/A';
		var certSubject= (certInfo.match(/subject=(.+)/) || [])[1] || 'N/A';

		/* Check iptables redirects */
		var redir443 = ipt.indexOf('3129') >= 0;
		var redir80  = ipt.indexOf('3128') >= 0;

		/* ── Summary cards ──────────────────────────────────── */
		var cards = E('div', {
			'style': 'display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px'
		}, [
			this._card(
				squidRunning ? '&#9899;' : '&#9898;',
				squidRunning ? 'Running' : 'Stopped',
				'Squid Status',
				squidRunning ? '#27ae60' : '#e74c3c'),
			this._card('&#128260;', ssldbOk ? 'Ready' : 'Missing',
				'SSL Cert DB', ssldbOk ? '#27ae60' : '#e74c3c'),
			this._card('&#128101;', activeConns, 'Active HTTPS', '#337ab7'),
			this._card('&#128196;', certCount,   'Dynamic Certs', '#8e44ad'),
			this._card('&#9989;',  wlCount,      'Bypass Rules',  '#27ae60')
		]);

		/* ── Squid process detail ────────────────────────────── */
		var secSquid = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('Squid Process')),
			E('div', { 'class': 'cbi-section-node' }, [
				E('table', { 'style': 'border-collapse:collapse;width:100%' }, [
					E('tbody', {}, [
						E('tr', {}, [
							E('td', { 'style': 'padding:6px 12px;font-weight:600;width:200px' }, _('Status')),
							E('td', { 'style': 'padding:6px 12px;color:'+(squidRunning?'#27ae60':'#e74c3c')+';font-weight:700' },
								squidRunning ? '&#9899; Running (PID ' + squidPID + ')' : '&#9898; Stopped')
						]),
						E('tr', { 'style': 'background:#f9f9f9' }, [
							E('td', { 'style': 'padding:6px 12px;font-weight:600' }, _('Config')),
							E('td', { 'style': 'padding:6px 12px;font-size:12px;font-family:monospace' },
								'/tmp/squid/squid.conf')
						]),
						E('tr', {}, [
							E('td', { 'style': 'padding:6px 12px;font-weight:600' }, _('SSL Port')),
							E('td', { 'style': 'padding:6px 12px;font-family:monospace' }, '3129 (intercept ssl-bump)')
						]),
						E('tr', { 'style': 'background:#f9f9f9' }, [
							E('td', { 'style': 'padding:6px 12px;font-weight:600' }, _('HTTP Port')),
							E('td', { 'style': 'padding:6px 12px;font-family:monospace' }, '3128 (intercept)')
						]),
						E('tr', {}, [
							E('td', { 'style': 'padding:6px 12px;font-weight:600' }, _('Config check')),
							E('td', { 'style': 'padding:6px 12px;font-size:11px;color:#888' },
								squidConf || _('OK (no warnings)'))
						])
					])
				]),
				E('div', { 'style': 'margin-top:10px;display:flex;gap:8px' }, [
					E('button', {
						'class': 'cbi-button cbi-button-apply',
						'click': ui.createHandlerFn(this, function() {
							return fs.exec('/usr/local/bin/SSLBUMPSTART', [])
								.then(function(r) {
									ui.addNotification(null,
										E('p', r.code === 0
											? _('Squid started. Reload page to update status.')
											: _('Start failed: ') + (r.stderr || '')),
										r.code === 0 ? 'info' : 'error');
								});
						})
					}, '&#9654; ' + _('Start Squid')),
					E('button', {
						'class': 'cbi-button',
						'click': ui.createHandlerFn(this, function() {
							return fs.exec('/bin/sh', ['-c',
								'squid -f /tmp/squid/squid.conf -k reconfigure 2>&1'
							]).then(function() {
								ui.addNotification(null, E('p', _('Reloaded.')), 'info');
							});
						})
					}, '&#8635; ' + _('Reload')),
					E('button', {
						'class': 'cbi-button cbi-button-negative',
						'click': ui.createHandlerFn(this, function() {
							return fs.exec('/bin/sh', ['-c',
								'squid -k shutdown 2>/dev/null; true'
							]).then(function() {
								ui.addNotification(null, E('p', _('Squid stopped.')), 'info');
							});
						})
					}, '&#9646;&#9646; ' + _('Stop Squid')),
					E('button', {
						'class': 'cbi-button',
						'click': function() { location.reload(); }
					}, '&#8635; ' + _('Refresh Page'))
				])
			])
		]);

		/* ── iptables REDIRECT rules ─────────────────────────── */
		var iptRows = [
			['HTTPS (443 → 3129)', redir443, 'ssl_bump intercept'],
			['HTTP  (80  → 3128)', redir80,  'transparent proxy']
		].map(function(r) {
			return E('tr', {}, [
				E('td', { 'style': 'padding:6px 12px;font-family:monospace' }, r[0]),
				E('td', { 'style': 'padding:6px 12px;color:'+(r[1]?'#27ae60':'#e74c3c')+';font-weight:700' },
					r[1] ? '&#10003; Active' : '&#10007; Missing'),
				E('td', { 'style': 'padding:6px 12px;color:#888;font-size:12px' }, r[2])
			]);
		});

		var secIpt = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('iptables REDIRECT Rules')),
			E('div', { 'class': 'cbi-section-node' }, [
				E('table', { 'style': 'border-collapse:collapse;width:100%' }, [
					E('thead', {}, E('tr', { 'style': 'background:#f0f0f0;border-bottom:2px solid #ddd' }, [
						E('th', { 'style': 'padding:6px 12px;text-align:left' }, _('Rule')),
						E('th', { 'style': 'padding:6px 12px;text-align:left' }, _('Status')),
						E('th', { 'style': 'padding:6px 12px;text-align:left' }, _('Purpose'))
					])),
					E('tbody', {}, iptRows)
				]),
				(!redir443 || !redir80)
					? E('div', { 'class': 'alert-message warning', 'style': 'margin-top:8px' }, [
						_('Missing redirect rules. Run: '),
						E('code', {}, '/usr/local/bin/SSLBUMPSTART'),
						_(' to restore them.')
					])
					: ''
			])
		]);

		/* ── CA Certificate info ─────────────────────────────── */
		var secCert = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('CA Certificate')),
			E('div', { 'class': 'cbi-section-node' }, [
				E('table', { 'style': 'border-collapse:collapse;width:100%' }, [
					E('tbody', {}, [
						E('tr', {}, [
							E('td', { 'style': 'padding:6px 12px;font-weight:600;width:160px' }, _('Subject')),
							E('td', { 'style': 'padding:6px 12px;font-family:monospace;font-size:12px' }, certSubject)
						]),
						E('tr', { 'style': 'background:#f9f9f9' }, [
							E('td', { 'style': 'padding:6px 12px;font-weight:600' }, _('Expires')),
							E('td', { 'style': 'padding:6px 12px;font-family:monospace;color:#27ae60' }, certExpiry)
						]),
						E('tr', {}, [
							E('td', { 'style': 'padding:6px 12px;font-weight:600' }, _('Dynamic certs issued')),
							E('td', { 'style': 'padding:6px 12px;font-family:monospace' }, certCount)
						]),
						E('tr', { 'style': 'background:#f9f9f9' }, [
							E('td', { 'style': 'padding:6px 12px;font-weight:600' }, _('ssldb path')),
							E('td', { 'style': 'padding:6px 12px;font-family:monospace;font-size:12px' },
								'/tmp/squid/ssldb  (' + (ssldbOk ? _('initialized') : _('MISSING')) + ')')
						])
					])
				])
			])
		]);

		/* ── Recent HTTPS access log ─────────────────────────── */
		var secLog = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('Recent HTTPS Connections')),
			E('div', { 'class': 'cbi-section-node' }, [
				E('pre', {
					'style': 'background:#1e1e1e;color:#d4d4d4;padding:12px;border-radius:4px;' +
					         'font-size:11px;white-space:pre-wrap;max-height:220px;overflow-y:auto;margin:0'
				}, accessLog || '(Squid access log empty or not yet populated)')
			])
		]);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('SSL Inspection — Live Status')),
			cards, secSquid, secIpt, secCert, secLog
		]);
	}
});
