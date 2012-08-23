var vTexture = null;
var nTexture = null;
var mTexture = null;
var rx = 90;
var ry = 0;
var dolly = 3;
var fov = 60;
var maxlevel = 1;
var time = 0;
var model = null;
var deform = false;
var drawWire = true;
var drawHull = true;
var uvMapping = false;
var prevTime = 0;
var fps = 0;
var uvimage = new Image();
var uvtex = null;
var program = null;
var interval = null;
var uvInvalid = true;
var geomInvalid = true;
var framebuffer = null;

function windowEvent(){
    if (window.event) 
	return window.event;
    var caller = arguments.callee.caller;
    while (caller) {
	var ob = caller.arguments[0];
	if (ob && ob.constructor == MouseEvent) 
	    return ob;
	caller = caller.caller;
    }
    return null;
}

function getMousePosition(){
    var event = windowEvent();
    var canvas = $("#main").get(0);
    canvasOffsetX = canvas.offsetLeft;
    canvasOffsetY = canvas.offsetTop;
    var x = event.pageX - canvasOffsetX;
    var y = event.pageY - canvasOffsetY;
    return vec3.create([x, y, 0]);
}

function buildProgram(vertexShader, fragmentShader)
{
    var define = "";
    if (uvMapping) define += "#define USE_UV_MAP\n";
    var util = $('#shaderutil').text();

    var program = gl.createProgram();
    var vshader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vshader, define+util+$(vertexShader).text());
    gl.compileShader(vshader);
    if (!gl.getShaderParameter(vshader, gl.COMPILE_STATUS)) 
		alert(gl.getShaderInfoLog(vshader));
    var fshader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fshader, define+$(fragmentShader).text());
    gl.compileShader(fshader);
    if (!gl.getShaderParameter(fshader, gl.COMPILE_STATUS)) 
		alert(gl.getShaderInfoLog(fshader));
    gl.attachShader(program, vshader);
    gl.attachShader(program, fshader);
    gl.bindAttribLocation(program, 0, "vertexID");
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) 
	alert(gl.getProgramInfoLog(program));
    return program;
}

function createTextureBuffer2(data, format, reso)
{
    if(format == gl.LUMINANCE) {
	data.length = reso*reso;
    }else if(format == gl.LUMINANCE_ALPHA)
	data.length = reso*reso*2;
    else if(format == gl.RGB)
	data.length = reso*reso*3;
    else if(format == gl.RGBA)
	data.length = reso*reso*4;

    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.texImage2D(gl.TEXTURE_2D, 0, format, reso, reso,
		  0, format, gl.FLOAT, data);

    return texture;
}

function createTextureBuffer(data, format)
{
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    if (data.length > reso*reso) {
	console.log("Data too large ", data.length);
    }
    
    var d = new Array();
    for(var j=0; j<data.length; j++){
	d.push(data[j]);
    }
    if(format == gl.LUMINANCE) 
	d.length = reso*reso;
    else if(format == gl.LUMINANCE_ALPHA)
	d.length = reso*reso*2;
    else if(format == gl.RGB)
	d.length = reso*reso*3;
    else if(format == gl.RGBA)
	d.length = reso*reso*4;
    gl.texImage2D(gl.TEXTURE_2D, 0, format, reso, reso,
		  0, format, gl.FLOAT, new Float32Array(d));
    return texture;
}

function dumpFrameBuffer()
{
    var buffer = new ArrayBuffer(reso*reso*4);
    var pixels = new Uint8Array(buffer);
    gl.readPixels(0, 0, reso, reso, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    console.log(pixels);
}

function initialize(){

    var reso = 512;
    // create vertex array
    var vertexIDs = new Array();
    for(i = 0; i <reso*reso; i++){
	vertexIDs.push(i);
    }
    numVertex = vertexIDs.length;
    vbuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexIDs), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    buildMainProgram();

    progFace = buildProgram('#faceKernel', '#kfshader');
    progEdge = buildProgram('#edgeKernel', '#kfshader');
    progVertexA = buildProgram('#vertexKernelA', '#kfshader');
    progVertexB = buildProgram('#vertexKernelB', '#kfshader');

}

