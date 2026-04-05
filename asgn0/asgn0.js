
let canvas, ctx;

function main() {
    // retrieve <canvas> element
    canvas = document.getElementById('canvas');
    if (!canvas) {
        console.log('Failed to retrieve the <canvas> element');
        return;
    }

    // get the rendering context for 2DCG
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.log('Failed to get the rendering context for 2D');
        return;
    }

    // specify the color for clearing <canvas>
    ctx.fillStyle = 'rgba(0, 0, 0, 1)'; // black

    // clear <canvas>
    ctx.fillRect(0, 0, canvas.width, canvas.height);

//     // draw a vector
//     var v1 = new Vector3([2.25, 2.25, 0]);
//     drawVector(ctx, v1, "red");

}

function drawVector(v, color) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    var scale = 20;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + v.elements[0] * scale, centerY - v.elements[1] * scale);
    ctx.stroke();
}

function handleDrawEvent() {

    // specify the color for clearing <canvas>
    ctx.fillStyle = 'rgba(0, 0, 0, 1)'; // black

    // clear <canvas>
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // get x,y values for v1
    var x1 = Number(document.getElementById("xInput1").value);
    var y1 = Number(document.getElementById("yInput1").value);

    // get x,y values for v2
    var x2 = Number(document.getElementById("xInput2").value);
    var y2 = Number(document.getElementById("yInput2").value);

    // create vectors
    var v1 = new Vector3([x1, y1, 0]);
    var v2 = new Vector3([x2, y2, 0]);

    // draw vectors
    drawVector(v1, "red");
    drawVector(v2, "blue");
}

function handleDrawOperationEvent() {
    // specify the color for clearing <canvas>
    ctx.fillStyle = 'rgba(0, 0, 0, 1)'; // black

    // clear <canvas>
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // get x,y values for v1
    var x1 = Number(document.getElementById("xInput1").value);
    var y1 = Number(document.getElementById("yInput1").value);

    // get x,y values for v2
    var x2 = Number(document.getElementById("xInput2").value);
    var y2 = Number(document.getElementById("yInput2").value);

    // create vectors
    var v1 = new Vector3([x1, y1, 0]);
    var v2 = new Vector3([x2, y2, 0]);
    var v3 = new Vector3(v1.elements);

    var operation = String(document.getElementById("operation").value);
    var scalar = Number(document.getElementById("scalar").value);

    if (operation == 'addition'){
        v3.add(v2);
    } else if(operation == 'subtraction') {
        v3.sub(v2);
    } else if(operation == 'multiplication') {
        var v4 = new Vector3(v2.elements);
        v3.mul(scalar);
        v4.mul(scalar);
    } else if(operation == 'division') {
        var v4 = new Vector3(v2.elements);
        v3.div(scalar);
        v4.div(scalar);
    } else if (operation == 'magnitude'){
        console.log("Magnitude of v1: " + v1.magnitude());
        console.log("Magnitude of v2: " + v2.magnitude());
    } else if (operation == 'normalize') {
        var v4 = new Vector3(v2.elements);
        v3.normalize();
        v4.normalize();
    } else if (operation == 'angle between') {
        var dotProduct = Vector3.dot(v1, v2);
        var magnitudes = v1.magnitude() * v2.magnitude();
        var angle = Math.acos(dotProduct / magnitudes);
        var degrees = angle * 180 / Math.PI;
        console.log("Angle: " + degrees);
    } else if (operation == 'area') {
        var area = areaTriangle(v1, v2);
        console.log("Area of the triangle: " + area);
    }

    drawVector(v1, "red");
    drawVector(v2, "blue");
    drawVector(v3, "green");
    if (v4){
        drawVector(v4, "green");
    }

}

function areaTriangle(v1, v2) {
    var crossProduct = Vector3.cross(v1, v2);
    var area = 0.5 * crossProduct.magnitude();
    return area;
}