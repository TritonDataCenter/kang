/*
 * nodeutil.js: miscellaneous utility routines
 */

exports.chopSlashes = function chopSlashes(str)
{
	var i;

	for (i = str.length - 1; i >= 0; i--) {
		if (str[i] != '/')
			break;
	}

	if (i != str.length - 1)
		return (str.substr(0, i + 1));

	return (str);
};