function buildMainProgram()
{
    if (program == null)
	gl.deleteProgram(program);
    program = buildProgram('#vshader', '#fshader');
    program.mvpMatrix = gl.getUniformLocation(program, "mvpMatrix");
    program.modelViewMatrix = gl.getUniformLocation(program, "modelViewMatrix");
    program.projMatrix = gl.getUniformLocation(program, "projMatrix");
}


function createVertexTexture(reso)
{
    var texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    var data = new Array();
    data.length = reso*reso*3;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, reso, reso,
		  0, gl.RGB, gl.FLOAT, new Float32Array(data));

    return texture;
}

function deleteModel(data) {
    if(data == null) return;

    for(var i=0; i<data.maxLevel; i++){
	gl.deleteBuffer(data.level[i].ibLines);
	gl.deleteBuffer(data.level[i].ibTriangles);
    }
    gl.deleteBuffer(data.ibHulls);
    gl.deleteTexture(data.texF_IT);
    gl.deleteTexture(data.texF_ITa);
    gl.deleteTexture(data.texE_IT);
    gl.deleteTexture(data.texV_IT);
    gl.deleteTexture(data.texV_ITa1);
    gl.deleteTexture(data.texV_ITa2);
    gl.deleteTexture(data.texE_W);
    gl.deleteTexture(data.texV_W);
}

function getLevelBuffer(header, data, i) {
    var size = header[3+i*14];
    var offset = header[3+i*14+1];
    var resolution = header[3+i*14+2];
    var lb = {};
    lb.buffer = new Float32Array(data.slice(offset, offset+size));
    lb.offset = [];
    lb.resolution = resolution;

    for(j = 0; j < 10; j++){
	lb.offset.push(header[3+i*14+4+j]);
    }
    return lb;
}

function getLevel(header, pos, data) {
    var level = {}
    level.firstOffset = header[pos+0];
    level.numFaceVerts = header[pos+1];
    level.numEdgeVerts = header[pos+2];
    level.numVertexVerts = header[pos+3];
    level.startVB = header[pos+4];
    level.endVB = header[pos+5];
    level.startVA1 = header[pos+6];
    level.endVA1 = header[pos+7];
    level.startVA2 = header[pos+8];
    level.endVA2 = header[pos+9];
    level.triangles = new Float32Array(data.slice(header[pos+11], header[pos+10] + header[pos+11]));
    level.lines = new Float32Array(data.slice(header[pos+13], header[pos+12] + header[pos+13]));
    return level;
}

function setModelBin(data) {
    if (data == null) return;
    deleteModel(model);
    model = {};
    
    header = new Uint32Array(data);
    model.nLevels = header[2];
    model.F_IT = getLevelBuffer(header, data, 0);
    model.F_ITa = getLevelBuffer(header, data, 1);
    model.E_IT = getLevelBuffer(header, data, 2);
    model.V_IT = getLevelBuffer(header, data, 3);
    model.V_ITa1 = getLevelBuffer(header, data, 4);
    model.V_ITa2 = getLevelBuffer(header, data, 5);
    model.E_W = getLevelBuffer(header, data, 6);
    model.V_W = getLevelBuffer(header, data, 7);

    var ofs = 3+14*8;
    model.cageVerts   = new Float32Array(data.slice(header[ofs+1], header[ofs  ]+header[ofs+1]));
    model.cageNormals = new Float32Array(data.slice(header[ofs+3], header[ofs+2]+header[ofs+3]));
    model.cageIndices = new Float32Array(data.slice(header[ofs+5], header[ofs+4]+header[ofs+5]));
    model.resolution = header[ofs+6];

    model.levels = [];
    for(i=0; i<model.nLevels; i++){
	var level = getLevel(header, ofs+14+14*i, data);

	var ibuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, ibuffer);
	gl.bufferData(gl.ARRAY_BUFFER, level.lines, gl.STATIC_DRAW);
	level.ibLines = ibuffer;
	level.nLines = level.lines.length;

	ibuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, ibuffer);
	gl.bufferData(gl.ARRAY_BUFFER, level.triangles, gl.STATIC_DRAW);
	level.ibTriangles = ibuffer;
	level.nTriangles = level.triangles.length;
    
	model.levels.push(level);
    }
    var ibuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ibuffer);
    gl.bufferData(gl.ARRAY_BUFFER, model.cageIndices, gl.STATIC_DRAW);
    model.ibHulls = ibuffer;
    model.nHulls = model.cageIndices.length;

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    model.texF_IT  = createTextureBuffer2(model.F_IT.buffer, gl.LUMINANCE, model.F_IT.resolution);
    model.texF_ITa = createTextureBuffer2(model.F_ITa.buffer, gl.LUMINANCE_ALPHA, model.F_ITa.resolution);
    model.texE_IT  = createTextureBuffer2(model.E_IT.buffer, gl.RGBA, model.E_IT.resolution);
    model.texV_IT  = createTextureBuffer2(model.V_IT.buffer, gl.LUMINANCE, model.V_IT.resolution);
    model.texV_ITa1 = createTextureBuffer2(model.V_ITa1.buffer, gl.RGB, model.V_ITa1.resolution);
    model.texV_ITa2 = createTextureBuffer2(model.V_ITa2.buffer, gl.LUMINANCE_ALPHA, model.V_ITa2.resolution);
    model.texE_W   = createTextureBuffer2(model.E_W.buffer, gl.LUMINANCE_ALPHA, model.E_W.resolution);
    model.texV_W   = createTextureBuffer2(model.V_W.buffer, gl.LUMINANCE, model.V_W.resolution);

    // framebuffer texture
    if (framebuffer) gl.deleteFramebuffer(framebuffer);
    framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    framebuffer.width = model.resolution;
    framebuffer.height = model.resolution;

    if (vTexture) gl.deleteTexture(vTexture);
    if (nTexture) gl.deleteTexture(nTexture);
    if (mTexture) gl.deleteTexture(mTexture);
    vTexture = null;
    nTexture = null;
    mTexture = null;


    uvInvalid = true;
    geomInvalid = true;

}


