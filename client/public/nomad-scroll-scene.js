import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js/+esm';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js/+esm';
if (!window.__deliverhubNomadSceneStarted) {
window.__deliverhubNomadSceneStarted = true;

const wrap = document.getElementById('canvas-wrap');
const progressEl = document.getElementById('progress');
const splineHero = document.getElementById('spline-hero');
const copies = [...document.querySelectorAll('.copy')];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0d10);
scene.fog = new THREE.FogExp2(0x0b0d10, 0.008);

const camera = new THREE.PerspectiveCamera(31, innerWidth/innerHeight, 0.05, 300);
camera.position.set(-18,14,19);

const renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance'});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
wrap.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xc8d8ff, 0x151515, 1.45);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 4.2);
key.position.set(6, 9, 5);
key.castShadow = true;
key.shadow.mapSize.set(2048,2048);
key.shadow.camera.near = 0.1;
key.shadow.camera.far = 40;
key.shadow.camera.left = -10;
key.shadow.camera.right = 10;
key.shadow.camera.top = 10;
key.shadow.camera.bottom = -10;
scene.add(key);

const rim = new THREE.DirectionalLight(0xff7048, 2.2);
rim.position.set(-5, 4, -6);
scene.add(rim);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(80,80),
  new THREE.MeshStandardMaterial({color:0x101318,roughness:.86,metalness:.05})
);
floor.rotation.x = -Math.PI/2;
floor.position.y = -1.03;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(80,80,0x30353d,0x1c2026);
grid.position.y = -1.02;
grid.material.opacity = .22;
grid.material.transparent = true;
scene.add(grid);

const vehicleRoot = new THREE.Group();
scene.add(vehicleRoot);
let model = null;

