'use strict';
'require view';
'require fs';
'require ui';

var CFG     = '/appdata/FWCONFIG/FQDNRules.json';
var BIN     = '/usr/local/bin/FQDNRULES';
var ALL_TRIGGERS = ['WAN_DOWN','IPS_ALERT','HA_FAILOVER','LICENSE_EXPIRY'];

return view.extend({

	load: function() {
		return L.resolveDefault(
			fs.read(CFG).then(function(d) {
				try { return JSON.parse(d); } catch(e) { return { Status:'DISABLE', Rules:[] }; }
			}), { Status:'DISABLE', Rules:[] }
		);
	},

	/* ── persist full config ─────────────────────────────────────── */
	_save: function(cfg) {
		return fs.write(CFG, JSON.stringify(cfg, null, 2));
	},

	/* ── collect rules from DOM ──────────────────────────────────── */
	_collectRules: function() {
		var rows = document.querySelectorAll('tr[data-fqdn-row]');
		var rules = [];
		rows.forEach(function(row) {
			var fqdn = row.querySelector('.fqdn-input').value.trim();
			if (!fqdn) return;
			rules.push({
				FQDN:        fqdn,
				Action:      row.querySelector('.action-select').value,
				Chain:       row.querySelector('.chain-select').value,
				Description: row.querySelector('.desc-input').value.trim()
			});
		});
		return rules;
	},

	/* ── build an editable rule row ──────────────────────────────── */
	_ruleRow: function(rule, idx) {
		var self = this;

		var actionBadge = function(a) {
			return E('span', {
				'style': 'padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;' +
				         'background:' + (a === 'block' ? '#e74c3c' : '#27ae60') + ';color:#fff'
			}, a.toUpperCase());
		};

		var fqdnInp = E('input', {
			'type':'text', 'class':'cbi-input-text fqdn-input',
			'value': rule.FQDN || '', 'placeholder':'example.com',
			'style':'width:100%;max-width:240px'
		});

		var actionSel = E('select', { 'class':'cbi-input-select action-select', 'style':'max-width:100px' }, [
			E('option', { 'value':'block', 'selected': rule.Action==='block' ? 'selected' : null }, 'Block'),
			E('option', { 'value':'allow', 'selected': rule.Action==='allow' ? 'selected' : null }, 'Allow')
		]);

		var chainSel = E('select', { 'class':'cbi-input-select chain-select', 'style':'max-width:110px' }, [
			E('option', { 'value':'FORWARD', 'selected': (rule.Chain||'FORWARD')==='FORWARD' ? 'selected':null }, 'FORWARD'),
			E('option', { 'value':'INPUT',   'selected': rule.Chain==='INPUT'   ? 'selected':null }, 'INPUT'),
			E('option', { 'value':'OUTPUT',  'selected': rule.Chain==='OUTPUT'  ? 'selected':null }, 'OUTPUT')
		]);

		var descInp = E('input', {
			'type':'text', 'class':'cbi-input-text desc-input',
			'value': rule.Description || '', 'placeholder':'Optional description',
			'style':'width:100%;max-width:200px'
		});

		var delBtn = E('button', {
			'class':'cbi-button cbi-button-negative',
			'style':'padding:4px 10px;white-space:nowrap',
			'click': function() {
				var row = delBtn.closest('tr[data-fqdn-row]');
				if (row) row.parentNode.removeChild(row);
			}
		}, '&#128465;');

		return E('tr', { 'data-fqdn-row': idx }, [
			E('td', { 'style':'padding:6px 8px' }, fqdnInp),
			E('td', { 'style':'padding:6px 8px' }, actionSel),
			E('td', { 'style':'padding:6px 8px' }, chainSel),
			E('td', { 'style':'padding:6px 8px' }, descInp),
			E('td', { 'style':'padding:6px 8px;text-align:center' }, delBtn)
		]);
	},

	/* ── add blank rule row ──────────────────────────────────────── */
	_addRow: function() {
		var tbody = document.getElementById('fqdn-rule-tbody');
		if (!tbody) return;
		var idx   = tbody.rows.length;
		var row   = this._ruleRow({ FQDN:'', Action:'block', Chain:'FORWARD', Description:'' }, idx);
		tbody.appendChild(row);
		row.querySelector('.fqdn-input').focus();
	},

	/* ── handleSave (footer Save button) ────────────────────────── */
	handleSave: function() {
		var enabled = document.getElementById('fqdn-enabled');
		var rules   = this._collectRules();
		var cfg     = {
			Status: (enabled && enabled.checked) ? 'ENABLE' : 'DISABLE',
			Rules:  rules
		};
		return this._save(cfg)
			.then(function() {
				ui.addNotification(null,
					E('p', _('FQDN Rules saved. ') + rules.length + _(' rules active.')), 'info');
			})
			.catch(function(e) {
				ui.addNotification(null, E('p', _('Save failed: ') + e.message), 'error');
			});
	},

	render: function(cfg) {
		var self    = this;
		var enabled = cfg.Status === 'ENABLE';
		var rules   = Array.isArray(cfg.Rules) ? cfg.Rules : [];

		/* ── Status banner ────────────────────────────────── */
		var banner = E('div', {
			'class': 'alert-message ' + (enabled ? 'info' : 'warning'),
			'style': 'margin-bottom:12px'
		}, enabled
			? _('FQDN Rules ENABLED — ') + rules.length + _(' rules loaded. DNS resolved every 5 minutes via cron.')
			: _('FQDN Rules DISABLED. Rules exist but are not applied. Enable and save to activate.')
		);

		/* ── Service toggle ───────────────────────────────── */
		var enabledCb = E('input', {
			'id':'fqdn-enabled', 'type':'checkbox', 'class':'cbi-input-checkbox'
		});
		if (enabled) enabledCb.setAttribute('checked','checked');

		var secToggle = E('div', { 'class':'cbi-section' }, [
			E('h3', { 'class':'cbi-section-node' }, _('Service Control')),
			E('div', { 'class':'cbi-section-node' }, [
				E('div', { 'class':'cbi-value' }, [
					E('label', { 'class':'cbi-value-title' }, _('Enable FQDN Rules')),
					E('div',   { 'class':'cbi-value-field' }, [
						E('span', {}, [enabledCb, ' ',
							E('label', { 'for':'fqdn-enabled' },
								_('Resolve FQDNs to IPs via DNS every 5 min and apply iptables block/allow rules'))
						])
					])
				]),
				E('div', { 'class':'cbi-value' }, [
					E('label', { 'class':'cbi-value-title' }, _('Apply Now')),
					E('div',   { 'class':'cbi-value-field' }, [
						E('button', {
							'class':'cbi-button cbi-button-action',
							'click': ui.createHandlerFn(this, function() {
								return fs.exec(BIN, [])
									.then(function(r) {
										ui.addNotification(null,
											E('p', r.code === 0
												? _('FQDN Rules applied. Check Live Status tab.')
												: _('Error: ') + (r.stderr || '')),
											r.code === 0 ? 'info' : 'error');
									});
							})
						}, '&#9654; ' + _('Run FQDNRULES Now')),
						E('span', { 'style':'margin-left:10px;font-size:12px;color:#888' },
							_('Resolves all FQDNs and refreshes ipsets immediately'))
					])
				])
			])
		]);

		/* ── Rules table ──────────────────────────────────── */
		var tbody = E('tbody', { 'id':'fqdn-rule-tbody' },
			rules.length
				? rules.map(function(r, i) { return self._ruleRow(r, i); })
				: []
		);

		var secRules = E('div', { 'class':'cbi-section' }, [
			E('h3', { 'class':'cbi-section-node' },
				_('Rules') + ' (' + rules.length + ')'),
			E('div', { 'class':'cbi-section-node' }, [
				E('table', { 'style':'width:100%;border-collapse:collapse;margin-bottom:10px' }, [
					E('thead', {}, [
						E('tr', { 'style':'background:#f0f0f0;border-bottom:2px solid #ddd' }, [
							E('th', { 'style':'padding:8px;text-align:left' }, _('FQDN')),
							E('th', { 'style':'padding:8px;text-align:left' }, _('Action')),
							E('th', { 'style':'padding:8px;text-align:left' }, _('Chain')),
							E('th', { 'style':'padding:8px;text-align:left' }, _('Description')),
							E('th', { 'style':'padding:8px;text-align:center' }, _('Del'))
						])
					]),
					tbody
				]),
				!rules.length
					? E('p', { 'style':'color:#888;font-style:italic' },
						_('No rules yet. Use the button below to add one.'))
					: '',
				E('button', {
					'class':'cbi-button cbi-button-add',
					'click': ui.createHandlerFn(this, function() {
						self._addRow();
					})
				}, '&#43; ' + _('Add FQDN Rule'))
			])
		]);

		/* ── How it works ─────────────────────────────────── */
		var secHow = E('div', { 'class':'cbi-section' }, [
			E('h3', { 'class':'cbi-section-node' }, _('How It Works')),
			E('div', { 'class':'cbi-section-node cbi-section-descr' }, [
				E('ul', { 'style':'margin:0;padding-left:18px' }, [
					E('li', {}, _('FQDNRULES script resolves each domain to its A records via DNS')),
					E('li', {}, _('Resolved IPs are loaded into a named ipset (fqdn_<domain>)')),
					E('li', {}, _('An iptables rule matching that ipset applies the action (DROP or ACCEPT)')),
					E('li', {}, _('Cron runs FQDNRULES every 5 minutes to refresh IPs when TTL expires')),
					E('li', {}, _('ipsets have a 360-second timeout — IPs auto-expire without refresh'))
				])
			])
		]);

		return E('div', { 'class':'cbi-map' }, [
			E('h2', {}, _('FQDN-Based Firewall Rules')),
			banner, secToggle, secRules, secHow
		]);
	}
});
