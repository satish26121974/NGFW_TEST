'use strict';
'require view';
'require fs';
'require ui';

var CFG = '/appdata/FWCONFIG/SMSGateway.json';

/* ── Provider field definitions ─────────────────────────────────────── */
var PROVIDER_FIELDS = {
    fast2sms: [
        { id:'ApiKey',   label:'API Key',    type:'password', ph:'Your Fast2SMS API key',    hint:'Get from fast2sms.com → Dev API' },
        { id:'SenderId', label:'Sender ID',  type:'text',     ph:'NGFWMS',                   hint:'6-char DLT registered sender ID' },
        { id:'Route',    label:'Route',      type:'select',   options:[['q','Quick (Transactional)'],['dlt','DLT (Promotional)']], hint:'Use "q" for OTP/alerts, "dlt" for promotional' }
    ],
    msg91: [
        { id:'ApiKey',   label:'Auth Key',   type:'password', ph:'MSG91 authentication key', hint:'Get from msg91.com → API' },
        { id:'SenderId', label:'Sender ID',  type:'text',     ph:'NGFWMS',                   hint:'6-char DLT approved sender ID' },
        { id:'FlowId',   label:'Flow ID',    type:'text',     ph:'MSG91 flow/template ID',   hint:'Required for DLT SMS in India' }
    ],
    twilio: [
        { id:'AccountSid', label:'Account SID',  type:'text',     ph:'ACxxxxxxxxxxxxxxxx', hint:'From Twilio Console dashboard' },
        { id:'AuthToken',  label:'Auth Token',   type:'password', ph:'Your auth token',    hint:'From Twilio Console dashboard' },
        { id:'FromNumber', label:'From Number',  type:'text',     ph:'+1234567890',        hint:'Twilio purchased phone number (E.164)' }
    ],
    vonage: [
        { id:'ApiKey',    label:'API Key',    type:'text',     ph:'Vonage API key',    hint:'From Vonage API Dashboard' },
        { id:'ApiSecret', label:'API Secret', type:'password', ph:'Vonage API secret', hint:'From Vonage API Dashboard' },
        { id:'SenderId',  label:'Sender ID',  type:'text',     ph:'NGFW',              hint:'Alphanumeric or phone number' }
    ],
    textlocal: [
        { id:'ApiKey',   label:'API Key',   type:'password', ph:'TextLocal API key',         hint:'Get from textlocal.in → API Keys' },
        { id:'SenderId', label:'Sender ID', type:'text',     ph:'NGFW',                      hint:'Sender name (registered with operator)' }
    ],
    custom: [
        { id:'Url',      label:'Webhook URL', type:'text',   ph:'https://api.example.com/sms', hint:'Supports template vars: {ApiKey} {SenderId} {Numbers} {Message}' },
        { id:'Method',   label:'HTTP Method', type:'select', options:[['POST','POST'],['GET','GET']], hint:'HTTP method for the API call' },
        { id:'ApiKey',   label:'API Key',     type:'password', ph:'(optional)',              hint:'Referenced as {ApiKey} in URL/Body' },
        { id:'SenderId', label:'Sender ID',   type:'text',   ph:'NGFW',                      hint:'Referenced as {SenderId} in URL/Body' },
        { id:'Body',     label:'Request Body',type:'textarea', ph:'apikey={ApiKey}&to={Numbers}&message={Message}', hint:'For POST. Leave empty for GET. Use template vars.' },
        { id:'Headers',  label:'Headers (JSON)',type:'textarea', ph:'{"Authorization":"Bearer {ApiKey}"}', hint:'Optional HTTP headers as JSON object' }
    ]
};

var PROVIDER_LABELS = {
    fast2sms:  'Fast2SMS (India)',
    msg91:     'MSG91 (India)',
    twilio:    'Twilio (Global)',
    vonage:    'Vonage / Nexmo (Global)',
    textlocal: 'TextLocal (India)',
    custom:    'Custom HTTP Webhook'
};

