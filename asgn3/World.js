// Utilized LLM's to generate parts of the code

var VSHADER_SOURCE =
  'precision mediump float;\n' +
  'attribute vec4 a_Position;\n' +
  'attribute vec2 a_UV;\n' +
  'varying vec2 v_UV;\n' +
  'uniform mat4 u_ModelMatrix;\n' +
  'uniform mat4 u_ViewMatrix;\n' +
  'uniform mat4 u_ProjectionMatrix;\n' +
  'uniform vec2 u_UVScale;\n' +
  'void main() {\n' +
  '  gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * a_Position;\n' +
  '  v_UV = a_UV * u_UVScale;\n' +
  '}\n';

var FSHADER_SOURCE =
  'precision mediump float;\n' +
  'varying vec2 v_UV;\n' +
  'uniform vec4 u_FragColor;\n' +
  'uniform sampler2D u_Sampler0;\n' +
  'uniform sampler2D u_Sampler1;\n' +
  'uniform sampler2D u_Sampler2;\n' +
  'uniform sampler2D u_Sampler3;\n' +
  'uniform int u_whichTexture;\n' +
  'void main() {\n' +
  '  if (u_whichTexture == -2) gl_FragColor = u_FragColor;\n' +
  '  else if (u_whichTexture == -1) gl_FragColor = vec4(v_UV, 1.0, 1.0);\n' +
  '  else if (u_whichTexture == 0) gl_FragColor = texture2D(u_Sampler0, v_UV);\n' +
  '  else if (u_whichTexture == 1) gl_FragColor = texture2D(u_Sampler1, v_UV);\n' +
  '  else if (u_whichTexture == 2) gl_FragColor = texture2D(u_Sampler2, v_UV);\n' +
  '  else gl_FragColor = texture2D(u_Sampler3, v_UV);\n' +
  '}\n';

var canvas;
var gl;
var a_Position;
var a_UV;
var u_FragColor;
var u_ModelMatrix;
var u_ViewMatrix;
var u_ProjectionMatrix;
var u_Sampler0;
var u_Sampler1;
var u_Sampler2;
var u_Sampler3;
var u_whichTexture;
var u_UVScale;

var camera;
var g_map;
var MAP_N = 64;
var HALF = MAP_N / 2;

var TEX_BRICK = 0;
var TEX_GRASS = 1;
var TEX_STONE = 3;

var keys = {};
var fpsLast = 0;
var fpsSmoothed = 0;
var _modelMat = new Matrix4();

function setupWebGL() {
  canvas = document.getElementById('webgl');
  gl = getWebGLContext(canvas, false);
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return false;
  }
  gl.enable(gl.DEPTH_TEST);
  return true;
}

function connectVariablesToGLSL() {
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to initialize shaders.');
    return false;
  }

  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  a_UV = gl.getAttribLocation(gl.program, 'a_UV');
  if (a_Position < 0 || a_UV < 0) {
    console.log('Failed to get attribute locations');
    return false;
  }

  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
  u_Sampler0 = gl.getUniformLocation(gl.program, 'u_Sampler0');
  u_Sampler1 = gl.getUniformLocation(gl.program, 'u_Sampler1');
  u_Sampler2 = gl.getUniformLocation(gl.program, 'u_Sampler2');
  u_Sampler3 = gl.getUniformLocation(gl.program, 'u_Sampler3');
  u_whichTexture = gl.getUniformLocation(gl.program, 'u_whichTexture');
  u_UVScale = gl.getUniformLocation(gl.program, 'u_UVScale');

  if (
    !u_FragColor ||
    !u_ModelMatrix ||
    !u_ViewMatrix ||
    !u_ProjectionMatrix ||
    !u_Sampler0 ||
    !u_Sampler1 ||
    !u_Sampler2 ||
    !u_Sampler3 ||
    !u_UVScale ||
    u_whichTexture === null
  ) {
    console.log('Failed to get one or more uniform locations');
    return false;
  }

  gl.uniform2f(u_UVScale, 1.0, 1.0);
  return true;
}

function isPowerOfTwo(n) {
  return (n & (n - 1)) === 0 && n > 0;
}

