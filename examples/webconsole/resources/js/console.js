/*
 * console.js: kang web console implementation
 */

$(document).ready(kInit);

/*
 * Important DOM elements
 */
var kLastUpdateTime;
var kDataContainer;
var kServiceField;
var kServiceSummary;
var kServiceTable;
var kDump;

/*
 * Application state
 */
var kServiceUrls = [];  /* list of URLs we're collecting data from */
var kServices = [];	/* list of resolved services */
var kUpdateTime;
var kSnapshot;

function kInit()
{
	kLastUpdateTime = document.getElementById('kLastUpdateTime').firstChild;
	kDataContainer = document.getElementById('kDataContainer');
	kServiceField = document.getElementById('kAddServiceService');
	kServiceTable = document.getElementById('kServiceTable');
	kServiceSummary = document.getElementById('kServiceSummary');
	kDump = document.getElementById('kDump');

	kMakeVisibleToggle(document.getElementById('kDumpToggle'),
	    kDump, false);

	kRedrawWorld();

	kLoadHash();

	if (kServiceUrls.length > 0)
		kRefresh();
}

function kFormAddService()
{
	if (kServiceField.value.length > 0)
		kServiceUrls.push(kServiceField.value);
	kServiceField.value = '';
	kSaveHash();
	kRefresh();
}

function kFormRefreshAll()
{
	kRefresh();
}

function kSaveHash()
{
	window.location.hash = kServiceUrls.map(function (url) {
		return ('host=' + encodeURIComponent(url));
	}).join('&');
}

function kLoadHash()
{
	var entries = window.location.hash.substr(1).split('&');

	entries.forEach(function (entry) {
		if (entry.substr(0, 'host='.length) != 'host=')
			return;

		kServiceUrls.push(decodeURIComponent(
		    entry.substr('host='.length)));
	});
}

function kRedrawWorld()
{
	kRedrawServices();
	kRedrawDynamic();
	kRedrawDump();
}

function kRedrawServices()
{
	var table = $(kServiceTable).dataTable({
		'aaData': kServices,
		'aoColumns': [
			{ 'sTitle': 'URL', 'sWidth': '30%' },
			{ 'sTitle': 'Service', 'sWidth': '30%' },
			{ 'sTitle': 'Component', 'sWidth': '10%' },
			{ 'sTitle': 'Instance', 'sWidth': '30%' }
		],
		'bAutoWidth': false,
		'bDestroy': true,
		'bFilter': false,
		'bInfo': false,
		'bPaginate': false,
		'bLengthChange': false,
		'oLanguage': {
			'sEmptyTable': 'No services added yet.'
		}
	});

	$(kServiceSummary).height($(kServiceTable).height() + 70);
}

