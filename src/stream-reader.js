class StreamReader {
  constructor(buffer) {
    this.buffer = buffer;
    this.dataview = new DataView(buffer);
    this.currentOffset = 0;
  }

  getLength() {
    return this.dataview.byteLength;
  }

  getPosition() {
    return this.currentOffset;
  }

  readUint32() {
    var val = this.dataview.getUint32(this.currentOffset);
    this.currentOffset += 4;
    return val;
  }

  readUint16() {
    var val = this.dataview.getUint16(this.currentOffset);
    this.currentOffset += 2;
    return val;
  }

  readUint8() {
    var val = this.dataview.getUint8(this.currentOffset);
    this.currentOffset++;
    return val;
  }

  readInt32() {
    var val = this.dataview.getInt32(this.currentOffset);
    this.currentOffset += 4;
    return val;
  }

  readInt16() {
    var val = this.dataview.getInt16(this.currentOffset);
    this.currentOffset += 2;
    return val;
  }

  readInt8() {
    var val = this.dataview.getInt8(this.currentOffset);
    this.currentOffset++;
    return val;
  }

  readFloat32() {
    var val = this.dataview.getFloat32(this.currentOffset);
    this.currentOffset += 4;
    return val;
  }

  readUtf8String() {
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
  readFloat32Array(length) {
    var arr = new Float32Array(length);
    for (var i = 0; i < length; i++) {
      arr[i] = this.readFloat32();
    }
    return arr;
  }

  readUint16Array(length) {
    var arr = new Uint16Array(length);
    for (var i = 0; i < length; i++) {
      arr[i] = this.readUint16();
    }
    return arr;
  }

  readUint8Array(length) {
    var arr = new Uint8Array(this.buffer, this.currentOffset, length);
    this.currentOffset += length;
    return arr;
  }
}

export default StreamReader;
