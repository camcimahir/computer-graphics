// Assignment 4 - Phong Lighting
// Builds on asgn3 (world + animal + first-person camera).
// Adds: per-vertex normals, point light + spot light (Phong), normal viz,
// lighting on/off, spotlight on/off, an OBJ-loaded model, and a sphere.

// ============================================================================
// SHADERS
// ============================================================================

var VSHADER_SOURCE = [
  'precision mediump float;',
  'attribute vec4 a_Position;',
  'attribute vec2 a_UV;',
  'attribute vec3 a_Normal;',
  'uniform mat4 u_ModelMatrix;',
  'uniform mat4 u_ViewMatrix;',
  'uniform mat4 u_ProjectionMatrix;',
  'uniform mat4 u_NormalMatrix;',
  'uniform vec2 u_UVScale;',
  'varying vec2 v_UV;',
  'varying vec3 v_Normal;',
  'varying vec3 v_WorldPos;',
  'void main() {',
  '  vec4 world = u_ModelMatrix * a_Position;',
  '  gl_Position = u_ProjectionMatrix * u_ViewMatrix * world;',
  '  v_UV = a_UV * u_UVScale;',
  '  v_Normal = normalize(vec3(u_NormalMatrix * vec4(a_Normal, 0.0)));',
  '  v_WorldPos = world.xyz;',
  '}'
].join('\n');

var FSHADER_SOURCE = [
  'precision mediump float;',
  'varying vec2 v_UV;',
  'varying vec3 v_Normal;',
  'varying vec3 v_WorldPos;',
  '',
  'uniform vec4 u_FragColor;',
  'uniform sampler2D u_Sampler0;',
  'uniform sampler2D u_Sampler1;',
  'uniform sampler2D u_Sampler2;',
  'uniform sampler2D u_Sampler3;',
  'uniform int  u_whichTexture;',
  '',
  'uniform bool u_NormalViz;',
  'uniform bool u_LightingOn;',
  'uniform bool u_PointOn;',
  'uniform bool u_SpotOn;',
  '',
  'uniform vec3 u_CameraPos;',
  '',
  'uniform vec3 u_LightPos;',
  'uniform vec3 u_LightColor;',
  '',
  'uniform vec3 u_SpotPos;',
  'uniform vec3 u_SpotDir;',
  'uniform vec3 u_SpotColor;',
  'uniform float u_SpotCosInner;',
  'uniform float u_SpotCosOuter;',
  '',
  'vec4 baseColor() {',
  '  if (u_whichTexture == -2)      return u_FragColor;',
  '  else if (u_whichTexture == -1) return vec4(v_UV, 1.0, 1.0);',
  '  else if (u_whichTexture == 0)  return texture2D(u_Sampler0, v_UV);',
  '  else if (u_whichTexture == 1)  return texture2D(u_Sampler1, v_UV);',
  '  else if (u_whichTexture == 2)  return texture2D(u_Sampler2, v_UV);',
  '  else                           return texture2D(u_Sampler3, v_UV);',
  '}',
  '',
  'void main() {',
  '  vec3 N = normalize(v_Normal);',
  '',
  '  if (u_NormalViz) {',
  '    gl_FragColor = vec4(N * 0.5 + 0.5, 1.0);',
  '    return;',
  '  }',
  '',
  '  vec4 base = baseColor();',
  '',
  '  if (!u_LightingOn) {',
  '    gl_FragColor = base;',
  '    return;',
  '  }',
  '',
  '  vec3 V = normalize(u_CameraPos - v_WorldPos);',
  '  vec3 ambient = 0.2 * base.rgb;',
  '  vec3 diffuse = vec3(0.0);',
  '  vec3 specular = vec3(0.0);',
  '',
  '  // ---- Point light ----',
  '  if (u_PointOn) {',
  '    vec3 L = u_LightPos - v_WorldPos;',
  '    float dist = length(L);',
  '    L = L / max(dist, 0.0001);',
  '    float attn = 1.0 / (1.0 + 0.02*dist + 0.003*dist*dist);',
  '    float ndotl = max(dot(N, L), 0.0);',
  '    diffuse += attn * ndotl * u_LightColor * base.rgb;',
  '    if (ndotl > 0.0) {',
  '      vec3 R = reflect(-L, N);',
  '      float spec = pow(max(dot(R, V), 0.0), 32.0);',
  '      specular += attn * spec * u_LightColor * 0.7;',
  '    }',
  '  }',
  '',
  '  // ---- Spot light ----',
  '  if (u_SpotOn) {',
  '    vec3 L = u_SpotPos - v_WorldPos;',
  '    float dist = length(L);',
  '    L = L / max(dist, 0.0001);',
  '    vec3 D = normalize(-u_SpotDir);',
  '    float cosTheta = dot(L, D);',
  '    // Smooth falloff between outer and inner cone.',
  '    float t = clamp((cosTheta - u_SpotCosOuter) / max(u_SpotCosInner - u_SpotCosOuter, 0.0001), 0.0, 1.0);',
  '    if (t > 0.0) {',
  '      float attn = 1.0 / (1.0 + 0.02*dist + 0.003*dist*dist);',
  '      float ndotl = max(dot(N, L), 0.0);',
  '      diffuse  += t * attn * ndotl * u_SpotColor * base.rgb;',
  '      if (ndotl > 0.0) {',
  '        vec3 R = reflect(-L, N);',
  '        float spec = pow(max(dot(R, V), 0.0), 48.0);',
  '        specular += t * attn * spec * u_SpotColor * 0.8;',
  '      }',
  '    }',
  '  }',
  '',
  '  vec3 color = ambient + diffuse + specular;',
  '  gl_FragColor = vec4(color, base.a);',
  '}'
].join('\n');