function mat(color, roughness=.45, metalness=.15){
  return new THREE.MeshStandardMaterial({color, roughness, metalness});
}
function mesh(geometry, material, position, rotation=[0,0,0]){
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...position);
  m.rotation.set(...rotation);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function roundedBox(w,h,d,r=0.18,steps=5){
  const shape = new THREE.Shape();
  const x=-w/2, y=-h/2;
  shape.moveTo(x+r,y);
  shape.lineTo(x+w-r,y); shape.quadraticCurveTo(x+w,y,x+w,y+r);
  shape.lineTo(x+w,y+h-r); shape.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  shape.lineTo(x+r,y+h); shape.quadraticCurveTo(x,y+h,x,y+h-r);
  shape.lineTo(x,y+r); shape.quadraticCurveTo(x,y,x+r,y);
  const g = new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:true,bevelThickness:r*.45,bevelSize:r*.45,bevelSegments:steps});
  g.center();
  return g;
}
function makeWheel(x,z){
  const group = new THREE.Group();
  const tire = mesh(new THREE.CylinderGeometry(.48,.48,.34,40), mat(0x111315,.72,.08), [0,0,0], [Math.PI/2,0,0]);
  const rim = mesh(new THREE.CylinderGeometry(.29,.29,.37,24), mat(0x9aa0a8,.25,.85), [0,0,0], [Math.PI/2,0,0]);
  const hub = mesh(new THREE.CylinderGeometry(.10,.10,.39,24), mat(0x30343a,.3,.7), [0,0,0], [Math.PI/2,0,0]);
  group.add(tire,rim,hub);
  group.position.set(x,-.58,z);
  return group;
}
function buildFallbackVan(){
  const g = new THREE.Group();

  const white = mat(0xd9dde2,.28,.35);
  const dark = mat(0x111820,.18,.65);
  const black = mat(0x17191c,.62,.15);
  const glass = new THREE.MeshPhysicalMaterial({
    color:0x1f3542, roughness:.06, metalness:.02, transmission:.08,
    transparent:true, opacity:.88, clearcoat:1, clearcoatRoughness:.04
  });
  const orange = mat(0xff6238,.3,.25);
  const chrome = mat(0xb9c1c9,.18,.9);

  // Main cargo body
  const cargo = mesh(roundedBox(4.15,2.25,2.05,.22), white, [-.55,.28,0]);
  g.add(cargo);

  // Rebuilt cab: taller roof, clear A-pillars and a proper commercial-van nose
  const cabLower = mesh(roundedBox(1.92,1.22,2.02,.16), white, [1.92,-.14,0]);
  g.add(cabLower);

  const cabUpper = mesh(roundedBox(1.62,1.02,2.00,.14), white, [1.80,.84,0]);
  cabUpper.rotation.z = -.035;
  g.add(cabUpper);

  // Proper sloped bonnet and front fascia
  const bonnet = mesh(roundedBox(.82,.34,1.84,.10), white, [2.87,.02,0]);
  bonnet.rotation.z = -.035;
  g.add(bonnet);

  const frontFascia = mesh(roundedBox(.20,.76,1.90,.08), white, [3.22,-.18,0]);
  g.add(frontFascia);

  const bumper = mesh(roundedBox(.26,.24,1.94,.06), black, [3.30,-.67,0]);
  g.add(bumper);

  // Front panoramic windshield — pushed slightly forward so it cannot be hidden by the cab body
  const windshieldFrame = mesh(new THREE.BoxGeometry(.075,1.14,1.86), black, [2.64,.88,0], [0,0,-.09]);
  g.add(windshieldFrame);

  const windshield = mesh(new THREE.BoxGeometry(.09,1.04,1.74), glass, [2.685,.88,0], [0,0,-.09]);
  g.add(windshield);

  // Thin A-pillars
  g.add(mesh(new THREE.BoxGeometry(.08,1.16,.08), black, [2.56,.86,.93], [0,0,-.09]));
  g.add(mesh(new THREE.BoxGeometry(.08,1.16,.08), black, [2.56,.86,-.93], [0,0,-.09]));

  // Clear left and right side windows — moved outward beyond the cab surface
  const sideWinL = mesh(new THREE.BoxGeometry(.94,.76,.075), glass, [1.96,.80,1.075]);
  const sideWinR = mesh(new THREE.BoxGeometry(.94,.76,.075), glass, [1.96,.80,-1.075]);
  g.add(sideWinL,sideWinR);

  // Rear-quarter side windows
  const quarterL = mesh(new THREE.BoxGeometry(.44,.66,.075), glass, [1.30,.80,1.075]);
  const quarterR = mesh(new THREE.BoxGeometry(.44,.66,.075), glass, [1.30,.80,-1.075]);
  g.add(quarterL,quarterR);

  // Strong but narrow B-pillars
  g.add(mesh(new THREE.BoxGeometry(.08,.84,.085), black, [1.56,.78,1.075]));
  g.add(mesh(new THREE.BoxGeometry(.08,.84,.085), black, [1.56,.78,-1.075]));

  // Grille with horizontal slats
  const grille = mesh(new THREE.BoxGeometry(.055,.38,1.18), black, [3.325,-.22,0]);
  g.add(grille);

  for(let z=-.44; z<=.44; z+=.22){
    g.add(mesh(new THREE.BoxGeometry(.07,.035,.18), chrome, [3.36,-.22,z]));
  }

  // Hood crease
  g.add(mesh(new THREE.BoxGeometry(.54,.025,1.46), chrome, [2.98,.19,0]));

  // Doors and panel gaps
  const seamMat = mat(0x90959b,.5,.2);
  const door1 = mesh(new THREE.BoxGeometry(.02,1.48,.82), seamMat, [1.72,.18,1.04]);
  const door2 = mesh(new THREE.BoxGeometry(.02,1.48,.82), seamMat, [1.72,.18,-1.04]);
  g.add(door1,door2);

  // Mirrors
  g.add(mesh(roundedBox(.18,.20,.34,.05), black, [2.47,.77,1.25]));
  g.add(mesh(roundedBox(.18,.20,.34,.05), black, [2.47,.77,-1.25]));

  // Side trim and orange brand stripe
  g.add(mesh(new THREE.BoxGeometry(3.75,.10,.035), black, [-.55,-.52,1.045]));
  g.add(mesh(new THREE.BoxGeometry(3.75,.10,.035), black, [-.55,-.52,-1.045]));
  g.add(mesh(new THREE.BoxGeometry(3.15,.16,.04), orange, [-.65,.05,1.06]));
  g.add(mesh(new THREE.BoxGeometry(3.15,.16,.04), orange, [-.65,.05,-1.06]));

  // Headlights and taillights
  const head = new THREE.MeshPhysicalMaterial({color:0xeaf6ff, emissive:0xbfdfff, emissiveIntensity:2.2, roughness:.1});
  const tail = new THREE.MeshPhysicalMaterial({color:0x8f1010, emissive:0xff2424, emissiveIntensity:2.0, roughness:.2});
  g.add(mesh(roundedBox(.08,.24,.40,.035), head, [3.34,-.08,.66]));
  g.add(mesh(roundedBox(.08,.24,.40,.035), head, [3.34,-.08,-.66]));
  const indicator = new THREE.MeshPhysicalMaterial({color:0xffa43a, emissive:0xff8b1f, emissiveIntensity:1.8, roughness:.18});
  g.add(mesh(roundedBox(.08,.10,.26,.03), indicator, [3.345,-.25,.73]));
  g.add(mesh(roundedBox(.08,.10,.26,.03), indicator, [3.345,-.25,-.73]));
  g.add(mesh(roundedBox(.08,.42,.22,.04), tail, [-2.67,-.02,.78]));
  g.add(mesh(roundedBox(.08,.42,.22,.04), tail, [-2.67,-.02,-.78]));

  // Wheels
  g.add(makeWheel(1.95,1.02), makeWheel(1.95,-1.02), makeWheel(-1.65,1.02), makeWheel(-1.65,-1.02));

  // Wheel arches
  const archMat = mat(0x1a1c20,.58,.2);
  for(const x of [1.95,-1.65]){
    g.add(mesh(new THREE.TorusGeometry(.55,.10,12,36,Math.PI), archMat, [x,-.42,1.055], [0,Math.PI/2,0]));
    g.add(mesh(new THREE.TorusGeometry(.55,.10,12,36,Math.PI), archMat, [x,-.42,-1.055], [0,-Math.PI/2,0]));
  }

  // Rear cargo doors
  const rearDoorLeftPivot = new THREE.Group();
  rearDoorLeftPivot.position.set(-2.67, .18, .98);
  const rearDoorLeft = mesh(roundedBox(.10,1.72,.96,.06), white, [0,0,-.48]);
  rearDoorLeftPivot.add(rearDoorLeft);
  g.add(rearDoorLeftPivot);

  const rearDoorRightPivot = new THREE.Group();
  rearDoorRightPivot.position.set(-2.67, .18, -.98);
  const rearDoorRight = mesh(roundedBox(.10,1.72,.96,.06), white, [0,0,.48]);
  rearDoorRightPivot.add(rearDoorRight);
  g.add(rearDoorRightPivot);

  // Cargo interior
  const cargoInteriorMat = mat(0x59616a,.62,.12);
  const cargoDarkMat = mat(0x262b31,.78,.06);

  // Full cargo bay interior
  const cargoFloor = mesh(new THREE.BoxGeometry(3.82,.10,1.76), cargoDarkMat, [-.66,-.72,0]);
  g.add(cargoFloor);

  const cargoCeiling = mesh(new THREE.BoxGeometry(3.82,.08,1.76), cargoInteriorMat, [-.66,1.05,0]);
  g.add(cargoCeiling);

  const cargoWallLeft = mesh(new THREE.BoxGeometry(3.82,1.72,.07), cargoInteriorMat, [-.66,.16,.89]);
  const cargoWallRight = mesh(new THREE.BoxGeometry(3.82,1.72,.07), cargoInteriorMat, [-.66,.16,-.89]);
  g.add(cargoWallLeft,cargoWallRight);

  const cargoFrontWall = mesh(new THREE.BoxGeometry(.08,1.72,1.76), cargoInteriorMat, [1.20,.16,0]);
  g.add(cargoFrontWall);

  // Structural ribs inside the cargo bay
  for(const x of [-1.95,-1.15,-.35,.45]){
    g.add(mesh(new THREE.BoxGeometry(.06,1.62,.10), chrome, [x,.16,.83]));
    g.add(mesh(new THREE.BoxGeometry(.06,1.62,.10), chrome, [x,.16,-.83]));
  }

  // Side shelves
  const shelfMat = mat(0x373d44,.55,.18);
  for(const z of [.66,-.66]){
    g.add(mesh(new THREE.BoxGeometry(2.85,.08,.42), shelfMat, [-.72,.24,z]));
    g.add(mesh(new THREE.BoxGeometry(2.85,.08,.42), shelfMat, [-.72,.72,z]));
  }

  // Rear opening is now transparent/readable, not blocked by a dark panel.
  const rearFrameTop = mesh(new THREE.BoxGeometry(.10,.12,1.78), black, [-2.68,1.02,0]);
  const rearFrameBottom = mesh(new THREE.BoxGeometry(.10,.12,1.78), black, [-2.68,-.72,0]);
  const rearFrameL = mesh(new THREE.BoxGeometry(.10,1.62,.10), black, [-2.68,.15,.86]);
  const rearFrameR = mesh(new THREE.BoxGeometry(.10,1.62,.10), black, [-2.68,.15,-.86]);
  g.add(rearFrameTop,rearFrameBottom,rearFrameL,rearFrameR);

  // Interior cargo lighting so the bay remains visible when the doors open.
  const cargoLight = new THREE.PointLight(0xf6f0dd, 3.2, 7.5, 2);
  cargoLight.position.set(-1.35,.82,0);
  g.add(cargoLight);

  const cargoFill = new THREE.PointLight(0xbfd7ff, 1.7, 6.5, 2);
  cargoFill.position.set(-2.10,.20,0);
  g.add(cargoFill);

  const cargoBoxes = [];
  const boxMat = mat(0xb8844f,.78,.02);
  const tapeMat = mat(0xd7b07a,.6,.01);
  const cargoBoxData = [
    [-2.05,-.30,.44,.76,.64,.62],
    [-2.00,-.30,-.44,.74,.62,.60],
    [-1.28,-.28,.20,.84,.68,.72],
    [-1.25,.38,-.22,.70,.60,.64],
    [-.48,-.28,.48,.72,.60,.58],
    [-.42,.36,-.46,.66,.56,.56]
  ];

  cargoBoxData.forEach((d,index)=>{
    const [x,y,z,w,h,dep]=d;
    const boxGroup = new THREE.Group();
    boxGroup.position.set(x,y,z);
    const body = mesh(roundedBox(w,h,dep,.055), boxMat, [0,0,0]);
    const tape = mesh(new THREE.BoxGeometry(w*1.01,.035,dep*.18), tapeMat, [0,h*.20,0]);
    boxGroup.add(body,tape);
    boxGroup.userData.start = new THREE.Vector3(x,y,z);
    boxGroup.userData.delay = index * .055;
    cargoBoxes.push(boxGroup);
    g.add(boxGroup);
  });

  g.userData.rearDoorLeftPivot = rearDoorLeftPivot;
  g.userData.rearDoorRightPivot = rearDoorRightPivot;
  g.userData.cargoBoxes = cargoBoxes;

  // Roof marker lights
  const marker = new THREE.MeshStandardMaterial({color:0xffb347, emissive:0xff8a24, emissiveIntensity:1.4});
  [-.9,0,.9].forEach(z => g.add(mesh(new THREE.BoxGeometry(.12,.06,.12), marker, [2.35,1.19,z])));

  // Ground contact shadow proxy
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4,2.65),
    new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.24,depthWrite:false})
  );
  shadow.rotation.x = -Math.PI/2;
  shadow.position.y = -1.0;
  g.add(shadow);

  g.rotation.y = -.18;
  return g;
}

