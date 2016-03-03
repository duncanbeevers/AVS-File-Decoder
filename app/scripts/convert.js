'use strict';

var _components = require('./components');
var builtinComponents = _components.builtinComponents;
var dllComponents = _components.dllComponents;

var _util = require('./util');
var sizeInt = _util.sizeInt;
var presetHeaderLength = _util.presetHeaderLength;
var builtinMax = _util.builtinMax;
var log = _util.log;
var ConvertException = _util.ConvertException;
var getBit = _util.getBit;
var getBool = _util.getBool;
var getInt32 = _util.getInt32;
var getUInt32 = _util.getUInt32;
var getUInt64 = _util.getUInt64;
var getSizeString = _util.getSizeString;
var getNtString = _util.getNtString;
var cmpBytes = _util.cmpBytes;
var removeSpaces = _util.removeSpaces;

var _tables = require('./tables');
var blendmodesIn = _tables.blendmodesIn;
var blendmodesOut = _tables.blendmodesOut;
var blendmodesBuffer = _tables.blendmodesBuffer;
var blendmodesColorMap = _tables.blendmodesColorMap;
var blendmodesPicture2 = _tables.blendmodesPicture2;
var blendmodesRender = _tables.blendmodesRender;
var blendmodesTexer = _tables.blendmodesTexer;
var buffermodes = _tables.buffermodes;
var movementEffects = _tables.movementEffects;
var multiFilterEffect = _tables.multiFilterEffect;
var cycleModesColorMap = _tables.cycleModesColorMap;
var keysColorMap = _tables.keysColorMap;
var coordinates = _tables.coordinates;
var drawModes = _tables.drawModes;
var audioChannels = _tables.audioChannels;
var audioSources = _tables.audioSources;
var positionsX = _tables.positionsX;
var positionsY = _tables.positionsY;

var allFields = true;

var componentTable = builtinComponents.concat(dllComponents);

function convertPreset (presetFile, preset) {
    preset = preset || {};
    preset.name = preset.name || 'UNKNOWN';

    var blob8 = new Uint8Array(presetFile);
    try {
        var clearFrame = decodePresetHeader(blob8.subarray(0, presetHeaderLength));
        preset['clearFrame'] = clearFrame;
        var components = convertComponents(blob8.subarray(presetHeaderLength));
        preset['components'] = components;
    } catch (e) {
        if(e instanceof ConvertException) {
            log('Error: '+e.message);
            return null;
        } else {
            throw e;
        }
    }
    return preset;
}

function convertComponents (blob) {
    var fp = 0;
    var components = [];
    while(fp < blob.length) {
        var code = getUInt32(blob, fp);
        var i = getComponentIndex(code, blob, fp);
        var isDll = code!==0xfffffffe && code>builtinMax;
        var size = getComponentSize(blob, fp+sizeInt+isDll*32);
        var res;
        if(i<0) {
            res = {'type': 'Unknown: ('+(-i)+')'};
        } else {
            var offset = fp+sizeInt*2+isDll*32;
            var fnName = componentTable[i].func;
            var fn = decodeFns[fnName];
            if (!fn) {
                throw new Error('Could not find decodeFn named ' + fnName);
            }

            res = fn(
                blob,
                offset,
                componentTable[i].fields,
                componentTable[i].name,
                offset+size);
        }
        if(!res || typeof res !== 'object') { // should not happen, decode functions should throw their own.
            throw new ConvertException('Unknown convert error');
        }
        components.push(res);
        fp += size + sizeInt*2 + isDll*32;
    }
    return components;
}

function getComponentIndex (code, blob, offset) {
    var i;
    if(code<builtinMax || code===0xfffffffe) {
        for (i = 0; i < componentTable.length; i++) {
            if(code === componentTable[i].code) {
                // log('Found component: '+componentTable[i].name+' ('+code+')');
                return i;
            }
        }
    } else {
        for (i = builtinComponents.length; i < componentTable.length; i++) {
            if(componentTable[i].code instanceof Array &&
                    cmpBytes(blob, offset+sizeInt, componentTable[i].code)) {
                // log('Found component: '+componentTable[i].name);
                return i;
            }
        }
    }
    log('Found unknown component (code: '+code+')');
    return -code;
}

function getComponentSize (blob, offset) {
    return getUInt32(blob, offset);
}