function uploadCanvasToUnit(unit, cnv, pixelated) {
  var tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cnv);
  var mag = pixelated ? gl.NEAREST : gl.LINEAR;
  var min = pixelated ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

  var samplerByUnit = [u_Sampler0, u_Sampler1, u_Sampler2, u_Sampler3];
  gl.uniform1i(samplerByUnit[unit], unit);
}

function uploadProceduralFallback(unit) {
  var SIZE = 64;
  var cnv = document.createElement('canvas');
  cnv.width = SIZE;
  cnv.height = SIZE;
  var ctx = cnv.getContext('2d');
  var fills = ['#9c6040', '#5a9a3e', '#87ceeb', '#7d7d7d'];
  ctx.fillStyle = fills[unit] || '#888888';
  ctx.fillRect(0, 0, SIZE, SIZE);
  uploadCanvasToUnit(unit, cnv, true);
}

/** Matsuda-style: loadImage → texImage2D → sampler uniform (assignment expects real image files + local server). */
function sendImageToTextureUnit(image, unit, pixelated) {
  var tex = gl.createTexture();
  if (!tex) {
    uploadProceduralFallback(unit);
    return;
  }
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

  var w = image.width;
  var h = image.height;
  var isPOT = isPowerOfTwo(w) && isPowerOfTwo(h);

  if (!isPOT) {
    console.warn('Dynamically resizing ' + w + 'x' + h + ' to power of two to support WebGL1 REPEAT.');
    var potW = 1; while (potW < w) potW *= 2;
    var potH = 1; while (potH < h) potH *= 2;
    var cnv = document.createElement('canvas');
    cnv.width = potW;
    cnv.height = potH;
    var ctx = cnv.getContext('2d');
    ctx.drawImage(image, 0, 0, potW, potH);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cnv);
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  }

  var mag = pixelated ? gl.NEAREST : gl.LINEAR;
  var min = pixelated ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag);

  // Now we can ALWAYS repeat, because we guaranteed it is POT!
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

  var samplerByUnit = [u_Sampler0, u_Sampler1, u_Sampler2, u_Sampler3];
  gl.uniform1i(samplerByUnit[unit], unit);
}

/** Encode spaces/special chars in the filename (last path segment only). */
function textureUrl(path) {
  var i = path.lastIndexOf('/');
  if (i === -1) return encodeURIComponent(path);
  return path.substring(0, i + 1) + encodeURIComponent(path.substring(i + 1));
}

/**
 * Block textures (sky is solid color in drawSkybox, not a file).
 */
var TEXTURE_MANIFEST = [
  { unit: TEX_BRICK, url: textureUrl('textures/brick texture.webp'), nearest: true },
  { unit: TEX_GRASS, url: textureUrl('textures/minecraft texture.webp'), nearest: true },
  { unit: TEX_STONE, url: textureUrl('textures/stone texture.webp'), nearest: true }
];

function loadAllTextures(callback) {
  var n = TEXTURE_MANIFEST.length;
  var done = 0;

  function finishedOne() {
    done++;
    if (done >= n) callback();
  }

  for (var i = 0; i < n; i++) {
    (function (entry) {
      var img = new Image();
      img.onload = function () {
        sendImageToTextureUnit(img, entry.unit, entry.nearest);
        finishedOne();
      };
      img.onerror = function () {
        console.warn('Could not load texture (add file or check path):', entry.url);
        uploadProceduralFallback(entry.unit);
        finishedOne();
      };
      img.src = entry.url;
    })(TEXTURE_MANIFEST[i]);
  }
}