function buildMascot(){
  const g = new THREE.Group();

  const shellMat = new THREE.MeshPhysicalMaterial({
    color:0xf3f5f8, roughness:.22, metalness:.05, clearcoat:.6, clearcoatRoughness:.25
  });
  const visorMat = new THREE.MeshPhysicalMaterial({
    color:0xf1f5f9, roughness:.18, metalness:.04, clearcoat:.9, clearcoatRoughness:.08
  });
  const faceInkMat = new THREE.MeshBasicMaterial({
    color:0x020306,
    depthTest:false,
    depthWrite:false
  });
  const darkJointMat = mat(0x1a1c20,.5,.3);
  const dotMat = new THREE.MeshStandardMaterial({
    color:0xff5a3c, emissive:0xff3a1c, emissiveIntensity:2.2, roughness:.3
  });

  // Head: rounded helmet shell + flattened dark visor on the front.
  const head = mesh(new THREE.SphereGeometry(.58,48,36), shellMat, [0,1.61,0]);
  head.scale.set(1.04,.96,.94);
  g.add(head);

  const visor = mesh(new THREE.SphereGeometry(.43,40,28), visorMat, [0,1.59,.29]);
  visor.scale.set(1.06,.76,.48);
  g.add(visor);

  // Smiling arc eyes + mouth in pure black ink.
  function faceStroke(start,control,end,r=.028){
    const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(...start),new THREE.Vector3(...control),new THREE.Vector3(...end));
    const stroke = mesh(new THREE.TubeGeometry(curve,28,r,10,false),faceInkMat,[0,0,0]);
    stroke.renderOrder = 20;
    return stroke;
  }
  const eyeL=faceStroke([-.23,1.61,.575],[-.17,1.72,.595],[-.11,1.61,.575],.024);
  const eyeR=faceStroke([ .11,1.61,.575],[ .17,1.72,.595],[ .23,1.61,.575],.024);
  const smile=faceStroke([-.16,1.47,.59],[0,1.375,.615],[.16,1.47,.59],.024);
  g.add(eyeL,eyeR,smile);
  g.userData.faceParts=[eyeL,eyeR,smile];

  // Ear pods
  const earL = mesh(new THREE.CapsuleGeometry(.10,.20,6,14), shellMat, [-.58,1.59,.02], [0,0,Math.PI/2]);
  const earR = mesh(new THREE.CapsuleGeometry(.10,.20,6,14), shellMat, [ .58,1.59,.02], [0,0,Math.PI/2]);
  g.add(earL,earR);
  g.add(mesh(new THREE.TorusGeometry(.135,.026,10,24), darkJointMat, [-.645,1.59,.02], [0,Math.PI/2,0]));
  g.add(mesh(new THREE.TorusGeometry(.135,.026,10,24), darkJointMat, [ .645,1.59,.02], [0,Math.PI/2,0]));

  // Neck joint
  g.add(mesh(new THREE.CylinderGeometry(.14,.17,.14,20), darkJointMat, [0,1.13,0]));

  // Body: slim but not pointy; the lower belly stays softly rounded instead of a sharp V.
  const bodyProfile = [
    new THREE.Vector2(.30,.54),
    new THREE.Vector2(.47,.48),
    new THREE.Vector2(.54,.22),
    new THREE.Vector2(.50,-.12),
    new THREE.Vector2(.39,-.45),
    new THREE.Vector2(.25,-.66),
    new THREE.Vector2(.12,-.74),
    new THREE.Vector2(.04,-.70),
  ];
  const torso = mesh(new THREE.LatheGeometry(bodyProfile,56), shellMat, [0,.58,0]);
  torso.scale.set(.92,1.0,.66);
  g.add(torso);

  // Chest port + status light
  g.add(mesh(new THREE.TorusGeometry(.122,.027,12,28), darkJointMat, [.17,.58,.35], [Math.PI/2,0,0]));
  g.add(mesh(new THREE.CircleGeometry(.096,28), darkJointMat, [.17,.58,.348]));
  g.add(mesh(new THREE.SphereGeometry(.022,12,12), dotMat, [0,.85,.385]));

  // Arms: black shoulder joint, white forearm shell and articulated dark hand.
  function arm(sign){
    const grp = new THREE.Group();
    grp.position.set(sign*.45,.84,0);
    grp.rotation.z = sign * .16;
    const shoulder = mesh(new THREE.CapsuleGeometry(.092,.28,8,16), darkJointMat, [0,-.20,0]);
    const forearm = mesh(new THREE.CapsuleGeometry(.125,.33,8,18), shellMat, [0,-.52,.02]);
    const hand = mesh(new THREE.CapsuleGeometry(.074,.20,7,14), darkJointMat, [0,-.79,.075],[.25,0,sign*.1]);
    grp.add(shoulder,forearm,hand);
    return grp;
  }
  g.add(arm(-1), arm(1));

  // Idle shadow blob
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(.85,32),
    new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.28,depthWrite:false})
  );
  shadow.rotation.x = -Math.PI/2;
  shadow.position.y = -.995;
  g.add(shadow);

  g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
  return g;
}

