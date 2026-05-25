// Model.js - small OBJ loader.
// Supports v / vn / vt / f lines (triangles or n-gon fan).
// Computes face normals if the OBJ provides none.
// Stores into a static interleaved buffer: [px,py,pz, u,v, nx,ny,nz].

function Model() {
  this.matrix = new Matrix4();
  this.color = [0.85, 0.85, 0.85, 1.0];
  this.glBuffer = null;
  this.count = 0;
  this.loaded = false;
}

Model.prototype.loadFromOBJText = function (text) {
  var positions = [];
  var texcoords = [];
  var normals = [];
  var faces = [];

  var lines = text.split('\n');
  for (var li = 0; li < lines.length; li++) {
    var raw = lines[li];
    var hash = raw.indexOf('#');
    if (hash !== -1) raw = raw.substring(0, hash);
    var line = raw.trim();
    if (!line) continue;

    var parts = line.split(/\s+/);
    var tag = parts[0];

    if (tag === 'v') {
      var px = parseFloat(parts[1]), py = parseFloat(parts[2]), pz = parseFloat(parts[3]);
      positions.push([px, py, pz]);
      if (!this.bounds) this.bounds = { min: [px,py,pz], max: [px,py,pz] };
      else {
        var bmin = this.bounds.min, bmax = this.bounds.max;
        if (px < bmin[0]) bmin[0] = px;  if (px > bmax[0]) bmax[0] = px;
        if (py < bmin[1]) bmin[1] = py;  if (py > bmax[1]) bmax[1] = py;
        if (pz < bmin[2]) bmin[2] = pz;  if (pz > bmax[2]) bmax[2] = pz;
      }
    } else if (tag === 'vn') {
      normals.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (tag === 'vt') {
      texcoords.push([parseFloat(parts[1]), parseFloat(parts[2])]);
    } else if (tag === 'f') {
      // Each remaining token: v, v/vt, v//vn, or v/vt/vn (1-indexed; negatives allowed)
      var face = [];
      for (var i = 1; i < parts.length; i++) {
        var tok = parts[i];
        var bits = tok.split('/');
        var vi  = parseInt(bits[0], 10);
        var ti  = bits.length > 1 && bits[1] ? parseInt(bits[1], 10) : 0;
        var ni  = bits.length > 2 && bits[2] ? parseInt(bits[2], 10) : 0;
        if (vi < 0) vi = positions.length + 1 + vi;
        if (ti < 0) ti = texcoords.length + 1 + ti;
        if (ni < 0) ni = normals.length + 1 + ni;
        face.push([vi, ti, ni]);
      }
      faces.push(face);
    }
    // Other tags (mtllib, usemtl, s, g, o) are ignored.
  }

  // Fan-triangulate every face and emit interleaved verts.
  var out = [];
  for (var f = 0; f < faces.length; f++) {
    var face = faces[f];
    if (face.length < 3) continue;
    var v0 = face[0];
    for (var k = 1; k + 1 < face.length; k++) {
      var v1 = face[k];
      var v2 = face[k + 1];
      this._emitTri(out, v0, v1, v2, positions, texcoords, normals);
    }
  }

  var arr = new Float32Array(out);
  this.glBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
  this.count = arr.length / 8;
  this.loaded = true;
};

Model.prototype._emitTri = function (out, A, B, C, positions, texcoords, normals) {
  var pa = positions[A[0] - 1] || [0,0,0];
  var pb = positions[B[0] - 1] || [0,0,0];
  var pc = positions[C[0] - 1] || [0,0,0];

  var ua = (A[1] > 0 && texcoords[A[1] - 1]) || [0, 0];
  var ub = (B[1] > 0 && texcoords[B[1] - 1]) || [0, 0];
  var uc = (C[1] > 0 && texcoords[C[1] - 1]) || [0, 0];

  var na, nb, nc;
  if (A[2] > 0 && normals[A[2] - 1]) {
    na = normals[A[2] - 1];
    nb = (B[2] > 0 && normals[B[2] - 1]) || na;
    nc = (C[2] > 0 && normals[C[2] - 1]) || na;
  } else {
    var e1 = [pb[0]-pa[0], pb[1]-pa[1], pb[2]-pa[2]];
    var e2 = [pc[0]-pa[0], pc[1]-pa[1], pc[2]-pa[2]];
    var n = [
      e1[1]*e2[2] - e1[2]*e2[1],
      e1[2]*e2[0] - e1[0]*e2[2],
      e1[0]*e2[1] - e1[1]*e2[0]
    ];
    var L = Math.sqrt(n[0]*n[0] + n[1]*n[1] + n[2]*n[2]) || 1;
    n = [n[0]/L, n[1]/L, n[2]/L];
    na = nb = nc = n;
  }

  out.push(pa[0], pa[1], pa[2], ua[0], ua[1], na[0], na[1], na[2]);
  out.push(pb[0], pb[1], pb[2], ub[0], ub[1], nb[0], nb[1], nb[2]);
  out.push(pc[0], pc[1], pc[2], uc[0], uc[1], nc[0], nc[1], nc[2]);
};

Model.prototype.render = function () {
  if (!this.loaded) return;

  gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);
  if (typeof u_NormalMatrix !== 'undefined' && u_NormalMatrix !== null) {
    var nm = Model._normalMat || (Model._normalMat = new Matrix4());
    nm.setInverseOf(this.matrix);
    nm.transpose();
    gl.uniformMatrix4fv(u_NormalMatrix, false, nm.elements);
  }
  gl.uniform4f(u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
  gl.uniform1i(u_whichTexture, -2);

  gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffer);
  var FSIZE = 4;
  var STRIDE = 8 * FSIZE;
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, STRIDE, 0);
  gl.vertexAttribPointer(a_UV,       2, gl.FLOAT, false, STRIDE, 3 * FSIZE);
  gl.vertexAttribPointer(a_Normal,   3, gl.FLOAT, false, STRIDE, 5 * FSIZE);
  gl.enableVertexAttribArray(a_Position);
  gl.enableVertexAttribArray(a_UV);
  gl.enableVertexAttribArray(a_Normal);
  gl.drawArrays(gl.TRIANGLES, 0, this.count);
};

// Centers + normalizes the model so its largest extent is `targetSize`,
// then translates it so the bottom sits at y=0.  Bakes into model matrix.
Model.prototype.normalizeFit = function (targetSize) {
  if (!this.loaded || this.count === 0) return;
  // Cheap second pass: read back the typed array we just uploaded.
  // Since we already discarded it, we instead recompute bounds here using
  // a quick re-read via gl.getBufferSubData... but WebGL1 doesn't have that.
  // So we stash the bounds during loadFromOBJText.  See loader update below.
  if (!this.bounds) return;
  var b = this.bounds;
  var cx = (b.min[0] + b.max[0]) / 2;
  var cy =  b.min[1];
  var cz = (b.min[2] + b.max[2]) / 2;
  var sx = b.max[0] - b.min[0];
  var sy = b.max[1] - b.min[1];
  var sz = b.max[2] - b.min[2];
  var maxExtent = Math.max(sx, sy, sz) || 1;
  var s = targetSize / maxExtent;
  var m = new Matrix4();
  m.setScale(s, s, s);
  m.translate(-cx, -cy, -cz);
  this.matrix = m;
};
