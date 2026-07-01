'use strict';
'require view';
'require rpc';
'require ui';
'require dom';

/* [code, name, lat, lon, radius] */
var COUNTRIES = [
	['AF','Afghanistan',33.9,67.7,7],['AL','Albania',41.1,20.2,4],['DZ','Algeria',28.0,3.0,10],
	['AD','Andorra',42.5,1.5,3],['AO','Angola',-11.2,17.9,9],['AG','Antigua & Barbuda',17.1,-61.8,3],
	['AR','Argentina',-38.4,-63.6,11],['AM','Armenia',40.1,45.0,4],['AU','Australia',-25.3,133.8,14],
	['AT','Austria',47.5,14.6,5],['AZ','Azerbaijan',40.1,47.6,5],['BS','Bahamas',25.0,-77.4,3],
	['BH','Bahrain',26.0,50.6,3],['BD','Bangladesh',23.7,90.4,7],['BB','Barbados',13.2,-59.5,3],
	['BY','Belarus',53.7,28.0,7],['BE','Belgium',50.8,4.5,4],['BZ','Belize',17.2,-88.5,4],
	['BJ','Benin',9.3,2.3,5],['BT','Bhutan',27.5,90.4,4],['BO','Bolivia',-16.3,-63.6,8],
	['BA','Bosnia & Herz.',43.9,17.7,4],['BW','Botswana',-22.3,24.7,7],['BR','Brazil',-14.2,-51.9,14],
	['BN','Brunei',4.5,114.7,3],['BG','Bulgaria',42.7,25.5,5],['BF','Burkina Faso',12.4,-1.6,6],
	['BI','Burundi',-3.4,29.9,4],['CV','Cabo Verde',16.0,-24.0,3],['KH','Cambodia',12.6,104.9,6],
	['CM','Cameroon',3.9,11.5,7],['CA','Canada',56.1,-106.3,14],['CF','C. African Rep.',6.6,20.9,8],
	['TD','Chad',15.5,18.7,9],['CL','Chile',-35.7,-71.5,9],['CN','China',35.9,104.2,15],
	['CO','Colombia',4.1,-72.3,9],['KM','Comoros',-11.7,43.3,3],['CD','DR Congo',-4.0,21.8,11],
	['CG','Congo',-0.2,15.8,6],['CR','Costa Rica',9.7,-83.8,4],['CI',"Cote d'Ivoire",7.5,-5.5,6],
	['HR','Croatia',45.1,15.2,4],['CU','Cuba',21.5,-80.0,6],['CY','Cyprus',35.1,33.4,3],
	['CZ','Czechia',49.8,15.5,5],['DK','Denmark',56.3,9.5,4],['DJ','Djibouti',11.8,42.6,3],
	['DM','Dominica',15.4,-61.4,3],['DO','Dominican Rep.',18.7,-70.2,5],['EC','Ecuador',-1.8,-78.2,7],
	['EG','Egypt',26.8,30.8,9],['SV','El Salvador',13.8,-88.9,4],['GQ','Equatorial Guinea',1.7,10.3,3],
	['ER','Eritrea',15.2,39.8,5],['EE','Estonia',58.6,25.0,4],['SZ','Eswatini',-26.5,31.5,3],
	['ET','Ethiopia',9.1,40.5,9],['FJ','Fiji',-17.7,178.1,3],['FI','Finland',61.9,25.7,7],
	['FR','France',46.2,2.2,8],['GA','Gabon',-0.8,11.6,6],['GM','Gambia',13.4,-15.3,3],
	['GE','Georgia',42.3,43.4,5],['DE','Germany',51.2,10.5,8],['GH','Ghana',7.9,-1.0,6],
	['GR','Greece',39.1,21.8,5],['GD','Grenada',12.1,-61.7,3],['GT','Guatemala',15.8,-90.2,5],
	['GN','Guinea',11.0,-10.9,6],['GW','Guinea-Bissau',11.8,-15.2,3],['GY','Guyana',4.9,-58.9,5],
	['HT','Haiti',19.0,-72.3,4],['HN','Honduras',15.2,-86.2,5],['HU','Hungary',47.2,19.5,5],
	['IS','Iceland',64.9,-19.0,4],['IN','India',20.6,78.9,12],['ID','Indonesia',-0.8,113.9,11],
	['IR','Iran',32.4,53.7,10],['IQ','Iraq',33.2,43.7,7],['IE','Ireland',53.4,-8.2,4],
	['IL','Israel',31.0,34.9,4],['IT','Italy',41.9,12.6,7],['JM','Jamaica',18.1,-77.3,3],
	['JP','Japan',36.2,138.3,8],['JO','Jordan',30.6,36.2,5],['KZ','Kazakhstan',48.0,66.9,12],
	['KE','Kenya',0.0,37.9,7],['KI','Kiribati',1.9,-157.4,3],['KP','North Korea',40.3,127.5,6],
	['KR','South Korea',35.9,127.8,6],['KW','Kuwait',29.3,47.5,3],['KG','Kyrgyzstan',41.2,74.8,5],
	['LA','Laos',19.9,102.5,6],['LV','Latvia',56.9,24.6,4],['LB','Lebanon',33.9,35.5,3],
	['LS','Lesotho',-29.6,28.2,3],['LR','Liberia',6.4,-9.4,5],['LY','Libya',26.3,17.2,9],
	['LI','Liechtenstein',47.1,9.6,2],['LT','Lithuania',55.2,23.9,4],['LU','Luxembourg',49.8,6.1,3],
	['MG','Madagascar',-18.8,46.9,8],['MW','Malawi',-13.3,34.3,5],['MY','Malaysia',4.2,108.0,8],
	['MV','Maldives',4.2,73.2,2],['ML','Mali',17.6,-4.0,9],['MT','Malta',35.9,14.4,2],
	['MH','Marshall Islands',7.1,171.2,2],['MR','Mauritania',21.0,-10.9,8],['MU','Mauritius',-20.3,57.6,2],
	['MX','Mexico',23.6,-102.6,11],['FM','Micronesia',7.4,150.6,3],['MD','Moldova',47.4,28.4,4],
	['MC','Monaco',43.7,7.4,2],['MN','Mongolia',46.9,103.8,9],['ME','Montenegro',42.7,19.4,3],
	['MA','Morocco',31.8,-7.1,7],['MZ','Mozambique',-18.7,35.5,8],['MM','Myanmar',17.1,96.0,8],
	['NA','Namibia',-22.9,18.5,8],['NR','Nauru',-0.5,166.9,2],['NP','Nepal',28.4,84.1,6],
	['NL','Netherlands',52.1,5.3,4],['NZ','New Zealand',-40.9,174.9,7],['NI','Nicaragua',12.9,-85.2,5],
	['NE','Niger',17.6,8.1,9],['NG','Nigeria',9.1,8.7,9],['NO','Norway',60.5,8.5,7],
	['OM','Oman',21.5,55.9,7],['PK','Pakistan',30.4,69.3,10],['PW','Palau',7.5,134.6,2],
	['PA','Panama',8.4,-80.1,5],['PG','Papua New Guinea',-6.3,143.9,8],['PY','Paraguay',-23.4,-58.4,7],
	['PE','Peru',-9.2,-75.0,9],['PH','Philippines',12.9,121.8,7],['PL','Poland',51.9,19.1,7],
	['PT','Portugal',39.4,-8.2,5],['QA','Qatar',25.4,51.2,3],['RO','Romania',45.9,24.9,6],
	['RU','Russia',61.5,105.3,16],['RW','Rwanda',-1.9,29.9,3],['KN','St. Kitts & Nevis',17.3,-62.7,2],
	['LC','St. Lucia',13.9,-60.9,2],['VC','St. Vincent',13.3,-61.2,2],['WS','Samoa',-13.8,-172.1,3],
	['SM','San Marino',43.9,12.5,2],['ST','Sao Tome & Principe',0.2,6.6,2],['SA','Saudi Arabia',23.9,45.1,11],
	['SN','Senegal',14.5,-14.5,6],['RS','Serbia',44.0,21.0,5],['SC','Seychelles',-4.7,55.5,2],
	['SL','Sierra Leone',8.5,-11.8,4],['SG','Singapore',1.4,103.8,3],['SK','Slovakia',48.7,19.7,4],
	['SI','Slovenia',46.1,14.9,3],['SB','Solomon Islands',-9.6,160.2,4],['SO','Somalia',5.2,46.2,7],
	['ZA','South Africa',-30.6,22.9,10],['SS','South Sudan',6.9,31.3,7],['ES','Spain',40.5,-3.7,7],
	['LK','Sri Lanka',7.9,80.8,5],['SD','Sudan',15.6,32.5,9],['SR','Suriname',3.9,-56.0,5],
	['SE','Sweden',60.1,18.6,7],['CH','Switzerland',46.8,8.2,4],['SY','Syria',35.0,38.0,6],
	['TW','Taiwan',23.7,121.0,5],['TJ','Tajikistan',38.9,71.3,5],['TZ','Tanzania',-6.4,34.9,8],
	['TH','Thailand',15.9,100.9,8],['TL','Timor-Leste',-8.9,125.7,3],['TG','Togo',8.6,0.8,4],
	['TO','Tonga',-21.2,-175.2,2],['TT','Trinidad & Tobago',10.7,-61.2,3],['TN','Tunisia',33.9,9.6,6],
	['TR','Turkey',38.9,35.2,8],['TM','Turkmenistan',38.9,59.6,7],['TV','Tuvalu',-7.1,177.6,2],
	['UG','Uganda',1.4,32.3,6],['UA','Ukraine',49.0,31.4,8],['AE','UAE',23.4,53.8,5],
	['GB','United Kingdom',55.4,-3.4,6],['US','United States',37.1,-95.7,15],['UY','Uruguay',-32.5,-55.8,6],
	['UZ','Uzbekistan',41.4,63.9,7],['VU','Vanuatu',-15.4,166.9,3],['VE','Venezuela',6.4,-66.6,8],
	['VN','Vietnam',14.1,108.3,7],['YE','Yemen',15.6,47.9,7],['ZM','Zambia',-13.1,27.8,7],
	['ZW','Zimbabwe',-20.0,30.0,6],['PS','Palestine',31.9,35.2,3],['XK','Kosovo',42.6,20.9,3],
	['TF','French S. Territories',-49.3,69.3,3],['NC','New Caledonia',-20.9,165.6,4]
];

