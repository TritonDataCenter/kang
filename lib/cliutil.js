/*
 * cliutil.js: general CLI utility routines
 */

function pad(obj, width)
{
	var objstr, rv, i;

	if (obj === undefined)
		objstr = '';
	else
		objstr = obj.toString();

	rv = '';

	if (typeof (obj) != 'number')
		rv += objstr;

	for (i = objstr.length; i < width; i++)
		rv += ' ';

	if (typeof (obj) == 'number')
		rv += objstr;

	return (rv);
}

exports.emitTable = function emitTable(out, fields, objects, debug)
{
	var widths = {};

	if (debug) {
		console.log('fields = %j', fields);
		console.log('objects = %j', objects);
	}

	/* Compute field widths */
	fields.forEach(function (field) {
		widths[field] = field.length + 1;
	});

	objects.forEach(function (obj) {
		fields.forEach(function (field) {
			if (!obj.hasOwnProperty(field))
				return;

			var value = obj[field].toString();
			if (value.length + 1 > widths[field])
				widths[field] = value.length + 1;
		});
	});

	/* Print out the table. */
	fields.forEach(function (field) {
		out.write(pad(field, widths[field]).toUpperCase());
	});
	out.write('\n');

	objects.forEach(function (obj) {
		fields.forEach(function (field) {
			var value = obj.hasOwnProperty(field) ?
			    obj[field].toString() : '';
			out.write(pad(value, widths[field]));
		});

		out.write('\n');
	});
};