function updateGeom() {

    time += 0.03;
    // create vertex texture
    if (vTexture == null) {
	vTexture = createVertexTexture(model.resolution);
	nTexture = createVertexTexture(model.resolution);
	mTexture = createVertexTexture(model.resolution);
	console.log("Created ", model.resolution);
    }
    var position = [];
    var uv = [];
    var reso = model.resolution;
    var reso_y = Math.ceil(model.cageVerts.length/3/reso + 1);
//    reso_y = reso;
    position.length = reso*reso_y*3;
    uv.length = reso*reso_y*3;
    var a = Math.sin(time);
    for(var i=0; i<model.cageVerts.length; i+=3) {
	var p = [model.cageVerts[i+0], model.cageVerts[i+1], model.cageVerts[i+2]];
	if (deform) {
	    var v = p[1] * a;
	    position[i+0] = Math.cos(v)*p[0] + Math.sin(v)*p[2];
	    position[i+1] = p[1];
	    position[i+2] = -Math.sin(v)*p[0] + Math.cos(v)*p[2];
	} else {
	    position[i+0] = p[0];
	    position[i+1] = p[1];
	    position[i+2] = p[2];
	}
	uv[i+0] = p[0];
	uv[i+1] = p[1];
    }

    // XX: normals are not deforming...
    var normal = [];
    normal.length = reso*reso_y*3;
    for(var i=0; i<model.cageNormals.length; i+=3) {
	var n = [model.cageNormals[i+0], model.cageNormals[i+1], model.cageNormals[i+2]];
	normal[i+0] = n[0];
	normal[i+1] = n[1];
	normal[i+2] = n[2];
    }
    
    gl.bindTexture(gl.TEXTURE_2D, vTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, reso, reso_y,
		     gl.RGB, gl.FLOAT, new Float32Array(position));

    gl.bindTexture(gl.TEXTURE_2D, nTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, reso, reso_y,
		     gl.RGB, gl.FLOAT, new Float32Array(normal));

    if (uvInvalid) {
	gl.bindTexture(gl.TEXTURE_2D, mTexture);
	gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, reso, reso_y,
			 gl.RGB, gl.FLOAT, new Float32Array(uv));
    }
}
function syncbuffer()
{
//    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, vTexture, 0);
    gl.flush();
//    dumpFrameBuffer();
}