function decodePresetHeader (blob) {
    var presetHeader0_1 = [ // reads: "Nullsoft AVS Preset 0.1 \x1A"
            0x4E, 0x75, 0x6C, 0x6C, 0x73, 0x6F, 0x66, 0x74,
            0x20, 0x41, 0x56, 0x53, 0x20, 0x50, 0x72, 0x65,
            0x73, 0x65, 0x74, 0x20, 0x30, 0x2E, 0x31, 0x1A];
    var presetHeader0_2 = [ // reads: "Nullsoft AVS Preset 0.2 \x1A"
            0x4E, 0x75, 0x6C, 0x6C, 0x73, 0x6F, 0x66, 0x74,
            0x20, 0x41, 0x56, 0x53, 0x20, 0x50, 0x72, 0x65,
            0x73, 0x65, 0x74, 0x20, 0x30, 0x2E, 0x32, 0x1A,];
    if(!cmpBytes(blob, /*offset*/0, presetHeader0_2) &&
        !cmpBytes(blob, /*offset*/0, presetHeader0_1)) { // 0.1 only if 0.2 failed because it's far rarer.
        throw new ConvertException('Invalid preset header.');
    }
    return blob[presetHeaderLength-1]===1; // "Clear Every Frame"
}

//// component decode functions

function decode_effectList (blob, offset) {
    var size = getUInt32(blob, offset-sizeInt);
    var comp = {
        'type': 'EffectList',
        'enabled': getBit(blob, offset, 1)[0]!==1,
        'clearFrame': getBit(blob, offset, 0)[0]===1,
        'input': getBlendmodeIn(blob, offset+2, 1)[0],
        'output': getBlendmodeOut(blob, offset+3, 1)[0],
        //ignore constant el config size of 36 bytes (9 x int32)
        'inAdjustBlend': getUInt32(blob, offset+5),
        'outAdjustBlend': getUInt32(blob, offset+9),
        'inBuffer': getUInt32(blob, offset+13),
        'outBuffer': getUInt32(blob, offset+17),
        'inBufferInvert': getUInt32(blob, offset+21)===1,
        'outBufferInvert': getUInt32(blob, offset+25)===1,
        'enableOnBeat': getUInt32(blob, offset+29)===1,
        'onBeatFrames': getUInt32(blob, offset+33),
    };
    var effectList28plusHeader = [ // reads: .$..AVS 2.8+ Effect List Config....
            0x00, 0x40, 0x00, 0x00, 0x41, 0x56, 0x53, 0x20,
            0x32, 0x2E, 0x38, 0x2B, 0x20, 0x45, 0x66, 0x66,
            0x65, 0x63, 0x74, 0x20, 0x4C, 0x69, 0x73, 0x74,
            0x20, 0x43, 0x6F, 0x6E, 0x66, 0x69, 0x67, 0x00,
            0x00, 0x00, 0x00, 0x00];
    var extOffset = offset+37;
    var contSize = size-37;
    var contOffset = extOffset;
    if(cmpBytes(blob, extOffset, effectList28plusHeader)) {
        extOffset += effectList28plusHeader.length;
        var extSize = getUInt32(blob, extOffset);
        contOffset += effectList28plusHeader.length+sizeInt+extSize;
        contSize = size-37-effectList28plusHeader.length-sizeInt-extSize;
        comp['codeEnabled'] = getUInt32(blob, extOffset+sizeInt)===1;
        var initSize = getUInt32(blob, extOffset+sizeInt*2);
        comp['init'] = getSizeString(blob, extOffset+sizeInt*2)[0];
        comp['frame'] = getSizeString(blob, extOffset+sizeInt*3+initSize)[0];
    } //else: old Effect List format, inside components just start
    var content = convertComponents(blob.subarray(contOffset, contOffset+contSize));
    comp['components'] = content;
    return comp;
}

