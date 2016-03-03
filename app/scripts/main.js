var compat = false;
var outputDir = "";

var pedanticMode = false; // unused
var verbose = true; // log individual key:value fields
var allFields = true;
var prettyPrint = true;

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
        log("Found "+files.length+" files in directory.");
        for (var i = 0; i < files.length; i++) {
            loadFile(files[i], saveAvsAsJson);
        };
    });
});

function saveAvsAsJson (preset, file) {
    var preset = {
        'name': file.name.substr(0,file.name.length-4),
        'date': file.lastModifiedDate.toISOString(),
        // 'author': '',
    };

    var json = convertPreset(preset, preset);
    var output = ('#output');
    $(output).html(JSON.stringify(json, null, prettyPrint?'    ':null));
    $(output).each(function(i, e) {hljs.highlightBlock(e)});
}

// not used - it's filespace wasted, but parsing easier...
function jsonPrintSpecials (k, v) {
    // a 7x7 matrix in full json takes up an awful lot of space
    if(k==="convolutionMatrix") {
        // we know the matrix is 7x7
        return v.join(',');
    }
    return v;
}