function subdivide(targetTexture) {
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, targetTexture, 0);

    var reso = model.resolution;
    gl.viewport(0, 0, reso, reso);
    gl.disable(gl.DEPTH_TEST);

    if(model.levels == undefined) return;

    gl.enableVertexAttribArray(0);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuffer);
    gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targetTexture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, model.texF_IT);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, model.texF_ITa);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, model.texE_IT);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, model.texE_W);
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, model.texV_ITa1);
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, model.texV_ITa2);
    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, model.texV_IT);
    gl.activeTexture(gl.TEXTURE8);
    gl.bindTexture(gl.TEXTURE_2D, model.texV_W);

    for(var i = 0; i < maxlevel; i++){
	var level = model.levels[i];
	var offset = level.firstOffset;
	var nvb = level.endVB - level.startVB;
	var nva1 = level.endVA1 - level.startVA1;
	var nva2 = level.endVA2 - level.startVA2;

	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, targetTexture, 0);

	gl.useProgram(progFace);
	gl.uniform1f(gl.getUniformLocation(progFace, "dim"), 1.0/reso);
	gl.uniform1f(gl.getUniformLocation(progFace, "offset"), offset);

	gl.uniform1i(gl.getUniformLocation(progFace, "texPosition"), 0);
	gl.uniform1i(gl.getUniformLocation(progFace, "F_IT"), 1);
	gl.uniform1i(gl.getUniformLocation(progFace, "F_ITa"), 2);
	gl.uniform1f(gl.getUniformLocation(progFace, "F_IT_ofs"), model.F_IT.offset[i]);
	gl.uniform1f(gl.getUniformLocation(progFace, "F_ITa_ofs"), model.F_ITa.offset[i]/2);
	gl.uniform1f(gl.getUniformLocation(progFace, "F_IT_dim"), 1.0/model.F_IT.resolution);
	gl.uniform1f(gl.getUniformLocation(progFace, "F_ITa_dim"), 1.0/model.F_ITa.resolution);

	gl.drawArrays(gl.POINTS, 0, level.numFaceVerts);
	syncbuffer();
	offset += level.numFaceVerts;

	// -------
	gl.useProgram(progEdge);
	gl.uniform1f(gl.getUniformLocation(progEdge, "dim"), 1.0/reso);
	gl.uniform1f(gl.getUniformLocation(progEdge, "offset"), offset);

	gl.uniform1i(gl.getUniformLocation(progEdge, "texPosition"), 0);
	gl.uniform1i(gl.getUniformLocation(progEdge, "E_IT"), 3);
	gl.uniform1i(gl.getUniformLocation(progEdge, "E_W"), 4);
	gl.uniform1f(gl.getUniformLocation(progEdge, "E_IT_ofs"), model.E_IT.offset[i]/4);
	gl.uniform1f(gl.getUniformLocation(progEdge, "E_W_ofs"), model.E_W.offset[i]/2);
	gl.uniform1f(gl.getUniformLocation(progEdge, "E_IT_dim"), 1.0/model.E_IT.resolution);
	gl.uniform1f(gl.getUniformLocation(progEdge, "E_W_dim"), 1.0/model.E_W.resolution);
	
	gl.drawArrays(gl.POINTS, 0, level.numEdgeVerts);
	syncbuffer();
	offset += level.numEdgeVerts;;
	
	// -------
	if(nvb > 0) {
	    gl.useProgram(progVertexB);
	    gl.uniform1f(gl.getUniformLocation(progVertexB, "dim"), 1.0/reso);
	    gl.uniform1f(gl.getUniformLocation(progVertexB, "offset"), offset);
	    gl.uniform1f(gl.getUniformLocation(progVertexB, "start"), level.startVB);

	    gl.uniform1i(gl.getUniformLocation(progVertexB, "texPosition"), 0);
	    gl.uniform1i(gl.getUniformLocation(progVertexB, "V_ITa1"), 5);
	    gl.uniform1i(gl.getUniformLocation(progVertexB, "V_ITa2"), 6);
	    gl.uniform1i(gl.getUniformLocation(progVertexB, "V_IT"), 7);
	    gl.uniform1i(gl.getUniformLocation(progVertexB, "V_W"), 8);
	    gl.uniform1f(gl.getUniformLocation(progVertexB, "V_ITa1_ofs"), model.V_ITa1.offset[i]/3);
	    gl.uniform1f(gl.getUniformLocation(progVertexB, "V_ITa2_ofs"), model.V_ITa2.offset[i]/2);
	    gl.uniform1f(gl.getUniformLocation(progVertexB, "V_IT_ofs"), model.V_IT.offset[i]);
	    gl.uniform1f(gl.getUniformLocation(progVertexB, "V_W_ofs"), model.V_W.offset[i]);
	    gl.uniform1f(gl.getUniformLocation(progVertexB, "V_IT_dim"), 1.0/model.V_IT.resolution);
	    gl.uniform1f(gl.getUniformLocation(progVertexB, "V_ITa1_dim"), 1.0/model.V_ITa1.resolution);
	    gl.uniform1f(gl.getUniformLocation(progVertexB, "V_ITa2_dim"), 1.0/model.V_ITa2.resolution);
	    gl.uniform1f(gl.getUniformLocation(progVertexB, "V_W_dim"), 1.0/model.V_W.resolution);
	    
	    gl.drawArrays(gl.POINTS, 0, nvb);
	    syncbuffer();
	}
    // -------
	if (nva1 > 0){
	    gl.useProgram(progVertexA);
	    gl.uniform1f(gl.getUniformLocation(progVertexA, "dim"), 1.0/reso);
	    gl.uniform1f(gl.getUniformLocation(progVertexA, "offset"), offset);
	    gl.uniform1f(gl.getUniformLocation(progVertexA, "start"), level.startVA1);
	    gl.uniform1i(gl.getUniformLocation(progVertexA, "pass"), 1);

	    gl.uniform1i(gl.getUniformLocation(progVertexA, "texPosition"), 0);
	    gl.uniform1i(gl.getUniformLocation(progVertexA, "V_ITa1"), 5);
	    gl.uniform1i(gl.getUniformLocation(progVertexA, "V_ITa2"), 6);
	    gl.uniform1i(gl.getUniformLocation(progVertexA, "V_IT"), 7);
	    gl.uniform1i(gl.getUniformLocation(progVertexA, "V_W"), 8);
	    gl.uniform1f(gl.getUniformLocation(progVertexA, "V_ITa1_ofs"), model.V_ITa1.offset[i]/3);
	    gl.uniform1f(gl.getUniformLocation(progVertexA, "V_ITa2_ofs"), model.V_ITa2.offset[i]/2);
	    gl.uniform1f(gl.getUniformLocation(progVertexA, "V_IT_ofs"), model.V_IT.offset[i]);
	    gl.uniform1f(gl.getUniformLocation(progVertexA, "V_W_ofs"), model.V_W.offset[i]);
	    gl.uniform1f(gl.getUniformLocation(progVertexA, "V_IT_dim"), 1.0/model.V_IT.resolution);
	    gl.uniform1f(gl.getUniformLocation(progVertexA, "V_ITa1_dim"), 1.0/model.V_ITa1.resolution);
	    gl.uniform1f(gl.getUniformLocation(progVertexA, "V_ITa2_dim"), 1.0/model.V_ITa2.resolution);
	    gl.uniform1f(gl.getUniformLocation(progVertexA, "V_W_dim"), 1.0/model.V_W.resolution);

	    gl.drawArrays(gl.POINTS, 0, nva1);
	    syncbuffer();
	}
	
	if (nva2 > 0){
	    gl.useProgram(progVertexA);
	    gl.uniform1f(gl.getUniformLocation(progVertexA, "dim"), 1.0/reso);
	    gl.uniform1f(gl.getUniformLocation(progVertexA, "offset"), offset);
	    gl.uniform1f(gl.getUniformLocation(progVertexA, "start"), level.startVA2);
	    gl.uniform1i(gl.getUniformLocation(progVertexA, "pass"), 0);

	    gl.uniform1i(gl.getUniformLocation(progVertexA, "texPosition"), 0);
	    gl.uniform1i(gl.getUniformLocation(progVertexA, "V_ITa1"), 5);
	    gl.uniform1i(gl.getUniformLocation(progVertexA, "V_ITa2"), 6);
	    gl.uniform1i(gl.getUniformLocation(progVertexA, "V_IT"), 7);
	    gl.uniform1i(gl.getUniformLocation(progVertexA, "V_W"), 8);
	    gl.uniform1f(gl.getUniformLocation(progVertexA, "V_ITa1_ofs"), model.V_ITa1.offset[i]/3);
	    gl.uniform1f(gl.getUniformLocation(progVertexA, "V_ITa2_ofs"), model.V_ITa2.offset[i]/2);
	    gl.uniform1f(gl.getUniformLocation(progVertexA, "V_IT_ofs"), model.V_IT.offset[i]);
	    gl.uniform1f(gl.getUniformLocation(progVertexA, "V_W_ofs"), model.V_W.offset[i]);
	    gl.uniform1f(gl.getUniformLocation(progVertexA, "V_IT_dim"), 1.0/model.V_IT.resolution);
	    gl.uniform1f(gl.getUniformLocation(progVertexA, "V_ITa1_dim"), 1.0/model.V_ITa1.resolution);
	    gl.uniform1f(gl.getUniformLocation(progVertexA, "V_ITa2_dim"), 1.0/model.V_ITa2.resolution);
	    gl.uniform1f(gl.getUniformLocation(progVertexA, "V_W_dim"), 1.0/model.V_W.resolution);

	    gl.drawArrays(gl.POINTS, 0, nva2);
	    syncbuffer();
	}
    }
}
function idle() {

    if(model == null) return;
    if(maxlevel > model.nLevels) {
	maxlevel = model.nLevels;
    }
    if(deform) {
	geomInvalid = true;
    }
    redraw();
}