// generic field decoding function that most components use.
function decode_generic (blob, offset, fields, name, end) {
    var comp = {
        'type': removeSpaces(name)
    };
    var keys = Object.keys(fields);
    var lastWasABitField = false;
    for(var i=0; i<keys.length; i++) {
        if(offset >= end) {
            break;
        }
        var k = keys[i];
        var f = fields[k];
        if(k.match(/^null[_0-9]*$/)) {
            offset += f;
            // 'null_: 0' resets bitfield continuity to allow several consecutive bitfields
            lastWasABitField = false;
            continue;
        }
        var size = 0;
        var value, result;
        var number = typeof f === 'number';
        // var other = typeof f === 'string' || f instanceof Array;
        var other = typeof f === 'string';
        // console.log('number: ' + number + ' other: ' + other + ' typeof: ' + typeof f + ' f: ' + f);
        // console.log('f: ' + JSON.stringify(f) + ' typeof f: ' + typeof f);
        // var array = f instanceof Array;
        var fn;
        if(number) {
            switch(f) {
                case 1:
                    size = 1;
                    value = blob[offset];
                    break;
                case sizeInt:
                    size = sizeInt;
                    value = getUInt32(blob, offset);
                    break;
                default:
                    throw new ConvertException('Invalid field size: '+f+'.');
            }
            lastWasABitField = false;
        } else if(other) {
            fn = mappingFns[f];
            if (!fn) {
                throw new ConvertException('(OTHER) Mapping method \''+f+'\' was not found. (correct capitalization?)' + JSON.stringify(Object.keys(mappingFns)));
            }

            try {
                result = fn(blob, offset);
            } catch (e) {
                if (e.message.search(/has no method'/)>=0) {
                    throw new ConvertException('(MULTI) Mapping method \''+f+'\' broke');
                } else { throw e; }
            }
            value = result[0];
            size = result[1];
            lastWasABitField = false;
        // } else if(f && f.length>=2) {
        } else if(f && f.length >= 1) {
            if(f[0]==='Bit') {
                if(lastWasABitField) {
                    offset -= 1; // compensate to stay in same bitfield
                }
                lastWasABitField = true;
            } else {
                lastWasABitField = false;
            }
            var fnName = f[0];

            fn = mappingFns[fnName];
            if (!fn) {
                throw new ConvertException('(MULTI) Mapping method \''+fnName+'\' was not found. (correct capitalization?)' + JSON.stringify(Object.keys(mappingFns)));
            }
            try {
                result = fn(blob, offset, f[1]);
                value = result[0];
            } catch (e) {
                if (e.message.search(/has no method/)>=0) {
                    throw new ConvertException('(MULTI) Mapping method \''+fnName+'\' broke.');
                } else {
                    throw e;
                }
            }

            if(f[2]) { // further processing if wanted
                var furtherFnName = f[2];
                var furtherFn = mappingFns[furtherFnName];
                if (!furtherFn) {
                    throw new ConvertException('Further Mapping method \''+furtherFnName+'\' was not found. (correct capitalization?)');
                }
                try {
                    value = furtherFn(value);
                } catch (e) {
                    throw new ConvertException('Further Mapping method \''+furtherFnName+'\' broke.');
                }
            }

            size = result[1];
        }

        // save value or function result of value in field
        comp[k] = value;
        // if(verbose) log('k: '+k+', val: '+value+', offset: '+offset);
        offset += size;
    }
    return comp;
}

function decode_movement (blob, offset) {
    var comp = {
        'type': 'Movement',
    };
    // the special value 0 is because "old versions of AVS barf" if the id is > 15, so
    // AVS writes out 0 in that case, and sets the actual id at the end of the save block.
    var effectIdOld = getUInt32(blob, offset);
    var effect = [];
    var code;
    if(effectIdOld!==0) {
        if(effectIdOld===32767) {
            var strAndSize = getSizeString(blob, offset+sizeInt+1); // for some reason there is a single byte reading '0x01' before custom code.
            offset += strAndSize[1];
            code = strAndSize[0];
        } else {
            effect = movementEffects[effectIdOld];
        }
    } else {
        var effectIdNew = getUInt32(blob, offset+sizeInt*6); // 1*sizeInt, because of oldId=0, and 5*sizeint because of the other settings.
        effect = movementEffects[effectIdNew];
    }
    if(effect.length) {
        comp['builtinEffect'] = effect[0];
    }
    comp['output'] = getUInt32(blob, offset+sizeInt) ? '50/50' : 'Replace';
    comp['sourceMapped'] = getBool(blob, offset+sizeInt*2, sizeInt)[0];
    comp['coordinates'] = getCoordinates(blob, offset+sizeInt*3, sizeInt);
    comp['bilinear'] = getBool(blob, offset+sizeInt*4, sizeInt)[0];
    comp['wrap'] = getBool(blob, offset+sizeInt*5, sizeInt)[0];
    if(effect.length && effectIdOld!==1 && effectIdOld!==7) { // 'slight fuzzify' and 'blocky partial out' have no script representation.
        code = effect[1];
        comp['coordinates'] = effect[2]; // overwrite
    }
    comp['code'] = code;
    return comp;
}

function decode_avi (blob, offset) {
    var comp = {
        'type': 'AVI',
        'enabled': getBool(blob, offset, sizeInt)[0],
    };
    var strAndSize = getNtString(blob, offset+sizeInt*3);
    comp['file'] = strAndSize[0];
    comp['speed'] = getUInt32(blob, offset+sizeInt*5+strAndSize[1]); // 0: fastest, 1000: slowest
    var beatAdd = getUInt32(blob, offset+sizeInt*3+strAndSize[1]);
    if(beatAdd) {
        comp['output'] = '50/50';
    } else {
        comp['output'] = getMap8(blob, offset+sizeInt, {0: 'Replace', 1: 'Additive', 0x100000000: '50/50'});
    }
    comp['onBeatAdd'] = beatAdd;
    comp['persist'] = getUInt32(blob, offset+sizeInt*4+strAndSize[1]); // 0-32
    return comp;
}

function decode_simple (blob, offset) {
    var comp = {
        'type': 'Simple',
    };
    var effect = getUInt32(blob, offset);
    if (effect&(1<<6)) {
        comp['audioSource'] = (effect&2) ? 'Waveform' : 'Spectrum';
        comp['renderType'] = 'Dots';
    } else {
        switch (effect&3) {
            case 0: // solid analyzer
            comp['audioSource'] = 'Spectrum';
            comp['renderType'] = 'Solid';
            break;
            case 1: // line analyzer
            comp['audioSource'] = 'Spectrum';
            comp['renderType'] = 'Lines';
            break;
            case 2: // line scope
            comp['audioSource'] = 'Waveform';
            comp['renderType'] = 'Lines';
            break;
            case 3: // solid scope
            comp['audioSource'] = 'Waveform';
            comp['renderType'] = 'Solid';
            break;
        }
    }
    comp['audioChannel'] = getAudioChannel((effect>>2)&3);
    comp['positionY'] = getPositionY((effect>>4)&3);
    comp['colors'] = getColorList(blob, offset+sizeInt)[0];
    return comp;
}

/**
 * blank decode function

function decode_ (blob, offset) {
    var comp = {
        'type': '',
    };
    return comp;
}

*/

// decode helpers

// generic mapping functions (in 1, 4, 8 byte flavor and radio button mode (multiple int32)) to map values to one of a set of strings
function getMap1 (blob, offset, map) { return [getMapping(map, blob[offset]), 1]; }
function getMap4 (blob, offset, map) { return [getMapping(map, getUInt32(blob, offset)), sizeInt]; }
function getMap8 (blob, offset, map) { return [getMapping(map, getUInt64(blob, offset)), sizeInt*2]; }
function getRadioButton (blob, offset, map) {
    var key = 0;
    for (var i = 0; i < map.length; i++) {
        var on = getUInt32(blob, offset+sizeInt*i)!==0;
        if(on) { // in case of (erroneous) multiple selections, the last one selected wins
            key = on*(i+1);
        }
    }
    return [getMapping(map, key), sizeInt*map.length];
}
function getMapping (map, key) {
    var value = map[key];
    if (value === undefined) {
        throw new ConvertException('Map: A value for key \''+key+'\' does not exist.');
    } else {
        return value;
    }
}

// Point, Frame, Beat, Init code fields - reorder to I,F,B,P order.
function getCodePFBI (blob, offset) {
    var map = [ // this is the sort map, lines are 'need'-sorted with 'is'-index.
        ['init', 3],
        ['perFrame', 1],
        ['onBeat', 2],
        ['perPoint', 0],
    ];
    return getCodeSection(blob, offset, map);
}

// Frame, Beat, Init code fields - reorder to I,F,B order.
function getCodeFBI (blob, offset) {
    var map = [ // see PFBI
        ['init', 2],
        ['perFrame', 1],
        ['onBeat', 0],
    ];
    return getCodeSection(blob, offset, map);
}

function getCodeIFBP (blob, offset) {
    var map = [ // in this case the mapping is pretty redundant. the fields are already in order.
        ['init', 0],
        ['perFrame', 1],
        ['onBeat', 2],
        ['perPoint', 3],
    ];
    return getCodeSection(blob, offset, map);
}

function getCodeIFB (blob, offset) {
    var map = [ // see IFBP
        ['init', 0],
        ['perFrame', 1],
        ['onBeat', 2],
    ];
    return getCodeSection(blob, offset, map);
}

// used only by 'Global Variables'
function getNtCodeIFB (blob, offset) {
    var map = [
        ['init', 0],
        ['perFrame', 1],
        ['onBeat', 2],
    ];
    return getCodeSection(blob, offset, map, /*nullterminated*/true);
}

// used only by 'Triangle'
function getNtCodeIFBP (blob, offset) {
    var map = [
        ['init', 0],
        ['perFrame', 1],
        ['onBeat', 2],
        ['perPoint', 3],
    ];
    return getCodeSection(blob, offset, map, /*nullterminated*/true);
}

function getCodeSection (blob, offset, map, nt) {
    var strings = new Array(map.length);
    var totalSize = 0;
    var i;
    var p;
    for (i = 0, p = offset; i < map.length; i++, p += strAndSize[1]) {
        var strAndSize = nt ? getNtString(blob, p) : getSizeString(blob, p);
        totalSize += strAndSize[1];
        strings[i] = strAndSize[0];
    }
    var code = {};
    for (i = 0; i < strings.length; i++) {
        code[map[i][0]] = strings[map[i][1]];
    }
    return [code, totalSize];
}

function getColorList (blob, offset) {
    var colors = [];
    var num = getUInt32(blob, offset);
    var size = sizeInt+num*sizeInt;
    while(num>0) {
        offset += sizeInt;
        colors.push(getColor(blob, offset)[0]);
        num--;
    }
    return [colors, size];
}

function getColorMaps (blob, offset) {
    var mapOffset = offset+480;
    var maps = [];
    var headerSize = 60; // 4B enabled, 4B num, 4B id, 48B filestring
    var mi = 0; // map index, might be != i when maps are skipped
    for (var i = 0; i < 8; i++) {
        var enabled = getBool(blob, offset+headerSize*i, sizeInt)[0];
        var num = getUInt32(blob, offset+headerSize*i+sizeInt);
        var map = getColorMap(blob, mapOffset, num);
        // check if it's a disabled default {0: #000000, 255: #ffffff} map, and only save it if not.
        if(!enabled && map.length===2 && map[0].color==='#000000' && map[0].position===0 && map[1].color==='#ffffff' && map[1].position===255) {
            // skip this map
        } else {
            maps[mi] = {
                'index': i,
                'enabled': enabled,
            };
            if(allFields) {
                var id = getUInt32(blob, offset+headerSize*i+sizeInt*2); // id of the map - not really needed.
                var mapFile = getNtString(blob, offset+headerSize*i+sizeInt*3)[0];
                maps[mi]['id'] = id;
                maps[mi]['fileName'] = mapFile;
            }
            maps[mi]['map'] = map;
            mi++;
        }
        mapOffset += num*sizeInt*3;
    }
    return [maps, mapOffset-offset];
}

function getColorMap (blob, offset, num) {
    var colorMap = [];
    for (var i = 0; i < num; i++) {
        var pos = getUInt32(blob, offset);
        var color = getColor(blob, offset+sizeInt)[0];
        offset += sizeInt*3; // there's a 4byte id (presumably) following each color.
        colorMap[i] = {'color': color, 'position': pos};
    }
    return colorMap;
}

function getColor (blob, offset) {
    // Colors in AVS are saved as (A)RGB (where A is always 0).
    // Maybe one should use an alpha channel right away and set
    // that to 0xff? For now, no 4th byte means full alpha.
    var color = getUInt32(blob, offset).toString(16);
    var padding = '';
    for (var i = color.length; i < 6; i++) {
        padding += '0';
    }
    return ['#'+padding+color, sizeInt];
}

function getConvoFilter (blob, offset, dimensions) {
    if(!(dimensions instanceof Array) && dimensions.length!==2) {
        throw new ConvertException('ConvoFilter: Size must be array with x and y dimensions in dwords.');
    }
    var size = dimensions[0]*dimensions[1];
    var data = new Array(size);
    for (var i = 0; i < size; i++, offset+=sizeInt) {
        data[i] = getInt32(blob, offset)[0];
    }
    var matrix = {'width': dimensions[0], 'height': dimensions[1], 'data': data};
    return [matrix, size*sizeInt];
}

// 'Text' needs this
function getSemiColSplit (str) {
    var strings = str.split(';');
    if(strings.length === 1) {
        return strings[0];
    } else {
        return strings;
    }
}

function getBlendmodeIn (blob, offset, size) {
    var code = size===1?blob[offset]:getUInt32(blob, offset);
    return [blendmodesIn[code], size];
}

function getBlendmodeOut (blob, offset, size) {
    var code = size===1?blob[offset]:getUInt32(blob, offset);
    return [blendmodesOut[code], size];
}

function getBlendmodeBuffer (blob, offset, size) {
    var code = size===1?blob[offset]:getUInt32(blob, offset);
    return [blendmodesBuffer[code], size];
}

function getBlendmodeRender (blob, offset, size) {
    var code = size===1?blob[offset]:getUInt32(blob, offset);
    return [blendmodesRender[code], size];
}

function getBlendmodePicture2 (blob, offset, size) {
    var code = size===1?blob[offset]:getUInt32(blob, offset);
    return [blendmodesPicture2[code], size];
}

function getBlendmodeColorMap (blob, offset, size) {
    var code = size===1?blob[offset]:getUInt32(blob, offset);
    return [blendmodesColorMap[code], size];
}

function getBlendmodeTexer (blob, offset, size) {
    var code = size===1?blob[offset]:getUInt32(blob, offset);
    return [blendmodesTexer[code], size];
}

function getKeyColorMap (blob, offset, size) {
    var code = size===1?blob[offset]:getUInt32(blob, offset);
    return [keysColorMap[code], size];
}

function getCycleModeColorMap (blob, offset, size) {
    var code = size===1?blob[offset]:getUInt32(blob, offset);
    return [cycleModesColorMap[code], size];
}

// Buffer modes
function getBufferMode (blob, offset, size) {
    var code = size===1?blob[offset]:getUInt32(blob, offset);
    return [buffermodes[code], size];
}

function getBufferNum (blob, offset, size) {
    var code = size===1 ? blob[offset] : getUInt32(blob, offset);
    if(code===0) return ['Current', size];
    else return [getUInt32(blob, offset), size];
}

function getCoordinates (blob, offset, size) {
    var code = size===1 ? blob[offset] : getUInt32(blob, offset);
    return [coordinates[code], size];
}

function getDrawMode (blob, offset, size) {
    var code = size===1 ? blob[offset] : getUInt32(blob, offset);
    return [drawModes[code], size];
}

function getAudioChannel (code) {
    return audioChannels[code];
}

function getAudioSource (code) {
    return audioSources[code];
}

function getPositionX (code) {
    return positionsX[code];
}

function getPositionY (code) {
    return positionsY[code];
}

function getMultiFilterEffect (code) {
    return multiFilterEffect[code];
}

const decodeFns = {
    'simple': decode_simple,
    'avi': decode_avi,
    'movement': decode_movement,
    'generic': decode_generic,
    'effectList': decode_effectList
};

const mappingFns = {
    'Map1': getMap1,
    'Map4': getMap4,
    'Map8': getMap8,
    'RadioButton': getRadioButton,
    'Mapping': getMapping,
    'CodePFBI': getCodePFBI,
    'CodeFBI': getCodeFBI,
    'CodeIFBP': getCodeIFBP,
    'CodeIFB': getCodeIFB,
    'NtCodeIFB': getNtCodeIFB,
    'NtCodeIFBP': getNtCodeIFBP,
    'CodeSection': getCodeSection,
    'Color': getColor,
    'ColorList': getColorList,
    'ColorMaps': getColorMaps,
    'ColorMap': getColorMap,
    'ConvoFilter': getConvoFilter,
    'SemiColSplit': getSemiColSplit,
    'BlendmodeIn': getBlendmodeIn,
    'BlendmodeBuffer': getBlendmodeBuffer,
    'BlendmodeRender': getBlendmodeRender,
    'BlendmodePicture2': getBlendmodePicture2,
    'BlendmodeColorMap': getBlendmodeColorMap,
    'BlendmodeTexer': getBlendmodeTexer,
    'KeyColorMap': getKeyColorMap,
    'CycleModeColorMap': getCycleModeColorMap,
    'BufferMode': getBufferMode,
    'BufferNum': getBufferNum,
    'Coordinates': getCoordinates,
    'DrawMode': getDrawMode,
    'AudioChannel': getAudioChannel,
    'AudioSource': getAudioSource,
    'PositionX': getPositionX,
    'PositionY': getPositionY,
    'MultiFilterEffect': getMultiFilterEffect,
    'Bit': _util.getBit,
    'Bool': _util.getBool,
    'Boolified': _util.getBoolified,
    'Float32': _util.getFloat32,
    'Int32': _util.getInt32,
    'UInt32': _util.getUInt32,
    'UInt64': _util.getUInt64,
    'SizeString': _util.getSizeString,
    'NtString': _util.getNtString
};

module.exports = {
    convertPreset
};