function buildMap() {
  var m = [];
  var z;
  var x;
  for (z = 0; z < MAP_N; z++) {
    var row = new Array(MAP_N);
    for (x = 0; x < MAP_N; x++) row[x] = 0;
    m.push(row);
  }

  var i;
  for (i = 0; i < MAP_N; i++) {
    m[0][i] = 4;
    m[MAP_N - 1][i] = 4;
    m[i][0] = 4;
    m[i][MAP_N - 1] = 4;
  }

  for (i = 10; i <= 14; i++) {
    m[10][i] = 2;
    m[14][i] = 2;
    m[i][10] = 2;
    m[i][14] = 2;
  }
  m[12][10] = 0;

  var pillars = [
    [6, 6, 3],
    [25, 6, 3],
    [6, 25, 3],
    [25, 25, 3],
    [16, 16, 4],
    [16, 6, 1],
    [16, 25, 1],
    [6, 16, 1],
    [25, 16, 1],
    [20, 20, 2],
    [11, 21, 2],
    [21, 11, 2]
  ];
  var pi;
  for (pi = 0; pi < pillars.length; pi++) {
    var p = pillars[pi];
    m[p[1]][p[0]] = p[2];
  }

  // Large parkour course taking advantage of high jump
  m[18][30] = 1;
  m[21][30] = 3; // Gap of 3, up 2
  m[25][30] = 5; // Gap of 4, up 2
  m[29][30] = 7; // Gap of 4, up 2
  m[33][30] = 9; // Gap of 4, up 2

  // Platform 1 (Height 10)
  for (var px = 29; px <= 31; px++) {
    for (var pz = 35; pz <= 37; pz++) {
      m[pz][px] = 10;
    }
  }

  // Floating stepping stones across the map
  m[36][24] = 10;
  m[36][18] = 10;
  m[36][12] = 10;

  // Final Platform (Height 12)
  for (var px = 7; px <= 10; px++) {
    for (var pz = 35; pz <= 38; pz++) {
      m[pz][px] = 12;
    }
  }

  return m;
}

function getGroundHeightAt(wx, wz) {
  var r = 0.3; // Player radius (width of bounding box)
  var minX = Math.floor(wx - r + HALF);
  var maxX = Math.floor(wx + r + HALF);
  var minZ = Math.floor(wz - r + HALF);
  var maxZ = Math.floor(wz + r + HALF);

  var maxH = 0;
  for (var z = minZ; z <= maxZ; z++) {
    for (var x = minX; x <= maxX; x++) {
      var h = 0;
      if (x >= 0 && x < MAP_N && z >= 0 && z < MAP_N) {
        h = g_map[z][x];
      }
      if (h > maxH) {
        maxH = h;
      }
    }
  }
  return maxH;
}

function cellTexId(x, z) {
  return x === 0 || x === MAP_N - 1 || z === 0 || z === MAP_N - 1 ? TEX_BRICK : TEX_STONE;
}

function setCubeCentered(m, cx, cy, cz, sx, sy, sz) {
  m.setTranslate(cx, cy, cz);
  m.scale(sx, sy, sz);
  m.translate(-0.5, -0.5, -0.5);
}

function setCubeCorner(m, x, y, z, sx, sy, sz) {
  m.setTranslate(x, y, z);
  m.scale(sx, sy, sz);
}

function drawSkybox() {
  setCubeCentered(_modelMat, 0, 0, 0, 1000, 1000, 1000);
  Cube.drawShared(_modelMat, [0.42, 0.68, 1.0, 1.0], -2);
}

function drawGround() {
  gl.uniform2f(u_UVScale, MAP_N, MAP_N);
  setCubeCentered(_modelMat, 0, -0.51, 0, MAP_N, 1, MAP_N);
  Cube.drawShared(_modelMat, [1, 1, 1, 1], TEX_GRASS);
  gl.uniform2f(u_UVScale, 1.0, 1.0);
}

function drawMap() {
  var z;
  var x;
  var y;
  for (z = 0; z < MAP_N; z++) {
    var row = g_map[z];
    for (x = 0; x < MAP_N; x++) {
      var h = row[x];
      if (h > 0) {
        var texId = cellTexId(x, z);
        var wx = x - HALF;
        var wz = z - HALF;
        for (y = 0; y < h; y++) {
          setCubeCorner(_modelMat, wx, y, wz, 1, 1, 1);
          Cube.drawShared(_modelMat, [1, 1, 1, 1], texId);
        }
      }
    }
  }
}

// Animal animation variables
var g_leftArmAngle = 0;
var g_leftArmFwdAngle = 0;
var g_leftForearmAngle = 0;
var g_rightArmAngle = 0;
var g_rightArmFwdAngle = 0;
var g_rightForearmAngle = 0;
var g_leftLegAngle = 0;
var g_leftShinAngle = 0;
var g_leftLegOutAngle = 0;
var g_rightLegAngle = 0;
var g_rightShinAngle = 0;
var g_rightLegOutAngle = 0;
var g_leftWristAngle = 0;
var g_rightWristAngle = 0;
var g_leftAnkleAngle = 0;
var g_rightAnkleAngle = 0;
var g_bodyOffsetY = 0;
var g_bodySpinY = 0;
var g_animalX = 2;
var g_animalZ = -2;
var g_animalRot = 0;

