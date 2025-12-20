import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164/build/three.module.js';
import { ARButton } from 'https://cdn.jsdelivr.net/npm/three@0.164/examples/jsm/webxr/ARButton.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.164/examples/jsm/loaders/GLTFLoader.js';

let camera, scene, renderer;
let controller;
let reticle;
let model;

init();
animate();

function init() {

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera();

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  document.body.appendChild(
    ARButton.createButton(renderer, {
      requiredFeatures: ['hit-test']
    })
  );

  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  scene.add(light);

  // Controller (Tap auf Bildschirm)
  controller = renderer.xr.getController(0);
  controller.addEventListener('select', onSelect);
  scene.add(controller);

  // Reticle (Platzierungshilfe)
  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  // Modell laden
  const loader = new GLTFLoader();
  loader.load('model.glb', (gltf) => {
    model = gltf.scene;
    model.scale.set(0.3, 0.3, 0.3);
  });

  window.addEventListener('resize', onWindowResize);
}

function onSelect() {
  if (reticle.visible && model) {
    model.position.setFromMatrixPosition(reticle.matrix);
    scene.add(model);
  }
}

function animate() {
  renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    if (!renderer.xr.hitTestSourceRequested) {
      session.requestReferenceSpace('viewer').then((space) => {
        session.requestHitTestSource({ space }).then((source) => {
          renderer.xr.hitTestSource = source;
        });
      });

      session.addEventListener('end', () => {
        renderer.xr.hitTestSourceRequested = false;
        renderer.xr.hitTestSource = null;
      });

      renderer.xr.hitTestSourceRequested = true;
    }

    if (renderer.xr.hitTestSource) {
      const hitTestResults = frame.getHitTestResults(renderer.xr.hitTestSource);
      if (hitTestResults.length) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(referenceSpace);
        reticle.visible = true;
        reticle.matrix.fromArray(pose.transform.matrix);
      } else {
        reticle.visible = false;
      }
    }
  }

  renderer.render(scene, camera);
}

function onWindowResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
}
