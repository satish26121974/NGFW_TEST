'use strict';
'require view';
'require fs';
'require ui';

var CONFFILE = '/etc/snmp/snmpd.conf';

/* Parse com2sec lines from snmpd.conf */
function parseCommunities(text) {
    var communities = [];
    (text || '').split('\n').forEach(function(line) {
        var l = line.trim();
        /* com2sec SECNAME SOURCE COMMUNITY */
        var m = l.match(/^com2sec\s+(\S+)\s+(\S+)\s+(\S+)/);
        if (m) {
            communities.push({
                proto:     'IPv4',
                secname:   m[1],
                source:    m[2],
                community: m[3],
                _line:     l
            });
        }
        /* com2sec6 SECNAME SOURCE COMMUNITY */
        var m6 = l.match(/^com2sec6\s+(\S+)\s+(\S+)\s+(\S+)/);
        if (m6) {
            communities.push({
                proto:     'IPv6',
                secname:   m6[1],
                source:    m6[2],
                community: m6[3],
                _line:     l
            });
        }
    });
    return communities;
}

return view.extend({

	load: function() {
		return L.resolveDefault(fs.read(CONFFILE), '').then(function(text) {
			return { text: text, communities: parseCommunities(text) };
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
			'class': 'cbi-input-text', 'style': 'max-width:300px'
		});
	},

	_select: function(id, options, selected) {
		return E('select', { 'id': id, 'class': 'cbi-input-select' },
			options.map(function(o) {
				return E('option', { 'value': o.value, 'selected': o.value === selected ? '' : null }, o.label);
			})
		);
	},

	/* ── delete a community ─────────────────────────────────────── */
	_delete: function(lineToRemove, confText) {
		if (!confirm('Delete this community?')) return;
		var newLines = confText.split('\n').filter(function(l) {
			return l.trim() !== lineToRemove.trim();
		});
		return fs.write(CONFFILE, newLines.join('\n'))
			.then(function() { return fs.exec('/usr/local/bin/SNMPAPPLY', []); })
			.then(function() { location.reload(); })
			.catch(function(e) { ui.addNotification(null, E('p', 'Delete failed: ' + e.message), 'error'); });
	},

	/* ── save: add new community ────────────────────────────────── */
	handleSave: function() {
		var self = this;
		var get  = function(id) { return document.getElementById(id); };
		var val  = function(id) { return get(id) ? get(id).value.trim() : ''; };

		var community = val('new_community');
		var source    = val('new_source')   || 'default';
		var access    = val('new_access')   || 'ro';
		var proto     = val('new_proto')    || 'v4';

		if (!community) {
			ui.addNotification(null, E('p', _('Community string is required.')), 'warning');
			return;
		}

		var secname  = access === 'rw' ? 'rw' : 'ro';
		var directive = proto === 'v6' ? 'com2sec6' : 'com2sec';
		var newLine  = '{} {} {} {}'.replace('{}', directive)
		                             .replace('{}', secname)
		                             .replace('{}', source)
		                             .replace('{}', community);

		return L.resolveDefault(fs.read(CONFFILE), '').then(function(text) {
			var updated = (text || '').trimEnd() + '\n' + newLine + '\n';
			return fs.write(CONFFILE, updated);
		})
		.then(function() { return fs.exec('/usr/local/bin/SNMPAPPLY', []); })
		.then(function() {
			ui.addNotification(null, E('p', _('Community added and SNMP restarted.')), 'info');
			location.reload();
		})
		.catch(function(e) {
			ui.addNotification(null, E('p', _('Save failed: ') + e.message), 'error');
		});
	},

	/* ── render ─────────────────────────────────────────────────── */
	render: function(data) {
		var self        = this;
		var communities = data.communities;
		var confText    = data.text;

		var rows = communities.map(function(c) {
			var accessLabel = (c.secname === 'rw') ? 'Read/Write' : 'Read Only';
			var badge = E('span', {
				'style': 'display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;' +
				         'background:' + (c.secname === 'rw' ? '#f5a623' : '#2dce89') + ';color:#fff;font-weight:600'
			}, accessLabel);
			return E('tr', {}, [
				E('td', { 'style': 'padding:8px 12px;border-bottom:1px solid #e5e5e5' }, c.community),
				E('td', { 'style': 'padding:8px 12px;border-bottom:1px solid #e5e5e5' }, c.source),
				E('td', { 'style': 'padding:8px 12px;border-bottom:1px solid #e5e5e5' }, c.proto),
				E('td', { 'style': 'padding:8px 12px;border-bottom:1px solid #e5e5e5' }, [badge]),
				E('td', { 'style': 'padding:8px 12px;border-bottom:1px solid #e5e5e5' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-negative',
						'style': 'padding:3px 10px;font-size:12px',
						'click': function() { self._delete(c._line, confText); }
					}, _('Delete'))
				])
			]);
		});

		var table = E('div', { 'style': 'overflow-x:auto;margin-bottom:16px' }, [
			E('table', { 'style': 'width:100%;border-collapse:collapse' }, [
				E('thead', {}, [
					E('tr', { 'style': 'background:#f8f9fa' }, [
						E('th', { 'style': 'padding:8px 12px;text-align:left;border-bottom:2px solid #ddd' }, _('Community String')),
						E('th', { 'style': 'padding:8px 12px;text-align:left;border-bottom:2px solid #ddd' }, _('Source / Host')),
						E('th', { 'style': 'padding:8px 12px;text-align:left;border-bottom:2px solid #ddd' }, _('Protocol')),
						E('th', { 'style': 'padding:8px 12px;text-align:left;border-bottom:2px solid #ddd' }, _('Access')),
						E('th', { 'style': 'padding:8px 12px;text-align:left;border-bottom:2px solid #ddd' }, _('Actions'))
					])
				]),
				E('tbody', {}, rows.length ? rows : [
					E('tr', {}, [E('td', { 'colspan': '5', 'style': 'padding:16px;text-align:center;color:#888' },
						_('No communities configured'))])
				])
			])
		]);

		var secAdd = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('Add Community')),
			E('div', { 'class': 'cbi-section-node' }, [
				this._field(
					_('Community String'),
					_('The SNMP community string (acts as a shared password).'),
					this._input('new_community', 'text', '', 'monitoring')
				),
				this._field(
					_('Source Host / Network'),
					_('IP, CIDR (192.168.1.0/24), or "default" to allow any source.'),
					this._input('new_source', 'text', '', 'default')
				),
				this._field(
					_('IP Version'),
					_('IPv4 adds com2sec, IPv6 adds com2sec6.'),
					this._select('new_proto', [
						{ value: 'v4', label: 'IPv4 (com2sec)' },
						{ value: 'v6', label: 'IPv6 (com2sec6)' }
					], 'v4')
				),
				this._field(
					_('Access Level'),
					_('Read Only uses secname "ro" (maps to public group). Read/Write uses "rw" (maps to private group).'),
					this._select('new_access', [
						{ value: 'ro', label: 'Read Only' },
						{ value: 'rw', label: 'Read/Write' }
					], 'ro')
				)
			])
		]);

		var secInfo = E('div', { 'class': 'cbi-section' }, [
			E('h3', { 'class': 'cbi-section-node' }, _('Notes')),
			E('div', { 'class': 'cbi-section-node cbi-section-descr' }, [
				E('p', {}, _('SNMPv1 and v2c community strings are sent in clear text. For secure monitoring, prefer SNMPv3.')),
				E('p', {}, _('Communities read from /etc/snmp/snmpd.conf. Changes restart snmpd.'))
			])
		]);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('SNMP Communities (v1/v2c)')),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', { 'class': 'cbi-section-node' }, _('Current Communities')),
				E('div', { 'class': 'cbi-section-node' }, [table])
			]),
			secAdd, secInfo
		]);
	}
});
