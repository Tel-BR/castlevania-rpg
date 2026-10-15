/**
 * FractalRollSystem - Motor 3D de Dados WebGL e Resolução de Risco
 * Sistema Fractal RPG — Cenário Castlevania
 *
 * Motor 3D com física realista:
 * - Textura atlas 1024x1024 gótica carmesim com detalhes dourados e chanfros
 * - Acomodação 100% plana na mesa com snapping ortogonal e slerp
 * - Colisão mútua elástica entre os dados com transferência de momento e torque
 * - Sem dependências externas: roda offline em file://, Obsidian e Webview
 */

export const GOTHIC_PALETTE = {
  crimson: '#8b1525',
  bloodDark: '#7a101c',
  holyGold: '#c49a2a',
  onyx: '#18141f',
  parchmentInk: '#2e1c14'
};

// ============================================================================
// MATEMÁTICA 3D: VETORES, MATRIZES E QUATERNIONS
// ============================================================================

export function mat4Create() {
  const out = new Float32Array(16);
  out[0] = 1; out[5] = 1; out[10] = 1; out[15] = 1;
  return out;
}

export function mat4LookAt(out, eye, center, up) {
  let x0, x1, x2, y0, y1, y2, z0, z1, z2, len;
  const eyex = eye[0], eyey = eye[1], eyez = eye[2];
  const upx = up[0], upy = up[1], upz = up[2];
  const centerx = center[0], centery = center[1], centerz = center[2];

  z0 = eyex - centerx; z1 = eyey - centery; z2 = eyez - centerz;
  len = Math.hypot(z0, z1, z2);
  if (len === 0) { z2 = 1; } else { z0 /= len; z1 /= len; z2 /= len; }

  x0 = upy * z2 - upz * z1;
  x1 = upz * z0 - upx * z2;
  x2 = upx * z1 - upy * z0;
  len = Math.hypot(x0, x1, x2);
  if (len === 0) { x0 = 0; x1 = 0; x2 = 0; } else { x0 /= len; x1 /= len; x2 /= len; }

  y0 = z1 * x2 - z2 * x1;
  y1 = z2 * x0 - z0 * x2;
  y2 = z0 * x1 - z1 * x0;

  out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
  out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
  out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
  out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
  out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
  out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
  out[15] = 1;
  return out;
}

export function mat4Perspective(out, fovy, aspect, near, far) {
  const f = 1.0 / Math.tan(fovy / 2);
  out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
  out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
  out[8] = 0; out[9] = 0; out[10] = (far + near) / (near - far); out[11] = -1;
  out[12] = 0; out[13] = 0; out[14] = (2 * far * near) / (near - far); out[15] = 0;
  return out;
}