var callExec = rpc.declare({
	object: 'luci',
	method: 'exec',
	params: ['command'],
	expect: { stdout: '' }
});

var callReadFile = rpc.declare({
	object: 'file',
	method: 'read',
	params: ['path'],
	expect: { data: '' }
});

var callWriteFile = rpc.declare({
	object: 'file',
	method: 'write',
	params: ['path', 'data']
});

return view.extend({

	blocked: null,
	enabled: false,
	allowedIPs: [],

	load: function() {
		this.blocked = new Set();
		var pathsLoad = new Promise(function(resolve) {
			if (typeof CF_COUNTRY_BOUNDS !== 'undefined') return resolve();
			var s = document.createElement('script');
			s.src = '/luci-static/resources/view/countryfilter/world-map-paths.js';
			s.onload  = resolve;
			s.onerror = resolve;
			document.head.appendChild(s);
		});
		return Promise.all([
			L.resolveDefault(callReadFile('/appdata/BlockCountry.txt'), ''),
			L.resolveDefault(callReadFile('/appdata/CountryIPAllowed.txt'), ''),
			L.resolveDefault(callExec('ls /usr/share/xt_geoip/*.iv4 2>/dev/null | wc -l'), '0'),
			pathsLoad
		]);
	},

	parseConfig: function(blockData, allowData) {
		var lines = (blockData || '').split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
		var last  = lines[lines.length - 1] || '';
		if (!lines.length || last === 'DISABLE') {
			this.enabled = false;
			this.blocked = new Set();
		} else {
			this.enabled = true;
			this.blocked = new Set(lines.filter(function(l){ return l !== 'DISABLE'; }));
		}
		this.allowedIPs = (allowData || '').split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
	},

	lonToX: function(lon) { return ((lon + 180) / 360 * 960); },
	latToY: function(lat) { return ((90 - lat) / 180 * 480); },

	/* ── Map View ─────────────────────────────────────────────── */

	buildMap: function() {
		var self = this;
		var hasPaths = (typeof CF_COUNTRY_BOUNDS !== 'undefined');
		var elements = '';

		COUNTRIES.forEach(function(c) {
			var code = c[0], name = c[1], on = self.blocked.has(code);
			var fill   = on ? '#ef5350' : '#66bb6a';
			var stroke = on ? '#b71c1c' : '#2e7d32';
			var title  = '<title>' + name + ' (' + code + ')</title>';

			if (hasPaths && CF_COUNTRY_BOUNDS[code]) {
				var d = CF_COUNTRY_BOUNDS[code].map(function(poly) {
					return 'M ' + poly.map(function(pt) {
						return self.lonToX(pt[0]).toFixed(1) + ',' + self.latToY(pt[1]).toFixed(1);
					}).join(' L ') + ' Z';
				}).join(' ');
				elements += '<path class="cf-country" id="cpath-' + code + '" d="' + d + '"' +
					' fill="' + fill + '" stroke="' + stroke + '" stroke-width="0.4" opacity="0.9"' +
					' data-code="' + code + '" data-name="' + name + '">' + title + '</path>';
			} else {
				var x = self.lonToX(c[3]).toFixed(1);
				var y = self.latToY(c[2]).toFixed(1);
				elements += '<circle class="cf-dot" id="dot-' + code + '" cx="' + x + '" cy="' + y +
					'" r="' + c[4] + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="0.8" opacity="0.88"' +
					' data-code="' + code + '" data-name="' + name + '">' + title + '</circle>';
			}
		});

		return '<div style="position:relative">' +
			'<svg id="cf-world-map" viewBox="0 0 960 480" ' +
				'style="width:100%;height:420px;display:block;border-radius:8px;cursor:crosshair;' +
				'background:linear-gradient(170deg,#1a237e 0%,#1565c0 40%,#0277bd 100%);' +
				'box-shadow:0 2px 12px rgba(0,0,0,0.3)">' +
				elements +
				'<rect id="cf-tip-bg" x="0" y="0" width="180" height="28" rx="4" fill="#212121" fill-opacity="0.88" style="display:none"/>' +
				'<text id="cf-tip-txt" x="8" y="19" fill="#fff" font-size="12" font-family="sans-serif" style="display:none;pointer-events:none"></text>' +
			'</svg>' +
			'<div style="position:absolute;bottom:8px;right:8px;display:flex;gap:12px;font-size:11px;color:#fff;' +
				'background:rgba(0,0,0,0.5);padding:4px 10px;border-radius:4px">' +
				'<span>&#9679; <span style="color:#66bb6a">Allowed</span></span>' +
				'<span>&#9679; <span style="color:#ef5350">Restricted</span></span>' +
				'<span style="opacity:0.7">Click to toggle</span>' +
			'</div></div>';
	},

	/* ── List View ────────────────────────────────────────────── */

	buildBlockedList: function() {
		if (!this.blocked.size)
			return '<li style="list-style:none;color:#aaa;font-style:italic">None selected</li>';
		var self = this;
		return Array.from(this.blocked).sort().map(function(code) {
			var entry = COUNTRIES.filter(function(c){ return c[0] === code; })[0];
			return '<li style="padding:2px 0">' + (entry ? entry[1] : code) + '</li>';
		}).join('');
	},

	buildListView: function() {
		var self = this;
		var sorted = COUNTRIES.slice().sort(function(a, b){ return a[0] < b[0] ? -1 : 1; });

		var rows = sorted.map(function(c, i) {
			var code = c[0], name = c[1];
			var chk  = self.blocked.has(code);
			return '<tr data-code="' + code + '" data-name="' + name.toLowerCase() + '">' +
				'<td style="padding:5px 8px;text-align:center;width:36px">' +
					'<input type="checkbox" class="cf-chk" data-code="' + code + '"' + (chk ? ' checked' : '') + '/>' +
				'</td>' +
				'<td style="padding:5px 4px;color:#999;font-size:11px;width:44px">' + (i + 1) + '</td>' +
				'<td style="padding:5px 4px;font-weight:700;font-family:monospace;font-size:12px;width:70px">' + code + '</td>' +
				'<td style="padding:5px 4px;font-size:13px">' + name + '</td>' +
			'</tr>';
		}).join('');

		return '<div style="display:flex;gap:14px;align-items:flex-start">' +

			/* left: table */
			'<div style="flex:1;min-width:0;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden">' +
				'<table style="width:100%;border-collapse:collapse;font-size:13px">' +
					'<thead>' +
						'<tr style="background:#f5f5f5;border-bottom:1px solid #e0e0e0">' +
							'<th style="padding:7px 8px;text-align:center;width:36px">' +
								'<input type="checkbox" id="cf-chk-all" title="Toggle all visible"/>' +
							'</th>' +
							'<th style="padding:7px 4px;text-align:left;color:#555;font-size:12px;width:44px">SR NO</th>' +
							'<th style="padding:7px 4px;text-align:left;color:#555;font-size:12px;width:70px">COUNTRY CODE</th>' +
							'<th style="padding:7px 4px;text-align:left;color:#555;font-size:12px">COUNTRY NAME</th>' +
						'</tr>' +
						'<tr style="background:#fafafa;border-bottom:1px solid #e0e0e0">' +
							'<th></th><th></th>' +
							'<th style="padding:4px">' +
								'<input type="text" id="cf-search-code" placeholder="Search..." ' +
									'style="width:100%;box-sizing:border-box;padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:11px"/>' +
							'</th>' +
							'<th style="padding:4px">' +
								'<input type="text" id="cf-search-name" placeholder="Search..." ' +
									'style="width:100%;box-sizing:border-box;padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:11px"/>' +
							'</th>' +
						'</tr>' +
					'</thead>' +
				'</table>' +
				'<div style="max-height:380px;overflow-y:auto">' +
					'<table style="width:100%;border-collapse:collapse;font-size:13px">' +
						'<tbody id="cf-list-tbody">' + rows + '</tbody>' +
					'</table>' +
				'</div>' +
			'</div>' +

			/* right: blocked panel */
			'<div style="width:210px;flex-shrink:0">' +
				'<div style="background:#fafafa;border:1px solid #e0e0e0;border-radius:6px;padding:12px;min-height:300px">' +
					'<div style="font-weight:600;font-size:13px;color:#333;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #e0e0e0">' +
						'Blocked Country Name' +
					'</div>' +
					'<ul id="cf-blocked-panel" style="margin:0;padding-left:16px;font-size:12px;color:#555">' +
						this.buildBlockedList() +
					'</ul>' +
				'</div>' +
			'</div>' +

		'</div>';
	},

	/* ── Render ───────────────────────────────────────────────── */

	render: function(data) {
		var self = this;
		this.parseConfig(data[0], data[1]);
		var geoipCount = parseInt((data[2] || '').trim()) || 0;

		/* header bar */
		var hdr = E('div', { 'class': 'cbi-section', style: 'padding:14px 18px;border-radius:8px;margin-bottom:10px' });
		hdr.innerHTML =
			'<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">' +

				/* left: title + enable toggle */
				'<div style="display:flex;align-items:center;gap:12px">' +
					'<span style="font-size:15px;font-weight:600;color:#333">Set country filter:</span>' +
					'<label style="display:inline-flex;align-items:center;gap:7px;cursor:pointer;' +
						'background:#f5f5f5;border:1px solid #ddd;border-radius:20px;padding:5px 14px">' +
						'<input type="checkbox" id="cf-enable"' + (this.enabled ? ' checked' : '') +
							' style="width:15px;height:15px;cursor:pointer"/>' +
						'<span id="cf-enable-label" style="font-weight:700;font-size:13px;' +
							(this.enabled ? 'color:#2e7d32' : 'color:#c62828') + '">' +
							(this.enabled ? 'Enable' : 'Disable') +
						'</span>' +
					'</label>' +
				'</div>' +

				/* right: view radio + ADD button */
				'<div style="display:flex;align-items:center;gap:10px">' +
					'<div style="display:inline-flex;border:1px solid #bbb;border-radius:6px;overflow:hidden;font-size:13px">' +
						'<label id="lbl-map" style="display:flex;align-items:center;gap:5px;padding:6px 14px;cursor:pointer;' +
							'background:#1565c0;color:#fff;user-select:none">' +
							'<input type="radio" name="cf-view" value="map" id="rb-map" style="accent-color:#fff" checked/> Map View' +
						'</label>' +
						'<label id="lbl-list" style="display:flex;align-items:center;gap:5px;padding:6px 14px;cursor:pointer;' +
							'background:#fff;color:#333;user-select:none">' +
							'<input type="radio" name="cf-view" value="list" id="rb-list" style="accent-color:#1565c0"/> List View' +
						'</label>' +
					'</div>' +
					'<button id="cf-add-btn" style="padding:6px 16px;background:#2e7d32;color:#fff;border:none;' +
						'border-radius:6px;cursor:pointer;font-size:13px;font-weight:600">+ ADD COUNTRIES</button>' +
				'</div>' +

			'</div>' +

			/* geoip status */
			(geoipCount < 10
				? '<div style="margin-top:10px;background:#fff3e0;border:1px solid #ff9800;border-radius:5px;padding:7px 12px;font-size:12px">' +
					'&#9888; GeoIP database not found at /usr/share/xt_geoip/. Install the xt-geoip package.</div>'
				: '<div style="margin-top:10px;background:#e8f5e9;border:1px solid #4caf50;border-radius:5px;padding:7px 12px;font-size:12px">' +
					'&#10003; GeoIP database ready &mdash; ' + geoipCount + ' country files found</div>'
			);

		/* map panel */
		var mapPanel = E('div', { id: 'cf-map-panel' });
		mapPanel.innerHTML = this.buildMap();

		/* list panel */
		var listPanel = E('div', { id: 'cf-list-panel', style: 'display:none' });
		listPanel.innerHTML = this.buildListView();

		/* save button */
		var saveBtn = E('button', {
			id: 'cf-save-btn',
			style: 'padding:9px 26px;background:#1565c0;color:#fff;border:none;' +
				'border-radius:6px;font-size:13px;font-weight:600;cursor:pointer',
			'click': function(ev) { self.handleSave(ev, container); }
		}, 'Save & Apply');

		/* content card */
		var content = E('div', { 'class': 'cbi-section', style: 'padding:16px 18px;border-radius:8px' }, [
			mapPanel,
			listPanel,
			E('div', { style: 'margin-top:16px;padding-top:14px;border-top:1px solid #eee;text-align:right' }, [saveBtn])
		]);

		var container = E('div', { style: 'max-width:1200px' }, [hdr, content]);

		requestAnimationFrame(function() { self.wireEvents(container); });
		return container;
	},

	/* ── Events ───────────────────────────────────────────────── */

	wireEvents: function(container) {
		var self = this;

		/* enable/disable label */
		var enChk = container.querySelector('#cf-enable');
		if (enChk) {
			enChk.addEventListener('change', function() {
				var lbl = container.querySelector('#cf-enable-label');
				if (!lbl) return;
				lbl.textContent = this.checked ? 'Enable' : 'Disable';
				lbl.style.color  = this.checked ? '#2e7d32' : '#c62828';
			});
		}

		/* view toggle */
		var rbMap    = container.querySelector('#rb-map');
		var rbList   = container.querySelector('#rb-list');
		var mapPanel = container.querySelector('#cf-map-panel');
		var lstPanel = container.querySelector('#cf-list-panel');
		var lblMap   = container.querySelector('#lbl-map');
		var lblList  = container.querySelector('#lbl-list');

		function switchView(mode) {
			var isMap = (mode === 'map');
			if (mapPanel) mapPanel.style.display = isMap ? '' : 'none';
			if (lstPanel) lstPanel.style.display = isMap ? 'none' : '';
			if (lblMap)  { lblMap.style.background  = isMap ? '#1565c0' : '#fff'; lblMap.style.color  = isMap ? '#fff' : '#333'; }
			if (lblList) { lblList.style.background = isMap ? '#fff' : '#1565c0'; lblList.style.color = isMap ? '#333' : '#fff'; }
			if (!isMap) self.refreshBlockedPanel(container);
		}

		if (rbMap)  rbMap.addEventListener('change',  function(){ if (this.checked) switchView('map');  });
		if (rbList) rbList.addEventListener('change', function(){ if (this.checked) switchView('list'); });

		/* ADD COUNTRIES → switches to list view */
		var addBtn = container.querySelector('#cf-add-btn');
		if (addBtn) {
			addBtn.addEventListener('click', function() {
				if (rbList && !rbList.checked) {
					rbList.checked = true;
					rbList.dispatchEvent(new Event('change'));
				}
			});
		}

		/* map click + tooltip */
		var svg    = container.querySelector('#cf-world-map');
		var tipBg  = container.querySelector('#cf-tip-bg');
		var tipTxt = container.querySelector('#cf-tip-txt');
		if (svg) {
			svg.addEventListener('click', function(ev) {
				var el = ev.target.closest ? ev.target.closest('.cf-country, .cf-dot') : null;
				if (el) self.toggleCountry(el.dataset.code, container);
			});
			svg.addEventListener('mousemove', function(ev) {
				var el = ev.target.closest ? ev.target.closest('.cf-country, .cf-dot') : null;
				if (el && tipBg && tipTxt) {
					var rect = svg.getBoundingClientRect();
					var vb   = svg.viewBox.baseVal;
					var sx   = (ev.clientX - rect.left) / rect.width  * vb.width;
					var sy   = (ev.clientY - rect.top)  / rect.height * vb.height;
					var txt  = el.dataset.name + ' (' + el.dataset.code + ') — ' + (self.blocked.has(el.dataset.code) ? 'Restricted' : 'Allowed');
					var tw   = Math.max(txt.length * 7 + 16, 160);
					tipBg.setAttribute('x', sx + 8); tipBg.setAttribute('y', sy - 24); tipBg.setAttribute('width', tw);
					tipTxt.setAttribute('x', sx + 16); tipTxt.setAttribute('y', sy - 8);
					tipTxt.textContent = txt;
					tipBg.style.display = tipTxt.style.display = '';
				} else if (tipBg) {
					tipBg.style.display = tipTxt.style.display = 'none';
				}
			});
			svg.addEventListener('mouseleave', function() {
				if (tipBg) tipBg.style.display = tipTxt.style.display = 'none';
			});
		}

		/* list checkboxes */
		var tbody = container.querySelector('#cf-list-tbody');
		if (tbody) {
			tbody.addEventListener('change', function(ev) {
				if (!ev.target.classList.contains('cf-chk')) return;
				var code = ev.target.dataset.code;
				if (ev.target.checked) self.blocked.add(code);
				else self.blocked.delete(code);
				self.refreshBlockedPanel(container);
				self.refreshDot(code);
			});
		}

		/* select-all */
		var chkAll = container.querySelector('#cf-chk-all');
		if (chkAll) {
			chkAll.addEventListener('change', function() {
				var vis = container.querySelectorAll('#cf-list-tbody tr:not([style*="display: none"]) .cf-chk, #cf-list-tbody tr:not([style*="display:none"]) .cf-chk');
				vis.forEach(function(cb) {
					cb.checked = chkAll.checked;
					if (chkAll.checked) self.blocked.add(cb.dataset.code);
					else self.blocked.delete(cb.dataset.code);
				});
				self.refreshBlockedPanel(container);
			});
		}

		/* column search */
		var scCode = container.querySelector('#cf-search-code');
		var scName = container.querySelector('#cf-search-name');
		function doFilter() {
			self.filterList(container, scCode ? scCode.value : '', scName ? scName.value : '');
		}
		if (scCode) scCode.addEventListener('input', doFilter);
		if (scName) scName.addEventListener('input', doFilter);
	},

	filterList: function(container, codeQ, nameQ) {
		codeQ = (codeQ || '').toLowerCase();
		nameQ = (nameQ || '').toLowerCase();
		var rows = container.querySelectorAll('#cf-list-tbody tr');
		rows.forEach(function(r) {
			var show = (r.dataset.code || '').toLowerCase().indexOf(codeQ) !== -1 &&
			           (r.dataset.name || '').toLowerCase().indexOf(nameQ) !== -1;
			r.style.display = show ? '' : 'none';
		});
	},

	toggleCountry: function(code, container) {
		if (this.blocked.has(code)) this.blocked.delete(code);
		else this.blocked.add(code);
		this.refreshDot(code);
		var cb = container ? container.querySelector('.cf-chk[data-code="' + code + '"]') : null;
		if (cb) cb.checked = this.blocked.has(code);
		this.refreshBlockedPanel(container);
	},

	refreshDot: function(code) {
		var el = document.getElementById('cpath-' + code) || document.getElementById('dot-' + code);
		if (!el) return;
		var on = this.blocked.has(code);
		el.setAttribute('fill',   on ? '#ef5350' : '#66bb6a');
		el.setAttribute('stroke', on ? '#b71c1c' : '#2e7d32');
	},

	refreshBlockedPanel: function(container) {
		var p = container ? container.querySelector('#cf-blocked-panel') : null;
		if (p) p.innerHTML = this.buildBlockedList();
	},

	/* ── Save ─────────────────────────────────────────────────── */

	handleSave: function(ev, container) {
		var self = this;

		/* sync list checkboxes into blocked set */
		container.querySelectorAll('#cf-list-tbody .cf-chk').forEach(function(cb) {
			if (cb.checked) self.blocked.add(cb.dataset.code);
			else self.blocked.delete(cb.dataset.code);
		});

		var enabled = !!(container.querySelector('#cf-enable') || {}).checked;
		var btn = ev.target;
		btn.disabled = true;
		btn.textContent = 'Applying…';

		var blockContent;
		if (!enabled || !this.blocked.size) {
			blockContent = 'DISABLE\n';
		} else {
			blockContent = Array.from(this.blocked).join('\n') + '\n';
		}

		/* UCI firewall include management */
		var fwCmd;
		if (enabled && this.blocked.size) {
			fwCmd = 'uci -q delete firewall.ngfw_country 2>/dev/null; ' +
			        'uci set firewall.ngfw_country=include; ' +
			        'uci set firewall.ngfw_country.path=/appdata/CountryBlock.sh; ' +
			        'uci set firewall.ngfw_country.reload=1; ' +
			        'uci commit firewall';
		} else {
			fwCmd = 'uci -q delete firewall.ngfw_country 2>/dev/null; uci commit firewall';
		}

		callWriteFile('/appdata/BlockCountry.txt', blockContent)
			.then(function() { return callExec(fwCmd); })
			.then(function() { return callExec('/usr/local/bin/CountryBlockSet.sh'); })
			.then(function() {
				btn.disabled = false;
				btn.textContent = 'Save & Apply';
				ui.addNotification(null, E('p', 'Country filter settings saved.'), 'info');
			}).catch(function(err) {
				btn.disabled = false;
				btn.textContent = 'Save & Apply';
				ui.addNotification(null, E('p', 'Save error: ' + (err.message || err)), 'error');
			});
	},

	handleSaveReply: function() {}
});
