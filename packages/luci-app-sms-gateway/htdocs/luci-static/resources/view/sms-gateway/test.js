'use strict';
'require view';
'require fs';
'require ui';

var CFG     = '/appdata/FWCONFIG/SMSGateway.json';
var GW_BIN  = '/usr/local/bin/SENDSMS_GW';
var LOG_FILE = '/var/log/BELRAS/sms_gateway.log';

return view.extend({

    load: function() {
        return Promise.all([
            L.resolveDefault(fs.read(CFG).then(function(d){try{return JSON.parse(d);}catch(e){return{};}}), {}),
            L.resolveDefault(fs.exec('/bin/sh',['-c','tail -30 ' + LOG_FILE + ' 2>/dev/null || echo "(no log)"']), {stdout:'(no log)'})
        ]);
    },

    handleSave:      null,
    handleSaveApply: null,
    handleReset:     null,

    render: function(data) {
        var self    = this;
        var cfg     = data[0];
        var log     = (data[1].stdout || '(no log)').trim();
        var enabled = cfg.Status === 'ENABLE';
        var provider= cfg.Provider || 'not set';
        var numbers = Array.isArray(cfg.Numbers) ? cfg.Numbers : [];

        /* ── Status cards ────────────────────────────────────────── */
        var cards = E('div', { 'style':'display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px' }, [
            E('div', {
                'style':'flex:1;min-width:140px;background:#fff;border:1px solid #ddd;border-radius:4px;padding:16px;text-align:center'
            }, [
                E('div', { 'style':'font-size:24px;margin-bottom:4px' }, '&#128241;'),
                E('div', { 'style':'font-size:16px;font-weight:700;color:'+(enabled?'#27ae60':'#e74c3c') },
                    enabled ? 'ENABLED' : 'DISABLED'),
                E('div', { 'style':'font-size:12px;color:#666;margin-top:4px' }, 'Gateway Status')
            ]),
            E('div', {
                'style':'flex:1;min-width:140px;background:#fff;border:1px solid #ddd;border-radius:4px;padding:16px;text-align:center'
            }, [
                E('div', { 'style':'font-size:24px;margin-bottom:4px' }, '&#127760;'),
                E('div', { 'style':'font-size:14px;font-weight:700;color:#337ab7;text-transform:capitalize' }, provider),
                E('div', { 'style':'font-size:12px;color:#666;margin-top:4px' }, 'Provider')
            ]),
            E('div', {
                'style':'flex:1;min-width:140px;background:#fff;border:1px solid #ddd;border-radius:4px;padding:16px;text-align:center'
            }, [
                E('div', { 'style':'font-size:24px;margin-bottom:4px' }, '&#128101;'),
                E('div', { 'style':'font-size:28px;font-weight:700;color:#8e44ad' }, String(numbers.length)),
                E('div', { 'style':'font-size:12px;color:#666;margin-top:4px' }, 'Recipients')
            ])
        ]);

        /* ── Gateway status check ────────────────────────────────── */
        var secStatus = E('div', { 'class':'cbi-section' }, [
            E('h3', { 'class':'cbi-section-node' }, _('Gateway Status')),
            E('div', { 'class':'cbi-section-node' }, [
                E('div', { 'id':'gw-status-result', 'style':'margin-bottom:10px' }),
                E('button', {
                    'class': 'cbi-button cbi-button-action',
                    'click': ui.createHandlerFn(this, function() {
                        var el = document.getElementById('gw-status-result');
                        el.innerHTML = '<div class="alert-message warning">Checking gateway status...</div>';
                        return fs.exec(GW_BIN, ['--status'])
                            .then(function(r) {
                                var ok = r.code === 0;
                                el.innerHTML = '<pre style="background:#1e1e1e;color:#d4d4d4;padding:10px;border-radius:4px;font-size:12px;margin:0">'
                                             + (r.stdout || r.stderr || 'No output') + '</pre>';
                            })
                            .catch(function(e) {
                                el.innerHTML = '<div class="alert-message error">Error: ' + e.message + '</div>';
                            });
                    })
                }, '&#128270; ' + _('Check Status'))
            ])
        ]);

        /* ── Test send card ──────────────────────────────────────── */
        var testNumber = E('input', {
            'id':'test-number', 'type':'text',
            'class':'cbi-input-text',
            'placeholder': numbers[0] || '+919xxxxxxxxx',
            'style':'max-width:220px;margin-right:8px'
        });
        var testMsg = E('input', {
            'id':'test-message', 'type':'text',
            'class':'cbi-input-text',
            'value':'Test SMS from UniGr8ways NGFW gateway',
            'style':'max-width:360px'
        });

        var secTest = E('div', { 'class':'cbi-section' }, [
            E('h3', { 'class':'cbi-section-node' }, _('Send Test SMS')),
            E('div', { 'class':'cbi-section-node' }, [
                E('div', { 'class':'cbi-value' }, [
                    E('label', { 'class':'cbi-value-title' }, _('Test Number')),
                    E('div', { 'class':'cbi-value-field' }, [
                        testNumber,
                        E('div', { 'class':'cbi-section-descr', 'style':'margin-top:4px' },
                            _('Defaults to first configured recipient if empty'))
                    ])
                ]),
                E('div', { 'class':'cbi-value' }, [
                    E('label', { 'class':'cbi-value-title' }, _('Test Message')),
                    E('div', { 'class':'cbi-value-field' }, [testMsg])
                ]),
                E('div', { 'id':'test-result', 'style':'margin:8px 0' }),
                E('div', { 'style':'display:flex;gap:8px;flex-wrap:wrap;align-items:center' }, [
                    E('button', {
                        'class': 'cbi-button cbi-button-apply',
                        'click': ui.createHandlerFn(this, function() {
                            var num = document.getElementById('test-number').value.trim()
                                   || (numbers[0] || '');
                            var msg = document.getElementById('test-message').value.trim()
                                   || 'Test from NGFW';
                            var el  = document.getElementById('test-result');

                            if (!num) {
                                ui.addNotification(null, E('p', _('Enter a phone number to test.')), 'warning');
                                return;
                            }
                            if (!enabled) {
                                ui.addNotification(null, E('p', _('Gateway is DISABLED. Enable it in Settings first.')), 'warning');
                                return;
                            }

                            el.innerHTML = '<div class="alert-message warning">Sending via ' + provider + '...</div>';

                            return fs.exec(GW_BIN, [num, msg])
                                .then(function(r) {
                                    var ok = r.code === 0;
                                    el.innerHTML = '<div class="alert-message ' + (ok ? 'info' : 'error') + '">'
                                                 + (ok ? '&#10003; SMS sent to ' + num
                                                       : '&#10007; Send failed: ' + (r.stdout || r.stderr || '')) + '</div>';
                                    /* Reload log */
                                    setTimeout(function() { location.reload(); }, 2000);
                                })
                                .catch(function(e) {
                                    el.innerHTML = '<div class="alert-message error">Error: ' + e.message + '</div>';
                                });
                        })
                    }, '&#128241; ' + _('Send Test SMS')),
                    E('button', {
                        'class': 'cbi-button',
                        'click': ui.createHandlerFn(this, function() {
                            var el = document.getElementById('test-result');
                            el.innerHTML = '<div class="alert-message warning">Sending to all configured numbers...</div>';
                            return fs.exec(GW_BIN, ['--test'])
                                .then(function(r) {
                                    var ok = r.code === 0;
                                    el.innerHTML = '<div class="alert-message ' + (ok?'info':'error') + '">'
                                                 + (ok ? '&#10003; Test sent to all ' + numbers.length + ' numbers'
                                                       : '&#10007; ' + (r.stdout||r.stderr||'failed')) + '</div>';
                                    setTimeout(function() { location.reload(); }, 2000);
                                });
                        })
                    }, '&#128228; ' + _('Send to All Numbers'))
                ])
            ])
        ]);

        /* ── Send log ─────────────────────────────────────────────── */
        var logLines = log.split('\n').filter(Boolean).reverse();
        var secLog = E('div', { 'class':'cbi-section' }, [
            E('h3', { 'class':'cbi-section-node' }, _('Send Log (last 30 entries)')),
            E('div', { 'class':'cbi-section-node' }, [
                E('pre', {
                    'style':'background:#1e1e1e;color:#d4d4d4;padding:12px;border-radius:4px;'
                           +'font-size:11px;white-space:pre-wrap;max-height:280px;overflow-y:auto;margin:0'
                }, logLines.join('\n') || '(no log entries yet)'),
                E('br'),
                E('button', {
                    'class': 'cbi-button',
                    'click': ui.createHandlerFn(this, function() {
                        return fs.exec('/bin/sh', ['-c', '> ' + LOG_FILE])
                            .then(function() {
                                ui.addNotification(null, E('p', _('Log cleared.')), 'info');
                                setTimeout(function() { location.reload(); }, 500);
                            });
                    })
                }, '&#128465; ' + _('Clear Log'))
            ])
        ]);

        return E('div', { 'class':'cbi-map' }, [
            E('h2', {}, _('SMS Gateway — Test & Log')),
            cards, secStatus, secTest, secLog
        ]);
    }
});
