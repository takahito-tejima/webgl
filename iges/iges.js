/*
  iges.js
  Copyright (C) 2011 Takahito TEJIMA
  tejima@da2.so-net.ne.jp
*/

function parseIgesString(str)
{
    // iges string (fortran) form: <length>H<str>
    var d = str.indexOf('H');
    if(d == -1) return null;
    var digit = str.substr(0, d);
    var value = str.substr(d+1, digit);
    return value;
}

function parseIges(source)
{
    function IGES(){
	this.fieldDelimiter = ','; // as default
	this.termDelimiter = ';';  // as default 
	this.entities = new Array();
	return this;
    }
    function Directory(){
	return this;
    }
    var iges = new IGES();
    var lines = source.split('\n');
    var currentSection = '';
    for(var i = 0; i < lines.length; i++){
	var line = lines[i];
	var section = line[72];
	if (section == currentSection){
	    data += line.substr(0, 72);
	    continue;
	}
	if(currentSection == 'S'){
	    // Start Section
	    iges.comment = data;
	}else if(currentSection == 'G'){
	    // Global Section
	    // determine field delimiter
	    if(data[0] != ','){
		iges.fieldDelimiter = parseIgesString(data);
	    }
	    var fields = data.split(iges.fieldDelimiter);
	    if(data[0] != ',') { fields.splice(0, 1); }
	    // determine terminater
	    iges.termDelimiter = parseIgesString(fields[1]);

	    iges.exportID = parseIgesString(fields[2]);
	    iges.fileName = parseIgesString(fields[3]);
	    iges.systemID = parseIgesString(fields[4]);
	    iges.translateVer = parseIgesString(fields[5]);
	    iges.integerBits = fields[6];
	    iges.singleExpBits = fields[7];
	    iges.singleMantissaBits = fields[8];
	    iges.doubleExpBits = fields[9];
	    iges.doubleMantissaBits = fields[10];
	    iges.receiveID = parseIgesString(fields[11]);
	    iges.scale = fields[12];
	    iges.unitFlag = fields[13];
	    iges.unit = parseIgesString(fields[14]);
	    iges.maxStep = fields[15];
	    iges.maxWidth = fields[16];
	    iges.createDate = parseIgesString(fields[17]);
	    iges.resolution = fields[18];
	    iges.maxValue = fields[19];
	    iges.createUser = parseIgesString(fields[20]);
	    iges.createOrg = parseIgesString(fields[21]);
	    iges.igesVer = fields[22];
	    iges.formatCode = fields[23];
	    iges.lastModifiedDate = parseIgesString(fields[24]);

//	    console.log("Filename = ", iges.fileName);
//	    console.log("Scale = ", iges.scale);
//	    console.log("User = ", iges.createUser);
//	    console.log("Last Modified = ", iges.lastModifiedDate);
	}else if(currentSection == 'D'){
	    // Directory Entry Section
	    for(var j = 0; j < data.length; j += 144){
		var record = data.substr(j, 144);
		var directory = new Directory();
		directory.elementIndex = parseInt(record.substr(0, 8));
		directory.index = parseInt(record.substr(8, 8));
		directory.igesVersion = parseInt(record.substr(16, 8));
		directory.lineType = parseInt(record.substr(24, 8));
		directory.level = parseInt(record.substr(32, 8));
		directory.projection = parseInt(record.substr(40, 8));
		directory.matrix = parseInt(record.substr(48, 8));
		directory.bind = parseInt(record.substr(56, 8));
		directory.status = record.substr(64, 8);
		directory.elementIndex2 = parseInt(record.substr(72, 8));
		directory.lineWidth = parseInt(record.substr(80, 8));
		directory.pen = parseInt(record.substr(88, 8));
		directory.card = parseInt(record.substr(96, 8));
		directory.format = parseInt(record.substr(104, 8));
		directory.label = record.substr(128, 8);
		directory.subscript = parseInt(record.substr(136, 8));
            }
	}else if(currentSection == 'P'){
	    var recordList = new Array();
	    for(var j = 0; j < data.length; j += 72){
		var record = data.substr(j, 64).replace(/[; ]*$/, "");
		var index = Math.floor(parseInt(data.substr(j+64, 8))/2);
		if(recordList[index] == undefined) recordList[index] = '';
		recordList[index] += record;
	    }
	    for(var j = 0; j < recordList.length; j++){
		var fields = recordList[j].split(iges.fieldDelimiter);

		switch(fields[0]){
		case "100": // Arc
		    iges.entities[j] = parseArc(fields);
		    break;
		case "110":
		    iges.entities[j] = parseLine(fields);
		    break;
		case "124": // Transformation matrix
		    iges.entities[j] = parseTransMatrix(fields);
		    break;
		case "126": // Rational B Spline Curve
		    iges.entities[j] = parseBSpline(fields);
		    console.log(iges.entities[j]);
		    break;
		case "128": // Rational B Spline Surface
		    iges.entities[j] = parseBSplineSurface(fields);
		    console.log(iges.entities[j]);
		    break;
		case "141": // Boundary
		    break;
		case "143":  // Boundary Surface
		    break;
		default:
		    console.log("ERROR: unknown entity ", fields[0]);
		    break;
		}
//		console.log(iges.entities[j]);
	    }
	}
        data = line.substr(0, 72);
        currentSection = section;
    }
    return iges;
}