const mascot = buildMascot();
scene.add(mascot);
// A real head pivot so the hero robot can follow the pointer without turning its body.
mascot.updateMatrixWorld(true);
const heroHeadRig=new THREE.Group();heroHeadRig.position.set(0,1.52,0);mascot.add(heroHeadRig);
const headParts=[...mascot.children].filter(o=>o!==heroHeadRig&&o.position.y>1.18);
(mascot.userData.faceParts||[]).forEach(o=>{if(!headParts.includes(o))headParts.push(o)});
headParts.forEach(o=>heroHeadRig.attach(o));
const pointer={x:0,y:0};
addEventListener('pointermove',e=>{
  pointer.x=(e.clientX/innerWidth-.5)*2;
  pointer.y=(.5-e.clientY/innerHeight)*2;
},{passive:true});

const fallbackVan = buildFallbackVan();
vehicleRoot.add(fallbackVan);
model = fallbackVan;

new GLTFLoader().load(
  './delivery-van.glb',
  gltf => {
    const external = gltf.scene;
    external.traverse(o => {
      if(o.isMesh){
        o.castShadow = true;
        o.receiveShadow = true;
        if(o.material){
          o.material.envMapIntensity = 1.15;
          o.material.needsUpdate = true;
        }
      }
    });

    const box = new THREE.Box3().setFromObject(external);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = 5.8 / Math.max(size.x,size.y,size.z);
    external.scale.setScalar(scale);
    external.position.sub(center.multiplyScalar(scale));
    external.position.y -= new THREE.Box3().setFromObject(external).min.y + 1.0;

    vehicleRoot.remove(fallbackVan);
    model = external;
    vehicleRoot.add(external);
  },
  undefined,
  err => {
    console.warn('delivery-van.glb not found; using built-in fallback van', err);
  }
);

// --- One continuous courier city world ---------------------------------
const cityRoot = new THREE.Group(); scene.add(cityRoot);
const cityMat = mat(0x171c23,.88,.04), roadMat = mat(0x0d1117,.96,.02);
for(let x=-20;x<=20;x+=5){
  for(let z=-20;z<=20;z+=5){
    const onMainRoad=Math.abs(x)<3||Math.abs(z)<3;
    const onStoryPath=(x>=5&&x<=10&&z>=5&&z<=15)||(x>=10&&x<=20&&z>=0&&z<=5)||(x<=-10&&z>=10&&z<=20)||(x===-5&&z===5);
    if(onMainRoad||onStoryPath)continue;
    const h=.65+((Math.abs(x*13+z*7)%7)/7)*1.25;
    const b=mesh(new THREE.BoxGeometry(2.55,h,2.55),cityMat,[x,h/2-.92,z]);
    b.material=b.material.clone();b.material.color.offsetHSL(0,0,((x+z)%3)*.018);cityRoot.add(b);
    const roof=mesh(new THREE.BoxGeometry(1.95,.08,1.95),mat(0x252c34,.72,.10),[x,h-.84,z]);cityRoot.add(roof);
  }
}
cityRoot.add(mesh(new THREE.BoxGeometry(48,.08,5.6),roadMat,[0,-.94,0]));
cityRoot.add(mesh(new THREE.BoxGeometry(5.6,.08,48),roadMat,[0,-.94,0]));
cityRoot.add(mesh(new THREE.BoxGeometry(36,.08,3.8),roadMat,[2,-.93,7],[0,-.26,0]));
cityRoot.add(mesh(new THREE.BoxGeometry(32,.08,3.8),roadMat,[5,-.92,-8],[0,.18,0]));
const laneMat=new THREE.MeshBasicMaterial({color:0x53606e,transparent:true,opacity:.8});
for(let n=-21;n<=21;n+=3){cityRoot.add(mesh(new THREE.BoxGeometry(1.35,.025,.055),laneMat,[n,-.885,0]));cityRoot.add(mesh(new THREE.BoxGeometry(.055,.025,1.35),laneMat,[0,-.88,n]))}
const showcaseRoad=new THREE.Group();scene.add(showcaseRoad);showcaseRoad.visible=false;
showcaseRoad.add(mesh(new THREE.BoxGeometry(22,.10,7.5),roadMat,[0,-.90,-15]));
for(let x=-9;x<=9;x+=3)showcaseRoad.add(mesh(new THREE.BoxGeometry(1.4,.03,.07),laneMat,[x,-.83,-15]));

