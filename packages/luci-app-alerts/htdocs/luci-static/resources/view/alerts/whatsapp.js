'use strict';
'require view';
'require fs';
'require ui';

var CFG      = '/appdata/FWCONFIG/WhatsAppAlert.json';
var SEND_BIN = '/usr/local/bin/SENDWHATSAPP';
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
		var ta=document.getElementById('wa-recipients');
		return ta ? ta.value.split('\n').map(function(r){return r.trim();}).filter(Boolean) : [];
	},
	_getTriggers: function(){
		var t=[];
		ALL_TRIGGERS.forEach(function(tr){
			var el=document.getElementById('wa-trig-'+tr);
			if(el&&el.checked) t.push(tr);
		});
		return t;
	},

	handleSave: function(){
		var cfg={
			Status:        this._chk('wa-enabled') ? 'ENABLE':'DISABLE',
			Token:         this._val('wa-token'),
			PhoneNumberId: this._val('wa-phone-id'),
			Recipients:    this._getRecipients(),
			Triggers:      this._getTriggers()
		};
		return fs.write(CFG, JSON.stringify(cfg,null,2))
			.then(function(){
				ui.addNotification(null,E('p',_('WhatsApp configuration saved.')), 'info');
			})
			.catch(function(e){
				ui.addNotification(null,E('p',_('Save failed: ')+e.message),'error');
			});
	},

	render: function(cfg){
		var en    = cfg.Status==='ENABLE';
		var recs  = Array.isArray(cfg.Recipients)?cfg.Recipients:[];
		var trigs = Array.isArray(cfg.Triggers)?cfg.Triggers:[];

		var row=function(label,field,hint){
			return E('div',{'class':'cbi-value'},[
				E('label',{'class':'cbi-value-title'},label),
				E('div',  {'class':'cbi-value-field'},[
					field,
					hint?E('div',{'class':'cbi-section-descr','style':'margin-top:4px'},hint):''
				])
			]);
		};
		var inp=function(id,type,val,ph){
			return E('input',{
				'id':id,'type':type||'text','value':val||'',
				'placeholder':ph||'','class':'cbi-input-text','style':'max-width:360px'
			});
		};

		var enabledCb=E('input',{'id':'wa-enabled','type':'checkbox','class':'cbi-input-checkbox'});
		if(en) enabledCb.setAttribute('checked','checked');

		var trigBoxes=ALL_TRIGGERS.map(function(t){
			var cb=E('input',{'id':'wa-trig-'+t,'type':'checkbox','class':'cbi-input-checkbox'});
			if(trigs.indexOf(t)>=0) cb.setAttribute('checked','checked');
			return E('label',{'style':'margin-right:16px;white-space:nowrap'},[cb,' ',t]);
		});

		/* Setup guide */
		var setupGuide=E('div',{'class':'cbi-section'},[
			E('h3',{'class':'cbi-section-node'},_('WhatsApp Business API Setup')),
			E('div',{'class':'cbi-section-node cbi-section-descr'},[
				E('ol',{'style':'margin:0;padding-left:18px'},[
					E('li',{},[E('a',{'href':'https://developers.facebook.com','target':'_blank'},
						_('Create a Meta Developer account')), _(' and add a WhatsApp Business app')]),
					E('li',{},_('Go to WhatsApp > API Setup — copy the temporary Access Token and Phone Number ID')),
					E('li',{},_('Add recipient phone numbers in E.164 without + (e.g. 919xxxxxxxxx for India)')),
					E('li',{},_('Each recipient must send your WhatsApp number a message first to opt-in (Meta requirement)')),
					E('li',{},_('For permanent use, replace the temporary token with a System User token'))
				])
			])
		]);

		var secConfig=E('div',{'class':'cbi-section'},[
			E('h3',{'class':'cbi-section-node'},_('WhatsApp Settings')),
			E('div',{'class':'cbi-section-node'},[
				row(_('Enable WhatsApp Alerts'),
					E('span',{},[enabledCb,' ',E('label',{'for':'wa-enabled'},_('Send WhatsApp messages via Meta Cloud API'))])
				),
				row(_('Access Token'),
					inp('wa-token','password',cfg.Token,'EAAxxxxxxxxxxxxxx'),
					_('Meta permanent or temporary access token. Keep this secret — it grants send access.')),
				row(_('Phone Number ID'),
					inp('wa-phone-id','text',cfg.PhoneNumberId,'1234567890'),
					_('Found in Meta Developer Console under WhatsApp > API Setup.')),
				row(_('Recipients'),
					E('textarea',{
						'id':'wa-recipients','class':'cbi-input-textarea',
						'style':'width:280px;height:70px;font-family:monospace',
						'placeholder':'919xxxxxxxxx\n9187xxxxxxxx'
					}, recs.join('\n')),
					_('Phone numbers in E.164 format WITHOUT the + sign (e.g. 919... for India +91).')),
				row(_('Trigger Events'),
					E('div',{},trigBoxes),
					_('Send WhatsApp message when SENDALERT is called with any of these events.'))
			])
		]);

		var secTest=E('div',{'class':'cbi-section'},[
			E('h3',{'class':'cbi-section-node'},_('Send Test Message')),
			E('div',{'class':'cbi-section-node'},[
				row(_('Test Recipient'),
					E('span',{},[
						E('input',{
							'id':'wa-test-to','type':'text','class':'cbi-input-text',
							'placeholder':recs[0]||'919xxxxxxxxx',
							'style':'max-width:200px;margin-right:8px'
						}),
						E('button',{
							'class':'cbi-button cbi-button-apply',
							'click':ui.createHandlerFn(this,function(){
								var to=document.getElementById('wa-test-to').value.trim()||recs[0]||'';
								if(!to){
									ui.addNotification(null,E('p',_('Enter a recipient number.')), 'warning');
									return;
								}
								return fs.exec(SEND_BIN,[to,'Test alert from UniGr8ways NGFW - WhatsApp notifications working!'])
									.then(function(r){
										ui.addNotification(null,
											E('p',r.code===0
												? '&#10003; '+_('WhatsApp sent to ')+to
												: '&#10007; '+_('Error: ')+(r.stderr||r.stdout||'')),
											r.code===0?'info':'error');
									});
							})
						},'&#128172; '+_('Send Test Message'))
					]),
					_('Sends via curl to Meta Cloud API. Token and Phone Number ID must be saved first.')
				)
			])
		]);

		return E('div',{'class':'cbi-map'},[
			E('h2',{},_('WhatsApp Alert Configuration')),
			setupGuide, secConfig, secTest
		]);
	}
});