function redraw() {

    if(model == null) return;

    if (geomInvalid) {
	updateGeom();
	subdivide(vTexture);
	subdivide(nTexture);
	geomInvalid = false;
    }
    if (uvMapping && uvInvalid) {
	subdivide(mTexture);
	uvInvalid = false;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1000);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.depthFunc(gl.LEQUAL);
    
    gl.useProgram(program);
    
    var canvas = $('#main');
    var w = canvas.width();
    var h = canvas.height();
    var aspect = w / h;
    gl.viewport(0, 0, w, h);
    
    var proj = mat4.create();
    mat4.identity(proj);
    mat4.perspective(fov, aspect, 0.001, 1000.0, proj);
    
    var modelView = mat4.create();
    mat4.identity(modelView);
    mat4.translate(modelView, [0, 0, -dolly], modelView);
    mat4.rotate(modelView, ry*Math.PI*2/360, [1, 0, 0], modelView);
    mat4.rotate(modelView, rx*Math.PI*2/360, [0, 1, 0], modelView);
    
    var mvpMatrix = mat4.create();
    mat4.multiply(modelView, proj, mvpMatrix);
    
    gl.uniformMatrix4fv(program.modelViewMatrix, false, modelView);
    gl.uniformMatrix4fv(program.projMatrix, false, proj);
    gl.uniformMatrix4fv(program.mvpMatrix, false, mvpMatrix);
    
    gl.enableVertexAttribArray(0);

    gl.uniform1i(gl.getUniformLocation(program, "texPosition"), 0);
    gl.uniform1i(gl.getUniformLocation(program, "texNormal"), 1);
    gl.uniform1i(gl.getUniformLocation(program, "texUV"), 2);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, vTexture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, nTexture);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, mTexture);

    gl.uniform1f(gl.getUniformLocation(program, "dim"), 1.0/model.resolution);
    gl.uniform3f(gl.getUniformLocation(program, "diffuse"), 0.7, 0.7, 0.7);
    gl.uniform3f(gl.getUniformLocation(program, "ambient"), 0.1, 0.1, 0.1);

    if (uvMapping) {
	gl.uniform1i(gl.getUniformLocation(program, "uvtex"), 3);
	gl.activeTexture(gl.TEXTURE3);
	gl.bindTexture(gl.TEXTURE_2D, uvtex);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, model.levels[maxlevel-1].ibTriangles);
    gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, model.levels[maxlevel-1].nTriangles);

    if (drawWire) {
	gl.uniform3f(gl.getUniformLocation(program, "diffuse"), 0, 0, 0);
	gl.uniform3f(gl.getUniformLocation(program, "ambient"), 0.2, 0.2, 0.2);

	gl.bindBuffer(gl.ARRAY_BUFFER, model.levels[maxlevel-1].ibLines);
	gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 0, 0);
	gl.drawArrays(gl.LINES, 0, model.levels[maxlevel-1].nLines);
    }
    if (drawHull) {
	gl.uniform3f(gl.getUniformLocation(program, "diffuse"), 0, 0, 0);
	gl.uniform3f(gl.getUniformLocation(program, "ambient"), 0, 0, 0.5);

	gl.bindBuffer(gl.ARRAY_BUFFER, model.ibHulls);
	gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 0, 0);
	gl.drawArrays(gl.LINES, 0, model.nHulls);
    }
	
    gl.finish();
    
    drawTime = Date.now() - prevTime;
    prevTime = Date.now();
    fps = (29 * fps + 1000.0/drawTime)/30.0;
    $('#fps').text(Math.round(fps));
    $('#triangles').text(model.levels[maxlevel-1].nTriangles/3);
}

