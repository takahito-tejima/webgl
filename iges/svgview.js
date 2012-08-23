/*
  svgview.js
  Copyright (C) 2011 Takahito TEJIMA
  tejima@da2.so-net.ne.jp
*/

function windowEvent()
{
    if(window.event) return window.event;
    var caller = arguments.callee.caller;
    while(caller){
	var ob = caller.arguments[0];
	if(ob && ob.constructor == MouseEvent) return ob;
	caller = caller.caller;
    }
    return null;
}

function getMousePosition()
{
    var event = windowEvent();
return new Array(event.pageX, event.pageY);
/*
    var canvas = $("#main").get(0);
    canvasOffsetX = canvas.offsetLeft;
    canvasOffsetY = canvas.offsetTop;
    var x = event.pageX - canvasOffsetX;
    var y = event.pageY - canvasOffsetY;
    return new Array(x, y);
*/
}

$(function(){
    var svg = $("#main");
    svg.mousedown(function(e){
	button = true;
	mousePosition = getMousePosition();
    });
    svg.mouseup(function(e){
	button = false;
    });
    svg.mousemove(function(e){
	if(button){
	    var m = getMousePosition();
	    var dx = m[0] - mousePosition[0];
	    var dy = m[1] - mousePosition[1];
	    mousePosition = m;

	    camera.rotate(-dx, -dy);
	    convertSvg();
	}
    });
    var wheel = function(e){
	if(!e) e = window.event; // IE
	if(e.wheelDelta){
	    delta = e.wheelDelta / 120;
	}else if(e.detail){
	    delta = -e.detail / 3;
	}
	if(delta){
	    scale += delta*10;
	    if(scale <= 0.01) scale = 0.01;
	}
	if(e.preventDefault) e.preventDefault();
	e.returnValue = false;
	convertSvg();
    }
    if(window.addEventListener){
	window.addEventListener('DOMMouseScroll', wheel, false);
    }
    window.onmousewheel = document.onmousewheel = wheel;

    Downloadify.create('svgsave', {
	filename: function(){
	    return "out.svg";
	},
	data: function(){
	    var ser = new XMLSerializer();
	    return ser.serializeToString($("#main").get(0));
	},
	swf: '../Downloadify/media/downloadify.swf',
	downloadImage: '../Downloadify/images/download.png',
	width: 100,
	height: 30,
	append: false
    });

    $("#igesfile").change(function(e){
	var reader = new FileReader();
	reader.onload = function(re){
//	    console.log(re.target.result);
	    setIges(re.target.result);
	}
	var src = reader.readAsText(e.target.files[0]);
    });

    // sample
    $(".sample").click(function(e){
	var file;
	if (document.all){
	    file = e.srcElement.value+".iges";
	}else{
	    //firefox
	    file = e.target.id+".iges";
	}
	$.get(file, function(ef)
	{
	    setIges(ef);
	});
    });


    $("#showNurbs").click(function(e){convertSvg();});
    $("#showBezier").click(function(e){convertSvg();});
    $("#showAxis").click(function(e){
	$("#axis").get(0).setAttribute("visibility", e.target.checked ? "visible" : "hidden");
    });

    // initial data
    $.get("surface2.iges", function(ef){setIges(ef);});
    convertSvg();
});

var button = false;
var mousePosition;
var scale = 50.0;
var iges = null;

var camera = new PersCamera();
camera.eyeVec[0] = 0;
camera.eyeVec[1] = 5;
camera.eyeVec[2] = -5;
camera.refVec[0] = 0;
camera.refVec[1] = 0;
camera.refVec[2] = 0;
camera.update();

function setIges(src)
{
    // clear svg
    $("#area").empty();
    iges = parseIges(src);
    
    // set info table
//    $("#comment").text(iges.comment);
//    $("#user").text(iges.createUser);
    $("#lastmodified").text(iges.lastModifiedDate);

    // fit all
    var bound = new Bound();
    for(var i = 0; i < iges.entities.length; i++){
	var entity = iges.entities[i];
	if(entity == null) continue;

	entity.calcBound();
	bound.extendBound(entity.bound);
    }
    bound.recalc();
    var w = $("#main").attr("width");
//    scale = w/bound.width;

    convertSvg();
}


