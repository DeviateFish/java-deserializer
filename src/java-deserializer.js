import StreamReader from './stream-reader';

// Magic numbers
const STREAM_MAGIC = 0xaced;
const STREAM_VERSION = 0x0005;

// Type constants (ignore because undef)
const TC_NULL = 0x70;
const TC_REFERENCE = 0x71;
const TC_CLASSDESC = 0x72;
const TC_OBJECT = 0x73; // jshint ignore:line
const TC_STRING = 0x74;
const TC_ARRAY = 0x75;
const TC_CLASS = 0x76; // jshint ignore:line
const TC_BLOCKDATA = 0x77;
const TC_ENDBLOCKDATA = 0x78;
const TC_RESET = 0x79; // jshint ignore:line
const TC_BLOCKDATALONG = 0x7A; // jshint ignore:line
const TC_EXCEPTION = 0x7B; // jshint ignore:line
const TC_LONGSTRING = 0x7C; // jshint ignore:line
const TC_PROXYCLASSDESC = 0x7D; // jshint ignore:line
const TC_ENUM = 0x7E; // jshint ignore:line

const BASE_HANDLE = 0x7E0000;

class JavaDeserializer {

  constructor(arraybuf) {
    this.buffer = arraybuf;
    this.stream = new StreamReader(arraybuf);
    this.repr = null;
    this.refs = [];
    this._checkMagic();
  }

  _checkMagic() {
    if (this.stream.readUint16() !== STREAM_MAGIC)
    {
      throw 'invalid magic number!';
    }
    if (this.stream.readUint16() !== STREAM_VERSION)
    {
      throw 'invalid version!';
    }
  }

  _readClassDescription() {
    var primitives = 'BCDFIJSZ';
    var type = this.stream.readUint8();
    var description = {};
    if (type === TC_NULL)
    {
      return;
    }
    else if (type === TC_REFERENCE)
    {
      var handle = this.stream.readUint32() - BASE_HANDLE;
      return this.refs[handle];
    }
    else if (type !== TC_CLASSDESC)
    {
      console.log('I don\'t know how to handle this type yet: ' + type); // jshint ignore:line
      return;
    }
    description.name = this.stream.readUtf8String();
    description.versionId = [this.stream.readUint32(), this.stream.readUint32()];
    description.handle = this.refs.length;
    description.flags = this.stream.readUint8();
    var fields = [];
    var num = this.stream.readUint16();
    for (var i = 0; i < num; i++)
    {
      var field = {};
      field.type = this.stream.readUint8();
      field.name = this.stream.readUtf8String();
      if (primitives.indexOf(String.fromCharCode(field.type)) === -1)
      {
        // not a primitive, what do.
        console.log('this is not a primitive type: ' + field.type); // jshint ignore:line
      }
      fields.push(field);
    }
    description.fields = fields;
    description.annotation = this.stream.readUint8();
    if (description.annotation !== TC_ENDBLOCKDATA)
    {
      console.log('I don\'t know what to do with this: ' + description.annotation); // jshint ignore:line
    }
    description.superClass = this._readClassDescription();
    this.refs.push(description);
    return description;
  }

  _readArray() {
    var content = {};
    var desc = this._readClassDescription(), i, length;
    content.description = desc;
    // for some reason this doesn't seem to be getting this.
    content.handle = this.refs.length;
    length = this.stream.readUint32();
    var name = desc.name;
    // haha what the fuck is this shit.
    // Spec, does you follow it?
    if (name === '[F')
    {
      content.elements = this.stream.readFloat32Array(length);
    }
    else if (name === '[S')
    {
      content.elements = this.stream.readUint16Array(length);
    }
    else // this is an array of classes of some kind?
    {
      content.elements = [];
      for (i = 0; i < length; i++)
      {
        var t = this._readChunk();
        content.elements.push(t);
      }
    }
    // nope.avi
    this.refs.push(content);
    return content;
  }

  _readBlockData() {
    var length = this.stream.readUint8();
    return this.stream.readUint8Array(length);
  }

  _readChunk() {
    var type = this.stream.readUint8();
    var content = null;
    switch (type)
    {
      case TC_ARRAY:
        content = this._readArray();
        break;
      case TC_BLOCKDATA:
        content = this._readBlockData();
        break;
      case TC_STRING:
        content = this.stream.readUtf8String();
        break;
      default:
        console.log('unhandled type'); // jshint ignore:line
    }
    return content;
  }

  getContents() {
    if(this.repr) {
      return this.repr;
    }

    this.repr = [];

    while (this.stream.getPosition() < this.stream.getLength())
    {
      this.repr.push(this._readChunk());
    }

    return this.repr;
  }
}

JavaDeserializer.VERSION = '0.2.0';

export default JavaDeserializer;

/*var JavaDeserializer = (function()
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
root.JavaDeserializer = JavaDeserializer;*/
