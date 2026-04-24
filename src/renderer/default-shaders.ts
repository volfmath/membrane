export const SPRITE_VERTEX_SHADER = `
attribute vec2 aPosition;
attribute vec2 aTexCoord;
attribute vec4 aColor;

uniform mat4 uProjection;

varying vec2 vTexCoord;
varying vec4 vColor;

void main() {
  vTexCoord = aTexCoord;
  vColor = aColor;
  gl_Position = uProjection * vec4(aPosition, 0.0, 1.0);
}
`;

export const SPRITE_FRAGMENT_SHADER = `
precision mediump float;

varying vec2 vTexCoord;
varying vec4 vColor;

uniform sampler2D uTexture;

void main() {
  gl_FragColor = texture2D(uTexture, vTexCoord) * vColor;
}
`;