function glowTube(points,color=0x1677ff){
  const vectors=points.map(p=>new THREE.Vector3(...p));
  const curve=new THREE.CurvePath();
  for(let i=0;i<vectors.length-1;i++){
    curve.add(new THREE.LineCurve3(vectors[i],vectors[i+1]));
  }
  const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,90,.105,12,false),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:6,transparent:true,opacity:1}));
  tube.position.y=-.82;tube.userData.curve=curve;tube.userData.maxCount=tube.geometry.index.count;tube.geometry.setDrawRange(0,0);return tube;
}
const routeRequest=glowTube([[-15,0,15],[-12,0,12],[-9,0,9],[-6.5,0,7],[-2.25,0,5]],0xd9f3ff);cityRoot.add(routeRequest);
const routeVerify=glowTube([[-2.25,0,5],[-1,0,3],[0,0,0],[4,0,3],[8,0,11.3]],0x1677ff);cityRoot.add(routeVerify);
const requestSignal=glowTube([[-2.25,.4,5],[-2.8,.7,5],[-3.9,1.15,5]],0xff6338);cityRoot.add(requestSignal);requestSignal.visible=false;
const routeStore=glowTube([[0,0,-15],[0,0,-8],[0,0,0],[14,0,0]],0xff6338);cityRoot.add(routeStore);routeStore.visible=false;
const routeDelivery=glowTube([[14,0,0],[8,0,0],[0,0,0],[0,0,-8],[0,0,-16]],0x23ff72);cityRoot.add(routeDelivery);routeDelivery.visible=false;

function labelSprite(title,sub,accent='#1677ff'){
  const c=document.createElement('canvas'); c.width=520;c.height=190;const x=c.getContext('2d');
  x.fillStyle='rgba(7,11,16,.92)';x.strokeStyle=accent;x.lineWidth=4;x.beginPath();x.roundRect(4,4,512,182,24);x.fill();x.stroke();
  x.fillStyle=accent;x.font='700 22px monospace';x.fillText(title,28,52);x.fillStyle='#fff';x.font='700 31px Inter, sans-serif';x.fillText(sub,28,104);x.fillStyle='#8f9aa8';x.font='20px monospace';x.fillText('LIVE NETWORK  •  NOMAD',28,148);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));s.scale.set(4.6,1.68,1);return s;
}
function pin(x,z,color=0x1677ff){const g=new THREE.Group();g.position.set(x,-.72,z);const ring=mesh(new THREE.TorusGeometry(.48,.055,10,40),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:4}),[0,0,0],[Math.PI/2,0,0]);const dot=mesh(new THREE.SphereGeometry(.13,20,16),ring.material,[0,.42,0]);g.add(ring,dot);return g}
const requestHouse=new THREE.Group();requestHouse.position.set(-4,-.95,5);cityRoot.add(requestHouse);
requestHouse.add(mesh(new THREE.BoxGeometry(2.8,2.15,3.2),mat(0x20262f,.58,.16),[0,1.08,0]));
requestHouse.add(mesh(new THREE.BoxGeometry(.10,1.35,1.45),new THREE.MeshPhysicalMaterial({color:0x182d38,roughness:.08,transparent:true,opacity:.9}),[1.45,.82,0]));
requestHouse.add(mesh(new THREE.BoxGeometry(.08,.16,2.5),new THREE.MeshStandardMaterial({color:0xff6338,emissive:0xff6338,emissiveIntensity:4}),[1.52,1.88,0]));
const requestHouseSign=labelSprite('02','REQUEST HOUSE','#ff6338');requestHouseSign.position.set(0,3.05,0);requestHouseSign.scale.multiplyScalar(.56);requestHouse.add(requestHouseSign);
const courier=buildMascot();courier.scale.setScalar(.72);courier.position.set(-15,-.95,15);cityRoot.add(courier);
mascot.position.set(-6.55,-.25,8.7);mascot.scale.setScalar(.96);mascot.rotation.y=0;
const courierPin=pin(-15,15,0xd9f3ff);cityRoot.add(courierPin);
const requestPin=pin(-2.25,5,0xff6338);cityRoot.add(requestPin);requestPin.visible=false;
const requestCard=labelSprite('VERIFICATION REQUEST','SENDING TO CENTER','#ff6338');requestCard.position.set(-4,3.45,5);cityRoot.add(requestCard);requestCard.visible=false;