function loadModel(url, type)
{
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    
    xhr.onload = function(e) {
	setModelBin(this.response);
	redraw();
    }
    xhr.send();

/*
    $.ajax({
	type: "GET",
	url: url,
	responseType:type,
	success: function(data) {
	    if (type == "text") {
		setModel(eval(data)[0]);
	    } else {
		setModelBin(data);
	    }
	    redraw();
	}
    });
*/
}

$(function(){
    var canvas = $("#main").get(0);
    $.each(["webgl", "experimental-webgl", "webkit-3d", "moz-webgl"], function(i, name){
	try {
	    gl = canvas.getContext(name);
	} 
	catch (e) {
	}
	return !gl;
    });
    if (!gl) {
	alert("WebGL is not supported in this browser!");
	return;
    }
    if(!gl.getExtension('OES_texture_float')){
	alert("requires OES_texture_float extension");
    }
    
    initialize();
	
    var button = false;
    var prev_position;
    document.onmousemove = function(e){
	var event = windowEvent();
	var p = getMousePosition();
	if (button > 0) {
	    var d = vec3.subtract(p, prev_position, vec3.create());
	    prev_position = p;
	    if (button == 1) {
		rx += d[0];
		ry += d[1];
		if(ry > 90) ry = 90;
		if(ry < -90) ry = -90;
	    }
	    else if(button == 3){
		fov -= d[0];
		if(fov < 1) fov = 1;
		if(fov > 170) fov = 170;
	    }
	    redraw();
	}
	return false;
    };
    document.onmousewheel = function(e){
	var event = windowEvent();
	dolly -= event.wheelDelta/200;
	if (dolly < 0.1) dolly = 0.1;
	redraw();
	return false;
    };
    canvas.onmousedown = function(e){
	var event = windowEvent();
	button = event.button + 1;
	prev_position = getMousePosition();
	return false; // keep cursor shape
    };
    document.onmouseup = function(e){
	button = false;
	return false; // prevent context menu
    }
    document.oncontextmenu = function(e){
	return false;
    }

    var modelSelect = $("#modelSelect").get(0);
    modelSelect.onclick = function(e){
	loadModel(modelSelect.value+".bin");
	redraw();
    }

    var levelSelect = $("#levelSelect").get(0);
    levelSelect.onclick = function(e){
	maxlevel = levelSelect.value;
	geomInvalid = true;
	uvInvalid = true;
	redraw();
    }

    var hullCheckbox = $("#hullCheckbox").get(0);
    hullCheckbox.onchange = function(e){
	drawHull = !drawHull;
	redraw();
    }

    var wireCheckbox = $("#wireCheckbox").get(0);
    wireCheckbox.onchange = function(e){
	drawWire = !drawWire;
	redraw();
    }

    var deformCheckbox = $("#deformCheckbox").get(0);
    deformCheckbox.onchange = function(e){
	deform = !deform;
	if (deform) {
	    interval = setInterval(idle, 16);
	} else {
	    clearInterval(interval);
	    interval = null;
	}
	geomInvalid = true;
	redraw();
    }

    var uvCheckbox = $("#uvCheckbox").get(0);
    uvCheckbox.onchange = function(e){
	uvMapping = !uvMapping;
	if (uvMapping && uvtex == null) {
	    uvimage.src = "brick.jpeg";
	}
	buildMainProgram();
	redraw();
    }

    uvimage.onload = function() {
	uvtex = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, uvtex);
	gl.pixelStorei(gl.UNPACK_ALIGNMENT, true);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, uvimage);

	redraw();
    }

		
    loadModel("test_catmark_cube.bin", "blob");
});

