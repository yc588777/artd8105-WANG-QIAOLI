export const VERT = `#version 300 es
precision highp float;
const vec2 VERTS[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
void main(){
  gl_Position = vec4(VERTS[gl_VertexID], 0.0, 1.0);
}`;

export const SIM_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uPrev;
uniform vec2 uRes;
uniform float uDu;
uniform float uDv;
uniform float uF;
uniform float uK;
uniform float uDt;
out vec4 fragColor;
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 t = 1.0 / uRes;
  vec2 c = texture(uPrev, uv).rg;
  float u = c.x;
  float v = c.y;
  float lapU = texture(uPrev, uv + vec2(t.x,0.0)).x + texture(uPrev, uv - vec2(t.x,0.0)).x
             + texture(uPrev, uv + vec2(0.0,t.y)).x + texture(uPrev, uv - vec2(0.0,t.y)).x - 4.0 * u;
  float lapV = texture(uPrev, uv + vec2(t.x,0.0)).y + texture(uPrev, uv - vec2(t.x,0.0)).y
             + texture(uPrev, uv + vec2(0.0,t.y)).y + texture(uPrev, uv - vec2(0.0,t.y)).y - 4.0 * v;
  float uvv = u * v * v;
  float un = u + uDt * (uDu * lapU - uvv + uF * (1.0 - u));
  float vn = v + uDt * (uDv * lapV + uvv - (uF + uK) * v);
  fragColor = vec4(clamp(un, 0.0, 1.0), clamp(vn, 0.0, 1.0), 0.0, 1.0);
}`;

export const DRAW_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uPrev;
uniform vec2 uRes;
uniform int uMode;
out vec4 fragColor;
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 c = texture(uPrev, uv).rg;
  float a = clamp(c.x, 0.0, 1.0);
  float b = clamp(c.y, 0.0, 1.0);
  vec3 col;
  if (uMode == 0) {
    col = vec3(a * 0.08, a * 0.32, 0.16 + a * 0.7);
  } else if (uMode == 1) {
    float t = clamp(b * 2.2, 0.0, 1.0);
    col = vec3(t, t * 0.55, 0.16 + (1.0 - t) * 0.3);
  } else {
    float t = clamp(b * 3.0, 0.0, 1.0);
    float r = t > 0.5 ? (t - 0.5) * 2.0 : 0.0;
    col = vec3(r, t * 0.59, t + (1.0 - a) * 0.59);
  }
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export const SPLAT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uPrev;
uniform vec2 uRes;
uniform vec2 uPoint;
uniform float uRadius;
uniform float uAmount;
uniform float uErase;
out vec4 fragColor;
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 c = texture(uPrev, uv).rg;
  float d = distance(gl_FragCoord.xy, uPoint);
  float m = smoothstep(uRadius, 0.0, d);
  if (uErase > 0.5) {
    c.y = mix(c.y, 0.0, m);
    c.x = mix(c.x, 1.0, m * 0.5);
  } else {
    c.y = mix(c.y, uAmount, m);
    c.x = mix(c.x, 0.35, m);
  }
  fragColor = vec4(c, 0.0, 1.0);
}`;