var g_startTime = performance.now() / 1000.0;
var g_seconds = 0;
var g_animalState = 'WALK';
var g_walkAngle = 0;
var g_danceStart = 0;

function updateAnimationAngles() {
  var dt = performance.now() / 1000.0 - g_startTime - g_seconds;
  g_seconds = performance.now() / 1000.0 - g_startTime;

  if (g_animalState === 'WALK') {
    var pathRadius = 3.5;
    var walkSpeed = 0.6;
    g_walkAngle += walkSpeed * dt;

    g_animalX = pathRadius * Math.cos(g_walkAngle);
    g_animalZ = pathRadius * Math.sin(g_walkAngle);

    var dx = -Math.sin(g_walkAngle);
    var dz = Math.cos(g_walkAngle);
    g_animalRot = Math.atan2(dx, dz) * 180 / Math.PI;

    var omega = 3.6;
    var t = g_seconds * omega;
    var c = Math.cos(t);

    g_leftArmAngle = 90;
    g_rightArmAngle = 90;
    g_leftArmFwdAngle = -55 * c;
    g_rightArmFwdAngle = 55 * c;
    g_leftForearmAngle = 90 + 8 * c;
    g_rightForearmAngle = 90 - 8 * c;
    g_leftWristAngle = 0;
    g_rightWristAngle = 0;

    g_leftLegAngle = 45 * c;
    g_rightLegAngle = -45 * c;
    g_leftLegOutAngle = 0;
    g_rightLegOutAngle = 0;
    g_leftShinAngle = 60 + 55 * c;
    g_rightShinAngle = 60 - 55 * c;
    g_leftAnkleAngle = 15 * c;
    g_rightAnkleAngle = -15 * c;

    g_bodyOffsetY = 0.025 * Math.abs(c) - 0.012;
    g_bodySpinY = 0;

    // Check if a full circle is completed
    if (g_walkAngle >= Math.PI * 2) {
      g_walkAngle = 0;
      g_animalState = 'DANCE';
      g_danceStart = g_seconds;
    }
  } else if (g_animalState === 'DANCE') {
    var pokeDuration = 4.0;
    var pt = g_seconds - g_danceStart;

    if (pt >= pokeDuration) {
      g_animalState = 'WALK';
    } else {
      var omega = 10.0;
      var beat = pt * omega;
      var s = Math.sin(beat);
      var dip = Math.abs(s);
      var step = Math.sin(beat * 0.5);

      g_leftArmAngle = -15 * s;
      g_rightArmAngle = -15 * s;
      g_leftArmFwdAngle = 0;
      g_rightArmFwdAngle = 0;
      g_leftForearmAngle = 0;
      g_rightForearmAngle = 0;
      g_leftWristAngle = 25 * s;
      g_rightWristAngle = -25 * s;

      g_leftLegAngle = 5 + 10 * step;
      g_rightLegAngle = 5 - 10 * step;
      g_leftLegOutAngle = 0;
      g_rightLegOutAngle = 0;
      g_leftShinAngle = 25 + 30 * dip;
      g_rightShinAngle = 25 + 30 * dip;
      g_leftAnkleAngle = 0;
      g_rightAnkleAngle = 0;

      g_bodyOffsetY = -0.05 * dip;
      // Add a cool spin during the dance!
      g_bodySpinY = pt * 180;
    }
  }
}

var C_BODY = [0.50, 0.40, 0.28, 1.0];
var C_HEAD = [0.55, 0.45, 0.30, 1.0];
var C_FACE = [0.85, 0.74, 0.58, 1.0];
var C_BELLY = [0.72, 0.60, 0.45, 1.0];
var C_EYE = [0.10, 0.06, 0.04, 1.0];
var C_LIMB = [0.50, 0.40, 0.28, 1.0];
var C_HAND = [0.40, 0.30, 0.20, 1.0];
var C_CLAW = [0.18, 0.12, 0.06, 1.0];

