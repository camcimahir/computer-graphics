// Cube.js - shared static buffer with positions, UVs, and per-face normals.
// Layout per vertex: [px, py, pz, u, v, nx, ny, nz]  (stride = 32 bytes)

function CubeInstance() {
  this.matrix = new Matrix4();
  this.color = [1.0, 1.0, 1.0, 1.0];
  this.textureNum = -2;
}

var Cube = CubeInstance;

Cube.initBuffer = function () {
  if (Cube._buf) return;
  var verts = Cube._buildVertices();
  Cube._buf = gl.createBuffer();
  if (!Cube._buf) {
    console.log('Failed to create the cube buffer');
    return;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, Cube._buf);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  Cube._count = 36;
};

Cube._buildVertices = function () {
  var out = [];
  function face(p0, p1, p2, p3, n) {
    // Two triangles per face, all sharing the same outward normal.
    // p0=(0,0)  p1=(1,0)  p2=(1,1)  p3=(0,1) for UV mapping.
    out.push(p0[0], p0[1], p0[2], 0, 0, n[0], n[1], n[2]);
    out.push(p1[0], p1[1], p1[2], 1, 0, n[0], n[1], n[2]);
    out.push(p2[0], p2[1], p2[2], 1, 1, n[0], n[1], n[2]);
    out.push(p0[0], p0[1], p0[2], 0, 0, n[0], n[1], n[2]);
    out.push(p2[0], p2[1], p2[2], 1, 1, n[0], n[1], n[2]);
    out.push(p3[0], p3[1], p3[2], 0, 1, n[0], n[1], n[2]);
  }

  // Unit cube in [0,1]^3. Normals are outward from cube center (0.5,0.5,0.5).
  // -Z face (front, looking at +Z toward -Z)
  face([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, -1]);
  // +Z face (back)
  face([1, 0, 1], [0, 0, 1], [0, 1, 1], [1, 1, 1], [0, 0, 1]);
  // -X face (left)
  face([0, 0, 1], [0, 0, 0], [0, 1, 0], [0, 1, 1], [-1, 0, 0]);
  // +X face (right)
  face([1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0], [1, 0, 0]);
  // +Y face (top)
  face([0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1], [0, 1, 0]);
  // -Y face (bottom)
  face([0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 0, 0], [0, -1, 0]);

  return new Float32Array(out);
};

Cube.drawShared = function (model, color, texId) {
  gl.uniformMatrix4fv(u_ModelMatrix, false, model.elements);

  // Normal matrix = transpose(inverse(model)).  cuon-matrix has setInverseOf/transpose.
  if (typeof u_NormalMatrix !== 'undefined' && u_NormalMatrix !== null) {
    var nm = Cube._normalMat || (Cube._normalMat = new Matrix4());
    nm.setInverseOf(model);
    nm.transpose();
    gl.uniformMatrix4fv(u_NormalMatrix, false, nm.elements);
  }

  gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
  gl.uniform1i(u_whichTexture, texId);

  gl.bindBuffer(gl.ARRAY_BUFFER, Cube._buf);
  var FSIZE = 4;
  var STRIDE = 8 * FSIZE; // 32 bytes
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, STRIDE, 0);
  gl.vertexAttribPointer(a_UV,       2, gl.FLOAT, false, STRIDE, 3 * FSIZE);
  gl.vertexAttribPointer(a_Normal,   3, gl.FLOAT, false, STRIDE, 5 * FSIZE);
  gl.enableVertexAttribArray(a_Position);
  gl.enableVertexAttribArray(a_UV);
  gl.enableVertexAttribArray(a_Normal);
  gl.drawArrays(gl.TRIANGLES, 0, 36);
};

CubeInstance.prototype.render = function () {
  Cube.drawShared(this.matrix, this.color, this.textureNum);
};