// ============================================================================
// GLOBALS
// ============================================================================

var canvas, gl;
var a_Position, a_UV, a_Normal;
var u_FragColor;
var u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix, u_NormalMatrix;
var u_Sampler0, u_Sampler1, u_Sampler2, u_Sampler3, u_whichTexture, u_UVScale;
var u_NormalViz, u_LightingOn, u_PointOn, u_SpotOn;
var u_CameraPos;
var u_LightPos, u_LightColor;
var u_SpotPos, u_SpotDir, u_SpotColor, u_SpotCosInner, u_SpotCosOuter;

var camera;
var g_map;
var MAP_N = 24;     // Smaller world than asgn3 so we focus on lighting
var HALF = MAP_N / 2;

var TEX_BRICK = 0;
var TEX_GRASS = 1;
var TEX_STONE = 3;

var keys = {};
var fpsLast = 0;
var fpsSmoothed = 0;
var _modelMat = new Matrix4();

// UI-controlled state
var g_lightingOn = true;
var g_normalViz  = false;
var g_pointOn    = true;
var g_spotOn     = true;
var g_animateLight = true;

var g_lightPos = [3.0, 4.0, 3.0];
var g_lightColor = [1.0, 1.0, 1.0];

var g_spotPos = [0.0, 6.0, 0.0];
var g_spotDir = [0.0, -1.0, 0.0];
var g_spotCutoffDeg = 18.0;
var g_spotPenumbraDeg = 6.0;
var g_spotColor = [1.0, 0.95, 0.8];

var g_model = null;        // OBJ-loaded model

// ============================================================================
// WEBGL SETUP
// ============================================================================

function setupWebGL() {
  canvas = document.getElementById('webgl');
  gl = getWebGLContext(canvas, false);
  if (!gl) {
    console.log('Failed to get WebGL context');
    return false;
  }
  gl.enable(gl.DEPTH_TEST);
  return true;
}

function getUniform(name) {
  var u = gl.getUniformLocation(gl.program, name);
  if (u === null) console.warn('Missing uniform: ' + name);
  return u;
}

function connectVariablesToGLSL() {
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to initialize shaders.');
    return false;
  }

  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  a_UV       = gl.getAttribLocation(gl.program, 'a_UV');
  a_Normal   = gl.getAttribLocation(gl.program, 'a_Normal');
  if (a_Position < 0 || a_UV < 0 || a_Normal < 0) {
    console.log('Failed to get attribute locations');
    return false;
  }

  u_FragColor        = getUniform('u_FragColor');
  u_ModelMatrix      = getUniform('u_ModelMatrix');
  u_ViewMatrix       = getUniform('u_ViewMatrix');
  u_ProjectionMatrix = getUniform('u_ProjectionMatrix');
  u_NormalMatrix     = getUniform('u_NormalMatrix');
  u_Sampler0         = getUniform('u_Sampler0');
  u_Sampler1         = getUniform('u_Sampler1');
  u_Sampler2         = getUniform('u_Sampler2');
  u_Sampler3         = getUniform('u_Sampler3');
  u_whichTexture     = getUniform('u_whichTexture');
  u_UVScale          = getUniform('u_UVScale');

  u_NormalViz   = getUniform('u_NormalViz');
  u_LightingOn  = getUniform('u_LightingOn');
  u_PointOn     = getUniform('u_PointOn');
  u_SpotOn      = getUniform('u_SpotOn');

  u_CameraPos   = getUniform('u_CameraPos');
  u_LightPos    = getUniform('u_LightPos');
  u_LightColor  = getUniform('u_LightColor');

  u_SpotPos      = getUniform('u_SpotPos');
  u_SpotDir      = getUniform('u_SpotDir');
  u_SpotColor    = getUniform('u_SpotColor');
  u_SpotCosInner = getUniform('u_SpotCosInner');
  u_SpotCosOuter = getUniform('u_SpotCosOuter');

  gl.uniform2f(u_UVScale, 1.0, 1.0);
  return true;
}

// ============================================================================
// TEXTURES (same loader as asgn3, trimmed)
// ============================================================================

function isPowerOfTwo(n) { return (n & (n - 1)) === 0 && n > 0; }

function uploadCanvasToUnit(unit, cnv, pixelated) {
  var tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cnv);
  var f = pixelated ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  var samplerByUnit = [u_Sampler0, u_Sampler1, u_Sampler2, u_Sampler3];
  gl.uniform1i(samplerByUnit[unit], unit);
}