function drawAnimal() {
  var ax = g_animalX;
  var az = g_animalZ;
  var ay = 0.3;

  var bodyFrame = new Matrix4();
  bodyFrame.translate(ax, ay + 0.5 + g_bodyOffsetY, az);
  bodyFrame.rotate(g_animalRot + g_bodySpinY, 0, 1, 0);

  var body = new Cube();
  body.color = C_BODY;
  body.matrix = new Matrix4(bodyFrame);
  body.matrix.translate(-0.18, -0.275, -0.15);
  body.matrix.scale(0.36, 0.55, 0.30);
  body.render();

  var belly = new Cube();
  belly.color = C_BELLY;
  belly.matrix = new Matrix4(bodyFrame);
  belly.matrix.translate(-0.13, -0.24, -0.16);
  belly.matrix.scale(0.26, 0.45, 0.02);
  belly.render();

  var headFrame = new Matrix4(bodyFrame);
  headFrame.translate(0, 0.30, -0.02);

  var head = new Cube();
  head.color = C_HEAD;
  head.matrix = new Matrix4(headFrame);
  head.matrix.translate(-0.15, -0.04, -0.15);
  head.matrix.scale(0.30, 0.26, 0.30);
  head.render();

  var faceMask = new Cube();
  faceMask.color = C_FACE;
  faceMask.matrix = new Matrix4(headFrame);
  faceMask.matrix.translate(-0.12, -0.02, -0.16);
  faceMask.matrix.scale(0.24, 0.18, 0.02);
  faceMask.render();

  var snout = new Cube();
  snout.color = C_FACE;
  snout.matrix = new Matrix4(headFrame);
  snout.matrix.translate(-0.06, -0.09, -0.19);
  snout.matrix.scale(0.12, 0.09, 0.04);
  snout.render();

  var nose = new Cube();
  nose.color = C_EYE;
  nose.matrix = new Matrix4(headFrame);
  nose.matrix.translate(-0.035, -0.07, -0.21);
  nose.matrix.scale(0.07, 0.03, 0.02);
  nose.render();

  var leftEye = new Cube();
  leftEye.color = C_EYE;
  leftEye.matrix = new Matrix4(headFrame);
  leftEye.matrix.translate(-0.115, 0.04, -0.17);
  leftEye.matrix.scale(0.06, 0.05, 0.02);
  leftEye.render();

  var rightEye = new Cube();
  rightEye.color = C_EYE;
  rightEye.matrix = new Matrix4(headFrame);
  rightEye.matrix.translate(0.055, 0.04, -0.17);
  rightEye.matrix.scale(0.06, 0.05, 0.02);
  rightEye.render();

  var leftShoulderFrame = new Matrix4(bodyFrame);
  leftShoulderFrame.translate(-0.18, 0.18, 0);
  leftShoulderFrame.rotate(g_leftArmFwdAngle, 1, 0, 0);
  leftShoulderFrame.rotate(g_leftArmAngle, 0, 0, 1);

  var leftArm = new Cylinder(16);
  leftArm.color = C_LIMB;
  leftArm.matrix = new Matrix4(leftShoulderFrame);
  leftArm.matrix.scale(-0.30, 0.10, 0.10);
  leftArm.render();

  var leftElbowFrame = new Matrix4(leftShoulderFrame);
  leftElbowFrame.translate(-0.30, 0, 0);
  leftElbowFrame.rotate(-g_leftForearmAngle, 0, 1, 0);

  var leftForearm = new Cube();
  leftForearm.color = C_LIMB;
  leftForearm.matrix = new Matrix4(leftElbowFrame);
  leftForearm.matrix.scale(0.26, 0.08, 0.08);
  leftForearm.matrix.translate(-1, -0.5, -0.5);
  leftForearm.render();

  var leftWristFrame = new Matrix4(leftElbowFrame);
  leftWristFrame.translate(-0.26, 0, 0);
  leftWristFrame.rotate(90, 1, 0, 0);
  leftWristFrame.rotate(-g_leftWristAngle, 0, 0, 1);

  var leftPalm = new Cube();
  leftPalm.color = C_HAND;
  leftPalm.matrix = new Matrix4(leftWristFrame);
  leftPalm.matrix.scale(0.06, 0.10, 0.14);
  leftPalm.matrix.translate(-1, -0.5, -0.5);
  leftPalm.render();

  for (var ci = 0; ci < 3; ci++) {
    var claw = new Cube();
    claw.color = C_CLAW;
    claw.matrix = new Matrix4(leftWristFrame);
    claw.matrix.translate(-0.06, -0.005, (ci - 1) * 0.045);
    claw.matrix.rotate(15, 0, 0, 1);
    claw.matrix.scale(0.14, 0.022, 0.024);
    claw.matrix.translate(-1, -0.5, -0.5);
    claw.render();
  }

  var rightShoulderFrame = new Matrix4(bodyFrame);
  rightShoulderFrame.translate(0.18, 0.18, 0);
  rightShoulderFrame.rotate(g_rightArmFwdAngle, 1, 0, 0);
  rightShoulderFrame.rotate(-g_rightArmAngle, 0, 0, 1);

  var rightArm = new Cylinder(16);
  rightArm.color = C_LIMB;
  rightArm.matrix = new Matrix4(rightShoulderFrame);
  rightArm.matrix.scale(0.30, 0.10, 0.10);
  rightArm.render();

  var rightElbowFrame = new Matrix4(rightShoulderFrame);
  rightElbowFrame.translate(0.30, 0, 0);
  rightElbowFrame.rotate(g_rightForearmAngle, 0, 1, 0);

  var rightForearm = new Cube();
  rightForearm.color = C_LIMB;
  rightForearm.matrix = new Matrix4(rightElbowFrame);
  rightForearm.matrix.scale(0.26, 0.08, 0.08);
  rightForearm.matrix.translate(0, -0.5, -0.5);
  rightForearm.render();

  var rightWristFrame = new Matrix4(rightElbowFrame);
  rightWristFrame.translate(0.26, 0, 0);
  rightWristFrame.rotate(90, 1, 0, 0);
  rightWristFrame.rotate(g_rightWristAngle, 0, 0, 1);

  var rightPalm = new Cube();
  rightPalm.color = C_HAND;
  rightPalm.matrix = new Matrix4(rightWristFrame);
  rightPalm.matrix.scale(0.06, 0.10, 0.14);
  rightPalm.matrix.translate(0, -0.5, -0.5);
  rightPalm.render();

  for (var cj = 0; cj < 3; cj++) {
    var clawR = new Cube();
    clawR.color = C_CLAW;
    clawR.matrix = new Matrix4(rightWristFrame);
    clawR.matrix.translate(0.06, -0.005, (cj - 1) * 0.045);
    clawR.matrix.rotate(-15, 0, 0, 1);
    clawR.matrix.scale(0.14, 0.022, 0.024);
    clawR.matrix.translate(0, -0.5, -0.5);
    clawR.render();
  }

  var leftHipFrame = new Matrix4(bodyFrame);
  leftHipFrame.translate(-0.10, -0.275, 0);
  leftHipFrame.rotate(-g_leftLegOutAngle, 0, 0, 1);
  leftHipFrame.rotate(g_leftLegAngle, 1, 0, 0);

  var leftLeg = new Cube();
  leftLeg.color = C_LIMB;
  leftLeg.matrix = new Matrix4(leftHipFrame);
  leftLeg.matrix.scale(0.13, 0.26, 0.13);
  leftLeg.matrix.translate(-0.5, -1, -0.5);
  leftLeg.render();

  var leftKneeFrame = new Matrix4(leftHipFrame);
  leftKneeFrame.translate(0, -0.26, 0);
  leftKneeFrame.rotate(-g_leftShinAngle, 1, 0, 0);

  var leftShin = new Cube();
  leftShin.color = C_LIMB;
  leftShin.matrix = new Matrix4(leftKneeFrame);
  leftShin.matrix.scale(0.11, 0.20, 0.11);
  leftShin.matrix.translate(-0.5, -1, -0.5);
  leftShin.render();

  var leftAnkleFrame = new Matrix4(leftKneeFrame);
  leftAnkleFrame.translate(0, -0.20, 0);
  leftAnkleFrame.rotate(g_leftAnkleAngle, 1, 0, 0);

  var leftFoot = new Cube();
  leftFoot.color = C_HAND;
  leftFoot.matrix = new Matrix4(leftAnkleFrame);
  leftFoot.matrix.scale(0.12, 0.05, 0.16);
  leftFoot.matrix.translate(-0.5, -1, -0.7);
  leftFoot.render();

  for (var fi = 0; fi < 3; fi++) {
    var fclaw = new Cube();
    fclaw.color = C_CLAW;
    fclaw.matrix = new Matrix4(leftAnkleFrame);
    fclaw.matrix.translate((fi - 1) * 0.04, -0.045, -0.115);
    fclaw.matrix.rotate(-15, 1, 0, 0);
    fclaw.matrix.scale(0.024, 0.022, 0.13);
    fclaw.matrix.translate(-0.5, -0.5, -1);
    fclaw.render();
  }

  var rightHipFrame = new Matrix4(bodyFrame);
  rightHipFrame.translate(0.10, -0.275, 0);
  rightHipFrame.rotate(g_rightLegOutAngle, 0, 0, 1);
  rightHipFrame.rotate(g_rightLegAngle, 1, 0, 0);

  var rightLeg = new Cube();
  rightLeg.color = C_LIMB;
  rightLeg.matrix = new Matrix4(rightHipFrame);
  rightLeg.matrix.scale(0.13, 0.26, 0.13);
  rightLeg.matrix.translate(-0.5, -1, -0.5);
  rightLeg.render();

  var rightKneeFrame = new Matrix4(rightHipFrame);
  rightKneeFrame.translate(0, -0.26, 0);
  rightKneeFrame.rotate(-g_rightShinAngle, 1, 0, 0);

  var rightShin = new Cube();
  rightShin.color = C_LIMB;
  rightShin.matrix = new Matrix4(rightKneeFrame);
  rightShin.matrix.scale(0.11, 0.20, 0.11);
  rightShin.matrix.translate(-0.5, -1, -0.5);
  rightShin.render();

  var rightAnkleFrame = new Matrix4(rightKneeFrame);
  rightAnkleFrame.translate(0, -0.20, 0);
  rightAnkleFrame.rotate(g_rightAnkleAngle, 1, 0, 0);

  var rightFoot = new Cube();
  rightFoot.color = C_HAND;
  rightFoot.matrix = new Matrix4(rightAnkleFrame);
  rightFoot.matrix.scale(0.12, 0.05, 0.16);
  rightFoot.matrix.translate(-0.5, -1, -0.7);
  rightFoot.render();

  for (var fj = 0; fj < 3; fj++) {
    var fclawR = new Cube();
    fclawR.color = C_CLAW;
    fclawR.matrix = new Matrix4(rightAnkleFrame);
    fclawR.matrix.translate((fj - 1) * 0.04, -0.045, -0.115);
    fclawR.matrix.rotate(-15, 1, 0, 0);
    fclawR.matrix.scale(0.024, 0.022, 0.13);
    fclawR.matrix.translate(-0.5, -0.5, -1);
    fclawR.render();
  }
}