const hub=new THREE.Group();hub.position.set(8,-.95,8);cityRoot.add(hub);
const hubBody=mesh(new THREE.BoxGeometry(6,2.8,5),mat(0x252c35,.52,.18),[0,1.4,0]);hub.add(hubBody);
const hubGlass=mesh(new THREE.BoxGeometry(5.7,1.55,.08),new THREE.MeshPhysicalMaterial({color:0x162b38,roughness:.08,metalness:.25,transparent:true,opacity:.85}),[0,1.25,2.54]);hub.add(hubGlass);
const hubSign=labelSprite('03','VERIFICATION CENTER','#1677ff');hubSign.position.set(0,3.55,2.62);hubSign.scale.multiplyScalar(.72);hub.add(hubSign);
const scanGate=new THREE.Group();scanGate.position.set(0,0,3.2);hub.add(scanGate);
const scanFrameMat=new THREE.MeshStandardMaterial({color:0x19ff68,emissive:0x19ff68,emissiveIntensity:7,roughness:.16});
scanGate.add(mesh(new THREE.BoxGeometry(2.3,.10,.10),scanFrameMat,[0,2.3,0]));
scanGate.add(mesh(new THREE.BoxGeometry(.10,2.3,.10),scanFrameMat,[-1.12,1.14,0]));scanGate.add(mesh(new THREE.BoxGeometry(.10,2.3,.10),scanFrameMat,[1.12,1.14,0]));
const scanBeam=mesh(new THREE.PlaneGeometry(2.15,2.15),new THREE.MeshBasicMaterial({color:0x19ff68,transparent:true,opacity:.42,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}),[0,2.25,0],[-Math.PI/2,0,0]);scanGate.add(scanBeam);
const scanColumn=mesh(new THREE.CylinderGeometry(1.05,1.05,2.5,32,1,true),new THREE.MeshBasicMaterial({color:0x19ff68,transparent:true,opacity:.17,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}),[0,1.2,0]);scanGate.add(scanColumn);
const bodyRings=[];for(let y=.25;y<2.3;y+=.34){const r=mesh(new THREE.TorusGeometry(.72,.018,8,36),new THREE.MeshBasicMaterial({color:0x20ff78,transparent:true,opacity:.55}),[0,y,0],[Math.PI/2,0,0]);scanGate.add(r);bodyRings.push(r)}
// Rooftop digital scan chamber — intentionally above the building, never at the door.
scanGate.position.set(0,3.05,0);scanGate.scale.setScalar(1.35);
const scanDeck=mesh(new THREE.CylinderGeometry(1.65,1.82,.20,36),mat(0x101820,.28,.55),[0,2.92,0]);hub.add(scanDeck);
const deckRing=mesh(new THREE.TorusGeometry(1.52,.055,12,48),new THREE.MeshStandardMaterial({color:0x20ff78,emissive:0x20ff78,emissiveIntensity:5}),[0,3.04,0],[Math.PI/2,0,0]);hub.add(deckRing);
const scanRobot=buildMascot();scanRobot.position.set(0,3.02,0);scanRobot.scale.setScalar(.78);hub.add(scanRobot);scanRobot.visible=false;
const success=labelSprite('✓ VERIFIED','COURIER BATTLUGA','#23ff72');success.position.set(8,4.4,8);cityRoot.add(success);success.visible=false;

const orderPins=[];[[14,4.8,'TECH STORE'],[-7,-8,'FASHION HUB'],[5,-12,'HOME MARKET'],[-13,-3,'BOOK STORE']].forEach((d,i)=>{const p=pin(d[0],d[1],0xff6338);const l=labelSprite('NEW ORDER',d[2],'#ff6338');l.position.set(0,2.1,0);l.scale.multiplyScalar(.58);p.add(l);p.visible=false;cityRoot.add(p);orderPins.push(p)});
const store=new THREE.Group();store.position.set(14,-.95,4.8);cityRoot.add(store);
store.add(mesh(new THREE.BoxGeometry(3.8,2.65,4),mat(0x202630,.52,.12),[0,1.32,0]));
store.add(mesh(new THREE.BoxGeometry(.10,1.7,2.2),new THREE.MeshPhysicalMaterial({color:0x233d4c,roughness:.08,transparent:true,opacity:.88}),[-1.95,1.05,0]));
store.add(mesh(new THREE.BoxGeometry(.09,.20,3.1),new THREE.MeshStandardMaterial({color:0xff6338,emissive:0xff6338,emissiveIntensity:4}),[-2.02,2.28,0]));
const storeSign=labelSprite('PICKUP 01','TECH STORE','#ff6338');storeSign.position.set(0,3.55,0);storeSign.scale.multiplyScalar(.62);store.add(storeSign);

const customer=new THREE.Group();customer.position.set(-4.8,-.95,-19);cityRoot.add(customer);
customer.add(mesh(new THREE.BoxGeometry(5,3.8,4),mat(0x20262e,.7,.08),[0,1.9,0]));customer.add(mesh(new THREE.BoxGeometry(1.4,2.4,.12),mat(0x7d573a,.7,.04),[0,1.2,2.05]));
const recipient=new THREE.Group();recipient.position.set(-1.6,-.95,-16);cityRoot.add(recipient);recipient.visible=false;
recipient.add(mesh(new THREE.SphereGeometry(.22,20,16),mat(0xd4a477,.62,.02),[0,1.55,0]));recipient.add(mesh(new THREE.CapsuleGeometry(.28,.72,8,16),mat(0x222933,.72,.04),[0,.82,0]));
const recipientLabel=labelSprite('RECIPIENT','READY FOR HANDOFF','#23ff72');recipientLabel.position.set(0,2.45,0);recipientLabel.scale.multiplyScalar(.5);recipient.add(recipientLabel);
const handoffBox=mesh(roundedBox(.52,.45,.48,.045),mat(0xb8844f,.78,.02),[0,0,0]);cityRoot.add(handoffBox);handoffBox.visible=false;
const mission=labelSprite('✓ MISSION COMPLETED','4 ORDERS  ·  ₮48,600','#23ff72');mission.position.set(-1.6,3.8,-14.5);cityRoot.add(mission);mission.visible=false;

const vanStart=new THREE.Vector3(0,-.02,-15), vanEnd=new THREE.Vector3(0,-.02,-16);
vehicleRoot.scale.setScalar(.62);vehicleRoot.position.copy(vanStart);vehicleRoot.visible=false;

// --- timeline geometry: all nine beats share the same canvas and world
const clamp = THREE.MathUtils.clamp;
const smooth = t => t*t*(3-2*t);
const localT = (p,a,b) => clamp((p-a)/(b-a||1),0,1);

const camKeys = [
  {t:0.00,p:[-8.6,2.35,15.2],l:[-8.6,1.20,8.7]},
  {t:.075,p:[-8.6,2.35,15.2],l:[-8.6,1.20,8.7]},
  {t:.105,p:[-20,19,25],l:[-15,-.4,15]},
  {t:.175,p:[4,12,14],l:[-3,.7,5]},
  {t:.27,p:[18,22,20],l:[8,.2,8]},
  {t:.35,p:[16,17,18],l:[8,1.8,8]},
  {t:.43,p:[18,19,19],l:[8,.8,8]},
  {t:.46,p:[13,4,-2],l:[0,.15,-15]},
  {t:.55,p:[13,4,-2],l:[0,.15,-15]},
  {t:.61,p:[5,27,11],l:[2,-.4,2]},
  {t:.70,p:[18,15,8],l:[14,0,0]},
  {t:.78,p:[18,5,6],l:[14,.2,0]},
  {t:.86,p:[12,24,-8],l:[0,-.4,-8]},
  {t:.95,p:[-7,4.2,-22],l:[0,.45,-16]},
  {t:1.00,p:[-7,4.2,-22],l:[0,.45,-16]}
];
const vA = new THREE.Vector3(), vB = new THREE.Vector3();
let target=0, current=0;