return view.extend({

    load: function() {
        return L.resolveDefault(
            fs.read(CFG).then(function(d) {
                try { return JSON.parse(d); } catch(e) { return {}; }
            }), {}
        );
    },

    /* ── render provider-specific fields ───────────────────────────── */
    _renderProviderFields: function(provider, cfg) {
        var fields = PROVIDER_FIELDS[provider] || [];
        return fields.map(function(f) {
            var input;
            if (f.type === 'select') {
                input = E('select', {
                    'id': 'gw-' + f.id,
                    'class': 'cbi-input-select',
                    'style': 'max-width:280px'
                }, f.options.map(function(o) {
                    var opt = E('option', { 'value': o[0] }, o[1]);
                    if ((cfg[f.id] || '') === o[0]) opt.setAttribute('selected', 'selected');
                    return opt;
                }));
            } else if (f.type === 'textarea') {
                var val = f.id === 'Headers'
                    ? JSON.stringify(cfg[f.id] || {}, null, 2)
                    : (cfg[f.id] || '');
                input = E('textarea', {
                    'id': 'gw-' + f.id,
                    'class': 'cbi-input-textarea',
                    'style': 'width:100%;max-width:460px;height:60px;font-family:monospace;font-size:12px',
                    'placeholder': f.ph || ''
                }, val);
            } else {
                input = E('input', {
                    'id': 'gw-' + f.id,
                    'type': f.type || 'text',
                    'class': 'cbi-input-text',
                    'value': cfg[f.id] || '',
                    'placeholder': f.ph || '',
                    'style': 'max-width:380px',
                    'autocomplete': f.type === 'password' ? 'new-password' : 'off'
                });
            }
            return E('div', { 'class': 'cbi-value', 'data-gw-field': f.id }, [
                E('label', { 'class': 'cbi-value-title' }, f.label),
                E('div', { 'class': 'cbi-value-field' }, [
                    input,
                    f.hint ? E('div', { 'class': 'cbi-section-descr', 'style': 'margin-top:4px' }, f.hint) : ''
                ])
            ]);
        });
    },

    handleSave: function() {
        var self = this;
        var get  = function(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
        var chk  = function(id) { var e = document.getElementById(id); return !!(e && e.checked); };

        var provider = get('gw-provider');
        var cfg = {
            Status:          chk('gw-enabled') ? 'ENABLE' : 'DISABLE',
            Provider:        provider,
            Numbers:         get('gw-numbers').split('\n').map(function(n){return n.trim();}).filter(Boolean),
            FallbackToModem: chk('gw-fallback'),
            ApiKey:    get('gw-ApiKey'),
            SenderId:  get('gw-SenderId'),
            Route:     get('gw-Route'),
            AccountSid: get('gw-AccountSid'),
            AuthToken:  get('gw-AuthToken'),
            FromNumber: get('gw-FromNumber'),
            ApiSecret:  get('gw-ApiSecret'),
            FlowId:     get('gw-FlowId'),
            Url:        get('gw-Url'),
            Method:     get('gw-Method'),
            Body:       get('gw-Body')
        };

        /* Parse custom headers JSON */
        var hdrStr = get('gw-Headers');
        if (hdrStr) {
            try { cfg.Headers = JSON.parse(hdrStr); }
            catch(e) { ui.addNotification(null, E('p', 'Headers must be valid JSON: ' + e.message), 'error'); return; }
        } else { cfg.Headers = {}; }

        return fs.write(CFG, JSON.stringify(cfg, null, 2))
            .then(function() {
                ui.addNotification(null, E('p', _('SMS Gateway configuration saved.')), 'info');
            })
            .catch(function(e) {
                ui.addNotification(null, E('p', _('Save failed: ') + e.message), 'error');
            });
    },

    render: function(cfg) {
        var self     = this;
        var enabled  = cfg.Status === 'ENABLE';
        var provider = cfg.Provider || 'fast2sms';
        var numbers  = Array.isArray(cfg.Numbers) ? cfg.Numbers : [];

        /* ── Status banner ───────────────────────────────────────── */
        var banner = E('div', {
            'class': 'alert-message ' + (enabled ? 'info' : 'warning'),
            'style': 'margin-bottom:12px'
        }, enabled
            ? _('SMS Gateway ENABLED — messages sent via ') + (PROVIDER_LABELS[provider] || provider)
            : _('SMS Gateway DISABLED. Configure a provider and enable to send alerts via HTTP API.'));

        /* ── Enable + provider ───────────────────────────────────── */
        var enabledCb = E('input', { 'id':'gw-enabled', 'type':'checkbox', 'class':'cbi-input-checkbox' });
        if (enabled) enabledCb.setAttribute('checked','checked');

        var provSel = E('select', { 'id':'gw-provider', 'class':'cbi-input-select', 'style':'max-width:280px',
            'onchange': function() {
                var p = this.value;
                /* Hide all provider sections, show selected */
                document.querySelectorAll('[data-provider-section]').forEach(function(el) {
                    el.style.display = 'none';
                });
                var sec = document.querySelector('[data-provider-section="' + p + '"]');
                if (sec) sec.style.display = '';
            }
        }, Object.keys(PROVIDER_LABELS).map(function(k) {
            var opt = E('option', { 'value': k }, PROVIDER_LABELS[k]);
            if (k === provider) opt.setAttribute('selected','selected');
            return opt;
        }));

        var secBasic = E('div', { 'class':'cbi-section' }, [
            E('h3', { 'class':'cbi-section-node' }, _('SMS Gateway Service')),
            E('div', { 'class':'cbi-section-node' }, [
                E('div', { 'class':'cbi-value' }, [
                    E('label', { 'class':'cbi-value-title' }, _('Enable Gateway SMS')),
                    E('div',   { 'class':'cbi-value-field' }, [
                        E('div', { 'style':'display:flex;align-items:center;gap:10px;flex-wrap:nowrap' }, [
                            E('div', { 'style':'flex-shrink:0' }, [enabledCb]),
                            E('label', { 'for':'gw-enabled', 'style':'font-weight:normal;margin:0;cursor:pointer' },
                                _('Send SMS via HTTP API provider (replaces/supplements modem SMS)'))
                        ])
                    ])
                ]),
                E('div', { 'class':'cbi-value' }, [
                    E('label', { 'class':'cbi-value-title' }, _('SMS Provider')),
                    E('div',   { 'class':'cbi-value-field' }, [
                        provSel,
                        E('div', { 'class':'cbi-section-descr', 'style':'margin-top:4px' },
                            _('Select your SMS gateway provider. Fields below change based on selection.'))
                    ])
                ]),
                E('div', { 'class':'cbi-value' }, [
                    E('label', { 'class':'cbi-value-title' }, _('Recipients')),
                    E('div',   { 'class':'cbi-value-field' }, [
                        E('textarea', {
                            'id':'gw-numbers', 'class':'cbi-input-textarea',
                            'style':'width:280px;height:80px;font-family:monospace',
                            'placeholder':'+919xxxxxxxxx\n+9187xxxxxxxx'
                        }, numbers.join('\n')),
                        E('div', { 'class':'cbi-section-descr', 'style':'margin-top:4px' },
                            _('One phone number per line in E.164 format (+CountryCode...)'))
                    ])
                ]),
                E('div', { 'class':'cbi-value' }, [
                    E('label', { 'class':'cbi-value-title' }, _('Fallback to Modem')),
                    E('div',   { 'class':'cbi-value-field' }, [
                        E('div', { 'style':'display:flex;align-items:center;gap:10px;flex-wrap:nowrap' }, [
                            E('div', { 'style':'flex-shrink:0' }, [
                                E('input', {
                                    'id':'gw-fallback', 'type':'checkbox', 'class':'cbi-input-checkbox',
                                    ...(cfg.FallbackToModem ? { 'checked':'checked' } : {})
                                })
                            ]),
                            E('label', { 'for':'gw-fallback', 'style':'font-weight:normal;margin:0;cursor:pointer' },
                                _('If gateway send fails, retry via 4G modem AT commands'))
                        ])
                    ])
                ])
            ])
        ]);

        /* ── Per-provider credential sections ─────────────────────── */
        var providerSections = Object.keys(PROVIDER_FIELDS).map(function(p) {
            var fields = self._renderProviderFields(p, cfg);
            var sec    = E('div', {
                'class': 'cbi-section',
                'data-provider-section': p,
                'style': p === provider ? '' : 'display:none'
            }, [
                E('h3', { 'class':'cbi-section-node' }, PROVIDER_LABELS[p] + _(' Settings')),
                E('div', { 'class':'cbi-section-node' }, fields)
            ]);
            return sec;
        });

        /* ── Provider guide ───────────────────────────────────────── */
        var secGuide = E('div', { 'class':'cbi-section' }, [
            E('h3', { 'class':'cbi-section-node' }, _('Provider Setup Guides')),
            E('div', { 'class':'cbi-section-node cbi-section-descr' }, [
                E('table', { 'style':'border-collapse:collapse;width:100%' }, [
                    E('thead', {}, E('tr', { 'style':'background:#f0f0f0;border-bottom:2px solid #ddd' }, [
                        E('th', { 'style':'padding:6px 10px;text-align:left' }, _('Provider')),
                        E('th', { 'style':'padding:6px 10px;text-align:left' }, _('Best For')),
                        E('th', { 'style':'padding:6px 10px;text-align:left' }, _('Free Tier')),
                        E('th', { 'style':'padding:6px 10px;text-align:left' }, _('DLT Required'))
                    ])),
                    E('tbody', {}, [
                        ['Fast2SMS','India — low cost','200 credits free','Yes (India)'],
                        ['MSG91','India — enterprise','100 SMS free','Yes (India)'],
                        ['Twilio','Global — reliable','$15 trial credit','No'],
                        ['Vonage','Global — good APIs','€2 free credit','No'],
                        ['TextLocal','India — bulk','10 SMS free','Yes (India)'],
                        ['Custom','Any provider','—','Depends on provider']
                    ].map(function(r) {
                        return E('tr', { 'style':'border-bottom:1px solid #eee' },
                            r.map(function(c, i) {
                                return E('td', { 'style':'padding:6px 10px' + (i===0?';font-weight:600':'') }, c);
                            }));
                    }))
                ]),
                E('p', { 'style':'margin-top:8px;color:#888;font-size:12px' },
                    _('Note: India providers require DLT (Distributed Ledger Technology) registration for transactional SMS. Register your sender ID and message template with your telecom operator before use.'))
            ])
        ]);

        return E('div', { 'class':'cbi-map' }, [
            E('h2', {}, _('SMS Gateway Settings')),
            banner, secBasic
        ].concat(providerSections).concat([secGuide]));
    }
});