function kRedrawDynamic()
{
	while (kDataContainer.firstChild !== null)
		kDataContainer.removeChild(kDataContainer.firstChild);

	if (!kSnapshot)
		return;

	/* XXX should use library client code */
	var schema = kSnapshot['schema'];
	var snapshot = kSnapshot['snapshot'].cs_objects;
	var name, div, objkeys, fieldhash, fields, field, rows, columns;

	for (var key in snapshot) {
		if (key == 'service' || key == 'stats')
			continue;

		name = key[0].toUpperCase() + key.substr(1);

		div = kDataContainer.appendChild(
		    kMakeElement('div', 'kSubHeader'));
		div.appendChild(document.createTextNode(name));

		objkeys = Object.keys(snapshot[key]);
		if (schema['types'].hasOwnProperty(key)) {
			fields = [];

			for (var s in schema['types'][key])
				for (var c in schema['types'][key][s])
					fields = fields.concat(
					    schema['types'][key][s][c][
					        'summaryFields']);

			fields = fields.filter(function (field, i) {
				return (fields.indexOf(field) == i);
			});
		} else {
			fieldhash = {};
			objkeys.forEach(function (objkey) {
				for (var k in snapshot[key][objkey][0])
					fieldhash[k] = true;
			});
			fields = Object.keys(fieldhash);
		}

		columns = [ { 'sTitle': name } ].concat(fields.map(
		    function (field) { return ({ 'sTitle': field }); }));

		if (objkeys.length === 0) {
			rows = [];
		} else {
			rows = [];

			objkeys.forEach(function (objkey) {
				snapshot[key][objkey].forEach(function (entry) {
					var row = [];
					row.push(objkey);
					fields.forEach(function (field) {
						var val = JSON.stringify(
						    entry[field], null, 4);
						if (val && val.length > 160)
							val = val.substr(
							    0, 157) + '...';
						row.push(val || '');
					});
					rows.push(row);
				});
			});
		}

		div = kDataContainer.appendChild(
		    kMakeElement('table', 'kDynamicTable'));
		$(div).dataTable({
			'aaData': rows,
			'aoColumns': columns,
			'iDisplayLength': 40,
			'bLengthChange': false,
			'bFilter': false,
			'bInfo': false,
			'bPaginate': false,
			'oLanguage': {
				'sEmptyTable': 'No objects.'
			}
		});

		kDataContainer.appendChild(
		    kMakeElement('div', 'kHorizontalSeparator'));
	}
}

function kRedrawDump()
{
	var text = document.createTextNode(JSON.stringify(kSnapshot, null, 4));

	if (kDump.firstChild)
		kDump.replaceChild(text, kDump.firstChild);
	else
		kDump.appendChild(text);
}

function kMakeElement(tag, classes)
{
	var rv = document.createElement(tag);
	if (classes)
		rv.className = classes;
	return (rv);
}

function kMakeHeader(text)
{
	var rv = kMakeElement('h2');
	rv.appendChild(document.createTextNode(text));
	return (rv);
}

function kMakeVisibleToggle(toggle, element, visible)
{
	var set_state = function (nowvisible) {
		if (nowvisible) {
			toggle.innerHTML = 'hide';
			element.style.display = 'block';
		} else {
			toggle.innerHTML = 'show';
			element.style.display = 'none';
		}

		state = nowvisible;
	};

	set_state(visible);

	$(toggle).click(function () { set_state(!state); });
}

function kRefresh()
{
	var query = '?' + kServiceUrls.map(function (url) {
		return ('host=' + encodeURIComponent(url));
	}).join('&');

	kLastUpdateTime.nodeValue =
	    (kUpdateTime ? kUpdateTime : 'never') + ' (refreshing...)';

	var rq = $.getJSON('proxy' + query, function (data) {
		kUpdateTime = new Date();
		kLastUpdateTime.nodeValue = kUpdateTime;

		if (!data || !data['snapshot'] || !data['snapshot'].cs_objects)
			return;

		/*
		 * Go through and normalize our source names.
		 */
		var i, source, name;
		for (i = 0; i < data['sources'].length; i++) {
			if (data['sources'][i].hasOwnProperty('error'))
				continue;

			source = data['sources'][i]['source'];
			name = source['protocol'] + '://' +
			    source['host'] + ':' + source['port'] +
			    source['path'];
			kServiceUrls[i] = name;
		}

		var snapshot = data['snapshot'];
		var services = snapshot.cs_objects['service'];
		kServices = [];
		if (!services)
			return;
		Object.keys(services).forEach(
		    function (key) {
			/* XXX auto-generate data table? */
			var service = services[key][0]; /* XXX [0] */
			kServices.push([
				service['source'],
				service['name'],
				service['component'] || '',
				service['ident']
			]);
		});

		kSnapshot = data;
		kSaveHash();
		kRedrawWorld();
	});

	rq.error(function (_, errmsg, err) {
		var msgs = [ 'refresh failed' ];

		if (errmsg)
			msgs.push(errmsg);

		if (err)
			msgs.push(err.message);

		alert(msgs.join(': '));
	});
}