function sample(keys,p,out,key){
  let a=keys[0],b=keys[keys.length-1];
  for(let i=0;i<keys.length-1;i++){
    if(p>=keys[i].t && p<=keys[i+1].t){a=keys[i];b=keys[i+1];break;}
  }
  const t=smooth(clamp((p-a.t)/(b.t-a.t||1),0,1));
  vA.set(...a[key]); vB.set(...b[key]);
  return out.copy(vA).lerp(vB,t);
}

const desiredPos = new THREE.Vector3();
const desiredLook = new THREE.Vector3();
const look = new THREE.Vector3();
const rearCamPos=new THREE.Vector3(),rearCamLook=new THREE.Vector3(),rearOffset=new THREE.Vector3();
const handoffStart=new THREE.Vector3(),handoffEnd=new THREE.Vector3(),localRear=new THREE.Vector3();

function keepVehicleOnRoad(){
  if(Math.abs(vehicleRoot.position.z) < 1.9){
    vehicleRoot.position.z = THREE.MathUtils.clamp(vehicleRoot.position.z, -1.35, 1.35);
    return;
  }

  if(Math.abs(vehicleRoot.position.x) < 1.9){
    vehicleRoot.position.x = THREE.MathUtils.clamp(vehicleRoot.position.x, -1.35, 1.35);
  }
}

function onScroll(){
  const max = Math.max(1, document.documentElement.scrollHeight-innerHeight);
  target = clamp(scrollY/(max * 0.55),0,1);
}
addEventListener('scroll',onScroll,{passive:true});
onScroll();

const copyRanges = Array.from({length:copies.length},(_,i)=>[i/copies.length,(i+1)/copies.length]);
function rangeOpacity(p,a,b){
  const span = b-a || 1, edge = Math.min(span*.18, 0.05);
  if(p < a-edge || p > b+edge) return 0;
  const fadeIn = a===0?1:localT(p, a, a+edge);
  const fadeOut = b===1?1:1-localT(p, b-edge, b);
  return clamp(Math.min(fadeIn,fadeOut), 0, 1);
}
function updateCopy(p){
  copies.forEach((el,i)=>{
    const [a,b] = copyRanges[i];
    el.style.opacity = rangeOpacity(p,a,b);
  });
}

function animateCargo(p){
  if(!fallbackVan || model !== fallbackVan) return;

  const loadOpen=smooth(localT(p,.715,.74))*(1-smooth(localT(p,.855,.875)));
  const unloadOpen=smooth(localT(p,.925,.945));
  const openT=Math.max(loadOpen,unloadOpen);
  fallbackVan.userData.rearDoorLeftPivot.rotation.y = -openT * Math.PI * 1.08;
  fallbackVan.userData.rearDoorRightPivot.rotation.y = openT * Math.PI * 1.08;
  fallbackVan.userData.rearDoorLeftPivot.rotation.z = openT * 0.04;
  fallbackVan.userData.rearDoorRightPivot.rotation.z = -openT * 0.04;

  const boxes = fallbackVan.userData.cargoBoxes || [];
  boxes.forEach((box,index)=>{
    const s = box.userData.start;
    box.visible=p>.735;
    const loadT=smooth(localT(p,.748+index*.01,.835+index*.008));
    const unloadT=smooth(localT(p,.945+index*.008,.992+index*.004));
    const outside=p<.90?1-loadT:unloadT;
    box.position.x = THREE.MathUtils.lerp(s.x, -4.05-index*.34, outside);
    box.position.y = THREE.MathUtils.lerp(s.y, -.52+(index%2)*.04, outside);
    box.position.z = THREE.MathUtils.lerp(s.z, (index-2.5)*.52, outside);
    box.rotation.y = outside*(index%2?-.08:.08);
    box.rotation.z = outside*(index-2.5)*.016;
  });
}

function setGroupOpacity(group, opacity){
  group.traverse(o=>{
    if(o.isMesh && o.material){
      o.material.transparent = true;
      o.material.opacity = opacity;
      o.visible = opacity > 0.005;
    }
  });
}