function convertSvg()
{
    var w = $("#viewframe").width();
    var h = $("#viewframe").height();
    var area = $("#area").get(0);
    var frame = $("#frame").get(0);
    frame.setAttribute("transform", "translate("+w*0.5+", "+h*0.5+") scale(1, -1)");
    camera.setScale(scale);

    var ns = 'http://www.w3.org/2000/svg';

    var xaxis = $("#xaxis").get(0);
    p0 = camera.apply(vec3.create([-1, 0, 0]));
    p1 = camera.apply(vec3.create([ 1, 0, 0]));
    xaxis.setAttribute("d", "M "+p0[0]+" "+p0[1]+" L "+p1[0]+" "+p1[1]);
    var yaxis = $("#yaxis").get(0);
    p0 = camera.apply(vec3.create([0, -1, 0]));
    p1 = camera.apply(vec3.create([0,  1, 0]));
    yaxis.setAttribute("d", "M "+p0[0]+" "+p0[1]+" L "+p1[0]+" "+p1[1]);
    var zaxis = $("#zaxis").get(0);
    p0 = camera.apply(vec3.create([0, 0, -1]));
    p1 = camera.apply(vec3.create([0, 0,  1]));
    zaxis.setAttribute("d", "M "+p0[0]+" "+p0[1]+" L "+p1[0]+" "+p1[1]);


    var dispCv = ($("#showNurbs").attr("checked")=="checked");

    // convert to svg
    if(iges == null) return;
    for(var i = 0; i < iges.entities.length; i++){
	var entity = iges.entities[i];
	if(entity == null) continue;
	
	if(entity.entityType == 110){
	    lineDraw(entity, area);
	}
	else if(entity.entityType == 126){
	    splineDraw(entity, area);
	    cvDraw(entity, area, dispCv);
	}
	else if(entity.entityType == 128){
	    surfaceDraw(entity, area);
	    cvDraw(entity, area, dispCv);
	}
    }
}

var SplineSpec = function(){
}

SplineSpec.prototype = {
    toBezier : function()
    {
	var M = this.degree + 1;
	var previous = this.knots[0];
	var multiplicity = 0;
	var count = 0;
	for(var i = 0; i < this.knots.length; i++){
	    // if i-M, i-M+1, ... i are same, duplicate i
	    //	console.log(i, spline.knots[i], previous, multiplicity);
	    if(previous == this.knots[i]) multiplicity++;
	    else if(multiplicity < this.degree-1){
		i--;
		//	    console.log("insert knot", spline.knots[i], i) ;
		var iknot = this.knots[i];
		this.knots.splice(i, 0, iknot);
		
		for(var k = 0; k < this.cv.length; k++){
		    var cv = this.cv[k];
		    // new 
		    var newcv = new Array();
		    // copy lower
		    for(var j = 0; j <= i - M + 1; j++){
			//		console.log("copy low ", j);
			newcv.push(new Array(cv[j][0], cv[j][1], cv[j][2]));
		    }
		    // interpolate interior
		    for(var j = i - M + 2; j <= i; j++){
			var r = (iknot - this.knots[j]) / (this.knots[j+M] - this.knots[j]);
			var x = (1-r) * cv[j-1][0];
			var y = (1-r) * cv[j-1][1];
			var z = (1-r) * cv[j-1][2];
			if(r > 0){
			    x += r * cv[j][0];
			    y += r * cv[j][1];
			    z += r * cv[j][2];
			}
			newcv.push(new Array(x, y, z));
			//		console.log("interpolate ", j, r, cpx2[j]);
		    }
		    // shift upper
		    for(var j = i+1; j <= cv.length; j++){
			newcv.push(new Array(cv[j-1][0], cv[j-1][1], cv[j-1][2]));
			//		console.log("shift ", j, cpx2[j], cpy2[j]);
		    }
		    this.cv[k] = newcv;
		}
	    }else{
		multiplicity = 0;
	    }
	    previous = this.knots[i];
	}
    }
};


function modifyPath(path)
{
    var d = 'M ';
    if(path.degree == 1) cmd = 'L';
    else if(path.degree == 2) cmd = 'Q';
    else cmd = 'C';
    for(var i = 0; i < path.cv.length; i++){
	if(i == 1) d += cmd + ' ';
	var p = camera.apply(path.cv[i]);
	d += p[0].toFixed(3) + ' ' + p[1].toFixed(3) + ' ';
    }	
    path.setAttribute("d", d);

    return path;
}

function modifyCircle(circle)
{
    var x = camera.apply(circle.cv);
    circle.setAttribute("cx", x[0]);
    circle.setAttribute("cy", x[1]);
}

function cvDraw(entity, area, dispCv)
{
    if(entity.svgCVs == undefined){
	var ns = 'http://www.w3.org/2000/svg';
	entity.svgCVs = document.createElementNS(ns, "g");
	area.appendChild(entity.svgCVs);

	entity.foreachCV(function(x, y, z){
	    var circle = document.createElementNS(ns, "circle");
	    circle.setAttribute("r", 3);
	    circle.setAttribute("fill", "red");
	    circle.cv = vec3.create([x, y, z]);
	    entity.svgCVs.appendChild(circle);
	});
    }
    
    if(dispCv){
	for(var i = 0; i < entity.svgCVs.childNodes.length; i++){
	    modifyCircle(entity.svgCVs.childNodes[i]);
	}
	entity.svgCVs.setAttribute("visibility", "visible");
    }else{
	entity.svgCVs.setAttribute("visibility", "hidden");
    }
}