function uploadProceduralFallback(unit) {
  var cnv = document.createElement('canvas');
  cnv.width = 64; cnv.height = 64;
  var ctx = cnv.getContext('2d');
  var fills = ['#9c6040', '#5a9a3e', '#87ceeb', '#7d7d7d'];
  ctx.fillStyle = fills[unit] || '#888';
  ctx.fillRect(0, 0, 64, 64);
  uploadCanvasToUnit(unit, cnv, true);
}

function sendImageToTextureUnit(image, unit, pixelated) {
  var tex = gl.createTexture();
  if (!tex) { uploadProceduralFallback(unit); return; }
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  var w = image.width, h = image.height;
  var isPOT = isPowerOfTwo(w) && isPowerOfTwo(h);
  if (!isPOT) {
    var pw = 1; while (pw < w) pw *= 2;
    var ph = 1; while (ph < h) ph *= 2;
    var cnv = document.createElement('canvas');
    cnv.width = pw; cnv.height = ph;
    cnv.getContext('2d').drawImage(image, 0, 0, pw, ph);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cnv);
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  }
  var f = pixelated ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  var samplerByUnit = [u_Sampler0, u_Sampler1, u_Sampler2, u_Sampler3];
  gl.uniform1i(samplerByUnit[unit], unit);
}

function textureUrl(path) {
  var i = path.lastIndexOf('/');
  if (i === -1) return encodeURIComponent(path);
  return path.substring(0, i + 1) + encodeURIComponent(path.substring(i + 1));
}

var TEXTURE_MANIFEST = [
  { unit: TEX_BRICK, url: textureUrl('textures/brick texture.webp'), nearest: true },
  { unit: TEX_GRASS, url: textureUrl('textures/minecraft texture.webp'), nearest: true },
  { unit: TEX_STONE, url: textureUrl('textures/stone texture.webp'), nearest: true }
];

function loadAllTextures(callback) {
  var n = TEXTURE_MANIFEST.length, done = 0;
  function finished() { done++; if (done >= n) callback(); }
  for (var i = 0; i < n; i++) {
    (function (entry) {
      var img = new Image();
      img.onload = function () { sendImageToTextureUnit(img, entry.unit, entry.nearest); finished(); };
      img.onerror = function () {
        console.warn('Could not load texture:', entry.url);
        uploadProceduralFallback(entry.unit); finished();
      };
      img.src = entry.url;
    })(TEXTURE_MANIFEST[i]);
  }
}

// ============================================================================
// MAP / WORLD (compact)
// ============================================================================

function buildMap() {
  var m = [];
  for (var z = 0; z < MAP_N; z++) {
    var row = new Array(MAP_N);
    for (var x = 0; x < MAP_N; x++) row[x] = 0;
    m.push(row);
  }
  for (var i = 0; i < MAP_N; i++) {
    m[0][i] = 3; m[MAP_N-1][i] = 3; m[i][0] = 3; m[i][MAP_N-1] = 3;
  }
  // A couple of decorative pillars
  m[5][5] = 2;  m[5][MAP_N-6] = 2;
  m[MAP_N-6][5] = 2;  m[MAP_N-6][MAP_N-6] = 2;
  return m;
}

function getGroundHeightAt(wx, wz) {
  var r = 0.3;
  var minX = Math.floor(wx - r + HALF);
  var maxX = Math.floor(wx + r + HALF);
  var minZ = Math.floor(wz - r + HALF);
  var maxZ = Math.floor(wz + r + HALF);
  var maxH = 0;
  for (var z = minZ; z <= maxZ; z++) {
    for (var x = minX; x <= maxX; x++) {
      var h = 0;
      if (x >= 0 && x < MAP_N && z >= 0 && z < MAP_N) h = g_map[z][x];
      if (h > maxH) maxH = h;
    }
  }
  return maxH;
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
  // Skybox: render unlit by temporarily forcing lighting off
  gl.uniform1i(u_LightingOn, 0);
  setCubeCentered(_modelMat, 0, 0, 0, 200, 200, 200);
  Cube.drawShared(_modelMat, [0.07, 0.10, 0.18, 1.0], -2);
  gl.uniform1i(u_LightingOn, g_lightingOn ? 1 : 0);
}

function drawGround() {
  gl.uniform2f(u_UVScale, MAP_N, MAP_N);
  setCubeCentered(_modelMat, 0, -0.51, 0, MAP_N, 1, MAP_N);
  Cube.drawShared(_modelMat, [1, 1, 1, 1], TEX_GRASS);
  gl.uniform2f(u_UVScale, 1.0, 1.0);
}

function cellTexId(x, z) {
  return (x === 0 || x === MAP_N - 1 || z === 0 || z === MAP_N - 1) ? TEX_BRICK : TEX_STONE;
}

function drawMap() {
  for (var z = 0; z < MAP_N; z++) {
    var row = g_map[z];
    for (var x = 0; x < MAP_N; x++) {
      var h = row[x];
      if (h > 0) {
        var texId = cellTexId(x, z);
        var wx = x - HALF, wz = z - HALF;
        for (var y = 0; y < h; y++) {
          setCubeCorner(_modelMat, wx, y, wz, 1, 1, 1);
          Cube.drawShared(_modelMat, [1, 1, 1, 1], texId);
        }
      }
    }
  }
}

