
var DXTColor = function(v)
{
	this.r = ((v >> 11) & 0x1f) << 3;	
	this.g = ((v >> 5) & 0x3f) << 2;
	this.b = ((v >> 0) & 0x1f) << 3;
	this.r = this.r | (this.r >> 5);
	this.g = this.g | (this.g >> 6);
	this.b = this.b | (this.b >> 5);
	this.a = 255;
	this.value = v;
	
	this.add = function(v)
	{
		var r = new DXTColor();
		r.set(this);
		r.r += v.r;
		r.g += v.g;
		r.b += v.b;
		return r;
	}
	this.scale = function(v)
	{
		var r = new DXTColor();
		r.set(this);
		r.r *= v;
		r.g *= v;
		r.b *= v;
		return r;
	}
	this.set = function (v)
	{
		this.r = v.r;
		this.g = v.g;
		this.b = v.b;
		this.a = v.a;
	}
}

var DDS = function(gl, file){
	
	this.MAGIC = 0x20534444;
	this.DDS_CUBEMAP = 0x00000200;
	this.DDS_FOURCC = 0x00000004;
	this.FOURCC_DXT1 = 0x31545844;
	this.FOURCC_DXT3 = 0x33545844;
	this.FOURCC_DXT5 = 0x35545844;
	this.FOURCC_G16R16F = 112;
	this.FOURCC_A16B16G16R16F = 113;
	
	this.position = 0;
	this.file = file;
	this.parser = new BinaryParser(false);
	
	this.readUInt8 = function(){
		return this.parser.toByte(this.file[this.position++]);
	};
	this.readInt8 = function(){
		return this.parser.toSmall(this.file[this.position++]);
	};
	this.readUInt16 = function(){
		return this.readUInt8() | this.readUInt8() << 8;
	};
	this.readInt16 = function(){
		return this.readUInt8() | this.readInt8() << 8;
	};
	this.readUInt32 = function(){
		return this.readUInt16() | this.readUInt16() << 16;
	};
	this.readInt32 = function(){
		return this.readUInt16() | this.readInt16() << 16;
	};
	
	this.decodeSurface = function(surface){
		switch (this.pfFourCC) {
			case this.FOURCC_DXT1:
				return this.decodeDXT(surface, this.FOURCC_DXT1);
			default:
				return this.decodeRGBA8(surface);
		}
	};
	this.decodeRGBA8 = function(surface){
		var index = 0;
		var data = new Uint8Array(this.width*this.height*4);
		for(var y = 0; y < this.height; y++){
			var dst_index = y * this.width * 4;
			for(var x = 0; x < this.width; x++){
				data[dst_index++] = surface[index++];
				data[dst_index++] = surface[index++];
				data[dst_index++] = surface[index++];
				data[dst_index++] = surface[index++];
			}
		}
		return data;
	}
	
    this.interpolate = function(color0, color1, color2, color3)
    {
        if (color0.value > color1.value)
        {
            color2.set(color0.scale(0.6667).add(color1.scale(0.3333)));
            color3.set(color0.scale(0.3333).add(color1.scale(0.6667)));
        }
        else
        {
            color2.set(color0.scale(0.5).add(color1.scale(0.5)));
            color3.set(new DXTColor(0));
        }
    }

    this.getBlockPixel = function(color0, color1, color2, color3, c1)
    {
        var c = color0;
        var t = (c1 & 3);
        c1 >>= 2;

        if (t == 1) c = color1;
        else if (t == 2) c = color2;
        else if (t == 3) c = color3;

        return c;
    }
	this.decodeDXT = function(surface, dxt){
		var data = new Uint8Array(this.width*this.height*4);
		var bLength = (dxt == this.FOURCC_DXT1) ? 8 : 16;
		var bWidth = this.width/4;
		var bHeight = this.height/4;
		var numBlock = bWidth * bHeight;
		
		console.log("decodeDXT", dxt);
		
		if(surface.length < numBlock * bLength) return data;
		var p = 0;
		for(var by = 0; by < bHeight; by++)
        {
			for(var bx = 0; bx < bWidth; bx++)
            {
                var a0 = 0xffffffff;
                var a1 = 255;
                var alpha0 = new DXTColor(255);
                var alpha1 = new DXTColor(255);
                var alpha2 = new DXTColor();
				var alpha3 = new DXTColor();

                if (dxt != this.FOURCC_DXT1)
                {
                    a0 = surface[p++] | surface[p++] << 8 | surface[p++] << 16 | surface[p++] << 24;
                    a1 = surface[p++] | surface[p++] << 8 | surface[p++] << 16 | surface[p++] << 24;

                    alpha0 = new DXTColor(a0 & 0xFFFF);
                    alpha1 = new DXTColor((a0 >> 16) & 0xffff);
                }
                this.interpolate(alpha0, alpha1, alpha2, alpha3);

                var c0 = surface[p++] | surface[p++] << 8 | surface[p++] << 16 | surface[p++] << 24;
                var c1 = surface[p++] | surface[p++] << 8 | surface[p++] << 16 | surface[p++] << 24;
                var color0 = new DXTColor(c0 & 0xFFFF);
                var color1 = new DXTColor((c0 >> 16) & 0xffff);
                var color2 = new DXTColor();
				var color3 = new DXTColor();
                this.interpolate(color0, color1, color2, color3);

                for (var y = 0; y < 4; y++)
                {
                    var q = ((by * 4 + y) * this.width + bx * 4) * 4;
                    for (var x = 0; x < 4; x++)
                    {
                        var c = this.getBlockPixel(color0, color1, color2, color3, c1);
                        var a = this.getBlockPixel(alpha0, alpha1, alpha2, alpha3, a1);
                        c1 >>= 2;
                        a1 >>= 2;
						
/*
                        if (((a0 >> 16) & 0xff) == 0 && a1 == 0 && this.transparentColor != Color.Transparent)
                        {
                            c.r = TransparentColor.R;
                            c.g = TransparentColor.G;
                            c.b = TransparentColor.B;
                        }
                        */

                        data[q++] = c.r;
                        data[q++] = c.g;
                        data[q++] = c.b;
                        data[q++] = c.a;
                    }
                }
            }
        }
		return data;
	}
	
	var header = this.readInt32();
	if(header != this.MAGIC){
		alert("not dds file");
		return null;
	}
	var size = this.readInt32();
	var flags = this.readInt32();
	this.height = this.readInt32();
	this.width = this.readInt32();
	
	var pitchOrLinearSize = this.readInt32();
	this.depth = this.readInt32();
	this.mipmapCount = this.readInt32();
	this.position += 11*4;
	
	this.pfSize = this.readInt32();
	this.pfFlags = this.readInt32();
	this.pfFourCC = this.readInt32();
	this.pfRGBbitCount = this.readInt32();
	this.pfRbitMask = this.readInt32();
	this.pfGbitMask = this.readInt32();
	this.pfBbitMask = this.readInt32();
	this.pfAbitMask = this.readInt32();
	
	this.caps1 = this.readInt32();
	this.caps2 = this.readInt32();
	this.readInt32();
	this.readInt32();
	this.readInt32();

	var numSurface = 1;
	this.images = [];
	if ((this.caps2 & this.DDS_CUBEMAP) != 0) {
		console.log("cubemap");
		this.cubemap = true;
		numSurface = 6;
	}
	console.log("size ",this.width, this.height);
	console.log("FourCC", this.pfFourCC);
	
	var offset = this.position;
	for(var i = 0; i < numSurface; i++){
		var pixelBit = this.pfRGBbitCount;
		if(pixelBit == 0){
			if(this.pfFourCC == this.FOURCC_DXT1)
				pixelBit = 4;
			else
				pixelBit = 8;
		}
		var surfaceSize = this.width * this.height * pixelBit / 8;
		var surface = this.file.slice(offset, offset+surfaceSize);
		offset += surfaceSize;
		var data = new Array(surface.length);
		var parser = new BinaryParser(false);		
		for(var j = 0; j < surface.length; j++) data[j] = (parser.toByte(surface[j]));
		this.images.push(this.decodeSurface(data));
		
		// mipmap 
		var w = this.width;
		var h = this.height;
		for(var j = 1; j < this.mipmapCount; j++)
		{
			w >>= 1;
			h >>= 1;
			offset += w*h*pixelBit/8;
			offset += (4-offset%4)%4;
		}
		offset += (4-offset%4)%4;
	}
	console.log("images : ", this.images.length);
	
}