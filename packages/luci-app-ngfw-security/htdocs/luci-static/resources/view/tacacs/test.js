'use strict';
'require view';
'require fs';
'require ui';

var CFG = '/appdata/FWCONFIG/TACACS.json';

return view.extend({

	load: function() {
		return Promise.all([
			L.resolveDefault(fs.read(CFG).then(function(d) {
				try { return JSON.parse(d); } catch(e) { return {}; }
			}), {}),
			L.resolveDefault(fs.read('/var/log/BELRAS/tacacs.log'), '')
		]);
	},

	/* ── test runner ────────────────────────────────────────────── */
	_runTest: function(user, pass) {
		var resultEl = document.getElementById('tac-test-result');
		resultEl.className = 'alert-message warning';
		resultEl.textContent = _('Testing…');
		resultEl.style.display = 'block';

		return fs.exec('/usr/local/bin/TACAUTH', [user, pass])
			.then(function(res) {
				var out    = (res.stdout || '').trim();
				var ok     = out === 'PASS';
				var warn   = out === 'FALLBACK';
				resultEl.className = 'alert-message ' + (ok ? 'info' : warn ? 'warning' : 'error');
				resultEl.innerHTML = ok
					? '<strong>&#10003; PASS</strong> — TACACS+ server authenticated the test user.'
					: warn
					? '<strong>&#9888; FALLBACK</strong> — Server unreachable or timed out. Local fallback would be used.'
					: '<strong>&#10007; FAIL</strong> — Server rejected authentication. Check credentials or server config.';
			})
			.catch(function(e) {
				resultEl.className = 'alert-message error';
				resultEl.textContent = _('Error running test: ') + e.message;
			});
	},

	/* ── TCP ping ───────────────────────────────────────────────── */
	_tcpPing: function(server, port) {
		var el = document.getElementById('tac-tcp-result');
		el.className = 'alert-message warning';
		el.textContent = _('Checking TCP connectivity to ') + server + ':' + port + '…';
		el.style.display = 'block';

		var py = [
			'-c',
			'import socket,sys; s=socket.create_connection(("' + server + '",' + port + '),5); s.close(); print("REACHABLE")'
		];
		return fs.exec('/usr/bin/python3', py)
			.then(function(res) {
				var ok = (res.stdout || '').indexOf('REACHABLE') >= 0;
				el.className = 'alert-message ' + (ok ? 'info' : 'error');
				el.textContent = ok
					? '&#10003; TCP ' + _('reachable on ') + server + ':' + port
					: '&#10007; TCP ' + _('not reachable: ') + (res.stderr || res.stdout || _('timeout'));
			})
			.catch(function(e) {
				el.className = 'alert-message error';
				el.textContent = _('Error: ') + e.message;
			});
	},

	handleSave:      null,
	handleSaveApply: null,
	handleReset:     null,

	render: function(data) {
		var cfg  = data[0];
		var log  = data[1] || '';
		var self = this;
		var server = cfg.Server || '';
		var port   = cfg.Port   || 49;

		/* ── TCP connectivity card ───────────────────────────── */
		var tcpCard = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('TCP Connectivity')),
			E('div', { 'class': 'cbi-section-node' }, [
				E('p', {}, _('Server: ') + E('strong', {}, server || _('(not configured)')) + '   Port: ' + port),
				E('div', { 'id': 'tac-tcp-result', 'style': 'display:none;margin:8px 0' }),
				E('button', {
					'class': 'cbi-button cbi-button-action',
					'click': ui.createHandlerFn(this, function() {
						if (!server) {
							ui.addNotification(null, E('p', _('No server configured. Save settings first.')), 'error');
							return;
						}
						return self._tcpPing(server, port);
					})
				}, _('Ping TCP ' + server + ':' + port))
			])
		]);

		/* ── Auth test card ──────────────────────────────────── */
		var authCard = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('Authentication Test')),
			E('div', { 'class': 'cbi-section-node' }, [
				E('p', { 'class': 'cbi-section-descr' },
					_('Enter a real TACACS+ username and password to test a live authentication against the configured server.')),

				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'for': 'tac-test-user' }, _('Username')),
					E('div',   { 'class': 'cbi-value-field' }, [
						E('input', {
							'id': 'tac-test-user', 'type': 'text',
							'class': 'cbi-input-text', 'placeholder': 'admin',
							'style': 'max-width:240px'
						})
					])
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'for': 'tac-test-pass' }, _('Password')),
					E('div',   { 'class': 'cbi-value-field' }, [
						E('input', {
							'id': 'tac-test-pass', 'type': 'password',
							'class': 'cbi-input-text', 'placeholder': '••••••••',
							'style': 'max-width:240px'
						})
					])
				]),

				E('div', { 'id': 'tac-test-result', 'style': 'display:none;margin:10px 0' }),

				E('button', {
					'class': 'cbi-button cbi-button-apply',
					'click': ui.createHandlerFn(this, function() {
						var u = document.getElementById('tac-test-user').value.trim();
						var p = document.getElementById('tac-test-pass').value;
						if (!u) {
							ui.addNotification(null, E('p', _('Enter a username to test.')), 'warning');
							return;
						}
						return self._runTest(u, p);
					})
				}, _('Run Authentication Test'))
			])
		]);

		/* ── Auth log card ───────────────────────────────────── */
		var logLines = log.split('\n').filter(Boolean).slice(-30).reverse();
		var logCard  = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('Recent Authentication Log')),
			E('div', { 'class': 'cbi-section-node' }, [
				logLines.length
					? E('pre', {
						'style': 'background:#1e1e1e;color:#d4d4d4;padding:12px;border-radius:4px;'
						       + 'max-height:260px;overflow-y:auto;font-size:12px;margin:0'
					}, logLines.join('\n'))
					: E('p', { 'class': 'cbi-section-descr' }, _('No authentication events logged yet. Log path: /var/log/BELRAS/tacacs.log')),
				E('br'),
				E('button', {
					'class': 'cbi-button',
					'click': ui.createHandlerFn(this, function() {
						return fs.exec('/bin/sh', ['-c', '> /var/log/BELRAS/tacacs.log'])
							.then(function() {
								ui.addNotification(null, E('p', _('Log cleared.')), 'info');
								document.querySelector('pre') &&
									(document.querySelector('pre').textContent = '');
							});
					})
				}, _('Clear Log'))
			])
		]);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('TACACS+ Test & Status')),
			tcpCard, authCard, logCard
		]);
	}
});