// ============================================================================
// SPHERES + STAR CUBE + LIGHT MARKER
// ============================================================================

function drawHeroes() {
  // Big bright-grey sphere in the middle - lighting hero #1
  // Use plain translate+scale (sphere geometry is centered at origin).
  var m = _modelMat;
  m.setTranslate(0, 1.2, 0);
  m.scale(2.0, 2.0, 2.0);
  Sphere.drawShared(m, [0.85, 0.85, 0.95, 1.0], -2);

  // A red sphere off to the side
  m.setTranslate(-3.0, 0.9, -2.0);
  m.scale(1.4, 1.4, 1.4);
  Sphere.drawShared(m, [0.95, 0.30, 0.30, 1.0], -2);

  // A green textured sphere
  m.setTranslate(3.0, 0.9, -2.0);
  m.scale(1.4, 1.4, 1.4);
  Sphere.drawShared(m, [0.30, 0.85, 0.45, 1.0], -2);

  // A rotating cube hero (textured)
  m.setTranslate(0, 0.8, 3.5);
  m.rotate(g_seconds * 35.0, 0, 1, 0);
  m.scale(1.3, 1.3, 1.3);
  m.translate(-0.5, -0.5, -0.5);
  Cube.drawShared(m, [1, 1, 1, 1], TEX_STONE);
}

function drawLightMarker() {
  // Light marker is rendered unlit and emissive-looking
  gl.uniform1i(u_LightingOn, 0);
  var m = _modelMat;
  m.setTranslate(g_lightPos[0], g_lightPos[1], g_lightPos[2]);
  m.scale(0.35, 0.35, 0.35);
  m.translate(-0.5, -0.5, -0.5);
  Cube.drawShared(m, [g_lightColor[0], g_lightColor[1], g_lightColor[2], 1.0], -2);

  // Spot light marker (small cube colored)
  m.setTranslate(g_spotPos[0], g_spotPos[1], g_spotPos[2]);
  m.scale(0.35, 0.35, 0.35);
  m.translate(-0.5, -0.5, -0.5);
  Cube.drawShared(m, [g_spotColor[0], g_spotColor[1], g_spotColor[2], 1.0], -2);

  gl.uniform1i(u_LightingOn, g_lightingOn ? 1 : 0);
}

function drawModel() {
  if (!g_model || !g_model.loaded) return;
  // g_model.matrix holds the baked normalize transform.
  // Compose: world placement * normalize.
  var bake = g_model._bake || (g_model._bake = new Matrix4(g_model.matrix));
  var place = new Matrix4();
  place.setTranslate(-3.0, 1.0, 4.0);
  place.rotate(g_seconds * 30.0, 0, 1, 0);
  place.multiply(bake);
  g_model.matrix = place;
  g_model.color = [0.95, 0.65, 0.25, 1.0];
  g_model.render();
}

// ============================================================================
// ANIMAL (from asgn3, abbreviated - same animation logic)
// ============================================================================

var g_leftArmAngle = 0, g_leftArmFwdAngle = 0, g_leftForearmAngle = 0;
var g_rightArmAngle = 0, g_rightArmFwdAngle = 0, g_rightForearmAngle = 0;
var g_leftLegAngle = 0, g_leftShinAngle = 0, g_leftLegOutAngle = 0;
var g_rightLegAngle = 0, g_rightShinAngle = 0, g_rightLegOutAngle = 0;
var g_leftWristAngle = 0, g_rightWristAngle = 0;
var g_leftAnkleAngle = 0, g_rightAnkleAngle = 0;
var g_bodyOffsetY = 0, g_bodySpinY = 0;
var g_animalX = 2, g_animalZ = -2, g_animalRot = 0;

var g_startTime = performance.now() / 1000.0;
var g_seconds = 0;
var g_animalState = 'WALK';
var g_walkAngle = 0;
var g_danceStart = 0;