export function mat4Multiply(out, a, b) {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
  out[0] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
  out[1] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
  out[2] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
  out[3] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
  b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
  out[4] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
  out[5] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
  out[6] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
  out[7] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
  b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
  out[8] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
  out[9] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
  out[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
  out[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
  b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
  out[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
  out[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
  out[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
  out[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
  return out;
}

export function quatFromAxisAngle(axis, rad) {
  const half = rad / 2;
  const s = Math.sin(half);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)];
}

export function quatMultiply(out, a, b) {
  const ax = a[0], ay = a[1], az = a[2], aw = a[3];
  const bx = b[0], by = b[1], bz = b[2], bw = b[3];
  out[0] = ax * bw + aw * bx + ay * bz - az * by;
  out[1] = ay * bw + aw * by + az * bx - ax * bz;
  out[2] = az * bw + aw * bz + ax * by - ay * bx;
  out[3] = aw * bw - ax * bx - ay * by - az * bz;
  return out;
}

export function quatNormalize(q) {
  const len = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  q[0] /= len; q[1] /= len; q[2] /= len; q[3] /= len;
  return q;
}

export function quatSlerp(out, a, b, t) {
  let ax = a[0], ay = a[1], az = a[2], aw = a[3];
  let bx = b[0], by = b[1], bz = b[2], bw = b[3];
  let cosom = ax * bx + ay * by + az * bz + aw * bw;
  if (cosom < 0) {
    cosom = -cosom;
    bx = -bx; by = -by; bz = -bz; bw = -bw;
  }
  let scale0, scale1;
  if (1.0 - cosom > 0.0001) {
    const omega = Math.acos(cosom);
    const sinom = Math.sin(omega);
    scale0 = Math.sin((1.0 - t) * omega) / sinom;
    scale1 = Math.sin(t * omega) / sinom;
  } else {
    scale0 = 1.0 - t;
    scale1 = t;
  }
  out[0] = scale0 * ax + scale1 * bx;
  out[1] = scale0 * ay + scale1 * by;
  out[2] = scale0 * az + scale1 * bz;
  out[3] = scale0 * aw + scale1 * bw;
  return quatNormalize(out);
}

export function mat4FromRotationTranslation(out, q, v) {
  const x = q[0], y = q[1], z = q[2], w = q[3];
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  out[0] = 1 - (yy + zz); out[1] = xy + wz; out[2] = xz - wy; out[3] = 0;
  out[4] = xy - wz; out[5] = 1 - (xx + zz); out[6] = yz + wx; out[7] = 0;
  out[8] = xz + wy; out[9] = yz - wx; out[10] = 1 - (xx + yy); out[11] = 0;
  out[12] = v[0]; out[13] = v[1]; out[14] = v[2]; out[15] = 1;
  return out;
}

export function rotateVec3ByQuat(out, v, q) {
  const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
  const vx = v[0], vy = v[1], vz = v[2];
  const ix = qw * vx + qy * vz - qz * vy;
  const iy = qw * vy + qz * vx - qx * vz;
  const iz = qw * vz + qx * vy - qy * vx;
  const iw = -qx * vx - qy * vy - qz * vz;
  out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
  out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
  out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
  return out;
}

export function quatFromTwoVectors(u, v) {
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  if (dot >= 0.999999) return [0, 0, 0, 1];
  if (dot <= -0.999999) {
    let axis = [1, 0, 0];
    if (Math.abs(u[0]) > 0.9) axis = [0, 0, 1];
    const ortho = [
      u[1] * axis[2] - u[2] * axis[1],
      u[2] * axis[0] - u[0] * axis[2],
      u[0] * axis[1] - u[1] * axis[0]
    ];
    const len = Math.hypot(ortho[0], ortho[1], ortho[2]) || 1;
    return [ortho[0] / len, ortho[1] / len, ortho[2] / len, 0];
  }
  const cross = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0]
  ];
  return quatNormalize([cross[0], cross[1], cross[2], 1.0 + dot]);
}

// Snapping exato para face plana com alinhamento de inclinação mínima (zero giro/snap de yaw)
export function computeSnappedFlatOrientation(q) {
  const faces = [
    { val: 1, norm: [0, 1, 0] },
    { val: 6, norm: [0, -1, 0] },
    { val: 2, norm: [0, 0, 1] },
    { val: 5, norm: [0, 0, -1] },
    { val: 3, norm: [1, 0, 0] },
    { val: 4, norm: [-1, 0, 0] }
  ];

  let bestFace = faces[0];
  let maxDot = -Infinity;
  const bestWorldNorm = [0, 0, 0];

  for (const f of faces) {
    const curNorm = rotateVec3ByQuat([0, 0, 0], f.norm, q);
    if (curNorm[1] > maxDot) {
      maxDot = curNorm[1];
      bestFace = f;
      bestWorldNorm[0] = curNorm[0];
      bestWorldNorm[1] = curNorm[1];
      bestWorldNorm[2] = curNorm[2];
    }
  }

  // qAlign é a menor rotação no espaço global que alinha a normal da face superior com o vetor [0, 1, 0] (topo).
  // Isso ajusta APENAS a inclinação residual (tilt de poucos graus), sem qualquer giro artificial de yaw.
  const qAlign = quatFromTwoVectors(bestWorldNorm, [0, 1, 0]);
  const out = quatNormalize(quatMultiply([0, 0, 0, 1], qAlign, q));

  return {
    targetQuat: out,
    faceValue: bestFace.val
  };
}

// ============================================================================
// GEOMETRIA E TEXTURAS PROCEDURAIS
// ============================================================================

export function createCubeData(size = 0.9) {
  const s = size / 2;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  function faceUV(faceIdx) {
    const col = (faceIdx - 1) % 3;
    const row = Math.floor((faceIdx - 1) / 3);
    const u0 = col / 3.0;
    const u1 = (col + 1) / 3.0;
    const v0 = row / 2.0;
    const v1 = (row + 1) / 2.0;
    return [
      [u0, v1], [u1, v1], [u1, v0], [u0, v0]
    ];
  }

  function addQuad(p0, p1, p2, p3, norm, faceIdx) {
    const baseIdx = positions.length / 3;
    positions.push(...p0, ...p1, ...p2, ...p3);
    for (let i = 0; i < 4; i++) normals.push(...norm);
    const fuv = faceUV(faceIdx);
    uvs.push(...fuv[0], ...fuv[1], ...fuv[2], ...fuv[3]);
    indices.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3);
  }

  // Face 1 (Top, +Y)
  addQuad([-s, s, -s], [s, s, -s], [s, s, s], [-s, s, s], [0, 1, 0], 1);
  // Face 6 (Bottom, -Y)
  addQuad([-s, -s, s], [s, -s, s], [s, -s, -s], [-s, -s, -s], [0, -1, 0], 6);
  // Face 2 (Front, +Z)
  addQuad([-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s], [0, 0, 1], 2);
  // Face 5 (Back, -Z)
  addQuad([s, -s, -s], [-s, -s, -s], [-s, s, -s], [s, s, -s], [0, 0, -1], 5);
  // Face 3 (Right, +X)
  addQuad([s, -s, s], [s, -s, -s], [s, s, -s], [s, s, s], [1, 0, 0], 3);
  // Face 4 (Left, -X)
  addQuad([-s, -s, -s], [-s, -s, s], [-s, s, s], [-s, s, -s], [-1, 0, 0], 4);

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices)
  };
}

