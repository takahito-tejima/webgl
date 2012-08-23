/*
  camera.js
  Copyright (C) 2011 Takahito TEJIMA
  tejima@da2.so-net.ne.jp
*/

var  PersCamera = function(){
    this.rad_deg = function(r){
	return r * 360.0 / Math.PI / 2.0;
    }

    this.setScale = function(s){
	this.scale = s;
    }

    this.apply = function(p){
	var pp = vec3.create();
	mat4.multiplyVec3(this.mvpMatrix, p, pp);
	return vec3.scale(pp, this.scale);
    }

    this.update = function(){
	// matrix setup
	var proj = mat4.create();
	mat4.identity(proj);
	var aspect = 1.0;
//	mat4.perspective(45, aspect, 0.1, 100.0, proj);
	var modelView = mat4.create();
	mat4.identity(modelView);
	mat4.lookAt(this.eyeVec, this.refVec, this.upVec, modelView);
	this.mvpMatrix = mat4.create();
	mat4.multiply(modelView, proj, this.mvpMatrix);
    }
    
    this.rotate = function(mx, my){
	var axis_z = vec3.create();
	vec3.subtract(this.eyeVec, this.refVec, axis_z);
	vec3.normalize(axis_z, axis_z);
	var axis_x = vec3.create();
	vec3.cross(this.upVec, axis_z, axis_x);
	vec3.normalize(axis_x, axis_x);
	
	var dmx = mx / 360.0 * 2.0 * Math.PI;
	var dmy = my / 360.0 * 2.0 * Math.PI;
	
	if (my > 0 && (this.refVec[1] - this.eyeVec[1] < 0)) {
	    if (Math.asin(this.upVec[1] < dmy)) {
		dmy = Math.asin(this.upVec[1]);
	    }
	}
	else {
	    if ((this.refVec[1] - this.eyeVec[1] > 0)) {
		if (Math.asin(this.upVec[1]) < -dmy) {
		    dmy = -Math.asin(this.upVec[1]);
		}
	    }
	}
	
	var mat = mat4.create();
	mat4.identity(mat);
	mat4.translate(mat, this.refVec);
	mat4.rotate(mat, dmx, [0, 1, 0]);
	mat4.rotate(mat, dmy, axis_x);
	var v = vec3.create(this.refVec);
	vec3.negate(v);
	mat4.translate(mat, v);
	
	mat4.multiplyVec3(mat, this.eyeVec);
	
	vec3.subtract(this.eyeVec, this.refVec, axis_z);
	vec3.normalize(axis_z, axis_z);
	vec3.cross(axis_z, [0, 1, 0], axis_x);
	vec3.cross(axis_x, axis_z, this.upVec);
	vec3.normalize(this.upVec, this.upVec);

	this.update();
    }
    this.translate = function(mx, my){		
	this.updatePixelSize();
	var axis_x = vec3.create();
	var axis_y = vec3.create(this.upVec);
	var axis_z = vec3.create();
	
	vec3.subtract(this.eyeVec, this.refVec, axis_z);
	vec3.normalize(axis_z, axis_z);		
	vec3.cross(this.upVec, axis_z, axis_x);
	
	var sx = -mx * this.pixelSize * 5.0;
	var sy = my * this.pixelSize * 5.0;
	
	vec3.scale(axis_x, sx, axis_x);
	vec3.scale(axis_y, sy, axis_y);
	var vec = vec3.create();
	vec3.add(axis_x, axis_y, vec);
	vec3.add(this.eyeVec, vec, this.eyeVec);
	vec3.add(this.refVec, vec, this.refVec);

	this.update();
    }
    this.dolly = function(mx){
	this.updatePixelSize();
	var vec = vec3.create();
	vec3.subtract(this.eyeVec, this.refVec, vec);
	vec3.normalize(vec, vec);
	
	var sx = mx * this.pixelSize * 5.0;
	vec3.scale(vec, sx, vec);
	
	var eyeVec = vec3.create();
	vec3.subtract(this.eyeVec, this.refVec, eyeVec);
	if(mx > 0 && vec3.length(vec) > vec3.length(eyeVec)) return;
	vec3.subtract(this.eyeVec, vec, this.eyeVec);		

	this.update();
    }
    this.updatePixelSize = function()
    {
	var v = vec3.create();
	vec3.subtract(this.eyeVec, this.refVec, v);
	this.pixelSize = Math.tan(45/360.0 * Math.PI) * vec3.length(v) / 512 /2.0;
    }
    this.eyeVec = vec3.create([0, 0, 5]);
    this.refVec = vec3.create([0, 0, 0]);
    this.upVec = vec3.create([0, 1, 0]);
    this.pixelSize = 1.0;
    this.updatePixelSize();
    this.update();
}