function updateAnimationAngles() {
  var dt = performance.now() / 1000.0 - g_startTime - g_seconds;
  g_seconds = performance.now() / 1000.0 - g_startTime;

  if (g_animalState === 'WALK') {
    var pathRadius = 5.0;
    var walkSpeed = 0.5;
    g_walkAngle += walkSpeed * dt;
    g_animalX = pathRadius * Math.cos(g_walkAngle);
    g_animalZ = pathRadius * Math.sin(g_walkAngle);
    var dx = -Math.sin(g_walkAngle);
    var dz = Math.cos(g_walkAngle);
    g_animalRot = Math.atan2(dx, dz) * 180 / Math.PI;

    var omega = 3.6, t = g_seconds * omega, c = Math.cos(t);
    g_leftArmAngle = 90; g_rightArmAngle = 90;
    g_leftArmFwdAngle = -55 * c; g_rightArmFwdAngle = 55 * c;
    g_leftForearmAngle = 90 + 8 * c; g_rightForearmAngle = 90 - 8 * c;
    g_leftWristAngle = 0; g_rightWristAngle = 0;
    g_leftLegAngle = 45 * c; g_rightLegAngle = -45 * c;
    g_leftShinAngle = 60 + 55 * c; g_rightShinAngle = 60 - 55 * c;
    g_leftAnkleAngle = 15 * c; g_rightAnkleAngle = -15 * c;
    g_bodyOffsetY = 0.025 * Math.abs(c) - 0.012;
    g_bodySpinY = 0;

    if (g_walkAngle >= Math.PI * 2) {
      g_walkAngle = 0;
      g_animalState = 'DANCE';
      g_danceStart = g_seconds;
    }
  } else {
    var pokeDuration = 3.0;
    var pt = g_seconds - g_danceStart;
    if (pt >= pokeDuration) { g_animalState = 'WALK'; return; }
    var omega2 = 10.0, beat = pt * omega2;
    var s = Math.sin(beat), dip = Math.abs(s), step = Math.sin(beat * 0.5);
    g_leftArmAngle = -15 * s; g_rightArmAngle = -15 * s;
    g_leftArmFwdAngle = 0; g_rightArmFwdAngle = 0;
    g_leftForearmAngle = 0; g_rightForearmAngle = 0;
    g_leftWristAngle = 25 * s; g_rightWristAngle = -25 * s;
    g_leftLegAngle = 5 + 10 * step; g_rightLegAngle = 5 - 10 * step;
    g_leftShinAngle = 25 + 30 * dip; g_rightShinAngle = 25 + 30 * dip;
    g_leftAnkleAngle = 0; g_rightAnkleAngle = 0;
    g_bodyOffsetY = -0.05 * dip;
    g_bodySpinY = pt * 180;
  }
}

var C_BODY = [0.50, 0.40, 0.28, 1.0];
var C_HEAD = [0.55, 0.45, 0.30, 1.0];
var C_FACE = [0.85, 0.74, 0.58, 1.0];
var C_BELLY = [0.72, 0.60, 0.45, 1.0];
var C_EYE  = [0.10, 0.06, 0.04, 1.0];
var C_LIMB = [0.50, 0.40, 0.28, 1.0];
var C_HAND = [0.40, 0.30, 0.20, 1.0];

function makeCube(color, matrix) {
  Cube.drawShared(matrix, color, -2);
}