function igesParseFloat(p)
{
    return parseFloat(p.replace(/D/g, "e"));
}

function parseTransMatrix(param)
{
    var tmat = new function(){};
    var ptr = 0;
    tmat.r11 = igesParseFloat(param[ptr++]);
    tmat.r12 = igesParseFloat(param[ptr++]);
    tmat.r13 = igesParseFloat(param[ptr++]);
    tmat.tx = igesParseFloat(param[ptr++]);
    tmat.r21 = igesParseFloat(param[ptr++]);
    tmat.r22 = igesParseFloat(param[ptr++]);
    tmat.r23 = igesParseFloat(param[ptr++]);
    tmat.ty = igesParseFloat(param[ptr++]);
    tmat.r31 = igesParseFloat(param[ptr++]);
    tmat.r32 = igesParseFloat(param[ptr++]);
    tmat.r33 = igesParseFloat(param[ptr++]);
    tmat.tz = igesParseFloat(param[ptr++]);
//    console.log(tmat.tx, tmat.ty, tmat.tz);
}

var Bound = function(xmin, xmax, ymin, ymax)
{
    if(xmin == undefined) xmin = 100000;
    if(xmax == undefined) xmax = -100000;
    if(ymin == undefined) ymin = 100000;
    if(ymax == undefined) ymax = -100000;

    this.xmin = xmin;
    this.xmax = xmax;
    this.ymin = ymin;
    this.ymax = ymax;
    
    this.extendPoint = function(x, y, z){
	if(x < this.xmin) this.xmin = x;
	if(x > this.xmax) this.xmax = x;
	if(y < this.ymin) this.ymin = y;
	if(y > this.ymax) this.ymax = y;
    }
    this.extendBound = function (b){
	if(b == undefined) return;
	if(b.xmin < this.xmin) this.xmin = b.xmin;
	if(b.ymin < this.ymin) this.ymin = b.ymin;
	if(b.xmax > this.xmax) this.xmax = b.xmax;
	if(b.ymax > this.ymax) this.ymax = b.ymax;
    }

    this.recalc = function(){
	this.xcenter = (this.xmin+this.xmax)*0.5;
	this.ycenter = (this.ymin+this.ymax)*0.5;
	this.width = this.xmax - this.xmin;
	this.height = this.ymax - this.ymin;
    }
}

var Entity = function()
{
    this.calcBound = function()
    {
	var bound = new Bound();
	if(this.foreachCV){
	    this.foreachCV(function(x, y, z){
		bound.extendPoint(x, y, z);
	    });
	    this.bound = bound;
	}
    }
}

function parseArc(param)
{
    var arc = new Entity();
    var ptr = 0;
    arc.entityType = parseInt(param[ptr++]);
    arc.z = igesParseFloat(param[ptr++]);
    arc.cx = igesParseFloat(param[ptr++]);
    arc.cy = igesParseFloat(param[ptr++]);
    arc.sx = igesParseFloat(param[ptr++]);
    arc.sy = igesParseFloat(param[ptr++]);
    arc.ex = igesParseFloat(param[ptr++]);
    arc.ey = igesParseFloat(param[ptr++]);

    return arc;
}

