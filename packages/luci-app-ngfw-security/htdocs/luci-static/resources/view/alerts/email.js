'use strict';
'require view';
'require fs';
'require ui';

var CFG      = '/appdata/FWCONFIG/EmailAlert.json';
var SEND_BIN = '/usr/local/bin/SENDEMAIL';
var ALL_TRIGGERS = ['WAN_DOWN','IPS_ALERT','HA_FAILOVER','LICENSE_EXPIRY','HIGH_CPU'];

return view.extend({

	load: function() {
		return L.resolveDefault(
			fs.read(CFG).then(function(d){try{return JSON.parse(d);}catch(e){return{};}}), {}
		);
	},

	_val: function(id){ var e=document.getElementById(id); return e?e.value.trim():''; },
	_chk: function(id){ var e=document.getElementById(id); return e&&e.checked; },

	_getRecipients: function(){
		var ta = document.getElementById('email-recipients');
		return ta ? ta.value.split('\n').map(function(r){return r.trim();}).filter(Boolean) : [];
	},
	_getTriggers: function(){
		var t=[];
		ALL_TRIGGERS.forEach(function(tr){
			var el=document.getElementById('email-trig-'+tr);
			if(el&&el.checked) t.push(tr);
		});
		return t;
	},

	handleSave: function(){
		var cfg = {
			Status:     this._chk('email-enabled') ? 'ENABLE':'DISABLE',
			SmtpServer: this._val('email-smtp'),
			SmtpPort:   this._val('email-port') || '465',
			SmtpUser:   this._val('email-user'),
			SmtpPass:   this._val('email-pass'),
			From:       this._val('email-from'),
			Recipients: this._getRecipients(),
			Triggers:   this._getTriggers()
		};
		return fs.write(CFG, JSON.stringify(cfg,null,2))
			.then(function(){
				ui.addNotification(null,E('p',_('Email configuration saved.')), 'info');
			})
			.catch(function(e){
				ui.addNotification(null,E('p',_('Save failed: ')+e.message),'error');
			});
	},

	render: function(cfg){
		var self  = this;
		var en    = cfg.Status==='ENABLE';
		var recs  = Array.isArray(cfg.Recipients)?cfg.Recipients:[];
		var trigs = Array.isArray(cfg.Triggers)?cfg.Triggers:[];

		var inp = function(id,type,val,ph){
			return E('input',{
				'id':id,'type':type||'text','value':val||'',
				'placeholder':ph||'','class':'cbi-input-text','style':'max-width:320px'
			});
		};

		var enabledCb=E('input',{'id':'email-enabled','type':'checkbox','class':'cbi-input-checkbox'});
		if(en) enabledCb.setAttribute('checked','checked');

		var trigBoxes=ALL_TRIGGERS.map(function(t){
			var cb=E('input',{'id':'email-trig-'+t,'type':'checkbox','class':'cbi-input-checkbox'});
			if(trigs.indexOf(t)>=0) cb.setAttribute('checked','checked');
			return E('label',{'style':'margin-right:16px;white-space:nowrap'},[cb,' ',t]);
		});

		var row=function(label,field,hint){
			return E('div',{'class':'cbi-value'},[
				E('label',{'class':'cbi-value-title'},label),
				E('div',  {'class':'cbi-value-field'},[
					field,
					hint?E('div',{'class':'cbi-section-descr','style':'margin-top:4px'},hint):''
				])
			]);
		};

		var secConfig=E('div',{'class':'cbi-section'},[
			E('h3',{'class':'cbi-section-node'},_('Email Settings')),
			E('div',{'class':'cbi-section-node'},[
				row(_('Enable Email Alerts'),
					E('span',{},[enabledCb,' ',E('label',{'for':'email-enabled'},_('Send email on alert events via SMTP'))])
				),
				row(_('SMTP Server'),    inp('email-smtp','text',cfg.SmtpServer,'smtp.gmail.com'),
					_('Hostname of the SMTP relay. Use smtps:// protocol (port 465) or STARTTLS (587).')),
				row(_('SMTP Port'),      inp('email-port','number',cfg.SmtpPort,'465'),
					_('465 = SMTPS (SSL)  |  587 = STARTTLS  |  25 = plain (not recommended)')),
				row(_('SMTP Username'),  inp('email-user','text',cfg.SmtpUser,'alerts@yourdomain.com')),
				row(_('SMTP Password'),  inp('email-pass','password',cfg.SmtpPass,''),
					_('For Gmail use an App Password (not your account password). Enable 2-step verification first.')),
				row(_('From Address'),   inp('email-from','text',cfg.From,'ngfw-alerts@yourdomain.com')),
				row(_('Recipients'),
					E('textarea',{
						'id':'email-recipients','class':'cbi-input-textarea',
						'style':'width:320px;height:70px;font-family:monospace',
						'placeholder':'admin@yourdomain.com\nnoc@yourdomain.com'
					}, recs.join('\n')),
					_('One email address per line.')),
				row(_('Trigger Events'),
					E('div',{},trigBoxes),
					_('Send email when SENDALERT is called with any of these events.'))
			])
		]);

		var secTest=E('div',{'class':'cbi-section'},[
			E('h3',{'class':'cbi-section-node'},_('Send Test Email')),
			E('div',{'class':'cbi-section-node'},[
				row(_('Test Recipient'),
					E('span',{},[
						E('input',{
							'id':'email-test-to','type':'text','class':'cbi-input-text',
							'placeholder':recs[0]||'admin@example.com',
							'style':'max-width:280px;margin-right:8px'
						}),
						E('button',{
							'class':'cbi-button cbi-button-apply',
							'click':ui.createHandlerFn(this,function(){
								var to=document.getElementById('email-test-to').value.trim()||recs[0]||'';
								if(!to){
									ui.addNotification(null,E('p',_('Enter a recipient email.')), 'warning');
									return;
								}
								return fs.exec(SEND_BIN,[to,'[NGFW Test] Alert Test','Test alert from UniGr8ways NGFW - if you receive this, email notifications are working.'])
									.then(function(r){
										ui.addNotification(null,
											E('p',r.code===0
												? _('Test email sent to ')+to
												: _('Error: ')+(r.stderr||r.stdout||'')),
											r.code===0?'info':'error');
									});
							})
						},'&#128140; '+_('Send Test Email'))
					]),
					_('Sends a test email using the saved SMTP settings. Save configuration first.')
				)
			])
		]);

		return E('div',{'class':'cbi-map'},[
			E('h2',{},_('Email Alert Configuration')),
			secConfig, secTest
		]);
	}
});