function drawAnimal() {
  var ax = g_animalX, az = g_animalZ, ay = 0.3;
  var bodyFrame = new Matrix4();
  bodyFrame.translate(ax, ay + 0.5 + g_bodyOffsetY, az);
  bodyFrame.rotate(g_animalRot + g_bodySpinY, 0, 1, 0);

  var m = new Matrix4(bodyFrame);
  m.translate(-0.18, -0.275, -0.15); m.scale(0.36, 0.55, 0.30);
  makeCube(C_BODY, m);

  m = new Matrix4(bodyFrame);
  m.translate(-0.13, -0.24, -0.16); m.scale(0.26, 0.45, 0.02);
  makeCube(C_BELLY, m);

  var headFrame = new Matrix4(bodyFrame); headFrame.translate(0, 0.30, -0.02);

  m = new Matrix4(headFrame);
  m.translate(-0.15, -0.04, -0.15); m.scale(0.30, 0.26, 0.30);
  makeCube(C_HEAD, m);

  m = new Matrix4(headFrame);
  m.translate(-0.12, -0.02, -0.16); m.scale(0.24, 0.18, 0.02);
  makeCube(C_FACE, m);

  m = new Matrix4(headFrame);
  m.translate(-0.06, -0.09, -0.19); m.scale(0.12, 0.09, 0.04);
  makeCube(C_FACE, m);

  m = new Matrix4(headFrame);
  m.translate(-0.035, -0.07, -0.21); m.scale(0.07, 0.03, 0.02);
  makeCube(C_EYE, m);

  m = new Matrix4(headFrame);
  m.translate(-0.115, 0.04, -0.17); m.scale(0.06, 0.05, 0.02);
  makeCube(C_EYE, m);

  m = new Matrix4(headFrame);
  m.translate(0.055, 0.04, -0.17); m.scale(0.06, 0.05, 0.02);
  makeCube(C_EYE, m);

  // Arms (use cylinders + cubes)
  var leftShoulder = new Matrix4(bodyFrame);
  leftShoulder.translate(-0.18, 0.18, 0);
  leftShoulder.rotate(g_leftArmFwdAngle, 1, 0, 0);
  leftShoulder.rotate(g_leftArmAngle, 0, 0, 1);

  var leftArm = new Cylinder(16);
  leftArm.color = C_LIMB;
  leftArm.matrix = new Matrix4(leftShoulder);
  leftArm.matrix.scale(-0.30, 0.10, 0.10);
  leftArm.render();

  var leftElbow = new Matrix4(leftShoulder);
  leftElbow.translate(-0.30, 0, 0);
  leftElbow.rotate(-g_leftForearmAngle, 0, 1, 0);

  m = new Matrix4(leftElbow);
  m.scale(0.26, 0.08, 0.08); m.translate(-1, -0.5, -0.5);
  makeCube(C_LIMB, m);

  var leftWrist = new Matrix4(leftElbow);
  leftWrist.translate(-0.26, 0, 0);
  leftWrist.rotate(90, 1, 0, 0);
  leftWrist.rotate(-g_leftWristAngle, 0, 0, 1);

  m = new Matrix4(leftWrist);
  m.scale(0.06, 0.10, 0.14); m.translate(-1, -0.5, -0.5);
  makeCube(C_HAND, m);

  var rightShoulder = new Matrix4(bodyFrame);
  rightShoulder.translate(0.18, 0.18, 0);
  rightShoulder.rotate(g_rightArmFwdAngle, 1, 0, 0);
  rightShoulder.rotate(-g_rightArmAngle, 0, 0, 1);

  var rightArm = new Cylinder(16);
  rightArm.color = C_LIMB;
  rightArm.matrix = new Matrix4(rightShoulder);
  rightArm.matrix.scale(0.30, 0.10, 0.10);
  rightArm.render();

  var rightElbow = new Matrix4(rightShoulder);
  rightElbow.translate(0.30, 0, 0);
  rightElbow.rotate(g_rightForearmAngle, 0, 1, 0);

  m = new Matrix4(rightElbow);
  m.scale(0.26, 0.08, 0.08); m.translate(0, -0.5, -0.5);
  makeCube(C_LIMB, m);

  var rightWrist = new Matrix4(rightElbow);
  rightWrist.translate(0.26, 0, 0);
  rightWrist.rotate(90, 1, 0, 0);
  rightWrist.rotate(g_rightWristAngle, 0, 0, 1);

  m = new Matrix4(rightWrist);
  m.scale(0.06, 0.10, 0.14); m.translate(0, -0.5, -0.5);
  makeCube(C_HAND, m);

  // Legs
  var leftHip = new Matrix4(bodyFrame);
  leftHip.translate(-0.10, -0.275, 0);
  leftHip.rotate(-g_leftLegOutAngle, 0, 0, 1);
  leftHip.rotate(g_leftLegAngle, 1, 0, 0);

  m = new Matrix4(leftHip);
  m.scale(0.13, 0.26, 0.13); m.translate(-0.5, -1, -0.5);
  makeCube(C_LIMB, m);

  var leftKnee = new Matrix4(leftHip);
  leftKnee.translate(0, -0.26, 0);
  leftKnee.rotate(-g_leftShinAngle, 1, 0, 0);

  m = new Matrix4(leftKnee);
  m.scale(0.11, 0.20, 0.11); m.translate(-0.5, -1, -0.5);
  makeCube(C_LIMB, m);

  var leftAnkle = new Matrix4(leftKnee);
  leftAnkle.translate(0, -0.20, 0);
  leftAnkle.rotate(g_leftAnkleAngle, 1, 0, 0);

  m = new Matrix4(leftAnkle);
  m.scale(0.12, 0.05, 0.16); m.translate(-0.5, -1, -0.7);
  makeCube(C_HAND, m);

  var rightHip = new Matrix4(bodyFrame);
  rightHip.translate(0.10, -0.275, 0);
  rightHip.rotate(g_rightLegOutAngle, 0, 0, 1);
  rightHip.rotate(g_rightLegAngle, 1, 0, 0);

  m = new Matrix4(rightHip);
  m.scale(0.13, 0.26, 0.13); m.translate(-0.5, -1, -0.5);
  makeCube(C_LIMB, m);

  var rightKnee = new Matrix4(rightHip);
  rightKnee.translate(0, -0.26, 0);
  rightKnee.rotate(-g_rightShinAngle, 1, 0, 0);

  m = new Matrix4(rightKnee);
  m.scale(0.11, 0.20, 0.11); m.translate(-0.5, -1, -0.5);
  makeCube(C_LIMB, m);

  var rightAnkle = new Matrix4(rightKnee);
  rightAnkle.translate(0, -0.20, 0);
  rightAnkle.rotate(g_rightAnkleAngle, 1, 0, 0);

  m = new Matrix4(rightAnkle);
  m.scale(0.12, 0.05, 0.16); m.translate(-0.5, -1, -0.7);
  makeCube(C_HAND, m);
}

// ============================================================================
// RENDER
// ============================================================================

function pushLightUniforms() {
  gl.uniform1i(u_NormalViz,  g_normalViz ? 1 : 0);
  gl.uniform1i(u_LightingOn, g_lightingOn ? 1 : 0);
  gl.uniform1i(u_PointOn,    g_pointOn ? 1 : 0);
  gl.uniform1i(u_SpotOn,     g_spotOn ? 1 : 0);

  var e = camera.eye.elements;
  gl.uniform3f(u_CameraPos, e[0], e[1], e[2]);

  gl.uniform3f(u_LightPos,   g_lightPos[0], g_lightPos[1], g_lightPos[2]);
  gl.uniform3f(u_LightColor, g_lightColor[0], g_lightColor[1], g_lightColor[2]);

  gl.uniform3f(u_SpotPos,   g_spotPos[0], g_spotPos[1], g_spotPos[2]);
  gl.uniform3f(u_SpotDir,   g_spotDir[0], g_spotDir[1], g_spotDir[2]);
  gl.uniform3f(u_SpotColor, g_spotColor[0], g_spotColor[1], g_spotColor[2]);

  // Convert degrees to cos for cheap check in shader
  var inner = (g_spotCutoffDeg) * Math.PI / 180.0;
  var outer = (g_spotCutoffDeg + g_spotPenumbraDeg) * Math.PI / 180.0;
  gl.uniform1f(u_SpotCosInner, Math.cos(inner));
  gl.uniform1f(u_SpotCosOuter, Math.cos(outer));
}

