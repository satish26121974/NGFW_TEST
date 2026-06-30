'use strict';
'require view';
'require fs';
'require ui';

var CFG = '/appdata/FWCONFIG/SNMPV3.json';

return view.extend({

	load: function() {
		return Promise.all([
			/* Check if snmpd is running */
			L.resolveDefault(
				fs.exec('sh', ['-c', 'pidof snmpd && echo RUNNING || echo STOPPED']),
				{ stdout: 'STOPPED' }
			),
			/* Read current running config */
			L.resolveDefault(fs.read('/var/run/snmpd.conf'), ''),
			/* Read v3 user config */
			L.resolveDefault(
				fs.read(CFG).then(function(d) {
					try { return JSON.parse(d); } catch(e) { return { users: [] }; }
				}),
				{ users: [] }
			),
			/* Check engine ID */
			L.resolveDefault(
				fs.exec('uci', ['get', 'snmpd.@engineid[0].engineidnic']),
				{ stdout: 'eth0' }
			),
		]).then(function(r) {
			return {
				status:    (r[0].stdout || '').trim(),
				config:    r[1] || '',
				v3cfg:     r[2],
				enginenic: (r[3].stdout || 'eth0').trim(),
			};
		});
	},

	/* ── test snmp ──────────────────────────────────────────────── */
	_runTest: function(version, community, user, authpass, privpass, authproto, privproto) {
		var outputEl = document.getElementById('snmp_test_output');
		if (outputEl) outputEl.textContent = 'Running test...';

		var cmd;
		if (version === 'v2c') {
			cmd = 'snmpwalk -v 2c -c ' + community + ' 127.0.0.1 1.3.6.1.2.1.1 2>&1 | head -20';
		} else {
			var selUser = users.find(function(u) { return u.name === user; }) || {};
			var secLevel = selUser.sec_level || 'authNoPriv';
			if (secLevel === 'authPriv') {
				cmd = 'snmpwalk -v 3 -l authPriv' +
				      ' -u ' + user +
				      ' -a ' + (authproto || 'SHA') +
				      ' -A ' + authpass +
				      ' -x DES -X ' + privpass +
				      ' 127.0.0.1 1.3.6.1.2.1.1 2>&1 | head -20';
			} else {
				cmd = 'snmpwalk -v 3 -l authNoPriv' +
				      ' -u ' + user +
				      ' -a ' + (authproto || 'SHA') +
				      ' -A ' + authpass +
				      ' 127.0.0.1 1.3.6.1.2.1.1 2>&1 | head -20';
			}
		}

		return fs.exec('sh', ['-c', cmd]).then(function(res) {
			if (outputEl) outputEl.textContent = (res.stdout || res.stderr || 'No output').trim();
		}).catch(function(e) {
			if (outputEl) outputEl.textContent = 'Test failed: ' + e.message;
		});
	},

	/* ── render ─────────────────────────────────────────────────── */
	render: function(data) {
		var self     = this;
		var running  = data.status.indexOf('RUNNING') >= 0 || /^\d+$/.test(data.status.trim());
		var users    = data.v3cfg.users || [];
		var configLines = data.config.split('\n').filter(function(l) { return l.trim(); });

		/* Status banner */
		var statusBadge = E('div', {
			'class': 'alert-message ' + (running ? 'info' : 'error'),
			'style': 'margin-bottom:16px;display:flex;align-items:center;gap:12px'
		}, [
			E('span', {
				'style': 'display:inline-block;width:12px;height:12px;border-radius:50%;flex-shrink:0;' +
				         'background:' + (running ? '#2dce89' : '#f5365c')
			}),
			E('strong', {}, running ? _('snmpd is RUNNING') : _('snmpd is STOPPED')),
			E('span', { 'style': 'margin-left:auto' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-neutral',
					'style': 'padding:4px 12px;font-size:12px',
					'click': function() { location.reload(); }
				}, _('Refresh'))
			])
		]);

		/* Summary cards */
		var cards = E('div', { 'style': 'display:flex;gap:16px;flex-wrap:wrap;margin-bottom:20px' }, [
			E('div', {
				'style': 'flex:1;min-width:160px;padding:16px;background:#fff;border:1px solid #e0e0e0;' +
				         'border-radius:8px;text-align:center'
			}, [
				E('div', { 'style': 'font-size:28px;font-weight:700;color:#5e72e4' }, String(users.length)),
				E('div', { 'style': 'font-size:13px;color:#888;margin-top:4px' }, _('SNMPv3 Users'))
			]),
			E('div', {
				'style': 'flex:1;min-width:160px;padding:16px;background:#fff;border:1px solid #e0e0e0;' +
				         'border-radius:8px;text-align:center'
			}, [
				E('div', { 'style': 'font-size:28px;font-weight:700;color:#2dce89' }, data.enginenic),
				E('div', { 'style': 'font-size:13px;color:#888;margin-top:4px' }, _('Engine ID NIC'))
			]),
			E('div', {
				'style': 'flex:1;min-width:160px;padding:16px;background:#fff;border:1px solid #e0e0e0;' +
				         'border-radius:8px;text-align:center'
			}, [
				E('div', { 'style': 'font-size:28px;font-weight:700;color:#f5a623' }, 'UDP:161'),
				E('div', { 'style': 'font-size:13px;color:#888;margin-top:4px' }, _('Listening Port'))
			])
		]);

		/* Running config display */
		var configPre = E('pre', {
			'style': 'background:#f8f9fa;padding:12px;border-radius:6px;font-size:12px;' +
			         'max-height:280px;overflow-y:auto;border:1px solid #e0e0e0;white-space:pre-wrap'
		}, configLines.join('\n') || _('Config file not found'));

		var secConfig = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('Active Configuration')),
			E('div', { 'class': 'cbi-section-node' }, [configPre])
		]);

		/* SNMPv3 users list */
		var v3list = users.length ? E('table', { 'style': 'width:100%;border-collapse:collapse' }, [
			E('thead', {}, [E('tr', { 'style': 'background:#f8f9fa' }, [
				E('th', { 'style': 'padding:8px 12px;text-align:left;border-bottom:2px solid #ddd' }, _('Username')),
				E('th', { 'style': 'padding:8px 12px;text-align:left;border-bottom:2px solid #ddd' }, _('Auth')),
				E('th', { 'style': 'padding:8px 12px;text-align:left;border-bottom:2px solid #ddd' }, _('Priv')),
				E('th', { 'style': 'padding:8px 12px;text-align:left;border-bottom:2px solid #ddd' }, _('Level')),
				E('th', { 'style': 'padding:8px 12px;text-align:left;border-bottom:2px solid #ddd' }, _('Access')),
			])]),
			E('tbody', {}, users.map(function(u) {
				return E('tr', {}, [
					E('td', { 'style': 'padding:6px 12px;border-bottom:1px solid #eee' }, E('strong', {}, u.name)),
					E('td', { 'style': 'padding:6px 12px;border-bottom:1px solid #eee' }, u.auth_proto || '-'),
					E('td', { 'style': 'padding:6px 12px;border-bottom:1px solid #eee' }, u.priv_proto || '-'),
					E('td', { 'style': 'padding:6px 12px;border-bottom:1px solid #eee' }, u.sec_level || '-'),
					E('td', { 'style': 'padding:6px 12px;border-bottom:1px solid #eee' },
						E('span', { 'style': 'padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;' +
						            'background:' + (u.access === 'rw' ? '#f5a623' : '#2dce89') + ';color:#fff' },
						  u.access === 'rw' ? 'RW' : 'RO')
					)
				]);
			}))
		]) : E('p', { 'style': 'color:#888;margin:0' }, _('No SNMPv3 users configured.'));

		var secV3 = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('SNMPv3 Users')),
			E('div', { 'class': 'cbi-section-node' }, [v3list])
		]);

		/* Test panel */
		var testVersion = 'v2c';
		var secTest = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('Connectivity Test')),
			E('div', { 'class': 'cbi-section-node' }, [
				E('div', { 'style': 'margin-bottom:12px' }, [
					E('label', { 'style': 'font-weight:600;margin-right:8px' }, _('Test with:')),
					E('select', {
						'id': 'test_version', 'class': 'cbi-input-select',
						'style': 'margin-right:8px',
						'change': function(e) {
							testVersion = e.target.value;
							document.getElementById('test_v2c_fields').style.display  = testVersion === 'v2c' ? '' : 'none';
							document.getElementById('test_v3_fields').style.display   = testVersion === 'v3'  ? '' : 'none';
						}
					}, [
						E('option', { 'value': 'v2c' }, 'SNMPv2c'),
						E('option', { 'value': 'v3'  }, 'SNMPv3')
					])
				]),
				E('div', { 'id': 'test_v2c_fields' }, [
					E('label', { 'style': 'margin-right:8px' }, _('Community:')),
					E('input', { 'id': 'test_community', 'type': 'text', 'value': 'public',
					             'class': 'cbi-input-text', 'style': 'max-width:200px;margin-right:8px' })
				]),
				E('div', { 'id': 'test_v3_fields', 'style': 'display:none' }, [
					E('div', { 'style': 'margin-bottom:6px' }, [
						E('label', { 'style': 'margin-right:8px;min-width:80px;display:inline-block' }, _('User:')),
						E('select', { 'id': 'test_v3user', 'class': 'cbi-input-select', 'style': 'max-width:200px' },
							users.length
								? users.map(function(u) { return E('option', { 'value': u.name }, u.name); })
								: [E('option', { 'value': '' }, _('No v3 users configured'))]
						)
					]),
					E('div', { 'style': 'margin-bottom:6px' }, [
						E('label', { 'style': 'margin-right:8px;min-width:80px;display:inline-block' }, _('Auth Pass:')),
						E('input', { 'id': 'test_authpass', 'type': 'password',
						             'class': 'cbi-input-text', 'style': 'max-width:200px' })
					]),
					E('div', { 'style': 'margin-bottom:6px' }, [
						E('label', { 'style': 'margin-right:8px;min-width:80px;display:inline-block' }, _('Priv Pass:')),
						E('input', { 'id': 'test_privpass', 'type': 'password',
						             'class': 'cbi-input-text', 'style': 'max-width:200px' })
					])
				]),
				E('div', { 'style': 'margin-top:12px;margin-bottom:8px' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-action',
						'click': function() {
							var ver = document.getElementById('test_version').value;
							if (ver === 'v2c') {
								var comm = document.getElementById('test_community').value.trim() || 'public';
								self._runTest('v2c', comm);
							} else {
								var sel = document.getElementById('test_v3user');
								var uname = sel ? sel.value : '';
								var apass = (document.getElementById('test_authpass') || {}).value || '';
								var ppass = (document.getElementById('test_privpass') || {}).value || '';
								var selUser = users.find(function(u) { return u.name === uname; }) || {};
								self._runTest('v3', '', uname, apass, ppass, selUser.auth_proto, selUser.priv_proto);
							}
						}
					}, _('Run Test (snmpwalk)')
					)
				]),
				E('pre', {
					'id': 'snmp_test_output',
					'style': 'background:#1a1a2e;color:#00d2ff;padding:12px;border-radius:6px;font-size:12px;' +
					         'min-height:60px;max-height:200px;overflow-y:auto;white-space:pre-wrap'
				}, _('Test output will appear here...'))
			])
		]);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('SNMP Status')),
			statusBadge, cards,
			secConfig, secV3, secTest
		]);
	}
});