function parseLine(param)
{
    var line = new Entity();
    var ptr = 0;
    line.entityType = parseInt(param[ptr++]);
    var x = igesParseFloat(param[ptr++]);
    var y = igesParseFloat(param[ptr++]);
    var z  = igesParseFloat(param[ptr++]);
    line.p0 = vec3.create([x, y, z]);
    x = igesParseFloat(param[ptr++]);
    y = igesParseFloat(param[ptr++]);
    z = igesParseFloat(param[ptr++]);
    line.p1 = vec3.create([x, y, z]);

    return line;
}

function parseBSpline(param)
{
    var spline = new Entity();
    spline.foreachCV = function(f)
    {
	for(var i = 0; i < this.cv.length; i++){
	    f(this.cv[i][0], this.cv[i][1], this.cv[i][2]);
	}
    }

    var ptr = 0;
    spline.entityType = parseInt(param[ptr++]);
    spline.upperIndex = parseInt(param[ptr++]);
    spline.degree = parseInt(param[ptr++]);
    spline.planar = parseInt(param[ptr++]);
    spline.closed = parseInt(param[ptr++]);
    spline.polynomial = parseInt(param[ptr++]);
    spline.periodic = parseInt(param[ptr++]);

    var n = 1 + spline.upperIndex - spline.degree;
    var a = n + 2 * spline.degree;
    spline.knots = new Array();
    for(var i = 0; i <= a; i++){
	spline.knots[i] = igesParseFloat(param[ptr++]);
    }
    spline.weights = new Array();
    for(var i = 0; i <= spline.upperIndex; i++){
	spline.weights[i] = igesParseFloat(param[ptr++]);
    }
    spline.cv = new Array();
    for(var i = 0; i <= spline.upperIndex; i++){
	var x = igesParseFloat(param[ptr++]);
	var y = igesParseFloat(param[ptr++]);
	var z = igesParseFloat(param[ptr++]);
	spline.cv[i] = new Array(x, y, z);
    }
    spline.start = igesParseFloat(param[ptr++]);
    spline.end = igesParseFloat(param[ptr++]);
    
    param[ptr++];
    param[ptr++];
    param[ptr++];

    return spline;
}

function parseBSplineSurface(param)
{
    var surface = new Entity();
    surface.foreachCV = function(f)
    {
	for(var u = 0; u <= surface.numU; u++){
	    for(var v = 0; v <= surface.numV; v++){
		f(surface.cv[v][u][0], surface.cv[v][u][1], surface.cv[v][u][2]);
	    }
	}
    }
    var ptr = 0;
    surface.entityType = parseInt(param[ptr++]);
    surface.numU = parseInt(param[ptr++]);
    surface.numV = parseInt(param[ptr++]);
    surface.degreeU = parseInt(param[ptr++]);
    surface.degreeV = parseInt(param[ptr++]);
    surface.closedU = parseInt(param[ptr++]);
    surface.closedV = parseInt(param[ptr++]);
    surface.polynomial = parseInt(param[ptr++]);
    surface.periodicU = parseInt(param[ptr++]);
    surface.periodicV = parseInt(param[ptr++]);

    var n1 = 1 + surface.numU - surface.degreeU;
    var n2 = 1 + surface.numV - surface.degreeV;
    var a = n1 + 2 * surface.degreeU;
    var b = n2 + 2 * surface.degreeV;
    var c = (1 + surface.numU) * (1 + surface.numV);

    surface.knots = new Array();
    surface.knots[0] = new Array();
    surface.knots[1] = new Array();
    for(var i = 0; i <= a; i++) surface.knots[0][i] = igesParseFloat(param[ptr++]);
    for(var i = 0; i <= b; i++) surface.knots[1][i] = igesParseFloat(param[ptr++]);

    surface.weights = new Array();
    for(var i = 0; i < c; i++) surface.weights[i] = igesParseFloat(param[ptr++]);

    surface.cv = new Array();
    for(var i = 0; i <= surface.numV; i++)
    {
	surface.cv[i] = new Array();
	for(var j = 0; j <= surface.numU; j++){
	    var x = igesParseFloat(param[ptr++]);
	    var y = igesParseFloat(param[ptr++]);
	    var z = igesParseFloat(param[ptr++]);
	    surface.cv[i][j] = new Array(x, y, z);
	}
    }
    return surface;
}