function renderScene() {
  gl.uniformMatrix4fv(u_ViewMatrix, false, camera.viewMatrix.elements);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, camera.projectionMatrix.elements);

  pushLightUniforms();

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  drawSkybox();
  drawGround();
  drawMap();
  drawHeroes();
  drawAnimal();
  drawModel();
  drawLightMarker();
}

// ============================================================================
// INPUT
// ============================================================================

function processKeys() {
  var speed = 0.08;
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
  var minXZ = -HALF + 1.1, maxXZ = HALF - 1.1;
  function clamp(v) { return Math.max(minXZ, Math.min(maxXZ, v)); }
  var cx = clamp(e[0]); if (cx !== e[0]) { var dX = cx - e[0]; e[0] += dX; a[0] += dX; }
  var cz = clamp(e[2]); if (cz !== e[2]) { var dZ = cz - e[2]; e[2] += dZ; a[2] += dZ; }

  // Wall collisions
  var newX = e[0], newZ = e[2];
  var feetY = e[1] - 1.5;
  var fx = getGroundHeightAt(newX, oldZ);
  if (feetY < fx - 0.1) { var d1 = oldX - newX; e[0] += d1; a[0] += d1; newX = oldX; }
  var fz = getGroundHeightAt(newX, newZ);
  if (feetY < fz - 0.1) { var d2 = oldZ - newZ; e[2] += d2; a[2] += d2; }

  camera._updateView();
}

function setupKeyboard() {
  window.addEventListener('keydown', function (ev) {
    var k = ev.key.toLowerCase();
    keys[k] = true;
    if (k === 'f') addBlock();
    else if (k === 'g') deleteBlock();
  });
  window.addEventListener('keyup', function (ev) { keys[ev.key.toLowerCase()] = false; });
}

function setupMouse() {
  canvas.addEventListener('click', function () {
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
  });
  document.addEventListener('mousemove', function (ev) {
    if (document.pointerLockElement !== canvas) return;
    var sens = 0.075;
    camera.panRight(ev.movementX * sens);
    camera.panUp(-ev.movementY * sens);
  });
}

