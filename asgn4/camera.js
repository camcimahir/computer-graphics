// camera.js - first-person camera (ES5-friendly)

function Camera(canvas) {
  this.fov = 60;
  this.eye = new Vector3([0, 1.5, 8]);
  this.at = new Vector3([0, 1.5, 7]);
  this.up = new Vector3([0, 1, 0]);

  this.vy = 0;
  this.isGrounded = false;

  this.viewMatrix = new Matrix4();
  this.projectionMatrix = new Matrix4();
  this.projectionMatrix.setPerspective(this.fov, canvas.width / canvas.height, 0.1, 1000);

  this._updateView();
}

Camera.prototype.jump = function () {
  if (this.isGrounded) {
    this.vy = 0.23; // Reduced jump strength
    this.isGrounded = false;
  }
};

Camera.prototype.applyPhysics = function (floorY) {
  // Gravity
  this.vy -= 0.006; // Weaker gravity
  
  // Apply velocity
  this.eye.elements[1] += this.vy;
  this.at.elements[1] += this.vy;
  
  // Floor collision (eye height is 1.5 above the floor)
  var playerFeetY = this.eye.elements[1] - 1.5;
  
  if (playerFeetY <= floorY) {
    var diff = floorY - playerFeetY;
    this.eye.elements[1] += diff;
    this.at.elements[1] += diff;
    this.vy = 0;
    this.isGrounded = true;
  } else {
    this.isGrounded = false;
  }
  
  this._updateView();
};

Camera.prototype._updateView = function () {
  var e = this.eye.elements;
  var a = this.at.elements;
  var u = this.up.elements;
  this.viewMatrix.setLookAt(e[0], e[1], e[2], a[0], a[1], a[2], u[0], u[1], u[2]);
};

Camera.prototype.forwardVec = function () {
  var e = this.eye.elements;
  var a = this.at.elements;
  return new Vector3([a[0] - e[0], a[1] - e[1], a[2] - e[2]]);
};

Camera.prototype._shift = function (vx, vy, vz) {
  this.eye.elements[0] += vx;
  this.eye.elements[1] += vy;
  this.eye.elements[2] += vz;
  this.at.elements[0] += vx;
  this.at.elements[1] += vy;
  this.at.elements[2] += vz;
};

Camera.prototype.moveForward = function (speed) {
  var f = this.forwardVec();
  f.normalize();
  this._shift(f.elements[0] * speed, 0, f.elements[2] * speed);
  this._updateView();
};

Camera.prototype.moveBackwards = function (speed) {
  this.moveForward(-speed);
};

Camera.prototype.moveLeft = function (speed) {
  var f = this.forwardVec();
  var u = this.up.elements;
  var fe = f.elements;
  var s = new Vector3([
    u[1] * fe[2] - u[2] * fe[1],
    u[2] * fe[0] - u[0] * fe[2],
    u[0] * fe[1] - u[1] * fe[0],
  ]);
  s.normalize();
  this._shift(s.elements[0] * speed, 0, s.elements[2] * speed);
  this._updateView();
};

Camera.prototype.moveRight = function (speed) {
  this.moveLeft(-speed);
};

Camera.prototype.panLeft = function (alpha) {
  var u = this.up.elements;
  var rot = new Matrix4();
  rot.setRotate(alpha, u[0], u[1], u[2]);
  var fPrime = rot.multiplyVector3(this.forwardVec());
  this.at.elements[0] = this.eye.elements[0] + fPrime.elements[0];
  this.at.elements[1] = this.eye.elements[1] + fPrime.elements[1];
  this.at.elements[2] = this.eye.elements[2] + fPrime.elements[2];
  this._updateView();
};

Camera.prototype.panRight = function (alpha) {
  this.panLeft(-alpha);
};

Camera.prototype.panUp = function (alpha) {
  var f = this.forwardVec();
  f.normalize();
  var u = this.up.elements;
  var fe = f.elements;
  var side = new Vector3([
    fe[1] * u[2] - fe[2] * u[1],
    fe[2] * u[0] - fe[0] * u[2],
    fe[0] * u[1] - fe[1] * u[0],
  ]);
  side.normalize();

  var currentPitch = Math.asin(fe[1]) * (180 / Math.PI);
  var desired = currentPitch + alpha;
  if (desired > 85 || desired < -85) return;

  var rot = new Matrix4();
  rot.setRotate(alpha, side.elements[0], side.elements[1], side.elements[2]);
  var fPrime = rot.multiplyVector3(this.forwardVec());
  this.at.elements[0] = this.eye.elements[0] + fPrime.elements[0];
  this.at.elements[1] = this.eye.elements[1] + fPrime.elements[1];
  this.at.elements[2] = this.eye.elements[2] + fPrime.elements[2];
  this._updateView();
};

Camera.prototype.panDown = function (alpha) {
  this.panUp(-alpha);
};
