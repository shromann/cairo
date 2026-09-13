import * as THREE from "three";

/**
 * Procedural PBR Texture Generator for Biological Cardiac Tissue
 * Generates high-resolution diffuse, normal, roughness, and subsurface maps
 * on HTML5 canvas buffers during initialization (0 KB external download penalty).
 */

let cachedTextures = null;

export function getMyocardialTextures() {
  if (cachedTextures) return cachedTextures;

  // 1. Epicardial Diffuse Map (Muscle fibers, capillary beds, adipose fat pads)
  const epiCanvas = document.createElement("canvas");
  epiCanvas.width = 1024;
  epiCanvas.height = 1024;
  const ctx = epiCanvas.getContext("2d");

  // Base deep myocardial muscle tone
  const bgGrad = ctx.createLinearGradient(0, 0, 1024, 1024);
  bgGrad.addColorStop(0, "#7a0c1a");
  bgGrad.addColorStop(0.35, "#931324");
  bgGrad.addColorStop(0.7, "#6d0a17");
  bgGrad.addColorStop(1, "#540611");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1024, 1024);

  // Micro-muscle fiber striations (helical diagonal bands)
  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let i = -500; i < 1500; i += 3) {
    ctx.strokeStyle = i % 6 === 0 ? "#b82638" : "#40040c";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.bezierCurveTo(i + 150, 300, i - 100, 700, i + 200, 1024);
    ctx.stroke();
  }
  ctx.restore();

  // Fine vascular micro-capillary network
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "#e63946";
  for (let c = 0; c < 45; c++) {
    let startX = Math.random() * 1024;
    let startY = Math.random() * 1024;
    ctx.lineWidth = Math.random() * 1.5 + 0.5;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    for (let seg = 0; seg < 4; seg++) {
      startX += (Math.random() - 0.5) * 80;
      startY += Math.random() * 60;
      ctx.lineTo(startX, startY);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Epicardial Adipose (Yellow-cream fatty deposits in sulci & AV groove)
  ctx.save();
  // AV Groove fat band (top region)
  const fatGrad = ctx.createRadialGradient(512, 180, 50, 512, 180, 380);
  fatGrad.addColorStop(0, "rgba(230, 195, 92, 0.65)");
  fatGrad.addColorStop(0.5, "rgba(200, 160, 70, 0.35)");
  fatGrad.addColorStop(0.85, "rgba(180, 120, 50, 0.12)");
  fatGrad.addColorStop(1, "rgba(140, 30, 40, 0.0)");
  ctx.fillStyle = fatGrad;
  ctx.fillRect(0, 0, 1024, 380);

  // Anterior Interventricular Sulcus fat strip (diagonal band down center)
  ctx.fillStyle = "rgba(225, 185, 85, 0.45)";
  for (let f = 0; f < 30; f++) {
    const fx = 420 + Math.sin(f * 0.3) * 60 + (Math.random() - 0.5) * 40;
    const fy = 150 + f * 26 + (Math.random() - 0.5) * 20;
    const fr = Math.random() * 28 + 12;
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const epicardiumDiffuse = new THREE.CanvasTexture(epiCanvas);
  epicardiumDiffuse.wrapS = THREE.RepeatWrapping;
  epicardiumDiffuse.wrapT = THREE.RepeatWrapping;

  // 2. Epicardial Normal Map (High-frequency muscle fiber depth & fatty bumpiness)
  const normCanvas = document.createElement("canvas");
  normCanvas.width = 1024;
  normCanvas.height = 1024;
  const nCtx = normCanvas.getContext("2d");

  // Neutral normal map base: RGB (128, 128, 255) -> #8080ff
  nCtx.fillStyle = "#8080ff";
  nCtx.fillRect(0, 0, 1024, 1024);

  // Anisotropic diagonal fiber grooves
  nCtx.save();
  nCtx.globalAlpha = 0.28;
  for (let i = -500; i < 1500; i += 4) {
    nCtx.strokeStyle = i % 8 === 0 ? "#9070ff" : "#7090ff";
    nCtx.lineWidth = 2.0;
    nCtx.beginPath();
    nCtx.moveTo(i, 0);
    nCtx.bezierCurveTo(i + 150, 300, i - 100, 700, i + 200, 1024);
    nCtx.stroke();
  }
  nCtx.restore();

  // Fatty lobule bump normals
  nCtx.save();
  nCtx.globalAlpha = 0.35;
  for (let b = 0; b < 60; b++) {
    const bx = Math.random() * 1024;
    const by = Math.random() * 400; // More in upper sulcus
    const br = Math.random() * 20 + 8;
    const bGrad = nCtx.createRadialGradient(bx, by, 0, bx, by, br);
    bGrad.addColorStop(0, "#a060ff");
    bGrad.addColorStop(0.5, "#8080ff");
    bGrad.addColorStop(1, "#8080ff");
    nCtx.fillStyle = bGrad;
    nCtx.beginPath();
    nCtx.arc(bx, by, br, 0, Math.PI * 2);
    nCtx.fill();
  }
  nCtx.restore();

  const epicardiumNormal = new THREE.CanvasTexture(normCanvas);
  epicardiumNormal.wrapS = THREE.RepeatWrapping;
  epicardiumNormal.wrapT = THREE.RepeatWrapping;

  // 3. Epicardial Roughness / Moisture Map (Natural semi-matte biological tissue)
  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = 512;
  roughCanvas.height = 512;
  const rCtx = roughCanvas.getContext("2d");

  // Base natural tissue roughness: soft matte/satin (0.58 = medium grey #949494)
  rCtx.fillStyle = "#949494";
  rCtx.fillRect(0, 0, 512, 512);

  // Subtle natural moisture gradients (subtle sheen: #787878, never mirror glossy)
  rCtx.save();
  rCtx.globalAlpha = 0.25;
  for (let w = 0; w < 30; w++) {
    const wx = Math.random() * 512;
    const wy = Math.random() * 512;
    const wr = Math.random() * 50 + 20;
    const wGrad = rCtx.createRadialGradient(wx, wy, 0, wx, wy, wr);
    wGrad.addColorStop(0, "#727272");
    wGrad.addColorStop(1, "#949494");
    rCtx.fillStyle = wGrad;
    rCtx.beginPath();
    rCtx.arc(wx, wy, wr, 0, Math.PI * 2);
    rCtx.fill();
  }
  // Softer fat pad areas
  rCtx.fillStyle = "#a8a8a8";
  rCtx.globalAlpha = 0.3;
  rCtx.fillRect(0, 0, 512, 160);
  rCtx.restore();

  const epicardiumRoughness = new THREE.CanvasTexture(roughCanvas);
  epicardiumRoughness.wrapS = THREE.RepeatWrapping;
  epicardiumRoughness.wrapT = THREE.RepeatWrapping;

  // 4. Endocardial Trabecular Texture (Spongy, cavernous, deep red cavity)
  const endoCanvas = document.createElement("canvas");
  endoCanvas.width = 512;
  endoCanvas.height = 512;
  const eCtx = endoCanvas.getContext("2d");

  // Deep fleshy cavernous red
  eCtx.fillStyle = "#590d19";
  eCtx.fillRect(0, 0, 512, 512);

  // Trabeculae carneae columnar ridges
  eCtx.save();
  eCtx.globalAlpha = 0.4;
  for (let t = 0; t < 70; t++) {
    const tx = Math.random() * 512;
    const ty = Math.random() * 512;
    const tw = Math.random() * 14 + 6;
    const th = Math.random() * 80 + 30;
    const tGrad = eCtx.createRadialGradient(tx, ty, 0, tx, ty, th / 2);
    tGrad.addColorStop(0, "#a82035");
    tGrad.addColorStop(0.6, "#781222");
    tGrad.addColorStop(1, "#36060e");
    eCtx.fillStyle = tGrad;
    eCtx.beginPath();
    eCtx.ellipse(tx, ty, tw, th / 2, Math.PI / 4 + (Math.random() - 0.5) * 0.4, 0, Math.PI * 2);
    eCtx.fill();
  }
  eCtx.restore();

  const endocardiumDiffuse = new THREE.CanvasTexture(endoCanvas);
  endocardiumDiffuse.wrapS = THREE.RepeatWrapping;
  endocardiumDiffuse.wrapT = THREE.RepeatWrapping;

  // 5. Great Vessels Texture (Elastic arterial wall with longitudinal micro-stretch)
  const vesselCanvas = document.createElement("canvas");
  vesselCanvas.width = 512;
  vesselCanvas.height = 512;
  const vCtx = vesselCanvas.getContext("2d");

  const vGrad = vCtx.createLinearGradient(0, 0, 512, 0);
  vGrad.addColorStop(0, "#d9383a");
  vGrad.addColorStop(0.5, "#e64a4c");
  vGrad.addColorStop(1, "#b82628");
  vCtx.fillStyle = vGrad;
  vCtx.fillRect(0, 0, 512, 512);

  vCtx.save();
  vCtx.globalAlpha = 0.15;
  vCtx.strokeStyle = "#ffffff";
  vCtx.lineWidth = 1;
  for (let y = 0; y < 512; y += 4) {
    vCtx.beginPath();
    vCtx.moveTo(0, y);
    vCtx.lineTo(512, y);
    vCtx.stroke();
  }
  vCtx.restore();

  const aortaDiffuse = new THREE.CanvasTexture(vesselCanvas);
  aortaDiffuse.wrapS = THREE.RepeatWrapping;
  aortaDiffuse.wrapT = THREE.RepeatWrapping;

  cachedTextures = {
    epicardiumDiffuse,
    epicardiumNormal,
    epicardiumRoughness,
    endocardiumDiffuse,
    aortaDiffuse
  };

  return cachedTextures;
}
