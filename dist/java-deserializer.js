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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvamF2YS1kZXNlcmlhbGl6ZXIuanMiLCJzcmMvc3RyZWFtLXJlYWRlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7XG4gIHZhbHVlOiB0cnVlXG59KTtcblxudmFyIF9jcmVhdGVDbGFzcyA9IChmdW5jdGlvbiAoKSB7IGZ1bmN0aW9uIGRlZmluZVByb3BlcnRpZXModGFyZ2V0LCBwcm9wcykgeyBmb3IgKHZhciBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7IHZhciBkZXNjcmlwdG9yID0gcHJvcHNbaV07IGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IGRlc2NyaXB0b3IuZW51bWVyYWJsZSB8fCBmYWxzZTsgZGVzY3JpcHRvci5jb25maWd1cmFibGUgPSB0cnVlOyBpZiAoJ3ZhbHVlJyBpbiBkZXNjcmlwdG9yKSBkZXNjcmlwdG9yLndyaXRhYmxlID0gdHJ1ZTsgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgZGVzY3JpcHRvci5rZXksIGRlc2NyaXB0b3IpOyB9IH0gcmV0dXJuIGZ1bmN0aW9uIChDb25zdHJ1Y3RvciwgcHJvdG9Qcm9wcywgc3RhdGljUHJvcHMpIHsgaWYgKHByb3RvUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IucHJvdG90eXBlLCBwcm90b1Byb3BzKTsgaWYgKHN0YXRpY1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLCBzdGF0aWNQcm9wcyk7IHJldHVybiBDb25zdHJ1Y3RvcjsgfTsgfSkoKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgJ2RlZmF1bHQnOiBvYmogfTsgfVxuXG5mdW5jdGlvbiBfY2xhc3NDYWxsQ2hlY2soaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7IGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvbicpOyB9IH1cblxudmFyIF9zdHJlYW1SZWFkZXIgPSByZXF1aXJlKCcuL3N0cmVhbS1yZWFkZXInKTtcblxudmFyIF9zdHJlYW1SZWFkZXIyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfc3RyZWFtUmVhZGVyKTtcblxuLy8gTWFnaWMgbnVtYmVyc1xudmFyIFNUUkVBTV9NQUdJQyA9IDB4YWNlZDtcbnZhciBTVFJFQU1fVkVSU0lPTiA9IDB4MDAwNTtcblxuLy8gVHlwZSBjb25zdGFudHMgKGlnbm9yZSBiZWNhdXNlIHVuZGVmKVxudmFyIFRDX05VTEwgPSAweDcwO1xudmFyIFRDX1JFRkVSRU5DRSA9IDB4NzE7XG52YXIgVENfQ0xBU1NERVNDID0gMHg3MjtcbnZhciBUQ19PQkpFQ1QgPSAweDczOyAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbnZhciBUQ19TVFJJTkcgPSAweDc0O1xudmFyIFRDX0FSUkFZID0gMHg3NTtcbnZhciBUQ19DTEFTUyA9IDB4NzY7IC8vIGpzaGludCBpZ25vcmU6bGluZVxudmFyIFRDX0JMT0NLREFUQSA9IDB4Nzc7XG52YXIgVENfRU5EQkxPQ0tEQVRBID0gMHg3ODtcbnZhciBUQ19SRVNFVCA9IDB4Nzk7IC8vIGpzaGludCBpZ25vcmU6bGluZVxudmFyIFRDX0JMT0NLREFUQUxPTkcgPSAweDdBOyAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbnZhciBUQ19FWENFUFRJT04gPSAweDdCOyAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbnZhciBUQ19MT05HU1RSSU5HID0gMHg3QzsgLy8ganNoaW50IGlnbm9yZTpsaW5lXG52YXIgVENfUFJPWFlDTEFTU0RFU0MgPSAweDdEOyAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbnZhciBUQ19FTlVNID0gMHg3RTsgLy8ganNoaW50IGlnbm9yZTpsaW5lXG5cbnZhciBCQVNFX0hBTkRMRSA9IDB4N0UwMDAwO1xuXG52YXIgSmF2YURlc2VyaWFsaXplciA9IChmdW5jdGlvbiAoKSB7XG4gIGZ1bmN0aW9uIEphdmFEZXNlcmlhbGl6ZXIoYXJyYXlidWYpIHtcbiAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgSmF2YURlc2VyaWFsaXplcik7XG5cbiAgICB0aGlzLmJ1ZmZlciA9IGFycmF5YnVmO1xuICAgIHRoaXMuc3RyZWFtID0gbmV3IF9zdHJlYW1SZWFkZXIyWydkZWZhdWx0J10oYXJyYXlidWYpO1xuICAgIHRoaXMucmVwciA9IG51bGw7XG4gICAgdGhpcy5yZWZzID0gW107XG4gICAgdGhpcy5fY2hlY2tNYWdpYygpO1xuICB9XG5cbiAgX2NyZWF0ZUNsYXNzKEphdmFEZXNlcmlhbGl6ZXIsIFt7XG4gICAga2V5OiAnX2NoZWNrTWFnaWMnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBfY2hlY2tNYWdpYygpIHtcbiAgICAgIGlmICh0aGlzLnN0cmVhbS5yZWFkVWludDE2KCkgIT09IFNUUkVBTV9NQUdJQykge1xuICAgICAgICB0aHJvdyAnaW52YWxpZCBtYWdpYyBudW1iZXIhJztcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLnN0cmVhbS5yZWFkVWludDE2KCkgIT09IFNUUkVBTV9WRVJTSU9OKSB7XG4gICAgICAgIHRocm93ICdpbnZhbGlkIHZlcnNpb24hJztcbiAgICAgIH1cbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdfcmVhZENsYXNzRGVzY3JpcHRpb24nLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBfcmVhZENsYXNzRGVzY3JpcHRpb24oKSB7XG4gICAgICB2YXIgcHJpbWl0aXZlcyA9ICdCQ0RGSUpTWic7XG4gICAgICB2YXIgdHlwZSA9IHRoaXMuc3RyZWFtLnJlYWRVaW50OCgpO1xuICAgICAgdmFyIGRlc2NyaXB0aW9uID0ge307XG4gICAgICBpZiAodHlwZSA9PT0gVENfTlVMTCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09IFRDX1JFRkVSRU5DRSkge1xuICAgICAgICB2YXIgaGFuZGxlID0gdGhpcy5zdHJlYW0ucmVhZFVpbnQzMigpIC0gQkFTRV9IQU5ETEU7XG4gICAgICAgIHJldHVybiB0aGlzLnJlZnNbaGFuZGxlXTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSAhPT0gVENfQ0xBU1NERVNDKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdJIGRvblxcJ3Qga25vdyBob3cgdG8gaGFuZGxlIHRoaXMgdHlwZSB5ZXQ6ICcgKyB0eXBlKTsgLy8ganNoaW50IGlnbm9yZTpsaW5lXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGRlc2NyaXB0aW9uLm5hbWUgPSB0aGlzLnN0cmVhbS5yZWFkVXRmOFN0cmluZygpO1xuICAgICAgZGVzY3JpcHRpb24udmVyc2lvbklkID0gW3RoaXMuc3RyZWFtLnJlYWRVaW50MzIoKSwgdGhpcy5zdHJlYW0ucmVhZFVpbnQzMigpXTtcbiAgICAgIGRlc2NyaXB0aW9uLmhhbmRsZSA9IHRoaXMucmVmcy5sZW5ndGg7XG4gICAgICBkZXNjcmlwdGlvbi5mbGFncyA9IHRoaXMuc3RyZWFtLnJlYWRVaW50OCgpO1xuICAgICAgdmFyIGZpZWxkcyA9IFtdO1xuICAgICAgdmFyIG51bSA9IHRoaXMuc3RyZWFtLnJlYWRVaW50MTYoKTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbnVtOyBpKyspIHtcbiAgICAgICAgdmFyIGZpZWxkID0ge307XG4gICAgICAgIGZpZWxkLnR5cGUgPSB0aGlzLnN0cmVhbS5yZWFkVWludDgoKTtcbiAgICAgICAgZmllbGQubmFtZSA9IHRoaXMuc3RyZWFtLnJlYWRVdGY4U3RyaW5nKCk7XG4gICAgICAgIGlmIChwcmltaXRpdmVzLmluZGV4T2YoU3RyaW5nLmZyb21DaGFyQ29kZShmaWVsZC50eXBlKSkgPT09IC0xKSB7XG4gICAgICAgICAgLy8gbm90IGEgcHJpbWl0aXZlLCB3aGF0IGRvLlxuICAgICAgICAgIGNvbnNvbGUubG9nKCd0aGlzIGlzIG5vdCBhIHByaW1pdGl2ZSB0eXBlOiAnICsgZmllbGQudHlwZSk7IC8vIGpzaGludCBpZ25vcmU6bGluZVxuICAgICAgICB9XG4gICAgICAgIGZpZWxkcy5wdXNoKGZpZWxkKTtcbiAgICAgIH1cbiAgICAgIGRlc2NyaXB0aW9uLmZpZWxkcyA9IGZpZWxkcztcbiAgICAgIGRlc2NyaXB0aW9uLmFubm90YXRpb24gPSB0aGlzLnN0cmVhbS5yZWFkVWludDgoKTtcbiAgICAgIGlmIChkZXNjcmlwdGlvbi5hbm5vdGF0aW9uICE9PSBUQ19FTkRCTE9DS0RBVEEpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ0kgZG9uXFwndCBrbm93IHdoYXQgdG8gZG8gd2l0aCB0aGlzOiAnICsgZGVzY3JpcHRpb24uYW5ub3RhdGlvbik7IC8vIGpzaGludCBpZ25vcmU6bGluZVxuICAgICAgfVxuICAgICAgZGVzY3JpcHRpb24uc3VwZXJDbGFzcyA9IHRoaXMuX3JlYWRDbGFzc0Rlc2NyaXB0aW9uKCk7XG4gICAgICB0aGlzLnJlZnMucHVzaChkZXNjcmlwdGlvbik7XG4gICAgICByZXR1cm4gZGVzY3JpcHRpb247XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnX3JlYWRBcnJheScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIF9yZWFkQXJyYXkoKSB7XG4gICAgICB2YXIgY29udGVudCA9IHt9O1xuICAgICAgdmFyIGRlc2MgPSB0aGlzLl9yZWFkQ2xhc3NEZXNjcmlwdGlvbigpLFxuICAgICAgICAgIGksXG4gICAgICAgICAgbGVuZ3RoO1xuICAgICAgY29udGVudC5kZXNjcmlwdGlvbiA9IGRlc2M7XG4gICAgICAvLyBmb3Igc29tZSByZWFzb24gdGhpcyBkb2Vzbid0IHNlZW0gdG8gYmUgZ2V0dGluZyB0aGlzLlxuICAgICAgY29udGVudC5oYW5kbGUgPSB0aGlzLnJlZnMubGVuZ3RoO1xuICAgICAgbGVuZ3RoID0gdGhpcy5zdHJlYW0ucmVhZFVpbnQzMigpO1xuICAgICAgdmFyIG5hbWUgPSBkZXNjLm5hbWU7XG4gICAgICAvLyBoYWhhIHdoYXQgdGhlIGZ1Y2sgaXMgdGhpcyBzaGl0LlxuICAgICAgLy8gU3BlYywgZG9lcyB5b3UgZm9sbG93IGl0P1xuICAgICAgaWYgKG5hbWUgPT09ICdbRicpIHtcbiAgICAgICAgY29udGVudC5lbGVtZW50cyA9IHRoaXMuc3RyZWFtLnJlYWRGbG9hdDMyQXJyYXkobGVuZ3RoKTtcbiAgICAgIH0gZWxzZSBpZiAobmFtZSA9PT0gJ1tTJykge1xuICAgICAgICBjb250ZW50LmVsZW1lbnRzID0gdGhpcy5zdHJlYW0ucmVhZFVpbnQxNkFycmF5KGxlbmd0aCk7XG4gICAgICB9IGVsc2UgLy8gdGhpcyBpcyBhbiBhcnJheSBvZiBjbGFzc2VzIG9mIHNvbWUga2luZD9cbiAgICAgICAge1xuICAgICAgICAgIGNvbnRlbnQuZWxlbWVudHMgPSBbXTtcbiAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciB0ID0gdGhpcy5fcmVhZENodW5rKCk7XG4gICAgICAgICAgICBjb250ZW50LmVsZW1lbnRzLnB1c2godCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAvLyBub3BlLmF2aVxuICAgICAgdGhpcy5yZWZzLnB1c2goY29udGVudCk7XG4gICAgICByZXR1cm4gY29udGVudDtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdfcmVhZEJsb2NrRGF0YScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIF9yZWFkQmxvY2tEYXRhKCkge1xuICAgICAgdmFyIGxlbmd0aCA9IHRoaXMuc3RyZWFtLnJlYWRVaW50OCgpO1xuICAgICAgcmV0dXJuIHRoaXMuc3RyZWFtLnJlYWRVaW50OEFycmF5KGxlbmd0aCk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnX3JlYWRDaHVuaycsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIF9yZWFkQ2h1bmsoKSB7XG4gICAgICB2YXIgdHlwZSA9IHRoaXMuc3RyZWFtLnJlYWRVaW50OCgpO1xuICAgICAgdmFyIGNvbnRlbnQgPSBudWxsO1xuICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgIGNhc2UgVENfQVJSQVk6XG4gICAgICAgICAgY29udGVudCA9IHRoaXMuX3JlYWRBcnJheSgpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFRDX0JMT0NLREFUQTpcbiAgICAgICAgICBjb250ZW50ID0gdGhpcy5fcmVhZEJsb2NrRGF0YSgpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFRDX1NUUklORzpcbiAgICAgICAgICBjb250ZW50ID0gdGhpcy5zdHJlYW0ucmVhZFV0ZjhTdHJpbmcoKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBjb25zb2xlLmxvZygndW5oYW5kbGVkIHR5cGUnKTsgLy8ganNoaW50IGlnbm9yZTpsaW5lXG4gICAgICB9XG4gICAgICByZXR1cm4gY29udGVudDtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdnZXRDb250ZW50cycsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGdldENvbnRlbnRzKCkge1xuICAgICAgaWYgKHRoaXMucmVwcikge1xuICAgICAgICByZXR1cm4gdGhpcy5yZXByO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnJlcHIgPSBbXTtcblxuICAgICAgd2hpbGUgKHRoaXMuc3RyZWFtLmdldFBvc2l0aW9uKCkgPCB0aGlzLnN0cmVhbS5nZXRMZW5ndGgoKSkge1xuICAgICAgICB0aGlzLnJlcHIucHVzaCh0aGlzLl9yZWFkQ2h1bmsoKSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aGlzLnJlcHI7XG4gICAgfVxuICB9XSk7XG5cbiAgcmV0dXJuIEphdmFEZXNlcmlhbGl6ZXI7XG59KSgpO1xuXG5KYXZhRGVzZXJpYWxpemVyLlZFUlNJT04gPSAnMC4yLjAnO1xuXG5leHBvcnRzWydkZWZhdWx0J10gPSBKYXZhRGVzZXJpYWxpemVyO1xubW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzWydkZWZhdWx0J107IiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7XG4gIHZhbHVlOiB0cnVlXG59KTtcblxudmFyIF9jcmVhdGVDbGFzcyA9IChmdW5jdGlvbiAoKSB7IGZ1bmN0aW9uIGRlZmluZVByb3BlcnRpZXModGFyZ2V0LCBwcm9wcykgeyBmb3IgKHZhciBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7IHZhciBkZXNjcmlwdG9yID0gcHJvcHNbaV07IGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IGRlc2NyaXB0b3IuZW51bWVyYWJsZSB8fCBmYWxzZTsgZGVzY3JpcHRvci5jb25maWd1cmFibGUgPSB0cnVlOyBpZiAoJ3ZhbHVlJyBpbiBkZXNjcmlwdG9yKSBkZXNjcmlwdG9yLndyaXRhYmxlID0gdHJ1ZTsgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgZGVzY3JpcHRvci5rZXksIGRlc2NyaXB0b3IpOyB9IH0gcmV0dXJuIGZ1bmN0aW9uIChDb25zdHJ1Y3RvciwgcHJvdG9Qcm9wcywgc3RhdGljUHJvcHMpIHsgaWYgKHByb3RvUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IucHJvdG90eXBlLCBwcm90b1Byb3BzKTsgaWYgKHN0YXRpY1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLCBzdGF0aWNQcm9wcyk7IHJldHVybiBDb25zdHJ1Y3RvcjsgfTsgfSkoKTtcblxuZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKCdDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb24nKTsgfSB9XG5cbnZhciBTdHJlYW1SZWFkZXIgPSAoZnVuY3Rpb24gKCkge1xuICBmdW5jdGlvbiBTdHJlYW1SZWFkZXIoYnVmZmVyKSB7XG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIFN0cmVhbVJlYWRlcik7XG5cbiAgICB0aGlzLmJ1ZmZlciA9IGJ1ZmZlcjtcbiAgICB0aGlzLmRhdGF2aWV3ID0gbmV3IERhdGFWaWV3KGJ1ZmZlcik7XG4gICAgdGhpcy5jdXJyZW50T2Zmc2V0ID0gMDtcbiAgfVxuXG4gIF9jcmVhdGVDbGFzcyhTdHJlYW1SZWFkZXIsIFt7XG4gICAga2V5OiAnZ2V0TGVuZ3RoJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gZ2V0TGVuZ3RoKCkge1xuICAgICAgcmV0dXJuIHRoaXMuZGF0YXZpZXcuYnl0ZUxlbmd0aDtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdnZXRQb3NpdGlvbicsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGdldFBvc2l0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuY3VycmVudE9mZnNldDtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdyZWFkVWludDMyJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gcmVhZFVpbnQzMigpIHtcbiAgICAgIHZhciB2YWwgPSB0aGlzLmRhdGF2aWV3LmdldFVpbnQzMih0aGlzLmN1cnJlbnRPZmZzZXQpO1xuICAgICAgdGhpcy5jdXJyZW50T2Zmc2V0ICs9IDQ7XG4gICAgICByZXR1cm4gdmFsO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3JlYWRVaW50MTYnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiByZWFkVWludDE2KCkge1xuICAgICAgdmFyIHZhbCA9IHRoaXMuZGF0YXZpZXcuZ2V0VWludDE2KHRoaXMuY3VycmVudE9mZnNldCk7XG4gICAgICB0aGlzLmN1cnJlbnRPZmZzZXQgKz0gMjtcbiAgICAgIHJldHVybiB2YWw7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAncmVhZFVpbnQ4JyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gcmVhZFVpbnQ4KCkge1xuICAgICAgdmFyIHZhbCA9IHRoaXMuZGF0YXZpZXcuZ2V0VWludDgodGhpcy5jdXJyZW50T2Zmc2V0KTtcbiAgICAgIHRoaXMuY3VycmVudE9mZnNldCsrO1xuICAgICAgcmV0dXJuIHZhbDtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdyZWFkSW50MzInLFxuICAgIHZhbHVlOiBmdW5jdGlvbiByZWFkSW50MzIoKSB7XG4gICAgICB2YXIgdmFsID0gdGhpcy5kYXRhdmlldy5nZXRJbnQzMih0aGlzLmN1cnJlbnRPZmZzZXQpO1xuICAgICAgdGhpcy5jdXJyZW50T2Zmc2V0ICs9IDQ7XG4gICAgICByZXR1cm4gdmFsO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3JlYWRJbnQxNicsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHJlYWRJbnQxNigpIHtcbiAgICAgIHZhciB2YWwgPSB0aGlzLmRhdGF2aWV3LmdldEludDE2KHRoaXMuY3VycmVudE9mZnNldCk7XG4gICAgICB0aGlzLmN1cnJlbnRPZmZzZXQgKz0gMjtcbiAgICAgIHJldHVybiB2YWw7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAncmVhZEludDgnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiByZWFkSW50OCgpIHtcbiAgICAgIHZhciB2YWwgPSB0aGlzLmRhdGF2aWV3LmdldEludDgodGhpcy5jdXJyZW50T2Zmc2V0KTtcbiAgICAgIHRoaXMuY3VycmVudE9mZnNldCsrO1xuICAgICAgcmV0dXJuIHZhbDtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdyZWFkRmxvYXQzMicsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHJlYWRGbG9hdDMyKCkge1xuICAgICAgdmFyIHZhbCA9IHRoaXMuZGF0YXZpZXcuZ2V0RmxvYXQzMih0aGlzLmN1cnJlbnRPZmZzZXQpO1xuICAgICAgdGhpcy5jdXJyZW50T2Zmc2V0ICs9IDQ7XG4gICAgICByZXR1cm4gdmFsO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3JlYWRVdGY4U3RyaW5nJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gcmVhZFV0ZjhTdHJpbmcoKSB7XG4gICAgICB2YXIgbGVuZ3RoID0gdGhpcy5yZWFkVWludDE2KCk7XG4gICAgICB2YXIgc3RyID0gJyc7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIC8vIFRPRE86IFJlcGxhY2UgdGhpcyB3aXRoIGEgcHJvcGVyIHV0ZjggcmVhZGVyLlxuICAgICAgICBzdHIgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSh0aGlzLnJlYWRVaW50OCgpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuXG4gICAgLy8gVGhpcyBkb2Vzbid0IHJlYWxseSByZWFkIGFuIGFycmF5LCBidXQganVzdCBnaXZlcyBhIHR5cGVkIGFycmF5XG4gICAgLy8gd2hpY2ggaGFzIGFjY2VzcyB0byB0aGUgdW5kZXJseWluZyBidWZmZXJcbiAgfSwge1xuICAgIGtleTogJ3JlYWRGbG9hdDMyQXJyYXknLFxuICAgIHZhbHVlOiBmdW5jdGlvbiByZWFkRmxvYXQzMkFycmF5KGxlbmd0aCkge1xuICAgICAgdmFyIGFyciA9IG5ldyBGbG9hdDMyQXJyYXkobGVuZ3RoKTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYXJyW2ldID0gdGhpcy5yZWFkRmxvYXQzMigpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFycjtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdyZWFkVWludDE2QXJyYXknLFxuICAgIHZhbHVlOiBmdW5jdGlvbiByZWFkVWludDE2QXJyYXkobGVuZ3RoKSB7XG4gICAgICB2YXIgYXJyID0gbmV3IFVpbnQxNkFycmF5KGxlbmd0aCk7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGFycltpXSA9IHRoaXMucmVhZFVpbnQxNigpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFycjtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdyZWFkVWludDhBcnJheScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHJlYWRVaW50OEFycmF5KGxlbmd0aCkge1xuICAgICAgdmFyIGFyciA9IG5ldyBVaW50OEFycmF5KHRoaXMuYnVmZmVyLCB0aGlzLmN1cnJlbnRPZmZzZXQsIGxlbmd0aCk7XG4gICAgICB0aGlzLmN1cnJlbnRPZmZzZXQgKz0gbGVuZ3RoO1xuICAgICAgcmV0dXJuIGFycjtcbiAgICB9XG4gIH1dKTtcblxuICByZXR1cm4gU3RyZWFtUmVhZGVyO1xufSkoKTtcblxuZXhwb3J0c1snZGVmYXVsdCddID0gU3RyZWFtUmVhZGVyO1xubW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzWydkZWZhdWx0J107Il19