function renderScene() {
  gl.uniformMatrix4fv(u_ViewMatrix, false, camera.viewMatrix.elements);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, camera.projectionMatrix.elements);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  drawSkybox();
  drawGround();
  drawMap();
  drawAnimal();
}

function processKeys() {
  var speed = 0.072; // 80% of original 0.09
  var turn = 1.25;

  var oldX = camera.eye.elements[0];
  var oldZ = camera.eye.elements[2];

  if (keys.w) camera.moveForward(speed);
  if (keys.s) camera.moveBackwards(speed);
  if (keys.a) camera.moveLeft(speed);
  if (keys.d) camera.moveRight(speed);
  if (keys.q) camera.panLeft(turn);
  if (keys.e) camera.panRight(turn);

  if (keys[' ']) camera.jump();

  var e = camera.eye.elements;
  var a = camera.at.elements;

  var minXZ = -HALF + 1.1;
  var maxXZ = HALF - 1.1;
  function clamp(v) {
    return Math.max(minXZ, Math.min(maxXZ, v));
  }

  // Boundary collisions
  var cx = clamp(e[0]);
  if (cx !== e[0]) {
    var diffX = cx - e[0];
    e[0] += diffX;
    a[0] += diffX;
  }
  var cz = clamp(e[2]);
  if (cz !== e[2]) {
    var diffZ = cz - e[2];
    e[2] += diffZ;
    a[2] += diffZ;
  }

  // Wall collisions (AABB)
  var newX = e[0];
  var newZ = e[2];
  var playerFeetY = e[1] - 1.5;

  var floorX = getGroundHeightAt(newX, oldZ);
  if (playerFeetY < floorX - 0.1) {
    var dX = oldX - newX;
    e[0] += dX;
    a[0] += dX;
    newX = oldX;
  }

  var floorZ = getGroundHeightAt(newX, newZ);
  if (playerFeetY < floorZ - 0.1) {
    var dZ = oldZ - newZ;
    e[2] += dZ;
    a[2] += dZ;
  }

  camera._updateView();
}