function lineDraw(line, area)
{
    if(line.path == undefined){
	var ns = 'http://www.w3.org/2000/svg';
	line.path = document.createElementNS(ns, 'path');
	area.appendChild(line.path);
    }

    var p0 = camera.apply(line.p0);
    var p1 = camera.apply(line.p1);
    line.path.setAttribute("d", "M "+p0[0]+" "+p0[1]+" L "+p1[0]+" "+p1[1]);
}

function splineDraw(spline, area)
{
    if(spline.path == undefined){
	// convert a spline to a splinespec for bezier transfromation
	var splineSpec = new SplineSpec();
	splineSpec.degree = spline.degree;
	splineSpec.knots = new Array();
	for(var i = 0; i < spline.knots.length; i++) splineSpec.knots[i] = spline.knots[i];
	splineSpec.cv = new Array();
	splineSpec.cv[0] = new Array();
	for(var i = 0; i < spline.cv.length; i++){
	    splineSpec.cv[0].push(vec3.create([spline.cv[i][0], spline.cv[i][1], spline.cv[i][2]]));
	}
	splineSpec.toBezier();
	
	var ns = 'http://www.w3.org/2000/svg';
	spline.path = document.createElementNS(ns, "path");
	spline.path.setAttribute("style", "fill:none; stroke:black;");
	spline.path.cv = splineSpec.cv[0];
	spline.path.degree = splineSpec.degree;
	area.appendChild(spline.path);
    }
    modifyPath(spline.path);
}
function surfaceDraw(surface, area)
{
    if(surface.paths == undefined){
	var ns = 'http://www.w3.org/2000/svg';
	surface.paths = document.createElementNS(ns, 'g');
	area.appendChild(surface.paths);
    
	// convert a surface to a splinespec
	var splineSpecU = new SplineSpec();
	splineSpecU.degree = surface.degreeU;
	splineSpecU.knots = new Array();
	for(var i = 0; i < surface.knots[0].length; i++)
	{
	    splineSpecU.knots.push(surface.knots[0][i]);
	}
	splineSpecU.cv = new Array();
	for(var v = 0; v <= surface.numV; v++){
	    splineSpecU.cv[v] = new Array();
	    for(var u = 0; u <= surface.numU; u++){
		splineSpecU.cv[v].push(vec3.create([surface.cv[v][u][0], surface.cv[v][u][1], surface.cv[v][u][2]]));
	    }
	}
	splineSpecU.toBezier();

	var splineSpecV = new SplineSpec();
	splineSpecV.degree = surface.degreeV;
	splineSpecV.knots = new Array();
	for(var i = 0; i < surface.knots[1].length; i++) splineSpecV.knots[i] = surface.knots[1][i];
	splineSpecV.cv = new Array();
	for(var u = 0; u < splineSpecU.cv[0].length; u++){
	    splineSpecV.cv[u] = new Array();
	    for(var v = 0; v <= surface.numV; v++){
		splineSpecV.cv[u].push(vec3.create([splineSpecU.cv[v][u][0], splineSpecU.cv[v][u][1], splineSpecU.cv[v][u][2]]));
	    }
	}
	splineSpecV.toBezier();
	surface.splineSpecU = splineSpecU;
	surface.splineSpecV = splineSpecV;

	surface.bezierCVs = document.createElementNS(ns, "g");
	area.appendChild(surface.bezierCVs);

	// create bezier path
	for(var u = 0; u < surface.splineSpecU.cv[0].length; u+=3){
	    var path = document.createElementNS(ns, "path");
	    path.setAttribute("style", "fill:none; stroke:black;");
	    path.cv = surface.splineSpecV.cv[u];
	    path.degree = surface.splineSpecV.degree;
	    surface.paths.appendChild(path);
	}
	
	// row-column transpose
	for(var v = 0; v < surface.splineSpecV.cv[0].length; v+=3){
	    var path = document.createElementNS(ns, "path");
	    path.setAttribute("style", "fill:none; stroke:black;");
	    path.cv = new Array();
	    for(var u = 0; u < surface.splineSpecV.cv.length; u++){
		path.cv.push(surface.splineSpecV.cv[u][v]);
	    }
	    path.degree = surface.splineSpecU.degree;
	    surface.paths.appendChild(path);

	    // cv circle
	    for(var i = 0; i < path.cv.length; i++){
		var circle = document.createElementNS(ns, "circle");
		circle.setAttribute("r", 3);
		circle.setAttribute("fill", "green");
		circle.cv = vec3.create(path.cv[i]);
		surface.bezierCVs.appendChild(circle);
	    }
	}
    }
    for(var i = 0; i < surface.paths.childNodes.length; i++){
	var path = surface.paths.childNodes[i];
	modifyPath(path);
    }

    if($("#showBezier").attr("checked")=="checked"){
	surface.bezierCVs.setAttribute("visibility", "visible");
	for(var i = 0; i < surface.bezierCVs.childNodes.length; i++){
	    modifyCircle(surface.bezierCVs.childNodes[i]);
	}
    }else{
	surface.bezierCVs.setAttribute("visibility", "hidden");
    }
}
