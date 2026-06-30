'use strict';
'require view';
'require fs';
'require ui';

var CFG = '/appdata/FWCONFIG/FQDNRules.json';
var BIN = '/usr/local/bin/FQDNRULES';

return view.extend({

	load: function() {
		return Promise.all([
			L.resolveDefault(fs.read(CFG).then(function(d) {
				try { return JSON.parse(d); } catch(e) { return { Rules:[] }; }
			}), { Rules:[] }),
			/* Show all fqdn_ ipsets */
			L.resolveDefault(fs.exec('/bin/sh', ['-c',
				'ipset list 2>/dev/null | grep -E "^Name: fqdn_|^(Members|Size|Timeout):"'
			]), { stdout:'' }),
			/* Active iptables FQDN rules */
			L.resolveDefault(fs.exec('/bin/sh', ['-c',
				'iptables -L FORWARD -n 2>/dev/null | grep FQDN_ || echo "(none)"'
			]), { stdout:'' }),
			/* Last 20 lines of FQDNRULES log */
			L.resolveDefault(fs.exec('/bin/sh', ['-c',
				'tail -20 /var/log/fqdnrules.log 2>/dev/null || echo "(no log yet)"'
			]), { stdout:'' })
		]);
	},

	handleSave:      null,
	handleSaveApply: null,
	handleReset:     null,

	render: function(data) {
		var cfg     = data[0];
		var ipsets  = (data[1].stdout || '').trim();
		var ipt     = (data[2].stdout || '').trim();
		var log     = (data[3].stdout || '').trim();
		var rules   = Array.isArray(cfg.Rules) ? cfg.Rules : [];

		/* ── Summary cards ────────────────────────────────── */
		var summaryCards = E('div', { 'style':'display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap' }, [
			E('div', {
				'style':'flex:1;min-width:150px;background:#fff;border:1px solid #ddd;'
				       +'border-radius:4px;padding:16px;text-align:center'
			}, [
				E('div', { 'style':'font-size:32px;font-weight:700;color:#337ab7' },
					String(rules.length)),
				E('div', { 'style':'color:#666;font-size:13px' }, _('Total Rules'))
			]),
			E('div', {
				'style':'flex:1;min-width:150px;background:#fff;border:1px solid #ddd;'
				       +'border-radius:4px;padding:16px;text-align:center'
			}, [
				E('div', {
					'style':'font-size:32px;font-weight:700;color:'+(cfg.Status==='ENABLE'?'#27ae60':'#e74c3c')
				}, cfg.Status === 'ENABLE' ? 'ON' : 'OFF'),
				E('div', { 'style':'color:#666;font-size:13px' }, _('Engine Status'))
			]),
			E('div', {
				'style':'flex:1;min-width:150px;background:#fff;border:1px solid #ddd;'
				       +'border-radius:4px;padding:16px;text-align:center'
			}, [
				E('div', { 'style':'font-size:32px;font-weight:700;color:#8e44ad' },
					String((ipsets.match(/^Name:/mg) || []).length)),
				E('div', { 'style':'color:#666;font-size:13px' }, _('Active ipsets'))
			])
		]);

		/* ── Per-rule live status ─────────────────────────── */
		var ruleRows = rules.map(function(r) {
			var setName = 'fqdn_' + r.FQDN.replace(/\./g,'_').replace(/-/g,'_').substring(0,28);
			var inSet   = ipsets.indexOf(setName) >= 0;
			var inIpt   = ipt.indexOf('FQDN_') >= 0 && ipt.indexOf(r.FQDN.replace(/\./g,'_')) >= 0;

			return E('tr', { 'style':'border-bottom:1px solid #eee' }, [
				E('td', { 'style':'padding:8px 10px;font-weight:600' }, r.FQDN),
				E('td', { 'style':'padding:8px 10px' }, [
					E('span', {
						'style':'padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;'
						       +'background:'+(r.Action==='block'?'#e74c3c':'#27ae60')+';color:#fff'
					}, (r.Action || 'block').toUpperCase())
				]),
				E('td', { 'style':'padding:8px 10px;font-size:12px;color:#555' }, r.Chain || 'FORWARD'),
				E('td', { 'style':'padding:8px 10px;text-align:center' },
					E('span', { 'style':'color:'+(inSet?'#27ae60':'#e74c3c') },
						inSet ? '&#10003; Active' : '&#10007; No ipset')),
				E('td', { 'style':'padding:8px 10px;font-size:11px;font-family:monospace;color:#555' }, setName)
			]);
		});

		var secRules = E('div', { 'class':'cbi-section' }, [
			E('h3', { 'class':'cbi-section-node' }, _('Rule Status')),
			E('div', { 'class':'cbi-section-node' }, [
				rules.length
					? E('table', { 'style':'width:100%;border-collapse:collapse' }, [
						E('thead', {}, E('tr', { 'style':'background:#f0f0f0;border-bottom:2px solid #ddd' }, [
							E('th', { 'style':'padding:8px 10px;text-align:left' }, _('FQDN')),
							E('th', { 'style':'padding:8px 10px;text-align:left' }, _('Action')),
							E('th', { 'style':'padding:8px 10px;text-align:left' }, _('Chain')),
							E('th', { 'style':'padding:8px 10px;text-align:center' }, _('ipset')),
							E('th', { 'style':'padding:8px 10px;text-align:left' }, _('Set Name'))
						])),
						E('tbody', {}, ruleRows)
					])
					: E('p', { 'style':'color:#888' }, _('No rules configured. Go to Rules tab to add.')),
				E('br'),
				E('button', {
					'class':'cbi-button cbi-button-apply',
					'click': ui.createHandlerFn(this, function() {
						return fs.exec(BIN, [])
							.then(function(r) {
								ui.addNotification(null,
									E('p', r.code===0 ? _('Rules refreshed.') : _('Error: ')+(r.stderr||'')),
									r.code===0 ? 'info' : 'error');
								setTimeout(function() { location.reload(); }, 1500);
							});
					})
				}, '&#8635; ' + _('Refresh All Rules Now'))
			])
		]);

		/* ── iptables output ──────────────────────────────── */
		var secIpt = E('div', { 'class':'cbi-section' }, [
			E('h3', { 'class':'cbi-section-node' }, _('Active iptables Rules')),
			E('div', { 'class':'cbi-section-node' }, [
				E('pre', {
					'style':'background:#1e1e1e;color:#d4d4d4;padding:12px;border-radius:4px;'
					       +'font-size:12px;white-space:pre-wrap;max-height:180px;overflow-y:auto;margin:0'
				}, ipt || '(none)')
			])
		]);

		/* ── Resolution log ───────────────────────────────── */
		var secLog = E('div', { 'class':'cbi-section' }, [
			E('h3', { 'class':'cbi-section-node' }, _('Resolution Log (last 20 entries)')),
			E('div', { 'class':'cbi-section-node' }, [
				E('pre', {
					'style':'background:#1e1e1e;color:#d4d4d4;padding:12px;border-radius:4px;'
					       +'font-size:11px;white-space:pre-wrap;max-height:220px;overflow-y:auto;margin:0'
				}, log)
			])
		]);

		return E('div', { 'class':'cbi-map' }, [
			E('h2', {}, _('FQDN Rules — Live Status')),
			summaryCards, secRules, secIpt, secLog
		]);
	}
});
