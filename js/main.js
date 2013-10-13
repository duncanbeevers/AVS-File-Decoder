var compat = false;
var outputDir = "";

/* Logging levels:
 * verbose>=0: errors only,
 * verbose>=1: successful file saves,
 * verbose>=2: loaded files, found components,
 * verbose>=3: individual key:value fields
 */
var verbose = 3;
var allFields = true;
var prettyPrint = false;
var pedanticMode = false; // unused
var receiverPort = 8609;
var receiverUrl = "http://localhost:"+receiverPort;

/// needs:
// util.js
// files.js
// tables.js
// components-builtin.js
// components-dll.js
// convert.js

$(document).ready(function () {
	checkCompat();
	log("File API check: "+(compat?"success":"fail")+".");
	
	var files = [];
	
	$("#preset").change(function(){
		files = loadDir(this, /\.avs$/);
		$("#progress").attr("max", files.length);
		log("Found "+files.length+" files in directory.");
		for (var i = 0; i < files.length; i++) {
			loadFile(files[i], saveAvsAsJson);
		};
	});
});

function saveAvsAsJson (preset, file) {
	var json = JSON.stringify(
			convertPreset(preset, file),
			null, // special treatment? no. // jsonPrintSpecials
			prettyPrint?'    ':null
		);
	// send output to receiver server
	var saveRequest = $.ajax({
			type: "POST",
			url: receiverUrl,
			data: {"json": json, "path": file.webkitRelativePath, "name": file.name},
			async: false, // wait for the receiver to finish saving
		});
	var $curProgress = $("#progress");
	$curProgress.attr("value", parseInt($curProgress.attr("value"))+1);
	log("	+1 - "+file.name);
	
	saveRequest.done(function(msg) {
		if(verbose) {
			log("Receiver successfully")
		}
	});
	
	saveRequest.fail(function(jqXHR, textStatus) {
		log("Receiver failed to save file '"+file.webkitRelativePath+file.name+"': "+textStatus);
	});
	// website text output
	//var output = ('#output');
	//$(output).html(json);
	//$(output).each(function(i, e) {hljs.highlightBlock(e)});
}

// not used - it's filespace wasted, but parsing is easier...
function jsonPrintSpecials (k, v) {
	// a 7x7 matrix in full json takes up an awful lot of space
	if(k==="convolutionMatrix") {
		// we know the matrix is 7x7
		return v.join(',');
	}
	return v;
}