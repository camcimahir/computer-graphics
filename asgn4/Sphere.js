// Sphere.js - unit sphere centered at origin, radius 0.5.
// Built once with lat/long stacks and slices.
// Layout per vertex: [px, py, pz, u, v, nx, ny, nz]  (stride = 32 bytes)
// For a sphere centered at origin, the outward normal IS the (normalized) position.

function SphereInstance(stacks, slices) {
  this.matrix = new Matrix4();
  this.color = [1.0, 1.0, 1.0, 1.0];
  this.textureNum = -2;
  this.stacks = stacks || 24;
  this.slices = slices || 36;
}

var Sphere = SphereInstance;

Sphere._cache = {};

Sphere._getGeom = function (stacks, slices) {
  var key = stacks + 'x' + slices;
  var entry = Sphere._cache[key];
  if (entry && entry.glBuffer) return entry;

  var verts = [];
  // Latitude i in [0, stacks], longitude j in [0, slices].
  // theta in [0, PI] (from north pole down), phi in [0, 2*PI].
  var r = 0.5;
  var s, sl;
  for (s = 0; s < stacks; s++) {
    var t0 = (s     / stacks) * Math.PI;
    var t1 = ((s + 1) / stacks) * Math.PI;
    for (sl = 0; sl < slices; sl++) {
      var p0 = (sl     / slices) * 2 * Math.PI;
      var p1 = ((sl + 1) / slices) * 2 * Math.PI;

      // 4 corners of the quad on the unit sphere (centered at origin)
      function pos(t, p) {
        return [
          r * Math.sin(t) * Math.cos(p),
          r * Math.cos(t),
          r * Math.sin(t) * Math.sin(p)
        ];
      }
      var a = pos(t0, p0);
      var b = pos(t1, p0);
      var c = pos(t1, p1);
      var d = pos(t0, p1);

      // UVs by simple unwrap
      var ua = sl / slices,       va = 1 - s     / stacks;
      var ub = sl / slices,       vb = 1 - (s+1) / stacks;
      var uc = (sl+1) / slices,   vc = 1 - (s+1) / stacks;
      var ud = (sl+1) / slices,   vd = 1 - s     / stacks;

      // Normal = normalized position (since center is origin)
      function emit(p, u, v) {
        var len = Math.sqrt(p[0]*p[0] + p[1]*p[1] + p[2]*p[2]) || 1;
        verts.push(p[0], p[1], p[2], u, v, p[0]/len, p[1]/len, p[2]/len);
      }
      // Two tris per quad
      emit(a, ua, va); emit(b, ub, vb); emit(c, uc, vc);
      emit(a, ua, va); emit(c, uc, vc); emit(d, ud, vd);
    }
  }

  var arr = new Float32Array(verts);
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);

  entry = { glBuffer: buf, count: verts.length / 8 };
  Sphere._cache[key] = entry;
  return entry;
};

Sphere.drawShared = function (model, color, texId, stacks, slices) {
  var geom = Sphere._getGeom(stacks || 24, slices || 36);

  gl.uniformMatrix4fv(u_ModelMatrix, false, model.elements);

  if (typeof u_NormalMatrix !== 'undefined' && u_NormalMatrix !== null) {
    var nm = Sphere._normalMat || (Sphere._normalMat = new Matrix4());
    nm.setInverseOf(model);
    nm.transpose();
    gl.uniformMatrix4fv(u_NormalMatrix, false, nm.elements);
  }

  gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
  gl.uniform1i(u_whichTexture, texId);

  gl.bindBuffer(gl.ARRAY_BUFFER, geom.glBuffer);
  var FSIZE = 4;
  var STRIDE = 8 * FSIZE;
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, STRIDE, 0);
  gl.vertexAttribPointer(a_UV,       2, gl.FLOAT, false, STRIDE, 3 * FSIZE);
  gl.vertexAttribPointer(a_Normal,   3, gl.FLOAT, false, STRIDE, 5 * FSIZE);
  gl.enableVertexAttribArray(a_Position);
  gl.enableVertexAttribArray(a_UV);
  gl.enableVertexAttribArray(a_Normal);
  gl.drawArrays(gl.TRIANGLES, 0, geom.count);
};

SphereInstance.prototype.render = function () {
  Sphere.drawShared(this.matrix, this.color, this.textureNum, this.stacks, this.slices);
};
