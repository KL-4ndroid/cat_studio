// CAT6 calibration A. The second UV set is registered to the 2D editor artwork.
// The original CAT6 UV remains in the asset for other uses.
const vertexShader = `#version 300 es
precision highp float;layout(location=0)in vec3 pos;layout(location=1)in vec3 norm;layout(location=2)in vec2 uv;uniform vec2 angle,aspect;uniform float zoom;out vec3 N,P,orig;out vec2 U;vec3 rot(vec3 a){float c=cos(angle.x),s=sin(angle.x);a=vec3(c*a.x+s*a.z,a.y,-s*a.x+c*a.z);c=cos(angle.y);s=sin(angle.y);return vec3(a.x,c*a.y-s*a.z,s*a.y+c*a.z);}void main(){P=rot(pos);N=rot(norm);U=uv;orig=pos;gl_Position=vec4(P.xy*aspect*zoom/8.0,-P.z/22.0,1.0);}`;
const fragmentShader = `#version 300 es
precision highp float;in vec3 N,P,orig;in vec2 U;uniform vec3 base;uniform bool hardware;uniform sampler2D artwork;out vec4 outColor;
vec3 srgb(vec3 c){return pow(max(c,vec3(0.)),vec3(2.2));}
float softbox(vec3 r,vec3 dir,float power){return pow(max(dot(r,normalize(dir)),0.),power);}
const int noseEdgeCount=40;
const vec3 nosePlanes[noseEdgeCount]=vec3[](
vec3(0.97159293,0.23665835,0.90486469),
vec3(0.90091610,0.43399330,1.16982816),
vec3(0.82422199,0.56626682,1.34349439),
vec3(0.75242944,0.65867286,1.46551648),
vec3(0.68566595,0.72791634,1.55961376),
vec3(0.62028252,0.78437848,1.63984862),
vec3(0.55046785,0.83485636,1.71552235),
vec3(0.54899787,0.83582375,1.71708864),
vec3(0.45705062,0.88944069,1.80458527),
vec3(0.32291290,0.94642869,1.89451010),
vec3(0.14575086,0.98932133,1.95410757),
vec3(-0.05621321,0.99841879,1.94834109),
vec3(-0.24903368,0.96849482,1.87121796),
vec3(-0.40571990,0.91399746,1.75310042),
vec3(-0.52002880,0.85414873,1.63086377),
vec3(-0.54833293,0.83626012,1.59557160),
vec3(-0.58974109,0.80759238,1.54357161),
vec3(-0.63283128,0.77428972,1.48812757),
vec3(-0.68191990,0.73142686,1.42238832),
vec3(-0.74133013,0.67114055,1.33623723),
vec3(-0.81547471,0.57879271,1.21066010),
vec3(-0.90490503,0.42561353,1.00618769),
vec3(-0.98691735,0.16122702,0.64622762),
vec3(-0.97081377,-0.23983456,0.06791916),
vec3(-0.79412295,-0.60775713,-0.50976436),
vec3(-0.55872847,-0.82935065,-0.89351443),
vec3(-0.36505407,-0.93098632,-1.08872785),
vec3(-0.22670755,-0.97396288,-1.17953169),
vec3(-0.12903053,-0.99164062,-1.21944083),
vec3(-0.05826300,-0.99830127,-1.23410773),
vec3(-0.00527581,-0.99998608,-1.23561591),
vec3(0.02405348,-0.99971067,-1.23175626),
vec3(0.07675374,-0.99705008,-1.21829113),
vec3(0.14153724,-0.98993293,-1.19210837),
vec3(0.22613818,-0.97409523,-1.14344934),
vec3(0.34218183,-0.93963375,-1.05229350),
vec3(0.50521724,-0.86299220,-0.87692347),
vec3(0.72155215,-0.69236009,-0.53974094),
vec3(0.93191329,-0.36268116,0.02343695),
vec3(0.99882081,-0.04854880,0.50135954));
float noseCoverage(vec3 p){
 if(p.z<4.65||p.x<-.62||p.x>.44||p.y<-1.98||p.y>-1.22)return 0.;
 float margin=1.;
 for(int i=0;i<noseEdgeCount;i++)margin=min(margin,dot(nosePlanes[i],vec3(p.xy,1.)));
 return smoothstep(-.008,.008,margin);
}
// Area-light reflections in reflection space make the clear coat read as a
// polished surface. The soft edge is the light's penumbra, not an albedo map.
float studioPanel(vec3 ray,vec3 direction,vec2 halfSize,float feather){
 vec3 axis=normalize(direction);
 vec3 right=normalize(cross(vec3(0.,1.,0.),axis));
 vec3 up=cross(axis,right);
 float depth=dot(ray,axis);
 if(depth<=0.)return 0.;
 vec2 uv=vec2(dot(ray,right),dot(ray,up))/depth;
 vec2 edge=abs(uv)-halfSize+vec2(.05);
 float distance=length(max(edge,0.))+min(max(edge.x,edge.y),0.)-.05;
 return 1.-smoothstep(-feather,feather,distance);
}

vec3 glazedEnamel(vec3 albedo,vec3 normal,vec3 ray){
 float key=max(dot(normal,normalize(vec3(-.5,.8,1.))),0.);
 float fill=max(dot(normal,normalize(vec3(.9,-.1,.4))),0.);
 float diffuse=.56+.30*key+.14*fill;
 // Clear dielectric coat over the pigmented layer. Keep the colored body opaque.
 float grazing=pow(1.-clamp(normal.z,0.,1.),5.);
 float reflection=.04+.96*grazing;
 float mainPanel=studioPanel(ray,vec3(-.71,.62,1.),vec2(.165,.40),.065);
 float fillPanel=studioPanel(ray,vec3(.90,.22,.76),vec2(.095,.34),.052);
 float bounce=softbox(ray,vec3(-.3,.95,1.),4.);
 float coatLight=.43*mainPanel+.19*fillPanel+.075*bounce;
 return albedo*diffuse*(1.-.22*reflection)
   +vec3(coatLight*(1.+.40*grazing)+.065*grazing);
}

vec3 goldReflection(vec3 ray){
 float highlights=softbox(ray,vec3(-.65,.55,1.),18.)
   +.6*softbox(ray,vec3(.8,.4,.7),12.6);
 float environment=.18+.62*softbox(ray,vec3(-.6,.8,1.),4.)
   +.35*softbox(ray,vec3(.9,-.35,.5),6.)+.20*max(ray.y,0.);
 return srgb(vec3(.82,.63,.30))*environment*1.55+vec3(highlights*.45);
}

void main(){
 vec3 n=normalize(N),v=vec3(0.,0.,1.);
 if(!gl_FrontFacing)n=-n;
 vec3 r=reflect(-v,n);
 float m=hardware?1.:noseCoverage(orig);
 if(hardware||m>=1.){
  outColor=vec4(pow(clamp(goldReflection(r),0.,1.),vec3(1./2.2)),1.);
  return;
 }
 vec3 paint=mix(base,texture(artwork,U).rgb,smoothstep(.62,1.18,orig.z));
 vec3 rgb=glazedEnamel(srgb(paint),n,r);
 if(m>0.)rgb=mix(rgb,goldReflection(r),m);
 outColor=vec4(pow(clamp(rgb,0.,1.),vec3(1./2.2)),1.);
}`;

