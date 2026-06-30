'use strict';
'require view';
'require fs';
'require ui';

var CONFFILE = '/etc/snmp/snmpd.conf';

/* Parse key directives from snmpd.conf text */
function parseConf(text) {
    var cfg = {
        agentaddress: 'UDP:161,UDP6:161',
        sysName:      '',
        sysLocation:  '',
        sysContact:   '',
        enabled:      true
    };
    (text || '').split('\n').forEach(function(line) {
        var l = line.trim();
        var m;
        if ((m = l.match(/^agentaddress\s+(.+)/)))   cfg.agentaddress = m[1].trim();
        if ((m = l.match(/^sysName\s+(.+)/)))         cfg.sysName      = m[1].trim();
        if ((m = l.match(/^sysLocation\s+(.+)/)))     cfg.sysLocation  = m[1].trim();
        if ((m = l.match(/^sysContact\s+(.+)/)))      cfg.sysContact   = m[1].trim();
    });
    return cfg;
}

return view.extend({

	load: function() {
		return Promise.all([
			L.resolveDefault(fs.read(CONFFILE), ''),
			L.resolveDefault(
				fs.exec('uci', ['get', 'snmpd.general.enabled']),
				{ stdout: '1' }
			),
			L.resolveDefault(
				fs.exec('sh', ['-c', 'pidof snmpd && echo RUNNING || echo STOPPED']),
				{ stdout: 'STOPPED' }
			)
		]).then(function(r) {
			var cfg     = parseConf(r[0]);
			cfg.enabled = (r[1].stdout || '1').trim() !== '0';
			cfg.running = (r[2].stdout || '').trim();
			return cfg;
		});
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
		var cb = E('input', {
			'id': id, 'type': 'checkbox',
			'style': 'position:absolute;opacity:0;width:0;height:0'
		});
		if (checked) cb.checked = true;

		var knob = E('span', {
			'style': 'position:absolute;top:3px;left:' + (checked ? '22px' : '3px') + ';' +
			         'width:16px;height:16px;background:#fff;border-radius:50%;' +
			         'transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.4)'
		});
		var track = E('span', {
			'style': 'display:inline-block;position:relative;width:42px;height:22px;' +
			         'background:' + (checked ? '#2dce89' : '#ccc') + ';' +
			         'border-radius:11px;transition:background 0.2s;cursor:pointer;flex-shrink:0'
		}, [knob]);

		cb.addEventListener('change', function() {
			var on = cb.checked;
			track.style.background = on ? '#2dce89' : '#ccc';
			knob.style.left = on ? '22px' : '3px';
		});
		track.addEventListener('click', function() {
			cb.checked = !cb.checked;
			cb.dispatchEvent(new Event('change'));
		});

		var parts = [cb, track];
		if (label) {
			parts.push(E('label', {
				'for': id,
				'style': 'margin:0;cursor:pointer;font-weight:normal;line-height:1.4;user-select:none'
			}, label));
		}
		return E('div', { 'style': 'display:inline-flex;align-items:center;gap:10px;position:relative' }, parts);
	},

	/* ── save ───────────────────────────────────────────────────── */
	handleSave: function() {
		var get = function(id) { return document.getElementById(id); };
		var val = function(id) { return get(id) ? get(id).value.trim() : ''; };
		var chk = function(id) { return get(id) && get(id).checked; };

		var enabled     = chk('snmp_enabled');
		var agentaddr   = val('snmp_agent') || 'UDP:161,UDP6:161';
		var sysName     = val('snmp_sysname');
		var sysLocation = val('snmp_location');
		var sysContact  = val('snmp_contact');

		/* Update UCI enabled flag and commit */
		var uciCmds = [
			['set', 'snmpd.general.enabled=' + (enabled ? '1' : '0')],
			['commit', 'snmpd']
		];

		/* Build SNMPSYS args list */
		var sysArgs = [];
		if (agentaddr)   sysArgs.push('agentaddress=' + agentaddr);
		if (sysName)     sysArgs.push('sysName=' + sysName);
		if (sysLocation) sysArgs.push('sysLocation=' + sysLocation);
		if (sysContact)  sysArgs.push('sysContact=' + sysContact);

		return uciCmds.reduce(function(p, args) {
			return p.then(function() { return fs.exec('uci', args); });
		}, Promise.resolve())
		.then(function() {
			if (sysArgs.length) {
				return fs.exec('/usr/local/bin/SNMPSYS', sysArgs);
			} else {
				return fs.exec('/usr/local/bin/SNMPAPPLY', []);
			}
		})
		.then(function(res) {
			var status = (res.stdout || '').trim();
			if (status === 'RUNNING') {
				ui.addNotification(null, E('p', _('SNMP settings saved and service restarted.')), 'info');
			} else {
				ui.addNotification(null, E('p', _('Settings saved but snmpd may not be running. Check Status tab.')), 'warning');
			}
		})
		.catch(function(e) {
			ui.addNotification(null, E('p', _('Save failed: ') + e.message), 'error');
		});
	},

	/* ── render ─────────────────────────────────────────────────── */
	render: function(cfg) {
		var running = cfg.running.indexOf('RUNNING') >= 0 || /^\d+$/.test(cfg.running.trim());
		var enabled = cfg.enabled;

		var banner = E('div', {
			'class': 'alert-message ' + (running ? 'info' : (enabled ? 'warning' : 'warning')),
			'style': 'margin-bottom:12px'
		}, running
			? _('SNMP agent is RUNNING — listening on ') + cfg.agentaddress
			: (enabled ? _('SNMP agent is ENABLED but not running. Check the Status tab.') : _('SNMP agent is DISABLED.'))
		);

		var secControl = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('Service Control')),
			E('div', { 'class': 'cbi-section-node' }, [
				this._field(
					_('Enable SNMP'),
					_('When disabled, snmpd will not start on boot or restart.'),
					this._toggle('snmp_enabled', enabled)
				)
			])
		]);

		var secAgent = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('Agent Address')),
			E('div', { 'class': 'cbi-section-node' }, [
				this._field(
					_('Listen Address'),
					_('Format: UDP:161,UDP6:161 for dual-stack. Use udp:10.0.0.1:161 to restrict to a specific IP.'),
					this._input('snmp_agent', 'text', cfg.agentaddress, 'UDP:161,UDP6:161')
				)
			])
		]);

		var secSystem = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('System Information')),
			E('div', { 'class': 'cbi-section-node' }, [
				this._field(
					_('System Name (sysName)'),
					_('Hostname shown in SNMP sysName OID (1.3.6.1.2.1.1.5.0).'),
					this._input('snmp_sysname', 'text', cfg.sysName, 'router.example.com')
				),
				this._field(
					_('Location (sysLocation)'),
					_('Physical location reported in sysLocation OID.'),
					this._input('snmp_location', 'text', cfg.sysLocation, 'Server Room, Rack 3')
				),
				this._field(
					_('Contact (sysContact)'),
					_('Administrator contact info reported in sysContact OID.'),
					this._input('snmp_contact', 'text', cfg.sysContact, 'admin@example.com')
				)
			])
		]);

		var secInfo = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('Notes')),
			E('div', { 'class': 'cbi-section-node cbi-section-descr' }, [
				E('p', {}, _('Settings are applied to /etc/snmp/snmpd.conf directly. Save restarts snmpd.')),
				E('p', {}, _('Community strings (v1/v2c): use the Communities tab.')),
				E('p', {}, _('SNMPv3 users: use the SNMPv3 Users tab.')),
				E('p', {}, [
					E('strong', {}, _('Note: ')),
					_('This device supports auth protocols: MD5, SHA, SHA-256. Privacy (encryption): DES only. AES is not compiled into this build.')
				])
			])
		]);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('SNMP Configuration')),
			banner, secControl, secAgent, secSystem, secInfo
		]);
	}
});
