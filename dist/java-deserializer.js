(function(root, undefined) {

  "use strict";


var JavaDeserializer = (function()
{
  var Inherits = function (a, b)
  {
    var c = function ()
    {
    };
    c.prototype = b.prototype;
    a.superClass_ = b.prototype;
    a.prototype = new c;
    a.prototype.constructor = a
  };

  if (!ArrayBuffer.prototype.slice)
  {
    ArrayBuffer.prototype.slice = function (start, end)
    {
      var that = new Uint8Array(this);
      if (end == undefined) end = that.length;
      var result = new ArrayBuffer(end - start);
      var resultArray = new Uint8Array(result);
      for (var i = 0; i < resultArray.length; i++)
        resultArray[i] = that[i + start];
      return result;
    };
  }

  var STREAM_MAGIC = 0xaced,
    STREAM_VERSION = 0x0005,
    TC_NULL = 0x70,
    TC_REFERENCE = 0x71,
    TC_CLASSDESC = 0x72,
    TC_OBJECT = 0x73,
    TC_STRING = 0x74,
    TC_ARRAY = 0x75,
    TC_CLASS = 0x76,
    TC_BLOCKDATA = 0x77,
    TC_ENDBLOCKDATA = 0x78,
    TC_RESET = 0x79,
    TC_BLOCKDATALONG = 0x7A,
    TC_EXCEPTION = 0x7B,
    TC_LONGSTRING = 0x7C,
    TC_PROXYCLASSDESC = 0x7D,
    TC_ENUM = 0x7E,
    baseWireHandle = 0x7E0000,
    SC_WRITE_METHOD = 0x01,
    SC_BLOCK_DATA = 0x08,
    SC_SERIALIZABLE = 0x02,
    SC_EXTERNALIZABLE = 0x04,
    SC_ENUM = 0x10;

  // need to properly namespace this thing
  // I would think this would break when attempting to deserialize multiple
  // objects.
  var previousDesc = [];

  var StreamChunk = function (dataview, offset, type)
  {
    this.dataview = dataview;
    this.startingOffset = this.currentOffset = offset;
    this.type = type;
    this.contents = {};
  };

  StreamChunk.prototype.getLength = function ()
  {
    return this.currentOffset - this.startingOffset;
  };

  StreamChunk.prototype.readUint32 = function ()
  {
    var val = this.dataview.getUint32(this.currentOffset);
    this.currentOffset += 4;
    return val;
  };

  StreamChunk.prototype.readUint16 = function ()
  {
    var val = this.dataview.getUint16(this.currentOffset);
    this.currentOffset += 2;
    return val;
  };

  StreamChunk.prototype.readUint8 = function ()
  {
    var val = this.dataview.getUint8(this.currentOffset);
    this.currentOffset++;
    return val;
  };

  StreamChunk.prototype.readInt32 = function ()
  {
    var val = this.dataview.getInt32(this.currentOffset);
    this.currentOffset += 4;
    return val;
  };

  StreamChunk.prototype.readInt16 = function ()
  {
    var val = this.dataview.getInt16(this.currentOffset);
    this.currentOffset += 2;
    return val;
  };

  StreamChunk.prototype.readInt8 = function ()
  {
    var val = this.dataview.getInt8(this.currentOffset);
    this.currentOffset++;
    return val;
  };

  StreamChunk.prototype.readFloat32 = function ()
  {
    var val = this.dataview.getFloat32(this.currentOffset);
    this.currentOffset += 4;
    return val;
  };

  var utfStr = function (dataview, offset)
  {
    StreamChunk.call(this, dataview, offset, 'utfStr');
    var length = this.readUint16();
    var str = '';
    for (var i = 0; i < length; i++)
    {
      str += String.fromCharCode(this.readUint8());
    }
    this.contents.length = length;
    this.contents.str = str;
  };
  Inherits(utfStr, StreamChunk);

  utfStr.prototype.toArray = function ()
  {
    var arr = [];
    for (var i = 0; i < this.contents.str.length; i++)
    {
      arr.push(this.contents.str.charAt(i));
    }
    return arr;
  };

  var classDesc = function (dataview, offset)
  {
    var primitives = 'BCDFIJSZ';
    StreamChunk.call(this, dataview, offset, 'classDesc');
    var type = this.readUint8();
    if (type === TC_NULL)
    {
      return;
    }
    else if (type === TC_REFERENCE)
    {
      var handle = this.readUint32() - baseWireHandle;
      this.contents = previousDesc[handle].contents;
      return;
    }
    else if (type !== TC_CLASSDESC)
    {
      console.log('I don\'t know how to handle this type yet: ' + type);
      return;
    }
    var name = new utfStr(this.dataview, this.currentOffset);
    this.currentOffset += name.getLength();
    this.contents.name = name;
    this.contents.versionId = [this.readUint32(), this.readUint32()];
    this.contents.handle = previousDesc.length;
    this.contents.flags = this.readUint8();
    var fields = [];
    var num = this.readUint16();
    for (var i = 0; i < num; i++)
    {
      var field = {};
      field.type = this.readUint8();
      field.name = new utfStr(this.dataview, this.currentOffset);
      this.currentOffset += field.name.getLength();
      if (primitives.indexOf(String.fromCharCode(field.type)) === -1)
      {
        // not a primitive, what do.
        console.log('this is not a primitive type: ' + field.type);
      }
      fields.push(field);
    }
    this.contents.fields = fields;
    this.contents.annotation = this.readUint8();
    if (this.contents.annotation !== TC_ENDBLOCKDATA)
    {
      console.log('I don\'t know what to do with this: ' + this.contents.annotation);
    }
    this.contents.superClass = new classDesc(this.dataview, this.currentOffset);
    this.currentOffset += this.contents.superClass.getLength();
    previousDesc.push(this);
  };
  Inherits(classDesc, StreamChunk);

  classDesc.prototype.getSize = function ()
  {
    // we don't really handle this yet.
    return 4;
  };

  var jArray = function (dataview, offset)
  {
    StreamChunk.call(this, dataview, offset, 'jArray');
    var desc = new classDesc(dataview, this.currentOffset), i;
    this.contents.description = desc;
    this.currentOffset += desc.getLength();
    // for some reason this doesn't seem to be getting this.
    this.contents.handle = previousDesc.length;
    this.contents.size = this.readUint32();
    this.contents.elements = [];
    var name = desc.contents.name && desc.contents.name.contents.str;
    // haha what the fuck is this shit.
    // Spec, does you follow it?
    if (name === '[F')
    {
      this.contents.elements = new Float32Array(this.contents.size);
      for (i = 0; i < this.contents.size; i++)
      {
        this.contents.elements[i] = this.readFloat32();
      }
    }
    else if (name === '[S')
    {
      this.contents.elements = new Uint16Array(this.contents.size);
      for (i = 0; i < this.contents.size; i++)
      {
        this.contents.elements[i] = this.readInt16();
      }
    }
    else
    {
      this.contents.elements = [];
      for (i = 0; i < this.contents.size; i++)
      {
        var t = new Contents(this.dataview, this.currentOffset);
        this.currentOffset += t.getLength();
        this.contents.elements.push(t);
      }
    }
    // nope.avi
    previousDesc.push(this);
  };
  Inherits(jArray, StreamChunk);

  jArray.prototype.toArray = function ()
  {
    return this.contents && this.contents.elements || null;
  };

  var blockData = function (dataview, offset)
  {
    StreamChunk.call(this, dataview, offset, 'blockData');
    var size = this.readUint8();
    var blocks = new ArrayBuffer(size);
    var t = new Uint8Array(blocks);
    for (var i = 0; i < size; i++)
    {
      t[i] = this.readUint8();
    }
    this.contents.size = size;
    this.contents.blocks = blocks;
  };
  Inherits(blockData, StreamChunk);

  blockData.prototype.toArray = function ()
  {
    return this.contents && this.contents.blocks || null;
  };

  var Contents = function (dataview, offset)
  {
    StreamChunk.call(this, dataview, offset, 'Contents');
    var type = this.readUint8();
    var content = null;
    switch (type)
    {
      case TC_ARRAY:
        content = new jArray(this.dataview, this.currentOffset);
        break;
      case TC_BLOCKDATA:
        content = new blockData(this.dataview, this.currentOffset);
        break;
      case TC_STRING:
        content = new utfStr(this.dataview, this.currentOffset);
        break;
      default:
        console.log('unhandled type');
    }
    if (content)
    {
      this.currentOffset += content.getLength();
    }
    this.contents = content;
    this.type = type;
  };
  Inherits(Contents, StreamChunk);

  var Stream = function (dataview)
  {
    StreamChunk.call(this, dataview, 0, 'Stream');
    if (this.readUint16() !== STREAM_MAGIC)
    {
      throw 'invalid magic number!';
    }
    if (this.readUint16() !== STREAM_VERSION)
    {
      throw 'invalid version!';
    }
    this.contents = null;
  };
  Inherits(Stream, StreamChunk);

  Stream.prototype.getContents = function ()
  {
    if (!this.contents)
    {
      this.contents = [];
      while (this.currentOffset < this.dataview.byteLength)
      {
        var contents = new Contents(this.dataview, this.currentOffset);
        this.currentOffset += contents.getLength();
        this.contents.push(contents);
      }
    }
    return this.contents;
  };

  // I don't quite know what the purpose of this last wrapper is:
  var JavaDeserializer = function (arraybuf)
  {
    this.buf = arraybuf;
  };

  JavaDeserializer.prototype.getStream = function ()
  {
    return new Stream(new DataView(this.buf, 0));
  };

  return JavaDeserializer;
}());

JavaDeserializer.VERSION = '0.1.0';
root.JavaDeserializer = JavaDeserializer;


}(this));
