(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.JavaDeserializer = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _streamReader = require('./stream-reader');

var _streamReader2 = _interopRequireDefault(_streamReader);

// Magic numbers
var STREAM_MAGIC = 0xaced;
var STREAM_VERSION = 0x0005;

// Type constants (ignore because undef)
var TC_NULL = 0x70;
var TC_REFERENCE = 0x71;
var TC_CLASSDESC = 0x72;
var TC_OBJECT = 0x73; // jshint ignore:line
var TC_STRING = 0x74;
var TC_ARRAY = 0x75;
var TC_CLASS = 0x76; // jshint ignore:line
var TC_BLOCKDATA = 0x77;
var TC_ENDBLOCKDATA = 0x78;
var TC_RESET = 0x79; // jshint ignore:line
var TC_BLOCKDATALONG = 0x7A; // jshint ignore:line
var TC_EXCEPTION = 0x7B; // jshint ignore:line
var TC_LONGSTRING = 0x7C; // jshint ignore:line
var TC_PROXYCLASSDESC = 0x7D; // jshint ignore:line
var TC_ENUM = 0x7E; // jshint ignore:line

var BASE_HANDLE = 0x7E0000;

var JavaDeserializer = (function () {
  function JavaDeserializer(arraybuf) {
    _classCallCheck(this, JavaDeserializer);

    this.buffer = arraybuf;
    this.stream = new _streamReader2['default'](arraybuf);
    this.repr = null;
    this.refs = [];
    this._checkMagic();
  }

  _createClass(JavaDeserializer, [{
    key: '_checkMagic',
    value: function _checkMagic() {
      if (this.stream.readUint16() !== STREAM_MAGIC) {
        throw 'invalid magic number!';
      }
      if (this.stream.readUint16() !== STREAM_VERSION) {
        throw 'invalid version!';
      }
    }
  }, {
    key: '_readClassDescription',
    value: function _readClassDescription() {
      var primitives = 'BCDFIJSZ';
      var type = this.stream.readUint8();
      var description = {};
      if (type === TC_NULL) {
        return;
      } else if (type === TC_REFERENCE) {
        var handle = this.stream.readUint32() - BASE_HANDLE;
        return this.refs[handle];
      } else if (type !== TC_CLASSDESC) {
        console.log('I don\'t know how to handle this type yet: ' + type); // jshint ignore:line
        return;
      }
      description.name = this.stream.readUtf8String();
      description.versionId = [this.stream.readUint32(), this.stream.readUint32()];
      description.handle = this.refs.length;
      description.flags = this.stream.readUint8();
      var fields = [];
      var num = this.stream.readUint16();
      for (var i = 0; i < num; i++) {
        var field = {};
        field.type = this.stream.readUint8();
        field.name = this.stream.readUtf8String();
        if (primitives.indexOf(String.fromCharCode(field.type)) === -1) {
          // not a primitive, what do.
          console.log('this is not a primitive type: ' + field.type); // jshint ignore:line
        }
        fields.push(field);
      }
      description.fields = fields;
      description.annotation = this.stream.readUint8();
      if (description.annotation !== TC_ENDBLOCKDATA) {
        console.log('I don\'t know what to do with this: ' + description.annotation); // jshint ignore:line
      }
      description.superClass = this._readClassDescription();
      this.refs.push(description);
      return description;
    }
  }, {
    key: '_readArray',
    value: function _readArray() {
      var content = {};
      var desc = this._readClassDescription(),
          i,
          length;
      content.description = desc;
      // for some reason this doesn't seem to be getting this.
      content.handle = this.refs.length;
      length = this.stream.readUint32();
      var name = desc.name;
      // haha what the fuck is this shit.
      // Spec, does you follow it?
      if (name === '[F') {
        content.elements = this.stream.readFloat32Array(length);
      } else if (name === '[S') {
        content.elements = this.stream.readUint16Array(length);
      } else // this is an array of classes of some kind?
        {
          content.elements = [];
          for (i = 0; i < length; i++) {
            var t = this._readChunk();
            content.elements.push(t);
          }
        }
      // nope.avi
      this.refs.push(content);
      return content;
    }
  }, {
    key: '_readBlockData',
    value: function _readBlockData() {
      var length = this.stream.readUint8();
      return this.stream.readUint8Array(length);
    }
  }, {
    key: '_readChunk',
    value: function _readChunk() {
      var type = this.stream.readUint8();
      var content = null;
      switch (type) {
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
  }, {
    key: 'getContents',
    value: function getContents() {
      if (this.repr) {
        return this.repr;
      }

      this.repr = [];

      while (this.stream.getPosition() < this.stream.getLength()) {
        this.repr.push(this._readChunk());
      }

      return this.repr;
    }
  }]);

  return JavaDeserializer;
})();

JavaDeserializer.VERSION = '0.2.0';

exports['default'] = JavaDeserializer;

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
module.exports = exports['default'];
},{"./stream-reader":2}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var StreamReader = (function () {
  function StreamReader(buffer) {
    _classCallCheck(this, StreamReader);

    this.buffer = buffer;
    this.dataview = new DataView(buffer);
    this.currentOffset = 0;
  }

  _createClass(StreamReader, [{
    key: 'getLength',
    value: function getLength() {
      return this.dataview.byteLength;
    }
  }, {
    key: 'getPosition',
    value: function getPosition() {
      return this.currentOffset;
    }
  }, {
    key: 'readUint32',
    value: function readUint32() {
      var val = this.dataview.getUint32(this.currentOffset);
      this.currentOffset += 4;
      return val;
    }
  }, {
    key: 'readUint16',
    value: function readUint16() {
      var val = this.dataview.getUint16(this.currentOffset);
      this.currentOffset += 2;
      return val;
    }
  }, {
    key: 'readUint8',
    value: function readUint8() {
      var val = this.dataview.getUint8(this.currentOffset);
      this.currentOffset++;
      return val;
    }
  }, {
    key: 'readInt32',
    value: function readInt32() {
      var val = this.dataview.getInt32(this.currentOffset);
      this.currentOffset += 4;
      return val;
    }
  }, {
    key: 'readInt16',
    value: function readInt16() {
      var val = this.dataview.getInt16(this.currentOffset);
      this.currentOffset += 2;
      return val;
    }
  }, {
    key: 'readInt8',
    value: function readInt8() {
      var val = this.dataview.getInt8(this.currentOffset);
      this.currentOffset++;
      return val;
    }
  }, {
    key: 'readFloat32',
    value: function readFloat32() {
      var val = this.dataview.getFloat32(this.currentOffset);
      this.currentOffset += 4;
      return val;
    }
  }, {
    key: 'readUtf8String',
    value: function readUtf8String() {
      var length = this.readUint16();
      var str = '';
      for (var i = 0; i < length; i++) {
        // TODO: Replace this with a proper utf8 reader.
        str += String.fromCharCode(this.readUint8());
      }
      return str;
    }

    // This doesn't really read an array, but just gives a typed array
    // which has access to the underlying buffer
  }, {
    key: 'readFloat32Array',
    value: function readFloat32Array(length) {
      var arr = new Float32Array(length);
      for (var i = 0; i < length; i++) {
        arr[i] = this.readFloat32();
      }
      return arr;
    }
  }, {
    key: 'readUint16Array',
    value: function readUint16Array(length) {
      var arr = new Uint16Array(length);
      for (var i = 0; i < length; i++) {
        arr[i] = this.readUint16();
      }
      return arr;
    }
  }, {
    key: 'readUint8Array',
    value: function readUint8Array(length) {
      var arr = new Uint8Array(this.buffer, this.currentOffset, length);
      this.currentOffset += length;
      return arr;
    }
  }]);

  return StreamReader;
})();

exports['default'] = StreamReader;
module.exports = exports['default'];
},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvamF2YS1kZXNlcmlhbGl6ZXIuanMiLCJzcmMvc3RyZWFtLXJlYWRlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHtcbiAgdmFsdWU6IHRydWVcbn0pO1xuXG52YXIgX2NyZWF0ZUNsYXNzID0gKGZ1bmN0aW9uICgpIHsgZnVuY3Rpb24gZGVmaW5lUHJvcGVydGllcyh0YXJnZXQsIHByb3BzKSB7IGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcHMubGVuZ3RoOyBpKyspIHsgdmFyIGRlc2NyaXB0b3IgPSBwcm9wc1tpXTsgZGVzY3JpcHRvci5lbnVtZXJhYmxlID0gZGVzY3JpcHRvci5lbnVtZXJhYmxlIHx8IGZhbHNlOyBkZXNjcmlwdG9yLmNvbmZpZ3VyYWJsZSA9IHRydWU7IGlmICgndmFsdWUnIGluIGRlc2NyaXB0b3IpIGRlc2NyaXB0b3Iud3JpdGFibGUgPSB0cnVlOyBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBkZXNjcmlwdG9yLmtleSwgZGVzY3JpcHRvcik7IH0gfSByZXR1cm4gZnVuY3Rpb24gKENvbnN0cnVjdG9yLCBwcm90b1Byb3BzLCBzdGF0aWNQcm9wcykgeyBpZiAocHJvdG9Qcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvci5wcm90b3R5cGUsIHByb3RvUHJvcHMpOyBpZiAoc3RhdGljUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IsIHN0YXRpY1Byb3BzKTsgcmV0dXJuIENvbnN0cnVjdG9yOyB9OyB9KSgpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyAnZGVmYXVsdCc6IG9iaiB9OyB9XG5cbmZ1bmN0aW9uIF9jbGFzc0NhbGxDaGVjayhpbnN0YW5jZSwgQ29uc3RydWN0b3IpIHsgaWYgKCEoaW5zdGFuY2UgaW5zdGFuY2VvZiBDb25zdHJ1Y3RvcikpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcignQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uJyk7IH0gfVxuXG52YXIgX3N0cmVhbVJlYWRlciA9IHJlcXVpcmUoJy4vc3RyZWFtLXJlYWRlcicpO1xuXG52YXIgX3N0cmVhbVJlYWRlcjIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9zdHJlYW1SZWFkZXIpO1xuXG4vLyBNYWdpYyBudW1iZXJzXG52YXIgU1RSRUFNX01BR0lDID0gMHhhY2VkO1xudmFyIFNUUkVBTV9WRVJTSU9OID0gMHgwMDA1O1xuXG4vLyBUeXBlIGNvbnN0YW50cyAoaWdub3JlIGJlY2F1c2UgdW5kZWYpXG52YXIgVENfTlVMTCA9IDB4NzA7XG52YXIgVENfUkVGRVJFTkNFID0gMHg3MTtcbnZhciBUQ19DTEFTU0RFU0MgPSAweDcyO1xudmFyIFRDX09CSkVDVCA9IDB4NzM7IC8vIGpzaGludCBpZ25vcmU6bGluZVxudmFyIFRDX1NUUklORyA9IDB4NzQ7XG52YXIgVENfQVJSQVkgPSAweDc1O1xudmFyIFRDX0NMQVNTID0gMHg3NjsgLy8ganNoaW50IGlnbm9yZTpsaW5lXG52YXIgVENfQkxPQ0tEQVRBID0gMHg3NztcbnZhciBUQ19FTkRCTE9DS0RBVEEgPSAweDc4O1xudmFyIFRDX1JFU0VUID0gMHg3OTsgLy8ganNoaW50IGlnbm9yZTpsaW5lXG52YXIgVENfQkxPQ0tEQVRBTE9ORyA9IDB4N0E7IC8vIGpzaGludCBpZ25vcmU6bGluZVxudmFyIFRDX0VYQ0VQVElPTiA9IDB4N0I7IC8vIGpzaGludCBpZ25vcmU6bGluZVxudmFyIFRDX0xPTkdTVFJJTkcgPSAweDdDOyAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbnZhciBUQ19QUk9YWUNMQVNTREVTQyA9IDB4N0Q7IC8vIGpzaGludCBpZ25vcmU6bGluZVxudmFyIFRDX0VOVU0gPSAweDdFOyAvLyBqc2hpbnQgaWdub3JlOmxpbmVcblxudmFyIEJBU0VfSEFORExFID0gMHg3RTAwMDA7XG5cbnZhciBKYXZhRGVzZXJpYWxpemVyID0gKGZ1bmN0aW9uICgpIHtcbiAgZnVuY3Rpb24gSmF2YURlc2VyaWFsaXplcihhcnJheWJ1Zikge1xuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBKYXZhRGVzZXJpYWxpemVyKTtcblxuICAgIHRoaXMuYnVmZmVyID0gYXJyYXlidWY7XG4gICAgdGhpcy5zdHJlYW0gPSBuZXcgX3N0cmVhbVJlYWRlcjJbJ2RlZmF1bHQnXShhcnJheWJ1Zik7XG4gICAgdGhpcy5yZXByID0gbnVsbDtcbiAgICB0aGlzLnJlZnMgPSBbXTtcbiAgICB0aGlzLl9jaGVja01hZ2ljKCk7XG4gIH1cblxuICBfY3JlYXRlQ2xhc3MoSmF2YURlc2VyaWFsaXplciwgW3tcbiAgICBrZXk6ICdfY2hlY2tNYWdpYycsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIF9jaGVja01hZ2ljKCkge1xuICAgICAgaWYgKHRoaXMuc3RyZWFtLnJlYWRVaW50MTYoKSAhPT0gU1RSRUFNX01BR0lDKSB7XG4gICAgICAgIHRocm93ICdpbnZhbGlkIG1hZ2ljIG51bWJlciEnO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuc3RyZWFtLnJlYWRVaW50MTYoKSAhPT0gU1RSRUFNX1ZFUlNJT04pIHtcbiAgICAgICAgdGhyb3cgJ2ludmFsaWQgdmVyc2lvbiEnO1xuICAgICAgfVxuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ19yZWFkQ2xhc3NEZXNjcmlwdGlvbicsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIF9yZWFkQ2xhc3NEZXNjcmlwdGlvbigpIHtcbiAgICAgIHZhciBwcmltaXRpdmVzID0gJ0JDREZJSlNaJztcbiAgICAgIHZhciB0eXBlID0gdGhpcy5zdHJlYW0ucmVhZFVpbnQ4KCk7XG4gICAgICB2YXIgZGVzY3JpcHRpb24gPSB7fTtcbiAgICAgIGlmICh0eXBlID09PSBUQ19OVUxMKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gVENfUkVGRVJFTkNFKSB7XG4gICAgICAgIHZhciBoYW5kbGUgPSB0aGlzLnN0cmVhbS5yZWFkVWludDMyKCkgLSBCQVNFX0hBTkRMRTtcbiAgICAgICAgcmV0dXJuIHRoaXMucmVmc1toYW5kbGVdO1xuICAgICAgfSBlbHNlIGlmICh0eXBlICE9PSBUQ19DTEFTU0RFU0MpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ0kgZG9uXFwndCBrbm93IGhvdyB0byBoYW5kbGUgdGhpcyB0eXBlIHlldDogJyArIHR5cGUpOyAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgZGVzY3JpcHRpb24ubmFtZSA9IHRoaXMuc3RyZWFtLnJlYWRVdGY4U3RyaW5nKCk7XG4gICAgICBkZXNjcmlwdGlvbi52ZXJzaW9uSWQgPSBbdGhpcy5zdHJlYW0ucmVhZFVpbnQzMigpLCB0aGlzLnN0cmVhbS5yZWFkVWludDMyKCldO1xuICAgICAgZGVzY3JpcHRpb24uaGFuZGxlID0gdGhpcy5yZWZzLmxlbmd0aDtcbiAgICAgIGRlc2NyaXB0aW9uLmZsYWdzID0gdGhpcy5zdHJlYW0ucmVhZFVpbnQ4KCk7XG4gICAgICB2YXIgZmllbGRzID0gW107XG4gICAgICB2YXIgbnVtID0gdGhpcy5zdHJlYW0ucmVhZFVpbnQxNigpO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBudW07IGkrKykge1xuICAgICAgICB2YXIgZmllbGQgPSB7fTtcbiAgICAgICAgZmllbGQudHlwZSA9IHRoaXMuc3RyZWFtLnJlYWRVaW50OCgpO1xuICAgICAgICBmaWVsZC5uYW1lID0gdGhpcy5zdHJlYW0ucmVhZFV0ZjhTdHJpbmcoKTtcbiAgICAgICAgaWYgKHByaW1pdGl2ZXMuaW5kZXhPZihTdHJpbmcuZnJvbUNoYXJDb2RlKGZpZWxkLnR5cGUpKSA9PT0gLTEpIHtcbiAgICAgICAgICAvLyBub3QgYSBwcmltaXRpdmUsIHdoYXQgZG8uXG4gICAgICAgICAgY29uc29sZS5sb2coJ3RoaXMgaXMgbm90IGEgcHJpbWl0aXZlIHR5cGU6ICcgKyBmaWVsZC50eXBlKTsgLy8ganNoaW50IGlnbm9yZTpsaW5lXG4gICAgICAgIH1cbiAgICAgICAgZmllbGRzLnB1c2goZmllbGQpO1xuICAgICAgfVxuICAgICAgZGVzY3JpcHRpb24uZmllbGRzID0gZmllbGRzO1xuICAgICAgZGVzY3JpcHRpb24uYW5ub3RhdGlvbiA9IHRoaXMuc3RyZWFtLnJlYWRVaW50OCgpO1xuICAgICAgaWYgKGRlc2NyaXB0aW9uLmFubm90YXRpb24gIT09IFRDX0VOREJMT0NLREFUQSkge1xuICAgICAgICBjb25zb2xlLmxvZygnSSBkb25cXCd0IGtub3cgd2hhdCB0byBkbyB3aXRoIHRoaXM6ICcgKyBkZXNjcmlwdGlvbi5hbm5vdGF0aW9uKTsgLy8ganNoaW50IGlnbm9yZTpsaW5lXG4gICAgICB9XG4gICAgICBkZXNjcmlwdGlvbi5zdXBlckNsYXNzID0gdGhpcy5fcmVhZENsYXNzRGVzY3JpcHRpb24oKTtcbiAgICAgIHRoaXMucmVmcy5wdXNoKGRlc2NyaXB0aW9uKTtcbiAgICAgIHJldHVybiBkZXNjcmlwdGlvbjtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdfcmVhZEFycmF5JyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gX3JlYWRBcnJheSgpIHtcbiAgICAgIHZhciBjb250ZW50ID0ge307XG4gICAgICB2YXIgZGVzYyA9IHRoaXMuX3JlYWRDbGFzc0Rlc2NyaXB0aW9uKCksXG4gICAgICAgICAgaSxcbiAgICAgICAgICBsZW5ndGg7XG4gICAgICBjb250ZW50LmRlc2NyaXB0aW9uID0gZGVzYztcbiAgICAgIC8vIGZvciBzb21lIHJlYXNvbiB0aGlzIGRvZXNuJ3Qgc2VlbSB0byBiZSBnZXR0aW5nIHRoaXMuXG4gICAgICBjb250ZW50LmhhbmRsZSA9IHRoaXMucmVmcy5sZW5ndGg7XG4gICAgICBsZW5ndGggPSB0aGlzLnN0cmVhbS5yZWFkVWludDMyKCk7XG4gICAgICB2YXIgbmFtZSA9IGRlc2MubmFtZTtcbiAgICAgIC8vIGhhaGEgd2hhdCB0aGUgZnVjayBpcyB0aGlzIHNoaXQuXG4gICAgICAvLyBTcGVjLCBkb2VzIHlvdSBmb2xsb3cgaXQ/XG4gICAgICBpZiAobmFtZSA9PT0gJ1tGJykge1xuICAgICAgICBjb250ZW50LmVsZW1lbnRzID0gdGhpcy5zdHJlYW0ucmVhZEZsb2F0MzJBcnJheShsZW5ndGgpO1xuICAgICAgfSBlbHNlIGlmIChuYW1lID09PSAnW1MnKSB7XG4gICAgICAgIGNvbnRlbnQuZWxlbWVudHMgPSB0aGlzLnN0cmVhbS5yZWFkVWludDE2QXJyYXkobGVuZ3RoKTtcbiAgICAgIH0gZWxzZSAvLyB0aGlzIGlzIGFuIGFycmF5IG9mIGNsYXNzZXMgb2Ygc29tZSBraW5kP1xuICAgICAgICB7XG4gICAgICAgICAgY29udGVudC5lbGVtZW50cyA9IFtdO1xuICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIHQgPSB0aGlzLl9yZWFkQ2h1bmsoKTtcbiAgICAgICAgICAgIGNvbnRlbnQuZWxlbWVudHMucHVzaCh0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIC8vIG5vcGUuYXZpXG4gICAgICB0aGlzLnJlZnMucHVzaChjb250ZW50KTtcbiAgICAgIHJldHVybiBjb250ZW50O1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ19yZWFkQmxvY2tEYXRhJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gX3JlYWRCbG9ja0RhdGEoKSB7XG4gICAgICB2YXIgbGVuZ3RoID0gdGhpcy5zdHJlYW0ucmVhZFVpbnQ4KCk7XG4gICAgICByZXR1cm4gdGhpcy5zdHJlYW0ucmVhZFVpbnQ4QXJyYXkobGVuZ3RoKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdfcmVhZENodW5rJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gX3JlYWRDaHVuaygpIHtcbiAgICAgIHZhciB0eXBlID0gdGhpcy5zdHJlYW0ucmVhZFVpbnQ4KCk7XG4gICAgICB2YXIgY29udGVudCA9IG51bGw7XG4gICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgY2FzZSBUQ19BUlJBWTpcbiAgICAgICAgICBjb250ZW50ID0gdGhpcy5fcmVhZEFycmF5KCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgVENfQkxPQ0tEQVRBOlxuICAgICAgICAgIGNvbnRlbnQgPSB0aGlzLl9yZWFkQmxvY2tEYXRhKCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgVENfU1RSSU5HOlxuICAgICAgICAgIGNvbnRlbnQgPSB0aGlzLnN0cmVhbS5yZWFkVXRmOFN0cmluZygpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGNvbnNvbGUubG9nKCd1bmhhbmRsZWQgdHlwZScpOyAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbiAgICAgIH1cbiAgICAgIHJldHVybiBjb250ZW50O1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2dldENvbnRlbnRzJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gZ2V0Q29udGVudHMoKSB7XG4gICAgICBpZiAodGhpcy5yZXByKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJlcHI7XG4gICAgICB9XG5cbiAgICAgIHRoaXMucmVwciA9IFtdO1xuXG4gICAgICB3aGlsZSAodGhpcy5zdHJlYW0uZ2V0UG9zaXRpb24oKSA8IHRoaXMuc3RyZWFtLmdldExlbmd0aCgpKSB7XG4gICAgICAgIHRoaXMucmVwci5wdXNoKHRoaXMuX3JlYWRDaHVuaygpKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRoaXMucmVwcjtcbiAgICB9XG4gIH1dKTtcblxuICByZXR1cm4gSmF2YURlc2VyaWFsaXplcjtcbn0pKCk7XG5cbkphdmFEZXNlcmlhbGl6ZXIuVkVSU0lPTiA9ICcwLjIuMCc7XG5cbmV4cG9ydHNbJ2RlZmF1bHQnXSA9IEphdmFEZXNlcmlhbGl6ZXI7XG5cbi8qdmFyIEphdmFEZXNlcmlhbGl6ZXIgPSAoZnVuY3Rpb24oKVxue1xuICB2YXIgSW5oZXJpdHMgPSBmdW5jdGlvbiAoYSwgYilcbiAge1xuICAgIHZhciBjID0gZnVuY3Rpb24gKClcbiAgICB7XG4gICAgfTtcbiAgICBjLnByb3RvdHlwZSA9IGIucHJvdG90eXBlO1xuICAgIGEuc3VwZXJDbGFzc18gPSBiLnByb3RvdHlwZTtcbiAgICBhLnByb3RvdHlwZSA9IG5ldyBjO1xuICAgIGEucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gYVxuICB9O1xuXG4gIGlmICghQXJyYXlCdWZmZXIucHJvdG90eXBlLnNsaWNlKVxuICB7XG4gICAgQXJyYXlCdWZmZXIucHJvdG90eXBlLnNsaWNlID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQpXG4gICAge1xuICAgICAgdmFyIHRoYXQgPSBuZXcgVWludDhBcnJheSh0aGlzKTtcbiAgICAgIGlmIChlbmQgPT0gdW5kZWZpbmVkKSBlbmQgPSB0aGF0Lmxlbmd0aDtcbiAgICAgIHZhciByZXN1bHQgPSBuZXcgQXJyYXlCdWZmZXIoZW5kIC0gc3RhcnQpO1xuICAgICAgdmFyIHJlc3VsdEFycmF5ID0gbmV3IFVpbnQ4QXJyYXkocmVzdWx0KTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzdWx0QXJyYXkubGVuZ3RoOyBpKyspXG4gICAgICAgIHJlc3VsdEFycmF5W2ldID0gdGhhdFtpICsgc3RhcnRdO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuICB9XG5cbiAgdmFyIFNUUkVBTV9NQUdJQyA9IDB4YWNlZCxcbiAgICBTVFJFQU1fVkVSU0lPTiA9IDB4MDAwNSxcbiAgICBUQ19OVUxMID0gMHg3MCxcbiAgICBUQ19SRUZFUkVOQ0UgPSAweDcxLFxuICAgIFRDX0NMQVNTREVTQyA9IDB4NzIsXG4gICAgVENfT0JKRUNUID0gMHg3MyxcbiAgICBUQ19TVFJJTkcgPSAweDc0LFxuICAgIFRDX0FSUkFZID0gMHg3NSxcbiAgICBUQ19DTEFTUyA9IDB4NzYsXG4gICAgVENfQkxPQ0tEQVRBID0gMHg3NyxcbiAgICBUQ19FTkRCTE9DS0RBVEEgPSAweDc4LFxuICAgIFRDX1JFU0VUID0gMHg3OSxcbiAgICBUQ19CTE9DS0RBVEFMT05HID0gMHg3QSxcbiAgICBUQ19FWENFUFRJT04gPSAweDdCLFxuICAgIFRDX0xPTkdTVFJJTkcgPSAweDdDLFxuICAgIFRDX1BST1hZQ0xBU1NERVNDID0gMHg3RCxcbiAgICBUQ19FTlVNID0gMHg3RSxcbiAgICBiYXNlV2lyZUhhbmRsZSA9IDB4N0UwMDAwLFxuICAgIFNDX1dSSVRFX01FVEhPRCA9IDB4MDEsXG4gICAgU0NfQkxPQ0tfREFUQSA9IDB4MDgsXG4gICAgU0NfU0VSSUFMSVpBQkxFID0gMHgwMixcbiAgICBTQ19FWFRFUk5BTElaQUJMRSA9IDB4MDQsXG4gICAgU0NfRU5VTSA9IDB4MTA7XG5cbiAgLy8gbmVlZCB0byBwcm9wZXJseSBuYW1lc3BhY2UgdGhpcyB0aGluZ1xuICAvLyBJIHdvdWxkIHRoaW5rIHRoaXMgd291bGQgYnJlYWsgd2hlbiBhdHRlbXB0aW5nIHRvIGRlc2VyaWFsaXplIG11bHRpcGxlXG4gIC8vIG9iamVjdHMuXG4gIHZhciBwcmV2aW91c0Rlc2MgPSBbXTtcblxuICB2YXIgY2xhc3NEZXNjID0gZnVuY3Rpb24gKGRhdGF2aWV3LCBvZmZzZXQpXG4gIHtcbiAgICB2YXIgcHJpbWl0aXZlcyA9ICdCQ0RGSUpTWic7XG4gICAgU3RyZWFtQ2h1bmsuY2FsbCh0aGlzLCBkYXRhdmlldywgb2Zmc2V0LCAnY2xhc3NEZXNjJyk7XG4gICAgdmFyIHR5cGUgPSB0aGlzLnJlYWRVaW50OCgpO1xuICAgIGlmICh0eXBlID09PSBUQ19OVUxMKVxuICAgIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZSA9PT0gVENfUkVGRVJFTkNFKVxuICAgIHtcbiAgICAgIHZhciBoYW5kbGUgPSB0aGlzLnJlYWRVaW50MzIoKSAtIGJhc2VXaXJlSGFuZGxlO1xuICAgICAgdGhpcy5jb250ZW50cyA9IHByZXZpb3VzRGVzY1toYW5kbGVdLmNvbnRlbnRzO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlICE9PSBUQ19DTEFTU0RFU0MpXG4gICAge1xuICAgICAgY29uc29sZS5sb2coJ0kgZG9uXFwndCBrbm93IGhvdyB0byBoYW5kbGUgdGhpcyB0eXBlIHlldDogJyArIHR5cGUpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgbmFtZSA9IG5ldyB1dGZTdHIodGhpcy5kYXRhdmlldywgdGhpcy5jdXJyZW50T2Zmc2V0KTtcbiAgICB0aGlzLmN1cnJlbnRPZmZzZXQgKz0gbmFtZS5nZXRMZW5ndGgoKTtcbiAgICB0aGlzLmNvbnRlbnRzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMuY29udGVudHMudmVyc2lvbklkID0gW3RoaXMucmVhZFVpbnQzMigpLCB0aGlzLnJlYWRVaW50MzIoKV07XG4gICAgdGhpcy5jb250ZW50cy5oYW5kbGUgPSBwcmV2aW91c0Rlc2MubGVuZ3RoO1xuICAgIHRoaXMuY29udGVudHMuZmxhZ3MgPSB0aGlzLnJlYWRVaW50OCgpO1xuICAgIHZhciBmaWVsZHMgPSBbXTtcbiAgICB2YXIgbnVtID0gdGhpcy5yZWFkVWludDE2KCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBudW07IGkrKylcbiAgICB7XG4gICAgICB2YXIgZmllbGQgPSB7fTtcbiAgICAgIGZpZWxkLnR5cGUgPSB0aGlzLnJlYWRVaW50OCgpO1xuICAgICAgZmllbGQubmFtZSA9IG5ldyB1dGZTdHIodGhpcy5kYXRhdmlldywgdGhpcy5jdXJyZW50T2Zmc2V0KTtcbiAgICAgIHRoaXMuY3VycmVudE9mZnNldCArPSBmaWVsZC5uYW1lLmdldExlbmd0aCgpO1xuICAgICAgaWYgKHByaW1pdGl2ZXMuaW5kZXhPZihTdHJpbmcuZnJvbUNoYXJDb2RlKGZpZWxkLnR5cGUpKSA9PT0gLTEpXG4gICAgICB7XG4gICAgICAgIC8vIG5vdCBhIHByaW1pdGl2ZSwgd2hhdCBkby5cbiAgICAgICAgY29uc29sZS5sb2coJ3RoaXMgaXMgbm90IGEgcHJpbWl0aXZlIHR5cGU6ICcgKyBmaWVsZC50eXBlKTtcbiAgICAgIH1cbiAgICAgIGZpZWxkcy5wdXNoKGZpZWxkKTtcbiAgICB9XG4gICAgdGhpcy5jb250ZW50cy5maWVsZHMgPSBmaWVsZHM7XG4gICAgdGhpcy5jb250ZW50cy5hbm5vdGF0aW9uID0gdGhpcy5yZWFkVWludDgoKTtcbiAgICBpZiAodGhpcy5jb250ZW50cy5hbm5vdGF0aW9uICE9PSBUQ19FTkRCTE9DS0RBVEEpXG4gICAge1xuICAgICAgY29uc29sZS5sb2coJ0kgZG9uXFwndCBrbm93IHdoYXQgdG8gZG8gd2l0aCB0aGlzOiAnICsgdGhpcy5jb250ZW50cy5hbm5vdGF0aW9uKTtcbiAgICB9XG4gICAgdGhpcy5jb250ZW50cy5zdXBlckNsYXNzID0gbmV3IGNsYXNzRGVzYyh0aGlzLmRhdGF2aWV3LCB0aGlzLmN1cnJlbnRPZmZzZXQpO1xuICAgIHRoaXMuY3VycmVudE9mZnNldCArPSB0aGlzLmNvbnRlbnRzLnN1cGVyQ2xhc3MuZ2V0TGVuZ3RoKCk7XG4gICAgcHJldmlvdXNEZXNjLnB1c2godGhpcyk7XG4gIH07XG4gIEluaGVyaXRzKGNsYXNzRGVzYywgU3RyZWFtQ2h1bmspO1xuXG4gIGNsYXNzRGVzYy5wcm90b3R5cGUuZ2V0U2l6ZSA9IGZ1bmN0aW9uICgpXG4gIHtcbiAgICAvLyB3ZSBkb24ndCByZWFsbHkgaGFuZGxlIHRoaXMgeWV0LlxuICAgIHJldHVybiA0O1xuICB9O1xuXG4gIHZhciBqQXJyYXkgPSBmdW5jdGlvbiAoZGF0YXZpZXcsIG9mZnNldClcbiAge1xuICAgIFN0cmVhbUNodW5rLmNhbGwodGhpcywgZGF0YXZpZXcsIG9mZnNldCwgJ2pBcnJheScpO1xuICAgIHZhciBkZXNjID0gbmV3IGNsYXNzRGVzYyhkYXRhdmlldywgdGhpcy5jdXJyZW50T2Zmc2V0KSwgaTtcbiAgICB0aGlzLmNvbnRlbnRzLmRlc2NyaXB0aW9uID0gZGVzYztcbiAgICB0aGlzLmN1cnJlbnRPZmZzZXQgKz0gZGVzYy5nZXRMZW5ndGgoKTtcbiAgICAvLyBmb3Igc29tZSByZWFzb24gdGhpcyBkb2Vzbid0IHNlZW0gdG8gYmUgZ2V0dGluZyB0aGlzLlxuICAgIHRoaXMuY29udGVudHMuaGFuZGxlID0gcHJldmlvdXNEZXNjLmxlbmd0aDtcbiAgICB0aGlzLmNvbnRlbnRzLnNpemUgPSB0aGlzLnJlYWRVaW50MzIoKTtcbiAgICB0aGlzLmNvbnRlbnRzLmVsZW1lbnRzID0gW107XG4gICAgdmFyIG5hbWUgPSBkZXNjLmNvbnRlbnRzLm5hbWUgJiYgZGVzYy5jb250ZW50cy5uYW1lLmNvbnRlbnRzLnN0cjtcbiAgICAvLyBoYWhhIHdoYXQgdGhlIGZ1Y2sgaXMgdGhpcyBzaGl0LlxuICAgIC8vIFNwZWMsIGRvZXMgeW91IGZvbGxvdyBpdD9cbiAgICBpZiAobmFtZSA9PT0gJ1tGJylcbiAgICB7XG4gICAgICB0aGlzLmNvbnRlbnRzLmVsZW1lbnRzID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLmNvbnRlbnRzLnNpemUpO1xuICAgICAgZm9yIChpID0gMDsgaSA8IHRoaXMuY29udGVudHMuc2l6ZTsgaSsrKVxuICAgICAge1xuICAgICAgICB0aGlzLmNvbnRlbnRzLmVsZW1lbnRzW2ldID0gdGhpcy5yZWFkRmxvYXQzMigpO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIGlmIChuYW1lID09PSAnW1MnKVxuICAgIHtcbiAgICAgIHRoaXMuY29udGVudHMuZWxlbWVudHMgPSBuZXcgVWludDE2QXJyYXkodGhpcy5jb250ZW50cy5zaXplKTtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLmNvbnRlbnRzLnNpemU7IGkrKylcbiAgICAgIHtcbiAgICAgICAgdGhpcy5jb250ZW50cy5lbGVtZW50c1tpXSA9IHRoaXMucmVhZEludDE2KCk7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICB0aGlzLmNvbnRlbnRzLmVsZW1lbnRzID0gW107XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5jb250ZW50cy5zaXplOyBpKyspXG4gICAgICB7XG4gICAgICAgIHZhciB0ID0gbmV3IENvbnRlbnRzKHRoaXMuZGF0YXZpZXcsIHRoaXMuY3VycmVudE9mZnNldCk7XG4gICAgICAgIHRoaXMuY3VycmVudE9mZnNldCArPSB0LmdldExlbmd0aCgpO1xuICAgICAgICB0aGlzLmNvbnRlbnRzLmVsZW1lbnRzLnB1c2godCk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIG5vcGUuYXZpXG4gICAgcHJldmlvdXNEZXNjLnB1c2godGhpcyk7XG4gIH07XG4gIEluaGVyaXRzKGpBcnJheSwgU3RyZWFtQ2h1bmspO1xuXG4gIGpBcnJheS5wcm90b3R5cGUudG9BcnJheSA9IGZ1bmN0aW9uICgpXG4gIHtcbiAgICByZXR1cm4gdGhpcy5jb250ZW50cyAmJiB0aGlzLmNvbnRlbnRzLmVsZW1lbnRzIHx8IG51bGw7XG4gIH07XG5cbiAgdmFyIGJsb2NrRGF0YSA9IGZ1bmN0aW9uIChkYXRhdmlldywgb2Zmc2V0KVxuICB7XG4gICAgU3RyZWFtQ2h1bmsuY2FsbCh0aGlzLCBkYXRhdmlldywgb2Zmc2V0LCAnYmxvY2tEYXRhJyk7XG4gICAgdmFyIHNpemUgPSB0aGlzLnJlYWRVaW50OCgpO1xuICAgIHZhciBibG9ja3MgPSBuZXcgQXJyYXlCdWZmZXIoc2l6ZSk7XG4gICAgdmFyIHQgPSBuZXcgVWludDhBcnJheShibG9ja3MpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2l6ZTsgaSsrKVxuICAgIHtcbiAgICAgIHRbaV0gPSB0aGlzLnJlYWRVaW50OCgpO1xuICAgIH1cbiAgICB0aGlzLmNvbnRlbnRzLnNpemUgPSBzaXplO1xuICAgIHRoaXMuY29udGVudHMuYmxvY2tzID0gYmxvY2tzO1xuICB9O1xuICBJbmhlcml0cyhibG9ja0RhdGEsIFN0cmVhbUNodW5rKTtcblxuICBibG9ja0RhdGEucHJvdG90eXBlLnRvQXJyYXkgPSBmdW5jdGlvbiAoKVxuICB7XG4gICAgcmV0dXJuIHRoaXMuY29udGVudHMgJiYgdGhpcy5jb250ZW50cy5ibG9ja3MgfHwgbnVsbDtcbiAgfTtcblxuICB2YXIgQ29udGVudHMgPSBmdW5jdGlvbiAoZGF0YXZpZXcsIG9mZnNldClcbiAge1xuICAgIFN0cmVhbUNodW5rLmNhbGwodGhpcywgZGF0YXZpZXcsIG9mZnNldCwgJ0NvbnRlbnRzJyk7XG4gICAgdmFyIHR5cGUgPSB0aGlzLnJlYWRVaW50OCgpO1xuICAgIHZhciBjb250ZW50ID0gbnVsbDtcbiAgICBzd2l0Y2ggKHR5cGUpXG4gICAge1xuICAgICAgY2FzZSBUQ19BUlJBWTpcbiAgICAgICAgY29udGVudCA9IG5ldyBqQXJyYXkodGhpcy5kYXRhdmlldywgdGhpcy5jdXJyZW50T2Zmc2V0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFRDX0JMT0NLREFUQTpcbiAgICAgICAgY29udGVudCA9IG5ldyBibG9ja0RhdGEodGhpcy5kYXRhdmlldywgdGhpcy5jdXJyZW50T2Zmc2V0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFRDX1NUUklORzpcbiAgICAgICAgY29udGVudCA9IG5ldyB1dGZTdHIodGhpcy5kYXRhdmlldywgdGhpcy5jdXJyZW50T2Zmc2V0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBjb25zb2xlLmxvZygndW5oYW5kbGVkIHR5cGUnKTtcbiAgICB9XG4gICAgaWYgKGNvbnRlbnQpXG4gICAge1xuICAgICAgdGhpcy5jdXJyZW50T2Zmc2V0ICs9IGNvbnRlbnQuZ2V0TGVuZ3RoKCk7XG4gICAgfVxuICAgIHRoaXMuY29udGVudHMgPSBjb250ZW50O1xuICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gIH07XG4gIEluaGVyaXRzKENvbnRlbnRzLCBTdHJlYW1DaHVuayk7XG5cbiAgdmFyIFN0cmVhbSA9IGZ1bmN0aW9uIChkYXRhdmlldylcbiAge1xuICAgIFN0cmVhbUNodW5rLmNhbGwodGhpcywgZGF0YXZpZXcsIDAsICdTdHJlYW0nKTtcbiAgICBpZiAodGhpcy5yZWFkVWludDE2KCkgIT09IFNUUkVBTV9NQUdJQylcbiAgICB7XG4gICAgICB0aHJvdyAnaW52YWxpZCBtYWdpYyBudW1iZXIhJztcbiAgICB9XG4gICAgaWYgKHRoaXMucmVhZFVpbnQxNigpICE9PSBTVFJFQU1fVkVSU0lPTilcbiAgICB7XG4gICAgICB0aHJvdyAnaW52YWxpZCB2ZXJzaW9uISc7XG4gICAgfVxuICAgIHRoaXMuY29udGVudHMgPSBudWxsO1xuICB9O1xuICBJbmhlcml0cyhTdHJlYW0sIFN0cmVhbUNodW5rKTtcblxuICBTdHJlYW0ucHJvdG90eXBlLmdldENvbnRlbnRzID0gZnVuY3Rpb24gKClcbiAge1xuICAgIGlmICghdGhpcy5jb250ZW50cylcbiAgICB7XG4gICAgICB0aGlzLmNvbnRlbnRzID0gW107XG4gICAgICB3aGlsZSAodGhpcy5jdXJyZW50T2Zmc2V0IDwgdGhpcy5kYXRhdmlldy5ieXRlTGVuZ3RoKVxuICAgICAge1xuICAgICAgICB2YXIgY29udGVudHMgPSBuZXcgQ29udGVudHModGhpcy5kYXRhdmlldywgdGhpcy5jdXJyZW50T2Zmc2V0KTtcbiAgICAgICAgdGhpcy5jdXJyZW50T2Zmc2V0ICs9IGNvbnRlbnRzLmdldExlbmd0aCgpO1xuICAgICAgICB0aGlzLmNvbnRlbnRzLnB1c2goY29udGVudHMpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5jb250ZW50cztcbiAgfTtcblxuICAvLyBJIGRvbid0IHF1aXRlIGtub3cgd2hhdCB0aGUgcHVycG9zZSBvZiB0aGlzIGxhc3Qgd3JhcHBlciBpczpcbiAgdmFyIEphdmFEZXNlcmlhbGl6ZXIgPSBmdW5jdGlvbiAoYXJyYXlidWYpXG4gIHtcbiAgICB0aGlzLmJ1ZiA9IGFycmF5YnVmO1xuICB9O1xuXG4gIEphdmFEZXNlcmlhbGl6ZXIucHJvdG90eXBlLmdldFN0cmVhbSA9IGZ1bmN0aW9uICgpXG4gIHtcbiAgICByZXR1cm4gbmV3IFN0cmVhbShuZXcgRGF0YVZpZXcodGhpcy5idWYsIDApKTtcbiAgfTtcblxuICByZXR1cm4gSmF2YURlc2VyaWFsaXplcjtcbn0oKSk7XG5cbkphdmFEZXNlcmlhbGl6ZXIuVkVSU0lPTiA9ICcwLjEuMCc7XG5yb290LkphdmFEZXNlcmlhbGl6ZXIgPSBKYXZhRGVzZXJpYWxpemVyOyovXG5tb2R1bGUuZXhwb3J0cyA9IGV4cG9ydHNbJ2RlZmF1bHQnXTsiLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHtcbiAgdmFsdWU6IHRydWVcbn0pO1xuXG52YXIgX2NyZWF0ZUNsYXNzID0gKGZ1bmN0aW9uICgpIHsgZnVuY3Rpb24gZGVmaW5lUHJvcGVydGllcyh0YXJnZXQsIHByb3BzKSB7IGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcHMubGVuZ3RoOyBpKyspIHsgdmFyIGRlc2NyaXB0b3IgPSBwcm9wc1tpXTsgZGVzY3JpcHRvci5lbnVtZXJhYmxlID0gZGVzY3JpcHRvci5lbnVtZXJhYmxlIHx8IGZhbHNlOyBkZXNjcmlwdG9yLmNvbmZpZ3VyYWJsZSA9IHRydWU7IGlmICgndmFsdWUnIGluIGRlc2NyaXB0b3IpIGRlc2NyaXB0b3Iud3JpdGFibGUgPSB0cnVlOyBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBkZXNjcmlwdG9yLmtleSwgZGVzY3JpcHRvcik7IH0gfSByZXR1cm4gZnVuY3Rpb24gKENvbnN0cnVjdG9yLCBwcm90b1Byb3BzLCBzdGF0aWNQcm9wcykgeyBpZiAocHJvdG9Qcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvci5wcm90b3R5cGUsIHByb3RvUHJvcHMpOyBpZiAoc3RhdGljUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IsIHN0YXRpY1Byb3BzKTsgcmV0dXJuIENvbnN0cnVjdG9yOyB9OyB9KSgpO1xuXG5mdW5jdGlvbiBfY2xhc3NDYWxsQ2hlY2soaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7IGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvbicpOyB9IH1cblxudmFyIFN0cmVhbVJlYWRlciA9IChmdW5jdGlvbiAoKSB7XG4gIGZ1bmN0aW9uIFN0cmVhbVJlYWRlcihidWZmZXIpIHtcbiAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgU3RyZWFtUmVhZGVyKTtcblxuICAgIHRoaXMuYnVmZmVyID0gYnVmZmVyO1xuICAgIHRoaXMuZGF0YXZpZXcgPSBuZXcgRGF0YVZpZXcoYnVmZmVyKTtcbiAgICB0aGlzLmN1cnJlbnRPZmZzZXQgPSAwO1xuICB9XG5cbiAgX2NyZWF0ZUNsYXNzKFN0cmVhbVJlYWRlciwgW3tcbiAgICBrZXk6ICdnZXRMZW5ndGgnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBnZXRMZW5ndGgoKSB7XG4gICAgICByZXR1cm4gdGhpcy5kYXRhdmlldy5ieXRlTGVuZ3RoO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2dldFBvc2l0aW9uJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gZ2V0UG9zaXRpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5jdXJyZW50T2Zmc2V0O1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3JlYWRVaW50MzInLFxuICAgIHZhbHVlOiBmdW5jdGlvbiByZWFkVWludDMyKCkge1xuICAgICAgdmFyIHZhbCA9IHRoaXMuZGF0YXZpZXcuZ2V0VWludDMyKHRoaXMuY3VycmVudE9mZnNldCk7XG4gICAgICB0aGlzLmN1cnJlbnRPZmZzZXQgKz0gNDtcbiAgICAgIHJldHVybiB2YWw7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAncmVhZFVpbnQxNicsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHJlYWRVaW50MTYoKSB7XG4gICAgICB2YXIgdmFsID0gdGhpcy5kYXRhdmlldy5nZXRVaW50MTYodGhpcy5jdXJyZW50T2Zmc2V0KTtcbiAgICAgIHRoaXMuY3VycmVudE9mZnNldCArPSAyO1xuICAgICAgcmV0dXJuIHZhbDtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdyZWFkVWludDgnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiByZWFkVWludDgoKSB7XG4gICAgICB2YXIgdmFsID0gdGhpcy5kYXRhdmlldy5nZXRVaW50OCh0aGlzLmN1cnJlbnRPZmZzZXQpO1xuICAgICAgdGhpcy5jdXJyZW50T2Zmc2V0Kys7XG4gICAgICByZXR1cm4gdmFsO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3JlYWRJbnQzMicsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHJlYWRJbnQzMigpIHtcbiAgICAgIHZhciB2YWwgPSB0aGlzLmRhdGF2aWV3LmdldEludDMyKHRoaXMuY3VycmVudE9mZnNldCk7XG4gICAgICB0aGlzLmN1cnJlbnRPZmZzZXQgKz0gNDtcbiAgICAgIHJldHVybiB2YWw7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAncmVhZEludDE2JyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gcmVhZEludDE2KCkge1xuICAgICAgdmFyIHZhbCA9IHRoaXMuZGF0YXZpZXcuZ2V0SW50MTYodGhpcy5jdXJyZW50T2Zmc2V0KTtcbiAgICAgIHRoaXMuY3VycmVudE9mZnNldCArPSAyO1xuICAgICAgcmV0dXJuIHZhbDtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdyZWFkSW50OCcsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHJlYWRJbnQ4KCkge1xuICAgICAgdmFyIHZhbCA9IHRoaXMuZGF0YXZpZXcuZ2V0SW50OCh0aGlzLmN1cnJlbnRPZmZzZXQpO1xuICAgICAgdGhpcy5jdXJyZW50T2Zmc2V0Kys7XG4gICAgICByZXR1cm4gdmFsO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3JlYWRGbG9hdDMyJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gcmVhZEZsb2F0MzIoKSB7XG4gICAgICB2YXIgdmFsID0gdGhpcy5kYXRhdmlldy5nZXRGbG9hdDMyKHRoaXMuY3VycmVudE9mZnNldCk7XG4gICAgICB0aGlzLmN1cnJlbnRPZmZzZXQgKz0gNDtcbiAgICAgIHJldHVybiB2YWw7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAncmVhZFV0ZjhTdHJpbmcnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiByZWFkVXRmOFN0cmluZygpIHtcbiAgICAgIHZhciBsZW5ndGggPSB0aGlzLnJlYWRVaW50MTYoKTtcbiAgICAgIHZhciBzdHIgPSAnJztcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgLy8gVE9ETzogUmVwbGFjZSB0aGlzIHdpdGggYSBwcm9wZXIgdXRmOCByZWFkZXIuXG4gICAgICAgIHN0ciArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHRoaXMucmVhZFVpbnQ4KCkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG5cbiAgICAvLyBUaGlzIGRvZXNuJ3QgcmVhbGx5IHJlYWQgYW4gYXJyYXksIGJ1dCBqdXN0IGdpdmVzIGEgdHlwZWQgYXJyYXlcbiAgICAvLyB3aGljaCBoYXMgYWNjZXNzIHRvIHRoZSB1bmRlcmx5aW5nIGJ1ZmZlclxuICB9LCB7XG4gICAga2V5OiAncmVhZEZsb2F0MzJBcnJheScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHJlYWRGbG9hdDMyQXJyYXkobGVuZ3RoKSB7XG4gICAgICB2YXIgYXJyID0gbmV3IEZsb2F0MzJBcnJheShsZW5ndGgpO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICBhcnJbaV0gPSB0aGlzLnJlYWRGbG9hdDMyKCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gYXJyO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3JlYWRVaW50MTZBcnJheScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHJlYWRVaW50MTZBcnJheShsZW5ndGgpIHtcbiAgICAgIHZhciBhcnIgPSBuZXcgVWludDE2QXJyYXkobGVuZ3RoKTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYXJyW2ldID0gdGhpcy5yZWFkVWludDE2KCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gYXJyO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3JlYWRVaW50OEFycmF5JyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gcmVhZFVpbnQ4QXJyYXkobGVuZ3RoKSB7XG4gICAgICB2YXIgYXJyID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5idWZmZXIsIHRoaXMuY3VycmVudE9mZnNldCwgbGVuZ3RoKTtcbiAgICAgIHRoaXMuY3VycmVudE9mZnNldCArPSBsZW5ndGg7XG4gICAgICByZXR1cm4gYXJyO1xuICAgIH1cbiAgfV0pO1xuXG4gIHJldHVybiBTdHJlYW1SZWFkZXI7XG59KSgpO1xuXG5leHBvcnRzWydkZWZhdWx0J10gPSBTdHJlYW1SZWFkZXI7XG5tb2R1bGUuZXhwb3J0cyA9IGV4cG9ydHNbJ2RlZmF1bHQnXTsiXX0=
