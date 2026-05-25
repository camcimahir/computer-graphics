// Cylinder.js - unit cylinder oriented along +X, from x=0..1, radius 0.5 in YZ.
// Interleaved layout per vertex: [px, py, pz, u, v, nx, ny, nz]  (stride = 32 bytes)

var _CYL_CACHE = {};

function _buildCylinder(segments) {
  var entry = _CYL_CACHE[segments];
  if (entry && entry.glBuffer) return entry;

  var sideVerts = [];
  var capPosVerts = [];
  var capNegVerts = [];

  var two_pi = Math.PI * 2.0;
  for (var i = 0; i < segments; i++) {
    var t1 = (i     / segments) * two_pi;
    var t2 = ((i + 1) / segments) * two_pi;
    var c1 = Math.cos(t1), s1 = Math.sin(t1);
    var c2 = Math.cos(t2), s2 = Math.sin(t2);
    var y1 = 0.5 * c1, z1 = 0.5 * s1;
    var y2 = 0.5 * c2, z2 = 0.5 * s2;

    // Side: normals point outward radially (no x component).
    function pushSide(x, y, z, u, v, ny, nz) {
      sideVerts.push(x, y, z, u, v, 0, ny, nz);
    }
    var u1 = i / segments, u2 = (i + 1) / segments;
    pushSide(0, y1, z1, u1, 0, c1, s1);
    pushSide(1, y1, z1, u1, 1, c1, s1);
    pushSide(1, y2, z2, u2, 1, c2, s2);
    pushSide(0, y1, z1, u1, 0, c1, s1);
    pushSide(1, y2, z2, u2, 1, c2, s2);
    pushSide(0, y2, z2, u2, 0, c2, s2);

    // +X cap: normal is +X
    capPosVerts.push(
      1, 0,   0, 0.5, 0.5, 1, 0, 0,
      1, y1, z1, 0.5 + c1*0.5, 0.5 + s1*0.5, 1, 0, 0,
      1, y2, z2, 0.5 + c2*0.5, 0.5 + s2*0.5, 1, 0, 0
    );
    // -X cap: normal is -X
    capNegVerts.push(
      0, 0,   0, 0.5, 0.5, -1, 0, 0,
      0, y2, z2, 0.5 + c2*0.5, 0.5 + s2*0.5, -1, 0, 0,
      0, y1, z1, 0.5 + c1*0.5, 0.5 + s1*0.5, -1, 0, 0
    );
  }

  var floatsPerVert = 8;
  var sideCount   = sideVerts.length   / floatsPerVert;
  var capPosCount = capPosVerts.length / floatsPerVert;
  var capNegCount = capNegVerts.length / floatsPerVert;

  var combined = new Float32Array(sideVerts.length + capPosVerts.length + capNegVerts.length);
  combined.set(sideVerts, 0);
  combined.set(capPosVerts, sideVerts.length);
  combined.set(capNegVerts, sideVerts.length + capPosVerts.length);

  var glBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, glBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, combined, gl.STATIC_DRAW);

  entry = {
    glBuffer: glBuffer,
    sideOffset:   0,
    capPosOffset: sideCount,
    capNegOffset: sideCount + capPosCount,
    sideCount:    sideCount,
    capPosCount:  capPosCount,
    capNegCount:  capNegCount
  };
  _CYL_CACHE[segments] = entry;
  return entry;
}

class Cylinder {
  constructor(segments) {
    this.type = 'cylinder';
    this.color = [1.0, 1.0, 1.0, 1.0];
    this.matrix = new Matrix4();
    this.segments = segments || 16;
    this._geom = null;
  }

  render() {
    if (!this._geom || !this._geom.glBuffer) {
      this._geom = _buildCylinder(this.segments);
    }
    var geom = this._geom;
    var r = this.color[0], g = this.color[1], b = this.color[2], a = this.color[3];

    gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);
    if (typeof u_NormalMatrix !== 'undefined' && u_NormalMatrix !== null) {
      var nm = Cylinder._normalMat || (Cylinder._normalMat = new Matrix4());
      nm.setInverseOf(this.matrix);
      nm.transpose();
      gl.uniformMatrix4fv(u_NormalMatrix, false, nm.elements);
    }
    gl.uniform1i(u_whichTexture, -2);

    gl.bindBuffer(gl.ARRAY_BUFFER, geom.glBuffer);
    var FSIZE = 4;
    var STRIDE = 8 * FSIZE;
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, STRIDE, 0);
    gl.vertexAttribPointer(a_UV,       2, gl.FLOAT, false, STRIDE, 3 * FSIZE);
    gl.vertexAttribPointer(a_Normal,   3, gl.FLOAT, false, STRIDE, 5 * FSIZE);
    gl.enableVertexAttribArray(a_Position);
    gl.enableVertexAttribArray(a_UV);
    gl.enableVertexAttribArray(a_Normal);

    gl.uniform4f(u_FragColor, r, g, b, a);
    gl.drawArrays(gl.TRIANGLES, geom.sideOffset, geom.sideCount);

    gl.uniform4f(u_FragColor, r * 0.85, g * 0.85, b * 0.85, a);
    gl.drawArrays(gl.TRIANGLES, geom.capPosOffset, geom.capPosCount);

    gl.uniform4f(u_FragColor, r * 0.75, g * 0.75, b * 0.75, a);
    gl.drawArrays(gl.TRIANGLES, geom.capNegOffset, geom.capNegCount);
  }
}