function setupKeyboard() {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
}

function onKeyDown(ev) {
  var k = ev.key.toLowerCase();
  keys[k] = true;
  if (k === 'f') addBlock();
  else if (k === 'g') deleteBlock();
}

function onKeyUp(ev) {
  keys[ev.key.toLowerCase()] = false;
}

function setupMouse() {
  canvas.addEventListener('click', onCanvasClick);
  document.addEventListener('mousemove', onMouseMoveDoc);
}

function onCanvasClick(ev) {
  if (ev.shiftKey) {
    g_animalState = 'DANCE';
    g_danceStart = performance.now() / 1000.0 - g_startTime;
    return;
  }
  if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
}

function onMouseMoveDoc(ev) {
  if (document.pointerLockElement !== canvas) return;
  var sens = 0.075;
  camera.panRight(ev.movementX * sens);
  camera.panUp(-ev.movementY * sens);
}

function targetCell() {
  var f = camera.forwardVec();
  f.normalize();
  var fx = f.elements[0];
  var fz = f.elements[2];
  var wx = camera.eye.elements[0] + fx * 1.6;
  var wz = camera.eye.elements[2] + fz * 1.6;
  var mx = Math.floor(wx + HALF);
  var mz = Math.floor(wz + HALF);
  return { mx: mx, mz: mz };
}

