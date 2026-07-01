'use strict';
'require view';
'require rpc';
'require ui';
'require dom';

/* All 195 UN member states + key territories
   [code, name, lat, lon, radius]
   lat/lon = geographic centroid
   radius = relative area (2=tiny, 4=small, 6=medium, 8=large, 12=very large, 15=continent-scale) */
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
		return Promise.all([
			L.resolveDefault(callReadFile('/appdata/BlockCountry.txt'), ''),
			L.resolveDefault(callReadFile('/appdata/CountryIPAllowed.txt'), ''),
			L.resolveDefault(callExec('ls /usr/share/xt_geoip/*.iv4 2>/dev/null | wc -l'), '0')
		]);
	},

	parseConfig: function(blockData, allowData) {
		var lines = (blockData || '').split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
		var last  = lines[lines.length - 1] || '';
		if (!lines.length || last === 'DISABLE') {
			this.enabled = false;
			this.blocked  = new Set();
		} else {
			this.enabled = true;
			this.blocked  = new Set(lines.filter(function(l){ return l !== 'DISABLE'; }));
		}
		this.allowedIPs = (allowData || '').split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
	},

	lonToX: function(lon) { return ((lon + 180) / 360 * 960); },
	latToY: function(lat) { return ((90 - lat) / 180 * 480); },

	buildMap: function() {
		var self = this;
		var W = 960, H = 480;

		var circles = COUNTRIES.map(function(c) {
			var code = c[0], name = c[1], lat = c[2], lon = c[3], r = c[4];
			var x = self.lonToX(lon).toFixed(1);
			var y = self.latToY(lat).toFixed(1);
			var blocked = self.blocked.has(code);
			var fill    = blocked ? '#ef5350' : '#66bb6a';
			var glow    = blocked ? '#b71c1c' : '#1b5e20';
			return '<circle class="cf-dot" id="dot-' + code + '" ' +
				'cx="' + x + '" cy="' + y + '" r="' + r + '" ' +
				'fill="' + fill + '" stroke="' + glow + '" stroke-width="0.8" opacity="0.88" ' +
				'data-code="' + code + '" data-name="' + name + '">' +
				'<title>' + name + ' (' + code + ') — ' + (blocked ? 'BLOCKED' : 'Allowed') + '</title>' +
				'</circle>';
		}).join('');

		/* simplified continent land polygons for geographic context */
		var land = [
			/* North America */
			'M 26,56 L 330,44 L 350,90 L 290,130 L 267,183 L 240,208 L 230,228 L 200,200 L 130,140 L 80,95 Z',
			/* Greenland */
			'M 310,18 L 390,12 L 400,50 L 360,60 L 310,45 Z',
			/* South America */
			'M 200,228 L 290,215 L 330,270 L 320,360 L 265,420 L 230,400 L 215,340 L 200,280 Z',
			/* Europe */
			'M 430,55 L 530,50 L 540,80 L 500,110 L 480,130 L 440,120 L 420,90 Z',
			/* Africa */
			'M 440,130 L 530,120 L 560,150 L 550,260 L 510,340 L 470,360 L 440,300 L 420,200 L 430,155 Z',
			/* Asia (simplified) */
			'M 530,50 L 840,40 L 870,100 L 820,140 L 760,160 L 700,200 L 640,180 L 580,160 L 540,120 L 530,80 Z',
			/* Middle East */
			'M 540,120 L 620,115 L 640,160 L 590,180 L 560,165 Z',
			/* Indian subcontinent */
			'M 680,140 L 730,135 L 740,200 L 720,240 L 690,230 L 675,180 Z',
			/* SE Asia */
			'M 760,180 L 820,175 L 830,240 L 800,260 L 765,240 L 755,200 Z',
			/* Australia */
			'M 760,270 L 870,260 L 890,330 L 870,380 L 810,390 L 760,350 L 750,300 Z',
			/* Japan */
			'M 840,110 L 860,105 L 865,130 L 850,135 Z',
			/* UK/Ireland */
			'M 435,70 L 450,65 L 455,85 L 438,88 Z'
		].join(' ');

		return '<div style="position:relative">' +
		'<svg id="cf-world-map" viewBox="0 0 ' + W + ' ' + H + '" ' +
			'style="width:100%;height:420px;display:block;border-radius:8px;cursor:crosshair;' +
			'background:linear-gradient(170deg,#1a237e 0%,#1565c0 40%,#0277bd 100%);' +
			'box-shadow:0 4px 20px rgba(0,0,0,0.4)">' +
			'<defs>' +
				'<filter id="glow-r"><feGaussianBlur stdDeviation="3" result="b"/>' +
					'<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
				'<filter id="glow-g"><feGaussianBlur stdDeviation="2" result="b"/>' +
					'<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
			'</defs>' +
			'<path d="' + land + '" fill="#2e7d32" fill-opacity="0.25" stroke="#4caf50" stroke-width="0.5" stroke-opacity="0.4"/>' +
			circles +
			'<rect id="cf-tooltip-bg" x="0" y="0" width="180" height="28" rx="4" fill="#212121" fill-opacity="0.85" style="display:none"/>' +
			'<text id="cf-tooltip-txt" x="8" y="19" fill="#fff" font-size="12" font-family="sans-serif" style="display:none;pointer-events:none"></text>' +
		'</svg>' +
		'<div style="position:absolute;bottom:8px;right:8px;display:flex;gap:12px;font-size:11px;color:#fff;' +
			'background:rgba(0,0,0,0.5);padding:4px 10px;border-radius:4px">' +
			'<span>&#9679; <span style="color:#66bb6a">Allowed</span></span>' +
			'<span>&#9679; <span style="color:#ef5350">Blocked</span></span>' +
			'<span style="opacity:0.6">Click to toggle</span>' +
		'</div>' +
		'</div>';
	},

	buildStats: function() {
		var total   = COUNTRIES.length;
		var blocked = this.blocked.size;
		var allowed = total - blocked;
		return '<div style="display:flex;gap:16px;margin:12px 0;flex-wrap:wrap">' +
			'<div style="flex:1;min-width:120px;background:linear-gradient(135deg,#1b5e20,#2e7d32);' +
				'color:#fff;padding:12px 16px;border-radius:8px;text-align:center">' +
				'<div style="font-size:28px;font-weight:700">' + allowed + '</div>' +
				'<div style="font-size:12px;opacity:0.85">Allowed Countries</div></div>' +
			'<div style="flex:1;min-width:120px;background:linear-gradient(135deg,#b71c1c,#c62828);' +
				'color:#fff;padding:12px 16px;border-radius:8px;text-align:center">' +
				'<div style="font-size:28px;font-weight:700">' + blocked + '</div>' +
				'<div style="font-size:12px;opacity:0.85">Blocked Countries</div></div>' +
			'<div style="flex:1;min-width:120px;background:linear-gradient(135deg,#0d47a1,#1565c0);' +
				'color:#fff;padding:12px 16px;border-radius:8px;text-align:center">' +
				'<div style="font-size:28px;font-weight:700">' + total + '</div>' +
				'<div style="font-size:12px;opacity:0.85">Total Countries</div></div>' +
		'</div>';
	},

	buildCountryList: function() {
		var self = this;
		var rows = COUNTRIES.map(function(c) {
			var code    = c[0], name = c[1];
			var blocked = self.blocked.has(code);
			var badgeBg = blocked ? '#ef5350' : '#66bb6a';
			var badge   = blocked ? 'BLOCKED' : 'Allowed';
			return '<tr id="row-' + code + '" style="cursor:pointer" ' +
				'onclick="this.getRootNode().host ? void 0 : window.__cfToggle && window.__cfToggle(\'' + code + '\')">' +
				'<td style="padding:6px 10px;font-weight:600;color:#888;width:50px">' + code + '</td>' +
				'<td style="padding:6px 4px">' + name + '</td>' +
				'<td style="padding:6px 10px;text-align:right">' +
					'<span id="badge-' + code + '" style="display:inline-block;padding:2px 10px;border-radius:12px;' +
					'font-size:11px;font-weight:600;color:#fff;background:' + badgeBg + '">' + badge + '</span>' +
				'</td>' +
			'</tr>';
		}).join('');

		return '<div style="margin-top:16px">' +
			'<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">' +
				'<input id="cf-search" type="text" placeholder="Search country..." ' +
					'style="flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:13px" ' +
					'oninput="window.__cfSearch && window.__cfSearch(this.value)"/>' +
				'<button onclick="window.__cfBlockAll && window.__cfBlockAll()" ' +
					'style="padding:7px 14px;background:#b71c1c;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px">Block All</button>' +
				'<button onclick="window.__cfClearAll && window.__cfClearAll()" ' +
					'style="padding:7px 14px;background:#2e7d32;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px">Allow All</button>' +
			'</div>' +
			'<div style="max-height:320px;overflow-y:auto;border:1px solid #e0e0e0;border-radius:6px">' +
				'<table style="width:100%;border-collapse:collapse;font-size:13px" id="cf-country-table">' +
					'<thead><tr style="background:#f5f5f5;position:sticky;top:0">' +
						'<th style="padding:8px 10px;text-align:left;color:#555">Code</th>' +
						'<th style="padding:8px 4px;text-align:left;color:#555">Country</th>' +
						'<th style="padding:8px 10px;text-align:right;color:#555">Status</th>' +
					'</tr></thead>' +
					'<tbody id="cf-tbody">' + rows + '</tbody>' +
				'</table>' +
			'</div>' +
		'</div>';
	},

	buildAllowedIPs: function() {
		var rows = this.allowedIPs.map(function(entry, i) {
			var parts = entry.split(':');
			var label = parts[0] || '';
			var ip    = parts.slice(1).join(':') || '';
			return '<tr>' +
				'<td style="padding:6px 8px"><input type="text" value="' + label + '" ' +
					'id="al-lbl-' + i + '" style="width:100%;border:1px solid #ddd;border-radius:4px;padding:4px 6px"/></td>' +
				'<td style="padding:6px 8px"><input type="text" value="' + ip + '" ' +
					'id="al-ip-' + i + '" style="width:100%;border:1px solid #ddd;border-radius:4px;padding:4px 6px"/></td>' +
				'<td style="padding:6px 8px;width:60px">' +
					'<button onclick="this.closest(\'tr\').remove()" ' +
						'style="background:#ef5350;color:#fff;border:none;border-radius:4px;padding:3px 8px;cursor:pointer">&#10005;</button>' +
				'</td></tr>';
		}).join('');

		return '<div style="margin-top:20px">' +
			'<div style="font-weight:600;margin-bottom:8px;color:#333">Bypass IPs ' +
				'<span style="font-size:11px;font-weight:400;color:#888">' +
				'(always allowed even if their country is blocked)</span></div>' +
			'<table style="width:100%;border-collapse:collapse;font-size:13px" id="cf-allow-table">' +
				'<thead><tr style="background:#f5f5f5">' +
					'<th style="padding:6px 8px;text-align:left;color:#555;border-bottom:1px solid #ddd">Label</th>' +
					'<th style="padding:6px 8px;text-align:left;color:#555;border-bottom:1px solid #ddd">IP / CIDR</th>' +
					'<th style="width:60px;border-bottom:1px solid #ddd"></th>' +
				'</tr></thead>' +
				'<tbody id="cf-allow-tbody">' + rows + '</tbody>' +
			'</table>' +
			'<button onclick="window.__cfAddIP && window.__cfAddIP()" ' +
				'style="margin-top:8px;padding:6px 14px;background:#1565c0;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px">+ Add IP</button>' +
		'</div>';
	},

	wireEvents: function(container) {
		var self = this;

		/* toggle a single country */
		window.__cfToggle = function(code) {
			if (self.blocked.has(code)) {
				self.blocked.delete(code);
			} else {
				self.blocked.add(code);
			}
			self.refreshDot(code);
			self.refreshRow(code);
			self.refreshStats(container);
		};

		/* map hover tooltip */
		var svg = container.querySelector('#cf-world-map');
		var tipBg  = container.querySelector('#cf-tooltip-bg');
		var tipTxt = container.querySelector('#cf-tooltip-txt');
		if (svg) {
			svg.addEventListener('mousemove', function(ev) {
				var el = ev.target.closest('.cf-dot');
				if (el) {
					var svgRect = svg.getBoundingClientRect();
					var vb = svg.viewBox.baseVal;
					var sx = (ev.clientX - svgRect.left) / svgRect.width  * vb.width;
					var sy = (ev.clientY - svgRect.top)  / svgRect.height * vb.height;
					var name  = el.dataset.name;
					var code  = el.dataset.code;
					var state = self.blocked.has(code) ? 'BLOCKED' : 'Allowed';
					var txt   = name + ' (' + code + ') — ' + state;
					var tw    = Math.max(txt.length * 7 + 16, 160);
					tipBg.setAttribute('x', sx + 10);
					tipBg.setAttribute('y', sy - 22);
					tipBg.setAttribute('width', tw);
					tipBg.style.display = '';
					tipTxt.setAttribute('x', sx + 18);
					tipTxt.setAttribute('y', sy - 6);
					tipTxt.textContent = txt;
					tipTxt.style.display = '';
				} else {
					tipBg.style.display = 'none';
					tipTxt.style.display = 'none';
				}
			});
			svg.addEventListener('mouseleave', function() {
				tipBg.style.display = 'none';
				tipTxt.style.display = 'none';
			});
			svg.addEventListener('click', function(ev) {
				var el = ev.target.closest('.cf-dot');
				if (el) window.__cfToggle(el.dataset.code);
			});
		}

		/* search */
		window.__cfSearch = function(q) {
			q = q.toLowerCase();
			var rows = container.querySelectorAll('#cf-tbody tr');
			rows.forEach(function(r) {
				var txt = r.textContent.toLowerCase();
				r.style.display = txt.includes(q) ? '' : 'none';
			});
		};

		/* bulk actions */
		window.__cfBlockAll = function() {
			COUNTRIES.forEach(function(c){ self.blocked.add(c[0]); });
			self.refreshAll(container);
		};
		window.__cfClearAll = function() {
			self.blocked.clear();
			self.refreshAll(container);
		};

		/* add allowed IP row */
		window.__cfAddIP = function() {
			var tbody = container.querySelector('#cf-allow-tbody');
			var i     = tbody.rows.length;
			var tr    = document.createElement('tr');
			tr.innerHTML =
				'<td style="padding:6px 8px"><input type="text" placeholder="Label" ' +
					'id="al-lbl-' + i + '" style="width:100%;border:1px solid #ddd;border-radius:4px;padding:4px 6px"/></td>' +
				'<td style="padding:6px 8px"><input type="text" placeholder="192.168.1.0/24" ' +
					'id="al-ip-' + i + '" style="width:100%;border:1px solid #ddd;border-radius:4px;padding:4px 6px"/></td>' +
				'<td style="padding:6px 8px;width:60px">' +
					'<button onclick="this.closest(\'tr\').remove()" ' +
						'style="background:#ef5350;color:#fff;border:none;border-radius:4px;padding:3px 8px;cursor:pointer">&#10005;</button>' +
				'</td>';
			tbody.appendChild(tr);
		};
	},

	refreshDot: function(code) {
		var dot = document.getElementById('dot-' + code);
		if (!dot) return;
		var blocked = this.blocked.has(code);
		dot.setAttribute('fill',   blocked ? '#ef5350' : '#66bb6a');
		dot.setAttribute('stroke', blocked ? '#b71c1c' : '#1b5e20');
		var title = dot.querySelector('title');
		if (title) title.textContent = dot.dataset.name + ' (' + code + ') — ' + (blocked ? 'BLOCKED' : 'Allowed');
	},

	refreshRow: function(code) {
		var badge = document.getElementById('badge-' + code);
		if (!badge) return;
		var blocked = this.blocked.has(code);
		badge.style.background = blocked ? '#ef5350' : '#66bb6a';
		badge.textContent      = blocked ? 'BLOCKED' : 'Allowed';
	},

	refreshAll: function(container) {
		COUNTRIES.forEach(function(c){ this.refreshDot(c[0]); this.refreshRow(c[0]); }, this);
		this.refreshStats(container);
	},

	refreshStats: function(container) {
		var el = container.querySelector('#cf-stats');
		if (el) el.innerHTML = this.buildStats();
	},

	collectAllowedIPs: function(container) {
		var result = [];
		var rows   = container.querySelectorAll('#cf-allow-tbody tr');
		rows.forEach(function(r, i) {
			var lbl = (r.querySelector('input[id^="al-lbl-"]') || {}).value || '';
			var ip  = (r.querySelector('input[id^="al-ip-"]')  || {}).value || '';
			lbl = lbl.trim(); ip = ip.trim();
			if (ip) result.push(lbl ? lbl + ':' + ip : ':' + ip);
		});
		return result;
	},

	render: function(data) {
		var self = this;
		this.parseConfig(data[0], data[1]);
		var geoipCount = parseInt((data[2] || '').trim()) || 0;

		var geoipWarning = geoipCount < 10
			? '<div style="background:#fff3e0;border:1px solid #ff9800;border-radius:6px;padding:10px 14px;margin-bottom:12px;font-size:13px">' +
				'&#9888; GeoIP database not found at <code>/usr/share/xt_geoip/</code>. ' +
				'Country blocking requires the <b>xt-geoip</b> package and GeoIP data to be installed.' +
			  '</div>'
			: '<div style="background:#e8f5e9;border:1px solid #4caf50;border-radius:6px;padding:8px 14px;margin-bottom:12px;font-size:13px">' +
				'&#10003; GeoIP database loaded (' + geoipCount + ' country files found)' +
			  '</div>';

		var el = E('div', { style: 'max-width:1100px' }, [
			E('h2', { style: 'margin:0 0 4px;color:#212121' }, 'Country Filter'),
			E('p',  { style: 'color:#666;margin:0 0 16px;font-size:13px' },
				'Block incoming traffic from selected countries using GeoIP firewall rules.'),

			E('div', { 'class': 'cbi-section', style: 'padding:16px 20px;border-radius:8px' }, [

				/* Enable toggle */
				E('div', { style: 'display:flex;align-items:center;gap:14px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid #eee' }, [
					E('span', { style: 'font-size:15px;font-weight:600;color:#333' }, 'Country Filter:'),
					E('label', { style: 'display:flex;align-items:center;gap:8px;cursor:pointer' }, [
						E('input', {
							type: 'checkbox',
							id: 'cf-enable',
							checked: this.enabled ? 'checked' : null,
							style: 'width:18px;height:18px;cursor:pointer'
						}),
						E('span', { id: 'cf-enable-label', style: 'font-weight:600;' +
							(this.enabled ? 'color:#2e7d32' : 'color:#b71c1c') },
							this.enabled ? 'ENABLED' : 'DISABLED')
					])
				]),

				/* GeoIP status */
				E('div', { innerHTML: geoipWarning }),

				/* Stats */
				E('div', { id: 'cf-stats', innerHTML: this.buildStats() }),

				/* Map */
				E('div', { style: 'margin-bottom:16px', innerHTML: this.buildMap() }),

				/* Country list */
				E('div', { innerHTML: this.buildCountryList() }),

				/* Allowed IPs */
				E('div', { innerHTML: this.buildAllowedIPs() }),

				/* Save button */
				E('div', { style: 'margin-top:20px;padding-top:16px;border-top:1px solid #eee;text-align:right' }, [
					E('button', {
						style: 'padding:10px 28px;background:#1565c0;color:#fff;border:none;' +
							'border-radius:6px;font-size:14px;font-weight:600;cursor:pointer',
						'click': function(ev) { self.handleSave(ev, el); }
					}, 'Save & Apply Rules')
				])
			])
		]);

		/* wire enable checkbox label */
		var chk = el.querySelector('#cf-enable');
		if (chk) {
			chk.addEventListener('change', function() {
				var lbl = el.querySelector('#cf-enable-label');
				if (lbl) {
					lbl.textContent = this.checked ? 'ENABLED' : 'DISABLED';
					lbl.style.color  = this.checked ? '#2e7d32' : '#b71c1c';
				}
			});
		}

		/* wire all interactive events */
		requestAnimationFrame(function() { self.wireEvents(el); });

		return el;
	},

	handleSave: function(ev, container) {
		var self    = this;
		var enabled = !!(container.querySelector('#cf-enable') || {}).checked;
		var ips     = this.collectAllowedIPs(container);

		var btn = ev.target;
		btn.disabled    = true;
		btn.textContent = 'Applying…';

		var blockContent, allowContent;

		if (!enabled) {
			blockContent = 'DISABLE\n';
		} else {
			blockContent = Array.from(this.blocked).join('\n') + (this.blocked.size ? '\n' : 'DISABLE\n');
		}

		allowContent = ips.join('\n') + (ips.length ? '\n' : '');

		Promise.all([
			callWriteFile('/appdata/BlockCountry.txt',    blockContent),
			callWriteFile('/appdata/CountryIPAllowed.txt', allowContent)
		]).then(function() {
			return callExec('/usr/local/bin/CountryBlockSet.sh');
		}).then(function() {
			btn.disabled    = false;
			btn.textContent = 'Save & Apply Rules';
			ui.addNotification(null, E('p', 'Country filter rules applied successfully.'), 'info');
		}).catch(function(err) {
			btn.disabled    = false;
			btn.textContent = 'Save & Apply Rules';
			ui.addNotification(null, E('p', 'Error: ' + (err.message || err)), 'error');
		});
	},

	handleSaveReply: function() {}
});
