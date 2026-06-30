'use strict';
'require view';
'require fs';
'require ui';

var CFGS = {
	sms:       '/appdata/FWCONFIG/SMSAlert.json',
	email:     '/appdata/FWCONFIG/EmailAlert.json',
	whatsapp:  '/appdata/FWCONFIG/WhatsAppAlert.json'
};
var DISPATCHER = '/usr/local/bin/SENDALERT';

return view.extend({

	load: function() {
		return Promise.all([
			L.resolveDefault(fs.read(CFGS.sms).then(function(d){try{return JSON.parse(d);}catch(e){return{};}}), {}),
			L.resolveDefault(fs.read(CFGS.email).then(function(d){try{return JSON.parse(d);}catch(e){return{};}}), {}),
			L.resolveDefault(fs.read(CFGS.whatsapp).then(function(d){try{return JSON.parse(d);}catch(e){return{};}}), {})
		]);
	},

	handleSave:      null,
	handleSaveApply: null,
	handleReset:     null,

	_statusCard: function(title, icon, cfg, link) {
		var enabled = cfg.Status === 'ENABLE';
		var targets = [];
		if (cfg.Numbers)    targets = cfg.Numbers;
		if (cfg.Recipients) targets = cfg.Recipients;

		return E('div', {
			'style': 'flex:1;min-width:200px;background:#fff;border:1px solid #ddd;'
			        +'border-radius:6px;padding:20px;cursor:pointer',
			'onclick': 'location.href="' + link + '"'
		}, [
			E('div', { 'style':'font-size:28px;margin-bottom:8px' }, icon),
			E('div', { 'style':'font-size:16px;font-weight:700;margin-bottom:6px' }, title),
			E('div', {
				'style':'display:inline-block;padding:2px 10px;border-radius:10px;font-size:12px;'
				       +'font-weight:700;background:'+(enabled?'#27ae60':'#95a5a6')+';color:#fff;margin-bottom:8px'
			}, enabled ? 'ENABLED' : 'DISABLED'),
			targets.length
				? E('div', { 'style':'font-size:12px;color:#666' },
					_('Recipients: ') + targets.slice(0,2).join(', ') +
					(targets.length > 2 ? ' +' + (targets.length-2) + ' more' : ''))
				: E('div', { 'style':'font-size:12px;color:#aaa' }, _('Not configured')),
			E('div', { 'style':'margin-top:10px;font-size:12px;color:#337ab7' }, _('Click to configure →'))
		]);
	},

	_triggerBadge: function(t) {
		var colors = {
			WAN_DOWN:       '#e74c3c',
			IPS_ALERT:      '#e67e22',
			HA_FAILOVER:    '#9b59b6',
			LICENSE_EXPIRY: '#f39c12',
			HIGH_CPU:       '#2980b9'
		};
		return E('span', {
			'style': 'display:inline-block;margin:2px;padding:2px 8px;border-radius:10px;'
			        +'font-size:11px;font-weight:700;color:#fff;background:'+(colors[t]||'#7f8c8d')
		}, t);
	},

	render: function(data) {
		var sms  = data[0], email = data[1], wa = data[2];
		var self = this;

		var baseUrl = '/cgi-bin/luci/admin/services/alerts/';

		/* ── Channel cards ───────────────────────────────── */
		var cards = E('div', { 'style':'display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap' }, [
			this._statusCard('SMS', '&#128241;', sms,   baseUrl+'sms'),
			this._statusCard('Email', '&#128140;', email, baseUrl+'email'),
			this._statusCard('WhatsApp', '&#128172;', wa, baseUrl+'whatsapp')
		]);

		/* ── Send test alert card ─────────────────────────── */
		var testCard = E('div', { 'class':'cbi-section' }, [
			E('h3', { 'class':'cbi-section-node' }, _('Send Test Alert')),
			E('div', { 'class':'cbi-section-node' }, [
				E('p', { 'class':'cbi-section-descr' },
					_('Sends a test message through all ENABLED channels using the SENDALERT dispatcher.')),
				E('div', { 'class':'cbi-value' }, [
					E('label', { 'class':'cbi-value-title', 'for':'test-msg' }, _('Test Message')),
					E('div',   { 'class':'cbi-value-field' }, [
						E('input', {
							'id':'test-msg', 'type':'text', 'class':'cbi-input-text',
							'value':'Test alert from UniGr8ways NGFW',
							'style':'max-width:360px'
						})
					])
				]),
				E('button', {
					'class':'cbi-button cbi-button-apply',
					'click': ui.createHandlerFn(this, function() {
						var msg = document.getElementById('test-msg').value.trim()
						        || 'Test alert from UniGr8ways NGFW';
						return fs.exec(DISPATCHER, ['TEST_ALERT', msg])
							.then(function(r) {
								ui.addNotification(null,
									E('p', r.code===0
										? _('Test alert sent to all enabled channels.')
										: _('Error: ')+(r.stderr||r.stdout||'')),
									r.code===0 ? 'info' : 'error');
							});
					})
				}, '&#128228; ' + _('Send Test to All Channels'))
			])
		]);

		/* ── Global trigger summary ──────────────────────── */
		var allTriggers = {};
		[sms, email, wa].forEach(function(c) {
			(c.Triggers || []).forEach(function(t) { allTriggers[t] = true; });
		});
		var triggerBadges = Object.keys(allTriggers).map(function(t) {
			return self._triggerBadge(t);
		});

		var secTriggers = E('div', { 'class':'cbi-section' }, [
			E('h3', { 'class':'cbi-section-node' }, _('Configured Triggers')),
			E('div', { 'class':'cbi-section-node' }, [
				triggerBadges.length
					? E('div', {}, triggerBadges)
					: E('p', { 'style':'color:#888' }, _('No triggers configured across any channel.')),
				E('div', { 'class':'cbi-section-descr', 'style':'margin-top:8px' },
					_('Events that fire the SENDALERT dispatcher. Configure per-channel on each tab.'))
			])
		]);

		/* ── Log ─────────────────────────────────────────── */
		var secLog = E('div', { 'class':'cbi-section' }, [
			E('h3', { 'class':'cbi-section-node' }, _('Recent Alert Activity')),
			E('div', { 'class':'cbi-section-node' }, [
				E('div', { 'id':'alert-log-content', 'style':'color:#888;font-style:italic' },
					_('Loading…')),
				E('button', {
					'class':'cbi-button', 'style':'margin-top:8px',
					'click': ui.createHandlerFn(this, function() {
						return fs.exec('/bin/sh', ['-c',
							'logread 2>/dev/null | grep -E "SENDALERT|SENDSMS|SENDEMAIL|SENDWHATSAPP" | tail -20 || echo "(no log)"'
						]).then(function(r) {
							var el = document.getElementById('alert-log-content');
							if (el) el.innerHTML = '<pre style="background:#1e1e1e;color:#d4d4d4;padding:12px;'
							                     + 'border-radius:4px;font-size:11px;margin:0;white-space:pre-wrap">'
							                     + (r.stdout||'(no log)') + '</pre>';
						});
					})
				}, '&#8635; ' + _('Load Log'))
			])
		]);

		return E('div', { 'class':'cbi-map' }, [
			E('h2', {}, _('Alert Notifications')),
			cards, testCard, secTriggers, secLog
		]);
	}
});