function tick(){
  requestAnimationFrame(tick);
  current += (target-current)*0.065;
  progressEl.style.width = `${current*100}%`;
  const now = performance.now();
  const heroOut=smooth(localT(current,.075,.096));
  const cityIn=smooth(localT(current,.082,.11));cityRoot.visible=current>=.082;floor.visible=current>=.082;grid.visible=current>=.082;
  mascot.visible=current<.097;mascot.position.y=-.25+Math.sin(now*.0018)*.05+heroOut*.65;mascot.scale.setScalar(.96*(1-heroOut*.98));
  heroHeadRig.rotation.y+=((pointer.x*.62)-heroHeadRig.rotation.y)*.11;
  heroHeadRig.rotation.x+=((pointer.y*.34)-heroHeadRig.rotation.x)*.11;
  mascot.rotation.y+=((pointer.x*.14)-mascot.rotation.y)*.055;
  mascot.rotation.x+=((pointer.y*.055)-mascot.rotation.x)*.055;

  sample(camKeys,current,desiredPos,'p');
  sample(camKeys,current,desiredLook,'l');
  camera.position.lerp(desiredPos,.075);
  look.lerp(desiredLook,.075);
  camera.lookAt(look);

  courier.position.y=-.95+Math.sin(now*.003)*.045;
  courier.rotation.y=Math.atan2(Math.sin(current*12),Math.cos(current*12));
  courierPin.rotation.z=now*.0007;

  requestCard.visible=current>.135&&current<.215;
  requestCard.material.opacity=rangeOpacity(current,.135,.215);
  requestPin.visible=current>.135&&current<.215;requestPin.scale.setScalar(.9+.18*(Math.sin(now*.006)+1)/2);
  const sending=smooth(localT(current,.155,.198));requestSignal.visible=current>.15&&current<.215;requestSignal.geometry.setDrawRange(0,Math.floor(requestSignal.userData.maxCount*sending));
  const toRequest=smooth(localT(current,.09,.16));
  const toVerify=smooth(localT(current,.20,.28));
  const courierPoint=current<.20?routeRequest.userData.curve.getPoint(toRequest):routeVerify.userData.curve.getPoint(toVerify);
  courier.position.x=courierPoint.x;courier.position.z=courierPoint.z;
  courierPin.position.x=courier.position.x;courierPin.position.z=courier.position.z;
  routeRequest.geometry.setDrawRange(0,Math.floor(routeRequest.userData.maxCount*toRequest));
  routeVerify.geometry.setDrawRange(0,Math.floor(routeVerify.userData.maxCount*toVerify));

  const scanT=smooth(localT(current,.29,.355));
  scanBeam.position.y=THREE.MathUtils.lerp(2.3,.18,scanT);
  scanColumn.material.opacity=.15+.11*(Math.sin(now*.006)+1)/2;
  bodyRings.forEach((r,i)=>{r.scale.setScalar(.88+.18*(Math.sin(now*.004+i*.7)+1)/2);r.material.opacity=.28+.45*(Math.sin(now*.005+i)+1)/2});
  scanGate.visible=current>.275&&current<.405;
  scanRobot.visible=current>.275&&current<.405;scanRobot.rotation.y=Math.sin(now*.0008)*.18;
  success.visible=current>.36&&current<.455;
  if(success.visible)success.material.opacity=rangeOpacity(current,.36,.455);
  courier.visible=current<.455;courierPin.visible=current<.455;
  orderPins.forEach((p,i)=>{p.visible=current>.545&&current<.65;p.scale.setScalar(smooth(localT(current,.55+i*.012,.59+i*.012)))});

  const oldRouteFade=1-smooth(localT(current,.43,.49));routeRequest.material.opacity=oldRouteFade;routeVerify.material.opacity=oldRouteFade;
  vehicleRoot.visible=current>.435;const vanIn=smooth(localT(current,.435,.46));vehicleRoot.scale.setScalar(.62*vanIn);
  const showcasing=current>.435&&current<.565;showcaseRoad.visible=showcasing;if(showcasing)cityRoot.visible=false;
  const spinT=smooth(localT(current,.46,.55));
  const driveStore=smooth(localT(current,.64,.72));const storePoint=routeStore.userData.curve.getPoint(driveStore);
  const driveDelivery=smooth(localT(current,.84,.925));const deliveryPoint=routeDelivery.userData.curve.getPoint(driveDelivery);
  routeStore.visible=current>.63;routeStore.geometry.setDrawRange(0,Math.floor(routeStore.userData.maxCount*driveStore));
  routeDelivery.visible=current>.83;routeDelivery.geometry.setDrawRange(0,Math.floor(routeDelivery.userData.maxCount*driveDelivery));
  if(current<.64){vehicleRoot.position.copy(vanStart);vehicleRoot.rotation.y=spinT*Math.PI*2}
  else if(current<.84){vehicleRoot.position.set(storePoint.x,-.02,storePoint.z);const t=routeStore.userData.curve.getTangent(driveStore);vehicleRoot.rotation.y=Math.atan2(-t.z,t.x)}
  else{vehicleRoot.position.set(deliveryPoint.x,-.02,deliveryPoint.z);const t=routeDelivery.userData.curve.getTangent(driveDelivery);vehicleRoot.rotation.y=Math.atan2(-t.z,t.x)}
  if(current>.64) keepVehicleOnRoad();
  if(showcasing){rearCamPos.set(13,4,-2);rearCamLook.set(0,.15,-15);camera.position.lerp(rearCamPos,.20);look.lerp(rearCamLook,.20);camera.lookAt(look)}
  const chaseView=(current>.64&&current<.72)||(current>.84&&current<.925);
  if(chaseView){
    rearOffset.set(-8.6,3.25,4.2).applyAxisAngle(new THREE.Vector3(0,1,0),vehicleRoot.rotation.y);
    localRear.set(.45,.55,0).applyAxisAngle(new THREE.Vector3(0,1,0),vehicleRoot.rotation.y);
    rearCamPos.copy(vehicleRoot.position).add(rearOffset);
    rearCamLook.copy(vehicleRoot.position).add(localRear);
    camera.position.lerp(rearCamPos,.18);look.lerp(rearCamLook,.18);camera.lookAt(look);
  }
  const rearView=(current>.72&&current<.855)||current>.925;
  if(rearView){
    rearOffset.set(-9.2,1.7,1.15).applyAxisAngle(new THREE.Vector3(0,1,0),vehicleRoot.rotation.y);
    localRear.set(-2.45,.42,0).applyAxisAngle(new THREE.Vector3(0,1,0),vehicleRoot.rotation.y);
    rearCamPos.copy(vehicleRoot.position).add(rearOffset);rearCamLook.copy(vehicleRoot.position).add(localRear);
    camera.position.lerp(rearCamPos,.18);look.lerp(rearCamLook,.18);camera.lookAt(look);
  }
  recipient.visible=current>.925;
  const handoffT=smooth(localT(current,.958,.992));handoffBox.visible=current>.952;
  if(handoffBox.visible){localRear.set(-3.2,.28,0).applyAxisAngle(new THREE.Vector3(0,1,0),vehicleRoot.rotation.y);handoffStart.copy(vehicleRoot.position).add(localRear);handoffEnd.copy(recipient.position).add(new THREE.Vector3(0,.8,0));handoffBox.position.lerpVectors(handoffStart,handoffEnd,handoffT);handoffBox.rotation.y=handoffT*.25}
  mission.visible=current>.925;
  if(mission.visible){mission.material.opacity=smooth(localT(current,.925,.97));mission.scale.setScalar(1+Math.sin(now*.002)*.02)}

  animateCargo(current);
  updateCopy(current);
  renderer.render(scene,camera);
}
tick();

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
});
}