function targetCell() {
  var f = camera.forwardVec();
  f.normalize();
  var wx = camera.eye.elements[0] + f.elements[0] * 1.6;
  var wz = camera.eye.elements[2] + f.elements[2] * 1.6;
  return { mx: Math.floor(wx + HALF), mz: Math.floor(wz + HALF) };
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

// ============================================================================
// UI WIRING
// ============================================================================

function setupUI() {
  function bindToggle(id, getter, setter, labelOn, labelOff) {
    var btn = document.getElementById(id);
    function refresh() {
      var v = getter();
      btn.textContent = v ? labelOn : labelOff;
      btn.classList.toggle('active', v);
    }
    btn.addEventListener('click', function () { setter(!getter()); refresh(); });
    refresh();
  }

  bindToggle('btnLighting',
    function () { return g_lightingOn; },
    function (v) { g_lightingOn = v; },
    'Lighting: On', 'Lighting: Off');

  bindToggle('btnNormalViz',
    function () { return g_normalViz; },
    function (v) { g_normalViz = v; },
    'Normal Viz: On', 'Normal Viz: Off');

  bindToggle('btnPoint',
    function () { return g_pointOn; },
    function (v) { g_pointOn = v; },
    'Point Light: On', 'Point Light: Off');

  bindToggle('btnSpot',
    function () { return g_spotOn; },
    function (v) { g_spotOn = v; },
    'Spot Light: On', 'Spot Light: Off');

  bindToggle('btnAnimate',
    function () { return g_animateLight; },
    function (v) { g_animateLight = v; },
    'Animate Light: On', 'Animate Light: Off');

  // Sliders
  function bindSlider(id, valId, setter) {
    var el = document.getElementById(id);
    var vv = document.getElementById(valId);
    function onChange() {
      var v = parseFloat(el.value);
      setter(v);
      vv.textContent = v.toFixed(2);
    }
    el.addEventListener('input', onChange);
    onChange();
  }

  bindSlider('lx', 'lxv', function (v) { g_lightPos[0] = v; });
  bindSlider('ly', 'lyv', function (v) { g_lightPos[1] = v; });
  bindSlider('lz', 'lzv', function (v) { g_lightPos[2] = v; });

  bindSlider('lcr', 'lcrv', function (v) { g_lightColor[0] = v; updateSwatch(); });
  bindSlider('lcg', 'lcgv', function (v) { g_lightColor[1] = v; updateSwatch(); });
  bindSlider('lcb', 'lcbv', function (v) { g_lightColor[2] = v; updateSwatch(); });

  bindSlider('sx', 'sxv', function (v) { g_spotPos[0] = v; recomputeSpotDir(); });
  bindSlider('sy', 'syv', function (v) { g_spotPos[1] = v; recomputeSpotDir(); });
  bindSlider('sz', 'szv', function (v) { g_spotPos[2] = v; recomputeSpotDir(); });
  bindSlider('scut','scutv', function (v) { g_spotCutoffDeg = v; });
  bindSlider('spen','spenv', function (v) { g_spotPenumbraDeg = v; });

  updateSwatch();
}

function updateSwatch() {
  var sw = document.getElementById('lswatch');
  if (!sw) return;
  var r = Math.round(g_lightColor[0] * 255);
  var g = Math.round(g_lightColor[1] * 255);
  var b = Math.round(g_lightColor[2] * 255);
  sw.style.background = 'rgb(' + r + ',' + g + ',' + b + ')';
}

function recomputeSpotDir() {
  // Always point spot at the world's center floor area
  var dx = 0 - g_spotPos[0];
  var dy = 0.5 - g_spotPos[1];
  var dz = 0 - g_spotPos[2];
  var L = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
  g_spotDir = [dx/L, dy/L, dz/L];
}

// ============================================================================
// LIGHT ANIMATION
// ============================================================================

function animateLight() {
  if (!g_animateLight) return;
  // Orbit the point light around the scene center
  var r = 6.0;
  var spd = 0.6;
  g_lightPos[0] = r * Math.cos(g_seconds * spd);
  g_lightPos[2] = r * Math.sin(g_seconds * spd);
  g_lightPos[1] = 3.5 + Math.sin(g_seconds * 1.3) * 1.2;

  // Reflect slider positions so users see them move
  document.getElementById('lx').value = g_lightPos[0].toFixed(2);
  document.getElementById('lxv').textContent = g_lightPos[0].toFixed(2);
  document.getElementById('ly').value = g_lightPos[1].toFixed(2);
  document.getElementById('lyv').textContent = g_lightPos[1].toFixed(2);
  document.getElementById('lz').value = g_lightPos[2].toFixed(2);
  document.getElementById('lzv').textContent = g_lightPos[2].toFixed(2);
}

// ============================================================================
// HUD + MAIN LOOP
// ============================================================================

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
      'FPS: ' + Math.round(fpsSmoothed) +
      '   pos: (' + e[0].toFixed(1) + ', ' + e[1].toFixed(1) + ', ' + e[2].toFixed(1) + ')';
  }
}

function tick() {
  updateAnimationAngles();
  animateLight();
  processKeys();
  var wx = camera.eye.elements[0], wz = camera.eye.elements[2];
  camera.applyPhysics(getGroundHeightAt(wx, wz));
  renderScene();
  updateHud();
  requestAnimationFrame(tick);
}

// ============================================================================
// OBJ LOADING
// ============================================================================

function loadObjModel(url, targetSize, onDone) {
  fetch(url)
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(function (text) {
      var mdl = new Model();
      mdl.loadFromOBJText(text);
      mdl.normalizeFit(targetSize || 1.5);
      g_model = mdl;
      if (onDone) onDone();
    })
    .catch(function (err) {
      console.warn('OBJ load failed for ' + url + ' - building fallback teapot-ish OBJ', err);
      // Fallback: create a tiny inline OBJ (octahedron) so the OBJ rendering path
      // still works without an external file.
      var fallback = [
        'v  0.0  1.0  0.0',
        'v  1.0  0.0  0.0',
        'v  0.0  0.0  1.0',
        'v -1.0  0.0  0.0',
        'v  0.0  0.0 -1.0',
        'v  0.0 -1.0  0.0',
        'f 1 2 3',
        'f 1 3 4',
        'f 1 4 5',
        'f 1 5 2',
        'f 6 3 2',
        'f 6 4 3',
        'f 6 5 4',
        'f 6 2 5'
      ].join('\n');
      var mdl = new Model();
      mdl.loadFromOBJText(fallback);
      mdl.normalizeFit(targetSize || 1.5);
      g_model = mdl;
      if (onDone) onDone();
    });
}

// ============================================================================
// ENTRY
// ============================================================================

function main() {
  if (!setupWebGL()) return;
  if (!connectVariablesToGLSL()) return;

  Cube.initBuffer();

  loadAllTextures(function () {
    g_map = buildMap();
    camera = new Camera(canvas);

    // Start camera looking toward the central spheres, slightly elevated.
    camera.eye.elements[0] = 0;
    camera.eye.elements[1] = 3.0;
    camera.eye.elements[2] = 9;
    camera.at.elements[0]  = 0;
    camera.at.elements[1]  = 1.5;
    camera.at.elements[2]  = 0;
    camera._updateView();

    setupKeyboard();
    setupMouse();
    setupUI();
    recomputeSpotDir();

    gl.clearColor(0.08, 0.10, 0.16, 1.0);

    loadObjModel('models/torus_knot.obj', 1.6, function () {});

    requestAnimationFrame(tick);
  });
}

window.main = main;
main();