export function createGothicTextureAtlas(primaryColor = '#991b1b') {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  const colWidth = 1024 / 3;
  const rowHeight = 1024 / 2;

  const pipCoords = {
    1: [[0.5, 0.5]],
    2: [[0.28, 0.28], [0.72, 0.72]],
    3: [[0.26, 0.26], [0.5, 0.5], [0.74, 0.74]],
    4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
    5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
    6: [[0.28, 0.24], [0.28, 0.5], [0.28, 0.76], [0.72, 0.24], [0.72, 0.5], [0.72, 0.76]]
  };

  for (let face = 1; face <= 6; face++) {
    const col = (face - 1) % 3;
    const row = Math.floor((face - 1) / 3);
    const ox = col * colWidth;
    const oy = row * rowHeight;
    const w = colWidth;
    const h = rowHeight;

    // Fundo aveludado profundo com gradiente radial
    const bg = ctx.createRadialGradient(ox + w*0.5, oy + h*0.5, 20, ox + w*0.5, oy + h*0.5, w*0.7);
    bg.addColorStop(0, primaryColor);
    bg.addColorStop(0.65, '#5c0914');
    bg.addColorStop(1, '#240206');
    ctx.fillStyle = bg;
    ctx.fillRect(ox, oy, w, h);

    // Borda chanfrada dourada
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 10;
    ctx.strokeRect(ox + 12, oy + 12, w - 24, h - 24);

    // Linha de filigrana interna
    ctx.strokeStyle = 'rgba(255, 235, 150, 0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(ox + 22, oy + 22, w - 44, h - 44);

    // Ornamentos dos cantos
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(ox + 18, oy + 18, 12, 12);
    ctx.fillRect(ox + w - 30, oy + 18, 12, 12);
    ctx.fillRect(ox + 18, oy + h - 30, 12, 12);
    ctx.fillRect(ox + w - 30, oy + h - 30, 12, 12);

    // Pips dourados com relevo
    const pips = pipCoords[face];
    for (const [px, py] of pips) {
      const cx = ox + px * w;
      const cy = oy + py * h;
      const r = face === 1 ? 38 : 25;

      ctx.beginPath();
      ctx.arc(cx, cy + 4, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fill();

      const pipGrad = ctx.createRadialGradient(cx - r*0.35, cy - r*0.35, 2, cx, cy, r);
      pipGrad.addColorStop(0, '#ffffff');
      pipGrad.addColorStop(0.2, '#fff199');
      pipGrad.addColorStop(0.6, '#d4af37');
      pipGrad.addColorStop(1, '#6b4f0c');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = pipGrad;
      ctx.fill();

      ctx.strokeStyle = '#3d2c04';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  return canvas;
}

// Shaders GLSL
const vsSource = `
  attribute vec3 aPosition;
  attribute vec3 aNormal;
  attribute vec2 aTexCoord;

  uniform mat4 uMVPMatrix;
  uniform mat4 uModelMatrix;
  uniform mat3 uNormalMatrix;

  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vTexCoord;

  void main() {
    vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = normalize(uNormalMatrix * aNormal);
    vTexCoord = aTexCoord;
    gl_Position = uMVPMatrix * vec4(aPosition, 1.0);
  }
`;

const fsSource = `
  precision mediump float;

  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vTexCoord;

  uniform sampler2D uSampler;
  uniform vec3 uLightDir;
  uniform vec3 uEyePos;

  void main() {
    vec4 texColor = texture2D(uSampler, vTexCoord);
    
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(uEyePos - vWorldPos);
    vec3 H = normalize(L + V);

    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, H), 0.0), 32.0) * 0.55;

    vec3 ambient = vec3(0.50, 0.44, 0.54);
    vec3 diffuse = diff * vec3(1.0, 0.95, 0.88);

    vec3 rgb = texColor.rgb * (ambient + diffuse) + vec3(spec * 0.9, spec * 0.75, spec * 0.35);
    gl_FragColor = vec4(rgb, 1.0);
  }
`;

const shadowVsSource = `
  attribute vec3 aPosition;
  uniform mat4 uMVPMatrix;
  varying vec2 vPos;
  void main() {
    vPos = aPosition.xz;
    gl_Position = uMVPMatrix * vec4(aPosition, 1.0);
  }
`;

const shadowFsSource = `
  precision mediump float;
  varying vec2 vPos;
  uniform float uOpacity;
  void main() {
    float dist = length(vPos);
    if (dist > 1.0) discard;
    float core = 1.0 - smoothstep(0.0, 0.45, dist);
    float penumbra = 1.0 - smoothstep(0.38, 1.0, dist);
    float alpha = (core * 0.6 + penumbra * 0.4) * uOpacity;
    gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
  }
`;

// ============================================================================
// MOTOR DE DADOS WEBGL (WebGLDiceEngine)
// ============================================================================

export class WebGLDiceEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { alpha: true, antialias: true }) || canvas.getContext('experimental-webgl');
    if (!this.gl) throw new Error('WebGL context unavailable');

    this.dice = [];
    this.isRolling = false;
    this.onRollComplete = null;
    this.themeColor = GOTHIC_PALETTE.crimson;
    this.aspect = 1.0;

    this.initGL();
    this.resize();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.resize());
    }
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  initGL() {
    const gl = this.gl;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    function compileShader(src, type) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('Shader error:', gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    }

    const vs = compileShader(vsSource, gl.VERTEX_SHADER);
    const fs = compileShader(fsSource, gl.FRAGMENT_SHADER);
    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);

    this.uMVPMatrix = gl.getUniformLocation(this.program, 'uMVPMatrix');
    this.uModelMatrix = gl.getUniformLocation(this.program, 'uModelMatrix');
    this.uNormalMatrix = gl.getUniformLocation(this.program, 'uNormalMatrix');
    this.uLightDir = gl.getUniformLocation(this.program, 'uLightDir');
    this.uEyePos = gl.getUniformLocation(this.program, 'uEyePos');
    this.uSampler = gl.getUniformLocation(this.program, 'uSampler');

    this.aPosition = gl.getAttribLocation(this.program, 'aPosition');
    this.aNormal = gl.getAttribLocation(this.program, 'aNormal');
    this.aTexCoord = gl.getAttribLocation(this.program, 'aTexCoord');

    const svs = compileShader(shadowVsSource, gl.VERTEX_SHADER);
    const sfs = compileShader(shadowFsSource, gl.FRAGMENT_SHADER);
    this.shadowProgram = gl.createProgram();
    gl.attachShader(this.shadowProgram, svs);
    gl.attachShader(this.shadowProgram, sfs);
    gl.linkProgram(this.shadowProgram);

    this.sMVPMatrix = gl.getUniformLocation(this.shadowProgram, 'uMVPMatrix');
    this.sOpacity = gl.getUniformLocation(this.shadowProgram, 'uOpacity');
    this.saPosition = gl.getAttribLocation(this.shadowProgram, 'aPosition');

    this.cubeData = createCubeData(0.9);
    this.posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.cubeData.positions, gl.STATIC_DRAW);

    this.normBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.normBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.cubeData.normals, gl.STATIC_DRAW);

    this.uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.cubeData.uvs, gl.STATIC_DRAW);

    this.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.cubeData.indices, gl.STATIC_DRAW);

    const sq = 1.5;
    const shadowQuad = new Float32Array([
      -sq, 0, -sq,  sq, 0, -sq,  sq, 0, sq,
      -sq, 0, -sq,  sq, 0, sq,  -sq, 0, sq
    ]);
    this.shadowBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.shadowBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, shadowQuad, gl.STATIC_DRAW);

    this.texture = gl.createTexture();
    this.updateTexture(this.themeColor);
  }

  updateTexture(themeColor) {
    const gl = this.gl;
    this.themeColor = themeColor;
    const atlas = createGothicTextureAtlas(themeColor);
    if (!atlas) return;

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  resize() {
    const width = window.innerWidth || 800;
    const height = window.innerHeight || 600;
    this.canvas.width = width * (window.devicePixelRatio || 1);
    this.canvas.height = height * (window.devicePixelRatio || 1);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.aspect = width / height;
  }

  roll(count = 2, themeColor = null) {
    if (themeColor && themeColor !== this.themeColor) {
      this.updateTexture(themeColor);
    }

    const qty = Math.max(1, Math.min(6, count));
    this.dice = [];
    this.isRolling = true;
    if (this.canvas) this.canvas.style.pointerEvents = 'auto';

    // TRAJETÓRIAS CONVERGENTES:
    // Os dados são arremessados convergindo em direção ao centro da mesa [0, 0, 0],
    // colidindo no ar e nos primeiros quiques!
    const focalCenter = [(Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4];

    for (let i = 0; i < qty; i++) {
      const startX = (i - (qty - 1) / 2) * 0.9 + (Math.random() - 0.5) * 0.3;
      const startY = 4.2 + Math.random() * 0.8;
      const startZ = 2.4 + (Math.random() - 0.5) * 0.4;
      const pos = [startX, startY, startZ];

      const toCenterX = focalCenter[0] - startX;
      const toCenterZ = focalCenter[2] - startZ;
      const vel = [
        toCenterX * 2.2 + (Math.random() - 0.5) * 1.5,
        -(4.0 + Math.random() * 2.5),
        toCenterZ * 2.0 + (Math.random() - 0.5) * 1.2
      ];

      const angVel = [
        (Math.random() - 0.5) * 35.0,
        (Math.random() - 0.5) * 35.0,
        (Math.random() - 0.5) * 35.0
      ];
      const rot = quatNormalize([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]);

      this.dice.push({
        pos,
        vel,
        rot,
        targetRot: null,
        snapProgress: 0,
        angVel,
        radius: 0.45,
        colRadius: 0.62, // Raio esférico da caixa envolvente considerando diagonais
        settled: false,
        settleValue: 0
      });
    }

    this.lastTime = performance.now();

    return new Promise((resolve) => {
      this.onRollComplete = (results) => {
        resolve(results);
      };
    });
  }

  updatePhysics(dt) {
    const floorY = 0.0;
    const minX = -this.aspect * 2.3;
    const maxX = this.aspect * 2.3;
    const minZ = -2.2;
    const maxZ = 2.2;

    let allSettled = true;

    for (let i = 0; i < this.dice.length; i++) {
      const d = this.dice[i];
      if (d.settled) continue;

      // Gravidade
      d.vel[1] -= 24.0 * dt;

      // Integração de posição
      d.pos[0] += d.vel[0] * dt;
      d.pos[1] += d.vel[1] * dt;
      d.pos[2] += d.vel[2] * dt;

      // Integração de rotação angular
      const angSpeed = Math.hypot(d.angVel[0], d.angVel[1], d.angVel[2]);
      if (angSpeed > 0.001 && !d.targetRot) {
        const axis = [d.angVel[0] / angSpeed, d.angVel[1] / angSpeed, d.angVel[2] / angSpeed];
        const dq = quatFromAxisAngle(axis, angSpeed * dt);
        quatMultiply(d.rot, dq, d.rot);
        quatNormalize(d.rot);
      }

      // Quique no chão em Y = 0
      if (d.pos[1] <= floorY + d.radius) {
        d.pos[1] = floorY + d.radius;
        if (Math.abs(d.vel[1]) > 0.45) {
          d.vel[1] = -d.vel[1] * 0.52;
          d.vel[0] *= 0.84;
          d.vel[2] *= 0.84;
          // Impulso angular com o impacto
          d.angVel[0] += (Math.random() - 0.5) * 10.0;
          d.angVel[2] += (Math.random() - 0.5) * 10.0;
        } else {
          d.vel[1] = 0;
          d.vel[0] *= 0.75;
          d.vel[2] *= 0.75;
          d.angVel[0] *= 0.75;
          d.angVel[1] *= 0.75;
          d.angVel[2] *= 0.75;
        }
      }

      // Ricochete nas bordas virtuais
      if (d.pos[0] < minX + d.radius) { d.pos[0] = minX + d.radius; d.vel[0] = Math.abs(d.vel[0]) * 0.75; d.angVel[1] += 5.0; }
      if (d.pos[0] > maxX - d.radius) { d.pos[0] = maxX - d.radius; d.vel[0] = -Math.abs(d.vel[0]) * 0.75; d.angVel[1] -= 5.0; }
      if (d.pos[2] < minZ + d.radius) { d.pos[2] = minZ + d.radius; d.vel[2] = Math.abs(d.vel[2]) * 0.75; d.angVel[0] += 5.0; }
      if (d.pos[2] > maxZ - d.radius) { d.pos[2] = maxZ - d.radius; d.vel[2] = -Math.abs(d.vel[2]) * 0.75; d.angVel[0] -= 5.0; }

      // Amortecimento do ar
      d.vel[0] *= 0.985;
      d.vel[1] *= 0.985;
      d.vel[2] *= 0.985;
      d.angVel[0] *= 0.98;
      d.angVel[1] *= 0.98;
      d.angVel[2] *= 0.98;

      // Verificação de repouso & ACOMODAÇÃO NATURAL ORGÂNICA (Smootherstep C2-contínuo)
      const speed = Math.hypot(d.vel[0], d.vel[1], d.vel[2]);
      const rotSpeed = Math.hypot(d.angVel[0], d.angVel[1], d.angVel[2]);

      if (d.pos[1] <= floorY + d.radius + 0.06 && speed < 0.35 && rotSpeed < 1.1) {
        if (!d.targetRot) {
          const snap = computeSnappedFlatOrientation(d.rot);
          d.targetRot = snap.targetQuat;
          d.settleValue = snap.faceValue;
          d.startRot = [...d.rot];
          d.startPos = [...d.pos];
          d.snapTimer = 0;
          d.snapDuration = 0.45; // Desaceleração suave e orgânica de 0.45s
        }

        d.snapTimer += dt;
        const t = Math.min(1.0, d.snapTimer / d.snapDuration);
        // Smootherstep (Ken Perlin): aceleração e desaceleração com derivadas nulas em t=0 e t=1
        const ease = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);

        quatSlerp(d.rot, d.startRot, d.targetRot, ease);
        d.pos[1] = d.startPos[1] + (floorY + d.radius - d.startPos[1]) * ease;
        d.pos[0] += d.vel[0] * dt * (1.0 - ease);
        d.pos[2] += d.vel[2] * dt * (1.0 - ease);

        if (t >= 1.0) {
          d.rot = [...d.targetRot];
          d.pos[1] = floorY + d.radius;
          d.vel = [0, 0, 0];
          d.angVel = [0, 0, 0];
          d.settled = true;
        } else {
          allSettled = false;
        }
      } else {
        allSettled = false;
      }
    }

    // COLISÃO MÚTUA ELÁSTICA ENTRE OS DADOS:
    // Diâmetro de colisão realista = 0.62 * 2 = 1.24 unidades
    for (let i = 0; i < this.dice.length; i++) {
      for (let j = i + 1; j < this.dice.length; j++) {
        const a = this.dice[i];
        const b = this.dice[j];
        const dx = a.pos[0] - b.pos[0];
        const dy = a.pos[1] - b.pos[1];
        const dz = a.pos[2] - b.pos[2];
        const dist = Math.hypot(dx, dy, dz);
        const minDist = a.colRadius + b.colRadius; // 1.24

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const nz = dz / dist;
          const overlap = (minDist - dist);

          // Separação posicional para evitar penetração
          const halfOverlap = overlap * 0.52;
          a.pos[0] += nx * halfOverlap;
          a.pos[1] += ny * halfOverlap;
          a.pos[2] += nz * halfOverlap;
          b.pos[0] -= nx * halfOverlap;
          b.pos[1] -= ny * halfOverlap;
          b.pos[2] -= nz * halfOverlap;

          if (a.pos[1] < floorY + a.radius) a.pos[1] = floorY + a.radius;
          if (b.pos[1] < floorY + b.radius) b.pos[1] = floorY + b.radius;

          // Troca de momento com alta restituição elástica
          const dvx = a.vel[0] - b.vel[0];
          const dvy = a.vel[1] - b.vel[1];
          const dvz = a.vel[2] - b.vel[2];
          const vn = dvx * nx + dvy * ny + dvz * nz;

          if (vn < 0) { // Em convergência
            const restitution = 0.85;
            const impulse = -(1 + restitution) * vn * 0.5;

            a.vel[0] += impulse * nx;
            a.vel[1] += impulse * ny;
            a.vel[2] += impulse * nz;
            b.vel[0] -= impulse * nx;
            b.vel[1] -= impulse * ny;
            b.vel[2] -= impulse * nz;

            // Transferência recíproca de rotação e torque
            const spinForce = 16.0;
            a.angVel[0] += (Math.random() - 0.5) * spinForce + ny * 6.0;
            a.angVel[1] += (Math.random() - 0.5) * spinForce + nx * 6.0;
            a.angVel[2] += (Math.random() - 0.5) * spinForce + nz * 6.0;

            b.angVel[0] -= (Math.random() - 0.5) * spinForce + ny * 6.0;
            b.angVel[1] -= (Math.random() - 0.5) * spinForce + nx * 6.0;
            b.angVel[2] -= (Math.random() - 0.5) * spinForce + nz * 6.0;

            // Impacto rompe qualquer acomodação prematura
            a.targetRot = null;
            a.startRot = null;
            b.targetRot = null;
            b.startRot = null;
          }
        }
      }
    }

    if (this.isRolling && allSettled && this.dice.length > 0) {
      this.isRolling = false;
      const results = this.dice.map(d => d.settleValue);

      setTimeout(() => {
        if (this.canvas) this.canvas.style.pointerEvents = 'none';
      }, 3000);

      if (this.onRollComplete) {
        this.onRollComplete(results);
        this.onRollComplete = null;
      }
    }
  }

  render() {
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (this.dice.length === 0) return;

    const eye = [0, 5.5, 4.8];
    const center = [0, 0, 0];
    const up = [0, 1, 0];

    const projMatrix = mat4Perspective(mat4Create(), 42 * Math.PI / 180, this.aspect, 0.1, 100.0);
    const viewMatrix = mat4LookAt(mat4Create(), eye, center, up);
    const vpMatrix = mat4Multiply(mat4Create(), projMatrix, viewMatrix);

    // 1. Sombras intensificadas no piso Y = 0
    gl.depthMask(false);
    gl.useProgram(this.shadowProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.shadowBuffer);
    gl.enableVertexAttribArray(this.saPosition);
    gl.vertexAttribPointer(this.saPosition, 3, gl.FLOAT, false, 0, 0);

    for (const d of this.dice) {
      const height = Math.max(0, d.pos[1] - d.radius);
      const shadowScale = 1.0 + height * 0.35;

      const shadowModel = mat4Create();
      shadowModel[0] = shadowScale;
      shadowModel[10] = shadowScale;
      shadowModel[12] = d.pos[0];
      shadowModel[13] = 0.005;
      shadowModel[14] = d.pos[2];

      const shadowMVP = mat4Multiply(mat4Create(), vpMatrix, shadowModel);
      gl.uniformMatrix4fv(this.sMVPMatrix, false, shadowMVP);

      const opacity = Math.max(0.12, 0.95 - height * 0.24);
      gl.uniform1f(this.sOpacity, opacity);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.depthMask(true);

    // 2. Cubos 3D dos dados
    gl.useProgram(this.program);
    gl.uniform3fv(this.uLightDir, [-0.5, 1.5, 0.9]);
    gl.uniform3fv(this.uEyePos, eye);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.uSampler, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.enableVertexAttribArray(this.aPosition);
    gl.vertexAttribPointer(this.aPosition, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.normBuffer);
    gl.enableVertexAttribArray(this.aNormal);
    gl.vertexAttribPointer(this.aNormal, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
    gl.enableVertexAttribArray(this.aTexCoord);
    gl.vertexAttribPointer(this.aTexCoord, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

    for (const d of this.dice) {
      const modelMatrix = mat4Create();
      mat4FromRotationTranslation(modelMatrix, d.rot, d.pos);

      const mvpMatrix = mat4Multiply(mat4Create(), vpMatrix, modelMatrix);
      gl.uniformMatrix4fv(this.uMVPMatrix, false, mvpMatrix);
      gl.uniformMatrix4fv(this.uModelMatrix, false, modelMatrix);

      const normMat = new Float32Array([
        modelMatrix[0], modelMatrix[1], modelMatrix[2],
        modelMatrix[4], modelMatrix[5], modelMatrix[6],
        modelMatrix[8], modelMatrix[9], modelMatrix[10]
      ]);
      gl.uniformMatrix3fv(this.uNormalMatrix, false, normMat);

      gl.drawElements(gl.TRIANGLES, this.cubeData.indices.length, gl.UNSIGNED_SHORT, 0);
    }
  }

  loop(now) {
    if (!this.lastTime) this.lastTime = now;
    const dt = Math.min((now - this.lastTime) / 1000, 0.033);
    this.lastTime = now;

    if (this.isRolling || this.dice.some(d => !d.settled)) {
      this.updatePhysics(dt);
    }

    this.render();
    requestAnimationFrame(this.loop);
  }

  clear() {
    this.dice = [];
    this.isRolling = false;
    const gl = this.gl;
    if (gl) {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
    if (this.canvas) {
      this.canvas.style.pointerEvents = 'none';
    }
  }
}

// ============================================================================
// RESOLUÇÃO DE REGRAS FRACTAL RPG (v1.0.3)
// ============================================================================

export function resolveFractalRules(results = [], options = {}) {
  const diceValues = Array.isArray(results) ? [...results] : [];
  const isSemFatos = Boolean(options.isSemFatos);
  const useDetermination = Boolean(options.useDetermination);
  const nature = (options.nature || 'humano').toLowerCase();
  const currentEssence = typeof options.essence === 'number' ? options.essence : null;

  const highest = diceValues.length > 0 ? Math.max(...diceValues) : 0;
  const sixesCount = diceValues.filter(v => v === 6).length;
  const hasRupture = diceValues.includes(1);
  const ruptureApplies = hasRupture && !isSemFatos;

  let outcome = 'FALHA';
  let outcomeTitle = '';
  let outcomeDescription = '';

  if (isSemFatos) {
    if (highest === 6) {
      outcome = 'SUCESSO_MILAGROSO';
      outcomeTitle = 'SUCESSO MILAGROSO!';
      outcomeDescription = `Dados: [ ${diceValues.join(', ')} ] — Tirou 6 puro sem Fatos aplicáveis!`;
    } else {
      outcome = 'FALHA';
      outcomeTitle = 'FALHA (Sem Fatos)';
      outcomeDescription = `Dados: [ ${diceValues.join(', ')} ] — Sem Fatos, somente o resultado 6 é Sucesso. (+1 XP)`;
    }
  } else {
    if (sixesCount >= 2) {
      outcome = 'IMPULSO';
      outcomeTitle = `IMPULSO NARRATIVO! (${sixesCount} Seis)`;
      outcomeDescription = `Dados: [ ${diceValues.join(', ')} ] — Sucesso triunfal com feito espetacular na cena!`;
    } else if (highest >= 5) {
      outcome = 'SUCESSO';
      outcomeTitle = `SUCESSO! (Dado: ${highest})`;
      outcomeDescription = `Dados: [ ${diceValues.join(', ')} ] — O objetivo é alcançado com perfeição.`;
    } else {
      outcome = 'FALHA';
      outcomeTitle = `FALHA! (Dado: ${highest})`;
      outcomeDescription = `Dados: [ ${diceValues.join(', ')} ] — O Arquiteto narra a Consequência. (+1 XP)`;
    }
  }

  const isSuccess = outcome === 'SUCESSO' || outcome === 'IMPULSO' || outcome === 'SUCESSO_MILAGROSO';
  const isCritical = outcome === 'IMPULSO';
  const isFailure = outcome === 'FALHA';
  const xpGained = isFailure ? 1 : 0;

  // Determinação (Espírito para humanos, Sangue para dhampiros e vampiros)
  const reserveType = nature === 'humano' ? 'Espírito' : 'Sangue';
  let determinationAllowed = false;
  let determinationError = null;

  if (useDetermination) {
    if (isSemFatos) {
      determinationAllowed = false;
      determinationError = 'Determinação não pode ser usada em rolagens sem Fatos';
    } else if (currentEssence !== null && currentEssence <= 0) {
      determinationAllowed = false;
      determinationError = `Reserva de ${reserveType} esgotada`;
    } else {
      determinationAllowed = true;
    }
  }

  const determinationCost = determinationAllowed ? 1 : 0;
  const newEssence = (currentEssence !== null && determinationAllowed) ? Math.max(0, currentEssence - 1) : currentEssence;

  return {
    results: diceValues,
    highest,
    sixesCount,
    isSemFatos,
    outcome,
    outcomeTitle,
    outcomeDescription,
    isSuccess,
    isCritical,
    isFailure,
    xpGained,
    hasRupture,
    ruptureApplies,
    determination: {
      requested: useDetermination,
      allowed: determinationAllowed,
      cost: determinationCost,
      reserveType,
      error: determinationError,
      newEssence
    }
  };
}

// ============================================================================
// SEAM DE ROLAGEM FRACTAL (FractalRollSystem)
// ============================================================================

export function createFractalRollSystem(options = {}) {
  let diceEngine = options.diceEngine || null;
  const DiceBoxClass = options.DiceBoxClass || null;
  const getContainer = options.getContainer || (() => (typeof document !== 'undefined' ? document.getElementById('dice-box-overlay') : null));
  const getCanvas = options.getCanvas || (() => (typeof document !== 'undefined' ? (document.getElementById('diceCanvas3D') || document.querySelector('#dice-box-overlay canvas')) : null));
  const settleTimeoutMs = options.settleTimeoutMs !== undefined ? options.settleTimeoutMs : 3000;
  const onBroadcast = options.onBroadcast || null;
  const owlbearBridge = options.owlbearBridge || (typeof window !== 'undefined' && window.OwlbearBridge ? window.OwlbearBridge : null);

  let box = null;
  let isInitialized = false;
  let isRolling = false;
  let settleTimer = null;

  function getThemeColor(species = 'humano', isParchment = false) {
    const s = (species || '').toLowerCase();
    if (s === 'dhampiro' || s === 'vampiro') {
      return GOTHIC_PALETTE.crimson;
    }
    if (isParchment) {
      return GOTHIC_PALETTE.bloodDark;
    }
    return GOTHIC_PALETTE.holyGold;
  }

  function setOverlayInteractive(interactive) {
    const container = getContainer();
    if (!container) return;
    container.style.pointerEvents = interactive ? 'auto' : 'none';
  }

  async function init() {
    if (isInitialized) return true;

    const container = getContainer();
    if (container) {
      container.style.pointerEvents = 'none';
    }

    // 1. Prioridade: Se houver canvas no DOM ou engine injetada, inicializar WebGLDiceEngine nativo
    if (!diceEngine && typeof document !== 'undefined') {
      let canvas = getCanvas();
      if (!canvas && container) {
        canvas = document.createElement('canvas');
        canvas.id = 'diceCanvas3D';
        container.appendChild(canvas);
      }
      if (canvas && typeof WebGLDiceEngine === 'function') {
        try {
          diceEngine = new WebGLDiceEngine(canvas);
        } catch (err) {
          console.warn('[FractalRollSystem] Falha ao inicializar WebGLDiceEngine nativo:', err);
        }
      }
    }

    // 2. Compatibilidade / Mocks de Teste (ex: DiceBoxClass passado em testes unitários)
    if (DiceBoxClass) {
      try {
        box = new DiceBoxClass('#dice-box-overlay', {
          themeColor: GOTHIC_PALETTE.crimson,
          scale: 6
        });
        if (box && typeof box.init === 'function') {
          await box.init();
        }
      } catch (err) {
        console.warn('[FractalRollSystem] Falha ao instanciar DiceBoxClass:', err);
      }
    }

    isInitialized = true;
    return true;
  }

  function extractDiceValues(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      if (raw.length === 0) return [];
      if (raw[0] && Array.isArray(raw[0].rolls)) {
        return raw.flatMap(g => g.rolls.map(r => r.value));
      }
      if (raw[0] && typeof raw[0].value === 'number') {
        return raw.map(r => r.value);
      }
      if (typeof raw[0] === 'number') {
        return raw;
      }
    }
    return [];
  }

  async function roll3D(count = 2, rollOpts = {}) {
    const qty = Math.max(1, Math.min(6, parseInt(count, 10) || 1));
    const themeColor = rollOpts.themeColor || GOTHIC_PALETTE.crimson;

    // Se temos o motor nativo WebGL
    if (diceEngine && typeof diceEngine.roll === 'function') {
      try {
        return await diceEngine.roll(qty, themeColor);
      } catch (err) {
        console.warn('[FractalRollSystem] Falha no motor WebGLDiceEngine nativo:', err);
      }
    }

    // Se temos o mock ou adaptador Box
    if (box && typeof box.roll === 'function') {
      try {
        const raw = await box.roll(`${qty}d6`, { themeColor });
        return extractDiceValues(raw);
      } catch (err) {
        console.warn('[FractalRollSystem] Falha no box.roll:', err);
      }
    }

    // Fallback matemático se WebGL ou box não estiverem ativos
    const fallbackResults = [];
    for (let i = 0; i < qty; i++) {
      fallbackResults.push(Math.floor(Math.random() * 6) + 1);
    }
    return fallbackResults;
  }

  async function roll(params = {}) {
    const {
      count = 2,
      nature = 'humano',
      isParchment = false,
      characterName = 'Herói',
      useDetermination = false,
      isSemFatos = false,
      essence = null,
      onDeductEssence = null,
      onGainXP = null
    } = params;

    if (!isInitialized) {
      await init();
    }

    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }

    isRolling = true;
    const container = getContainer();
    if (container) {
      container.classList.add('lights-dimmed');
    }
    setOverlayInteractive(true);

    const themeColor = getThemeColor(nature, isParchment);
    const diceValues = await roll3D(count, { themeColor });

    isRolling = false;

    if (settleTimeoutMs > 0) {
      settleTimer = setTimeout(() => {
        setOverlayInteractive(false);
      }, settleTimeoutMs);
    } else {
      setOverlayInteractive(false);
    }

    // Processamento das Regras do Fractal RPG
    const ruleEvaluation = resolveFractalRules(diceValues, {
      isSemFatos,
      useDetermination,
      essence,
      nature
    });

    // Se houve consumo de determinação válido e callback fornecido
    if (ruleEvaluation.determination.cost > 0 && typeof onDeductEssence === 'function') {
      try {
        onDeductEssence(ruleEvaluation.determination.cost, ruleEvaluation.determination.reserveType);
      } catch (err) {
        console.warn('[FractalRollSystem] Erro no callback onDeductEssence:', err);
      }
    }

    // Se houve ganho de XP (por falha) e callback fornecido
    if (ruleEvaluation.xpGained > 0 && typeof onGainXP === 'function') {
      try {
        onGainXP(ruleEvaluation.xpGained);
      } catch (err) {
        console.warn('[FractalRollSystem] Erro no callback onGainXP:', err);
      }
    }

    const result = {
      characterName,
      nature,
      count: diceValues.length,
      useDetermination,
      isSemFatos,
      timestamp: Date.now(),
      ...ruleEvaluation
    };

    if (owlbearBridge && typeof owlbearBridge.broadcastRoll === 'function') {
      try {
        await owlbearBridge.broadcastRoll(result);
      } catch (err) {
        console.warn('[FractalRollSystem] Erro no owlbearBridge.broadcastRoll:', err);
      }
    }

    if (typeof onBroadcast === 'function') {
      try {
        onBroadcast(result);
      } catch (err) {
        console.warn('[FractalRollSystem] Erro no onBroadcast:', err);
      }
    }

    return result;
  }

  function clear() {
    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
    isRolling = false;
    const container = getContainer();
    if (container) {
      container.classList.remove('lights-dimmed');
    }
    setOverlayInteractive(false);
    if (diceEngine && typeof diceEngine.clear === 'function') {
      diceEngine.clear();
    }
  }

  return {
    get isInitialized() { return isInitialized; },
    get isRolling() { return isRolling; },
    get box() { return box; },
    get diceEngine() { return diceEngine; },
    get owlbearBridge() { return owlbearBridge; },
    init,
    getThemeColor,
    roll3D,
    roll,
    clear,
    setOverlayInteractive,
    resolveFractalRules,
    evaluateRoll: resolveFractalRules
  };
}

// Exportações globais de janela quando executado no navegador
if (typeof window !== 'undefined') {
  window.WebGLDiceEngine = WebGLDiceEngine;
  window.createFractalRollSystem = createFractalRollSystem;
  window.FractalRollSystem = createFractalRollSystem();
}
