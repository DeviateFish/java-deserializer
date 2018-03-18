import StreamReader from './src/stream-reader';

// Magic numbers
const STREAM_MAGIC = 0xaced;
const STREAM_VERSION = 0x0005;

// Type constants (ignore because undef)
const TC_NULL = 0x70;
const TC_REFERENCE = 0x71;
const TC_CLASSDESC = 0x72;
const TC_OBJECT = 0x73; // eslint-disable-line no-unused-vars
const TC_STRING = 0x74;
const TC_ARRAY = 0x75;
const TC_CLASS = 0x76; // eslint-disable-line no-unused-vars
const TC_BLOCKDATA = 0x77;
const TC_ENDBLOCKDATA = 0x78;
const TC_RESET = 0x79; // eslint-disable-line no-unused-vars
const TC_BLOCKDATALONG = 0x7A; // eslint-disable-line no-unused-vars
const TC_EXCEPTION = 0x7B; // eslint-disable-line no-unused-vars
const TC_LONGSTRING = 0x7C; // eslint-disable-line no-unused-vars
const TC_PROXYCLASSDESC = 0x7D; // eslint-disable-line no-unused-vars
const TC_ENUM = 0x7E; // eslint-disable-line no-unused-vars

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
    if (this.stream.readUint16() !== STREAM_MAGIC) {
      throw 'invalid magic number!';
    }
    if (this.stream.readUint16() !== STREAM_VERSION) {
      throw 'invalid version!';
    }
  }

  _readClassDescription() {
    var primitives = 'BCDFIJSZ';
    var type = this.stream.readUint8();
    var description = {};
    if (type === TC_NULL) {
      return;
    } else if (type === TC_REFERENCE) {
      var handle = this.stream.readUint32() - BASE_HANDLE;
      return this.refs[handle];
    } else if (type !== TC_CLASSDESC) {
      console.log('I don\'t know how to handle this type yet: ' + type); // eslint-disable-line no-console
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
        console.log('this is not a primitive type: ' + field.type); // eslint-disable-line no-console
      }
      fields.push(field);
    }
    description.fields = fields;
    description.annotation = this.stream.readUint8();
    if (description.annotation !== TC_ENDBLOCKDATA) {
      console.log('I don\'t know what to do with this: ' + description.annotation); // eslint-disable-line no-console
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
    if (name === '[F') {
      content.elements = this.stream.readFloat32Array(length);
    } else if (name === '[S') {
      content.elements = this.stream.readUint16Array(length);
    } else { // this is an array of classes of some kind?
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

  _readBlockData() {
    var length = this.stream.readUint8();
    return this.stream.readUint8Array(length);
  }

  _readChunk() {
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
        console.log('unhandled type'); // eslint-disable-line no-console
    }
    return content;
  }

  getContents() {
    if(this.repr) {
      return this.repr;
    }

    this.repr = [];

    while (this.stream.getPosition() < this.stream.getLength()) {
      this.repr.push(this._readChunk());
    }

    return this.repr;
  }
}

JavaDeserializer.VERSION = '0.3.1';

export default JavaDeserializer;