let modelRequest;
function loadModel() {
  if (!modelRequest) {
    modelRequest = fetch(new URL('./assets/cat6-preview.glb', import.meta.url))
      .then(response => {
        if (!response.ok) throw Error('CAT6 model unavailable');
        return response.arrayBuffer();
      })
      .then(bytes => {
        const header = new DataView(bytes);
        if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2)
          throw Error('Invalid CAT6 GLB');
        const jsonSize = header.getUint32(12, true);
        const model = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, jsonSize)));
        const dataStart = 28 + jsonSize;
        function read(index, Type, width) {
          const field = model.accessors[index];
          const view = model.bufferViews[field.bufferView];
          return new Type(bytes, dataStart + (view.byteOffset || 0) + (field.byteOffset || 0), field.count * width);
        }
        return model.meshes.map(({primitives: [primitive]}) => {
          const fields = primitive.attributes;
          return {
            position: read(fields.POSITION, Float32Array, 3).map(metres => metres * 1000),
            normal: read(fields.NORMAL, Float32Array, 3),
            uv: read(fields.TEXCOORD_1 ?? fields.TEXCOORD_0, Float32Array, 2),
            indices: read(primitive.indices, Uint16Array, 1),
          };
        });
      })
      .catch(error => {
        modelRequest = null;
        throw error;
      });
  }
  return modelRequest;
}

function linkProgram(gl) {
  const program = gl.createProgram();
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, vertexShader], [gl.FRAGMENT_SHADER, fragmentShader]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw Error(message);
      }
      gl.attachShader(program, shader);
      gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    return program;
  } catch (error) {
    gl.deleteProgram(program);
    throw error;
  }
}