function addBlock() {
  var t = targetCell();
  if (t.mx < 0 || t.mx >= MAP_N || t.mz < 0 || t.mz >= MAP_N) return;
  g_map[t.mz][t.mx] = Math.min(4, g_map[t.mz][t.mx] + 1);
}

function deleteBlock() {
  var t = targetCell();
  if (t.mx < 0 || t.mx >= MAP_N || t.mz < 0 || t.mz >= MAP_N) return;
  g_map[t.mz][t.mx] = Math.max(0, g_map[t.mz][t.mx] - 1);
}

function updateHud() {
  var now = performance.now();
  if (fpsLast > 0) {
    var dt = now - fpsLast;
    if (dt > 0) {
      var inst = 1000 / dt;
      fpsSmoothed = fpsSmoothed === 0 ? inst : fpsSmoothed * 0.9 + inst * 0.1;
    }
  }
  fpsLast = now;
  var hud = document.getElementById('hud');
  if (hud) {
    var e = camera.eye.elements;
    hud.textContent =
      'FPS: ' +
      Math.round(fpsSmoothed) +
      '  pos: (' +
      e[0].toFixed(1) +
      ', ' +
      e[1].toFixed(1) +
      ', ' +
      e[2].toFixed(1) +
      ')  WASD QE  mouse  SPACE to jump';
  }
}

function tick() {
  updateAnimationAngles();
  processKeys();

  var wx = camera.eye.elements[0];
  var wz = camera.eye.elements[2];
  camera.applyPhysics(getGroundHeightAt(wx, wz));

  renderScene();
  updateHud();
  requestAnimationFrame(tick);
}

function main() {
  if (!setupWebGL()) return;
  if (!connectVariablesToGLSL()) return;

  Cube.initBuffer();

  loadAllTextures(function () {
    g_map = buildMap();
    camera = new Camera(canvas);

    setupKeyboard();
    setupMouse();

    gl.clearColor(0.53, 0.81, 1.0, 1.0);

    requestAnimationFrame(tick);
  });
}

window.main = main;

function startWorldWhenReady() {
  main();
}

startWorldWhenReady();

