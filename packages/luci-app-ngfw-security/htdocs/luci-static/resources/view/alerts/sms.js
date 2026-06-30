'use strict';
'require view';
'require fs';
'require ui';

var CFG      = '/appdata/FWCONFIG/SMSAlert.json';
var SEND_BIN = '/usr/local/bin/SENDSMS';
var ALL_TRIGGERS = ['WAN_DOWN','IPS_ALERT','HA_FAILOVER','LICENSE_EXPIRY','HIGH_CPU'];

return view.extend({

	load: function() {
		return Promise.all([
			L.resolveDefault(fs.read(CFG).then(function(d){try{return JSON.parse(d);}catch(e){return{};}}), {}),
			/* Check modem */
			L.resolveDefault(fs.exec('/bin/sh',['-c','ls /dev/ttyUSB* 2>/dev/null | head -5']),{stdout:''})
		]);
	},

	_getNumbers: function() {
		var ta = document.getElementById('sms-numbers');
		if (!ta) return [];
		return ta.value.split('\n').map(function(n){return n.trim();}).filter(Boolean);
	},

	_getTriggers: function() {
		var t = [];
		ALL_TRIGGERS.forEach(function(tr){
			var el = document.getElementById('sms-trig-'+tr);
			if (el && el.checked) t.push(tr);
		});
		return t;
	},

	handleSave: function() {
		var en    = document.getElementById('sms-enabled');
		var modem = document.getElementById('sms-modem');
		var cfg   = {
			Status:   (en && en.checked) ? 'ENABLE' : 'DISABLE',
			Modem:    modem ? modem.value.trim() : '/dev/ttyUSB4',
			Numbers:  this._getNumbers(),
			Triggers: this._getTriggers()
		};
		return fs.write(CFG, JSON.stringify(cfg, null, 2))
			.then(function(){
				ui.addNotification(null, E('p', _('SMS configuration saved.')), 'info');
			})
			.catch(function(e){
				ui.addNotification(null, E('p', _('Save failed: ')+e.message), 'error');
			});
	},

	render: function(data) {
		var cfg    = data[0];
		var modems = (data[1].stdout||'').trim();
		var self   = this;
		var enabled= cfg.Status === 'ENABLE';
		var nums   = Array.isArray(cfg.Numbers) ? cfg.Numbers : [];
		var trigs  = Array.isArray(cfg.Triggers)? cfg.Triggers: [];

		var enabledCb = E('input',{'id':'sms-enabled','type':'checkbox','class':'cbi-input-checkbox'});
		if (enabled) enabledCb.setAttribute('checked','checked');

		/* Modem devices */
		var modemSelect = E('select', {'id':'sms-modem','class':'cbi-input-select','style':'max-width:200px'});
		var found = false;
		(modems ? modems.split('\n').filter(Boolean) : []).forEach(function(dev){
			var opt = E('option',{'value':dev},dev);
			if ((cfg.Modem||'/dev/ttyUSB4') === dev){opt.setAttribute('selected','selected');found=true;}
			modemSelect.appendChild(opt);
		});
		if (!found){
			var opt = E('option',{'value':cfg.Modem||'/dev/ttyUSB4','selected':'selected'},cfg.Modem||'/dev/ttyUSB4');
			modemSelect.insertBefore(opt, modemSelect.firstChild);
		}

		/* Trigger checkboxes */
		var trigBoxes = ALL_TRIGGERS.map(function(t){
			var cb = E('input',{'id':'sms-trig-'+t,'type':'checkbox','class':'cbi-input-checkbox'});
			if (trigs.indexOf(t)>=0) cb.setAttribute('checked','checked');
			return E('label',{'style':'margin-right:16px;white-space:nowrap'},[cb,' ',t]);
		});

		/* Test section */
		var testNumber = E('input',{
			'id':'sms-test-num','type':'text','class':'cbi-input-text',
			'placeholder':nums[0]||'+919xxxxxxxxx','style':'max-width:200px;margin-right:8px'
		});

		var secConfig = E('div',{'class':'cbi-section'},[
			E('h3',{'class':'cbi-section-node'},_('SMS Settings')),
			E('div',{'class':'cbi-section-node'},[
				E('div',{'class':'cbi-value'},[
					E('label',{'class':'cbi-value-title'},_('Enable SMS Alerts')),
					E('div',  {'class':'cbi-value-field'},[enabledCb,' ',
						E('label',{'for':'sms-enabled'},_('Send SMS via 4G modem on alert events'))
					])
				]),
				E('div',{'class':'cbi-value'},[
					E('label',{'class':'cbi-value-title'},_('Modem Device')),
					E('div',  {'class':'cbi-value-field'},[
						modemSelect,
						E('div',{'class':'cbi-section-descr'},
							modems ? _('Detected: ')+modems.split('\n').join(', ')
							       : _('No USB modem detected — check /dev/ttyUSBx'))
					])
				]),
				E('div',{'class':'cbi-value'},[
					E('label',{'class':'cbi-value-title'},_('Phone Numbers')),
					E('div',  {'class':'cbi-value-field'},[
						E('textarea',{
							'id':'sms-numbers','class':'cbi-input-textarea',
							'style':'width:280px;height:80px;font-family:monospace',
							'placeholder':'+919xxxxxxxxx\n+9187xxxxxxxx'
						}, nums.join('\n')),
						E('div',{'class':'cbi-section-descr'},_('One number per line in E.164 format (+CountryCode…)'))
					])
				]),
				E('div',{'class':'cbi-value'},[
					E('label',{'class':'cbi-value-title'},_('Trigger Events')),
					E('div',  {'class':'cbi-value-field'},[
						E('div',{},trigBoxes),
						E('div',{'class':'cbi-section-descr'},
							_('SMS is sent when SENDALERT is called with any of these events.'))
					])
				])
			])
		]);

		var secTest = E('div',{'class':'cbi-section'},[
			E('h3',{'class':'cbi-section-node'},_('Send Test SMS')),
			E('div',{'class':'cbi-section-node'},[
				E('div',{'class':'cbi-value'},[
					E('label',{'class':'cbi-value-title'},_('Test Number')),
					E('div',  {'class':'cbi-value-field'},[
						testNumber,
						E('button',{
							'class':'cbi-button cbi-button-apply',
							'click': ui.createHandlerFn(this, function(){
								var num = document.getElementById('sms-test-num').value.trim()
								        || (nums[0]||'');
								if (!num){
									ui.addNotification(null,E('p',_('Enter a phone number.')), 'warning');
									return;
								}
								return fs.exec(SEND_BIN,[num,'Test SMS from UniGr8ways NGFW'])
									.then(function(r){
										ui.addNotification(null,
											E('p',r.code===0
												? _('Test SMS dispatched to ')+num
												: _('Error: ')+(r.stderr||r.stdout||'')),
											r.code===0?'info':'error');
									});
							})
						}, '&#128241; '+_('Send Test SMS'))
					])
				]),
				E('p',{'class':'cbi-section-descr'},
					_('Uses AT+CMGS commands on the modem. The modem must be active with a SIM card inserted.'))
			])
		]);

		return E('div',{'class':'cbi-map'},[
			E('h2',{},_('SMS Alert Configuration')),
			secConfig, secTest
		]);
	}
});