async function decodeArtwork(svg) {
  const url = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml;charset=utf-8'}));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function createPreview(canvas, onUnavailable) {
  const gl = canvas.getContext('webgl2', {antialias: true, alpha: false});
  if (!gl) throw Error('WebGL 2 unavailable');

  const program = linkProgram(gl);
  const handles = Object.fromEntries(['angle', 'aspect', 'zoom', 'base', 'hardware', 'artwork']
    .map(name => [name, gl.getUniformLocation(program, name)]));
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.enable(gl.DEPTH_TEST);

  let meshes = [];
  const buffers = [];
  let frame = 0;
  let yaw = 0;
  let pitch = 0;
  let zoom = 1;
  let base = [1, 1, 1];
  let disposed = false;
  let artworkRevision = 0;
  const input = new AbortController();
  const options = {signal: input.signal};
  const pointers = new Map();

  function draw() {
    frame = 0;
    if (disposed || !meshes.length || !canvas.clientWidth || !canvas.clientHeight) return;
    const pixelRatio = Math.min(devicePixelRatio || 1, 2);
    const width = Math.round(canvas.clientWidth * pixelRatio);
    const height = Math.round(canvas.clientHeight * pixelRatio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.clearColor(243/255, 239/255, 229/255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform2f(handles.angle, yaw, pitch);
    gl.uniform2f(handles.aspect, Math.min(1, height/width), Math.min(1, width/height));
    gl.uniform1f(handles.zoom, zoom);
    gl.uniform3fv(handles.base, base);
    gl.uniform1i(handles.artwork, 0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    for (const [index, mesh] of meshes.entries()) {
      gl.uniform1i(handles.hardware, index === 1 ? 1 : 0);
      gl.bindVertexArray(mesh.vao);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
    }
  }

  function schedule() {
    if (!disposed && !frame) frame = requestAnimationFrame(draw);
  }

  function attachBuffer(target, array) {
    const buffer = gl.createBuffer();
    buffers.push(buffer);
    gl.bindBuffer(target, buffer);
    gl.bufferData(target, array, gl.STATIC_DRAW);
  }

  async function setArtwork(svg, color) {
    const revision = ++artworkRevision;
    const [parts, image] = await Promise.all([loadModel(), decodeArtwork(svg)]);
    if (disposed || revision !== artworkRevision) return;
    if (!meshes.length) {
      meshes = parts.map(({position, normal, uv, indices}) => {
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        for (const [location, array, width] of [[0, position, 3], [1, normal, 3], [2, uv, 2]]) {
          attachBuffer(gl.ARRAY_BUFFER, array);
          gl.enableVertexAttribArray(location);
          gl.vertexAttribPointer(location, width, gl.FLOAT, false, 0, 0);
        }
        attachBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
        return {vao, count: indices.length};
      });
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    if (gl.getError() !== gl.NO_ERROR) throw Error('CAT6 texture unavailable');
    base = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16)/255);
    schedule();
  }

  function reset() {
    yaw = pitch = 0;
    zoom = 1;
    schedule();
  }

  function rotate(dx, dy) {
    yaw += dx;
    pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch + dy));
    schedule();
  }

  function magnify(factor) {
    zoom = Math.max(.65, Math.min(1.75, zoom * factor));
    schedule();
  }

  function distance() {
    const [a, b] = pointers.values();
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  }

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointers.size === 2) return;
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
  }, options);
  canvas.addEventListener('pointermove', event => {
    const old = pointers.get(event.pointerId);
    if (!old) return;
    const isPinch = pointers.size === 2;
    const previousDistance = isPinch ? distance() : 0;
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
    if (previousDistance) magnify(distance()/previousDistance);
    else if (!isPinch) rotate((event.clientX-old[0])*.009, (event.clientY-old[1])*.009);
  }, options);
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(name, event => pointers.delete(event.pointerId), options);
  }
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    magnify(Math.exp(-event.deltaY*.001));
  }, {...options, passive: false});
  canvas.addEventListener('keydown', event => {
    const commands = {
      ArrowLeft: () => rotate(-.15, 0), ArrowRight: () => rotate(.15, 0),
      ArrowUp: () => rotate(0, -.15), ArrowDown: () => rotate(0, .15),
      '+': () => magnify(1.1), '-': () => magnify(1/1.1), Home: reset,
    };
    if (!Object.hasOwn(commands, event.key)) return;
    event.preventDefault();
    commands[event.key]();
  }, options);
  canvas.addEventListener('webglcontextlost', onUnavailable, options);
  const resize = new ResizeObserver(schedule);
  resize.observe(canvas);

  return {
    setArtwork,
    reset,
    dispose() {
      disposed = true;
      input.abort();
      resize.disconnect();
      cancelAnimationFrame(frame);
      for (const {vao} of meshes) gl.deleteVertexArray(vao);
      for (const buffer of buffers) gl.deleteBuffer(buffer);
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
    },
  };
}
