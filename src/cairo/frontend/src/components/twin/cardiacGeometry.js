import * as THREE from "three";

/**
 * Advanced Procedural Cardiac Geometry Engine
 * Generates anatomically precise cardiac components:
 * - Prolate spheroid LV with C1/C2 continuous curvature, smooth septal flattening, and vortex apex
 * - Volumetric 3D Right Ventricle with physical myocardial wall thickness and smooth Infundibulum (RVOT)
 * - Left Atrium with curved Left Atrial Appendage (LAA) & 4 Pulmonary Vein sleeves
 * - Right Atrium with triangular Right Atrial Appendage (RAA) & SVC / IVC systemic conduits
 * - Aorta with tri-lobed Sinuses of Valsalva root & 3 supra-aortic arch branches
 * - Pulmonary Trunk with non-overlapping anatomical crossing anterior to Ascending Aorta and bifurcation (LPA & RPA)
 */

// Helper: smoothstep function for C1-smooth blending
function smoothstep(min, max, value) {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

// 1. LEFT VENTRICLE (Epicardium & Endocardium)
export function buildLeftVentricleGeometries() {
  const latSegments = 80;
  const lonSegments = 80;

  // Epicardium (Outer Myocardium)
  const outerGeo = new THREE.SphereGeometry(1.6, lonSegments, latSegments);
  const outerPos = outerGeo.attributes.position;

  for (let i = 0; i < outerPos.count; i++) {
    let x = outerPos.getX(i);
    let y = outerPos.getY(i);
    let z = outerPos.getZ(i);

    // Anatomical vertical elongation
    y *= 1.45;

    // Asymmetrical elliptical cross-section
    z *= 0.96;

    // Smooth apical taper and anterior-inferior tip curvature
    if (y < 0.2) {
      const s = smoothstep(0.2, -1.8, y);
      const taper = 1.0 - s * 0.78;
      x *= Math.max(0.16, taper);
      z *= Math.max(0.16, taper);
      // Smooth anterior-inferior tip inclination toward anatomical apex
      z += s * 0.12;
      x -= s * 0.05;
    }

    // Interventricular Septum (IVS) smooth flattening on +X side
    if (x > 0.35) {
      const septalFactor = smoothstep(0.35, 1.2, x);
      x -= septalFactor * (x - 0.35) * 0.38;
    }

    // Smooth Anterior Interventricular Sulcus groove (LAD bed)
    const anteriorAngle = Math.atan2(z, x);
    if (anteriorAngle > 0.7 && anteriorAngle < 1.9 && y > -1.5 && y < 1.3) {
      const angleWeight = Math.sin((anteriorAngle - 0.7) / 1.2 * Math.PI);
      const yWeight = Math.cos((y + 0.1) / 1.5 * (Math.PI / 2));
      const sulcusDepth = 0.055 * Math.max(0, angleWeight) * Math.max(0, yWeight);
      x -= sulcusDepth * Math.cos(anteriorAngle);
      z -= sulcusDepth * Math.sin(anteriorAngle);
    }

    // Smooth Posterior Interventricular Sulcus groove (PDA bed)
    const posteriorAngle = Math.atan2(z, x);
    if (posteriorAngle < -0.7 && posteriorAngle > -1.9 && y > -1.4 && y < 1.1) {
      const angleWeight = Math.sin((posteriorAngle + 1.9) / 1.2 * Math.PI);
      const yWeight = Math.cos((y + 0.15) / 1.4 * (Math.PI / 2));
      const sulcusDepth = 0.042 * Math.max(0, angleWeight) * Math.max(0, yWeight);
      x -= sulcusDepth * Math.cos(posteriorAngle);
      z -= sulcusDepth * Math.sin(posteriorAngle);
    }

    // Basal AV groove muscular shoulder
    if (y > 1.1 && y < 1.5) {
      const ring = Math.sin((y - 1.1) / 0.4 * Math.PI);
      const bulge = 1.0 + ring * 0.045;
      x *= bulge;
      z *= bulge;
    }

    outerPos.setXYZ(i, x, y, z);
  }
  outerGeo.computeVertexNormals();

  // Endocardium (Internal Cavity)
  const innerGeo = new THREE.SphereGeometry(1.22, lonSegments, latSegments);
  const innerPos = innerGeo.attributes.position;

  for (let i = 0; i < innerPos.count; i++) {
    let x = innerPos.getX(i);
    let y = innerPos.getY(i);
    let z = innerPos.getZ(i);

    y *= 1.36;
    z *= 0.95;

    if (y < 0.2) {
      const s = smoothstep(0.2, -1.6, y);
      const taper = 1.0 - s * 0.80;
      x *= Math.max(0.14, taper);
      z *= Math.max(0.14, taper);
      z += s * 0.10;
      x -= s * 0.04;
    }

    if (x > 0.32) {
      const septalFactor = smoothstep(0.32, 1.1, x);
      x -= septalFactor * (x - 0.32) * 0.36;
    }

    innerPos.setXYZ(i, x, y, z);
  }
  innerGeo.computeVertexNormals();

  return { outerGeometry: outerGeo, innerGeometry: innerGeo };
}

// 2. VOLUMETRIC RIGHT VENTRICLE & INFUNDIBULUM (RVOT)
export function buildRightVentricleGeometry() {
  const nu = 48; // Circumferential segments (anterior sulcus -> lateral -> posterior sulcus)
  const nv = 38; // Longitudinal segments (apex -> infundibulum/base)

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  // Helper to calculate 3D position for a parameterized point on RV
  function getRVPoint(u, v, isOuter) {
    // v: 0 (apex) -> 1 (base / RVOT)
    const y = -1.45 + v * 2.70;

    // Smooth baseline radius profile
    let rad = 1.36;
    if (y < 0.2) {
      const s = smoothstep(0.2, -1.45, y);
      rad = 1.36 * (1.0 - s * 0.65);
    }

    // Infundibulum / Conus Arteriosus smooth funnel toward pulmonic valve
    let cx = 0.36;
    let cz = 0.08;
    if (y > 0.35) {
      const infund = smoothstep(0.35, 1.25, y);
      rad = rad * (1.0 - infund * 0.36);
      cx = 0.36 + infund * 0.06;
      cz = 0.08 + infund * 0.38;
    }

    // Acute diaphragmatic margin rounding near apex
    if (y < -0.4) {
      const acute = smoothstep(-0.4, -1.45, y);
      cx += acute * 0.12;
      cz -= acute * 0.06;
    }

    // Angular span: wrapping from anterior sulcus around +X (right lateral) to posterior sulcus
    // u: 0 (anterior sulcus) -> 1 (posterior sulcus)
    const thetaStart = 0.96; // Anterior sulcus angle
    const thetaEnd = -1.18;  // Posterior sulcus angle
    const theta = thetaStart + u * (thetaEnd - thetaStart);

    // Anatomical myocardial wall thickness (RV is thinner than LV, ~0.20 units)
    // Tapers smoothly at sulcal attachment edges
    const edgeTaper = Math.sin(u * Math.PI);
    const wallThickness = 0.06 + 0.16 * edgeTaper * (1.0 - smoothstep(0.6, 1.25, y) * 0.35);

    const currentRad = isOuter ? rad : Math.max(0.10, rad - wallThickness);

    const x = cx + currentRad * Math.cos(theta);
    const z = cz + currentRad * Math.sin(theta);

    return new THREE.Vector3(x, y, z);
  }

  // Generate Vertex Grids: Outer Epicardial Layer (w=1) and Inner Endocardial Layer (w=0)
  // Vertex layout: Outer grid: [0 .. (nu+1)*(nv+1)-1]
  //               Inner grid: [(nu+1)*(nv+1) .. 2*(nu+1)*(nv+1)-1]
  const layerSize = (nu + 1) * (nv + 1);

  // 1. Outer Epicardium Vertices
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      const pt = getRVPoint(u, v, true);
      positions.push(pt.x, pt.y, pt.z);
      uvs.push(u, v);
    }
  }

  // 2. Inner Endocardium Vertices
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      const pt = getRVPoint(u, v, false);
      positions.push(pt.x, pt.y, pt.z);
      uvs.push(u, v);
    }
  }

  // 3. Faces - Outer Epicardial Surface
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      const b = (j + 1) * (nu + 1) + i;
      const c = (j + 1) * (nu + 1) + (i + 1);
      const d = j * (nu + 1) + (i + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  // 4. Faces - Inner Endocardial Surface (Inverted Winding)
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = layerSize + j * (nu + 1) + i;
      const b = layerSize + (j + 1) * (nu + 1) + i;
      const c = layerSize + (j + 1) * (nu + 1) + (i + 1);
      const d = layerSize + j * (nu + 1) + (i + 1);

      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }

  // 5. Connecting Boundary Ribbons (Water-tight Solid Thickening)
  // A. Anterior Sulcus Edge (u = 0)
  for (let j = 0; j < nv; j++) {
    const outA = j * (nu + 1);
    const outB = (j + 1) * (nu + 1);
    const inA = layerSize + j * (nu + 1);
    const inB = layerSize + (j + 1) * (nu + 1);

    indices.push(outA, inA, outB);
    indices.push(outB, inA, inB);
  }

  // B. Posterior Sulcus Edge (u = 1, i = nu)
  for (let j = 0; j < nv; j++) {
    const outA = j * (nu + 1) + nu;
    const outB = (j + 1) * (nu + 1) + nu;
    const inA = layerSize + j * (nu + 1) + nu;
    const inB = layerSize + (j + 1) * (nu + 1) + nu;

    indices.push(outA, outB, inA);
    indices.push(outB, inB, inA);
  }

  // C. Basal / Outflow Ring (v = 1, j = nv)
  for (let i = 0; i < nu; i++) {
    const outA = nv * (nu + 1) + i;
    const outB = nv * (nu + 1) + (i + 1);
    const inA = layerSize + nv * (nu + 1) + i;
    const inB = layerSize + nv * (nu + 1) + (i + 1);

    indices.push(outA, outB, inA);
    indices.push(outB, inB, inA);
  }

  // D. Apical Diaphragmatic Rim (v = 0, j = 0)
  for (let i = 0; i < nu; i++) {
    const outA = i;
    const outB = i + 1;
    const inA = layerSize + i;
    const inB = layerSize + i + 1;

    indices.push(outA, inA, outB);
    indices.push(outB, inA, inB);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return geo;
}

// 3. LEFT ATRIUM WITH LAA & 4 PULMONARY VEINS
export function buildLeftAtriumGeometries() {
  // Main posterior body
  const laGeo = new THREE.SphereGeometry(1.02, 36, 36);
  const laPos = laGeo.attributes.position;
  for (let i = 0; i < laPos.count; i++) {
    let x = laPos.getX(i);
    let y = laPos.getY(i);
    let z = laPos.getZ(i);
    x *= 1.08;
    z *= 0.92;
    laPos.setXYZ(i, x, y, z);
  }
  laGeo.computeVertexNormals();

  // Left Atrial Appendage (LAA / Auricle) - curved finger-like pouch
  const laaCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.45, 0.25, 0.55),
    new THREE.Vector3(-0.75, 0.15, 0.72),
    new THREE.Vector3(-0.95, -0.15, 0.68),
    new THREE.Vector3(-1.08, -0.42, 0.45)
  ]);
  const laaGeo = new THREE.TubeGeometry(laaCurve, 18, 0.22, 14, false);

  // 4 Pulmonary Vein Inlets (Sleeves entering posterior LA wall)
  // Left Superior PV
  const lspvCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.65, 0.45, -0.65),
    new THREE.Vector3(-1.05, 0.65, -0.95)
  ]);
  const lspvGeo = new THREE.TubeGeometry(lspvCurve, 8, 0.15, 12, false);

  // Left Inferior PV
  const lipvCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.65, -0.25, -0.65),
    new THREE.Vector3(-1.05, -0.45, -0.95)
  ]);
  const lipvGeo = new THREE.TubeGeometry(lipvCurve, 8, 0.14, 12, false);

  // Right Superior PV
  const rspvCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.65, 0.45, -0.65),
    new THREE.Vector3(1.15, 0.62, -0.92)
  ]);
  const rspvGeo = new THREE.TubeGeometry(rspvCurve, 8, 0.15, 12, false);

  // Right Inferior PV
  const ripvCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.65, -0.25, -0.65),
    new THREE.Vector3(1.15, -0.45, -0.92)
  ]);
  const ripvGeo = new THREE.TubeGeometry(ripvCurve, 8, 0.14, 12, false);

  return { laGeo, laaGeo, lspvGeo, lipvGeo, rspvGeo, ripvGeo };
}

// 4. RIGHT ATRIUM WITH RAA & SYSTEMIC CAVAE (SVC & IVC)
export function buildRightAtriumGeometries() {
  // Main RA body
  const raGeo = new THREE.SphereGeometry(0.96, 36, 36);
  const raPos = raGeo.attributes.position;
  for (let i = 0; i < raPos.count; i++) {
    let x = raPos.getX(i);
    let y = raPos.getY(i) * 1.15;
    let z = raPos.getZ(i) * 0.95;
    raPos.setXYZ(i, x, y, z);
  }
  raGeo.computeVertexNormals();

  // Right Atrial Appendage (RAA / Auricle)
  const raaCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.15, 0.35, 0.65),
    new THREE.Vector3(-0.45, 0.25, 0.85),
    new THREE.Vector3(-0.75, 0.05, 0.72)
  ]);
  const raaGeo = new THREE.TubeGeometry(raaCurve, 14, 0.22, 12, false);

  // Superior Vena Cava (SVC) entering superior pole
  const svcCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.15, 0.85, -0.15),
    new THREE.Vector3(0.15, 1.75, -0.25)
  ]);
  const svcGeo = new THREE.TubeGeometry(svcCurve, 10, 0.22, 14, false);

  // Inferior Vena Cava (IVC) entering inferior floor
  const ivcCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.1, -0.85, -0.2),
    new THREE.Vector3(0.1, -1.65, -0.3)
  ]);
  const ivcGeo = new THREE.TubeGeometry(ivcCurve, 10, 0.24, 14, false);

  return { raGeo, raaGeo, svcGeo, ivcGeo };
}

// 5. AORTA WITH TRI-LOBED SINUSES OF VALSALVA & 3 ARCH BRANCHES
export function buildAortaGeometries() {
  // Ascending Aorta & Arch - routes smoothly posterior to the pulmonary trunk
  const aortaCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.02, 1.48, 0.02),   // Root at LV base
    new THREE.Vector3(0.06, 1.95, -0.10),   // Passes behind the anteriorly sweeping Pulmonary Trunk
    new THREE.Vector3(0.14, 2.45, -0.18),   // Pre-arch ascending segment
    new THREE.Vector3(0.10, 2.82, -0.38),   // Arch summit
    new THREE.Vector3(-0.16, 2.76, -0.62),  // Arch transverse curving left and posterior
    new THREE.Vector3(-0.35, 2.05, -0.80)   // Descending thoracic aorta
  ]);
  const aortaGeo = new THREE.TubeGeometry(aortaCurve, 48, 0.34, 24, false);

  // Tri-Lobed Sinuses of Valsalva Root (Left, Right, Non-Coronary bulbs)
  const lccBulb = new THREE.SphereGeometry(0.30, 18, 18);
  const rccBulb = new THREE.SphereGeometry(0.30, 18, 18);
  const nccBulb = new THREE.SphereGeometry(0.30, 18, 18);

  // 3 Supra-Aortic Head & Neck Branches
  const brachioCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.12, 2.78, -0.26),
    new THREE.Vector3(0.24, 3.32, -0.20)
  ]);
  const brachioGeo = new THREE.TubeGeometry(brachioCurve, 10, 0.11, 12, false);

  const carotidCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.02, 2.81, -0.42),
    new THREE.Vector3(0.04, 3.35, -0.38)
  ]);
  const carotidGeo = new THREE.TubeGeometry(carotidCurve, 10, 0.09, 12, false);

  const subclavCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.10, 2.77, -0.55),
    new THREE.Vector3(-0.14, 3.30, -0.52)
  ]);
  const subclavGeo = new THREE.TubeGeometry(subclavCurve, 10, 0.09, 12, false);

  return {
    aortaGeo,
    lccBulb,
    rccBulb,
    nccBulb,
    brachioGeo,
    carotidGeo,
    subclavGeo
  };
}

// 6. PULMONARY TRUNK & BIFURCATION (LPA & RPA)
export function buildPulmonaryGeometries() {
  // Main Pulmonary Trunk sweeps anterior and crosses across the Ascending Aorta
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.38, 1.28, 0.50),   // RV Infundibulum / Outflow tract
    new THREE.Vector3(0.22, 1.82, 0.48),   // Sweeps medially and anterior to Ascending Aorta
    new THREE.Vector3(-0.16, 2.26, 0.18)   // Bifurcation under the aortic arch concavity
  ]);
  const trunkGeo = new THREE.TubeGeometry(trunkCurve, 28, 0.29, 24, false);

  // Left Pulmonary Artery (LPA) curving posterolaterally under aortic arch
  const lpaCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.16, 2.26, 0.18),
    new THREE.Vector3(-0.58, 2.20, -0.15),
    new THREE.Vector3(-1.02, 2.05, -0.45)
  ]);
  const lpaGeo = new THREE.TubeGeometry(lpaCurve, 16, 0.20, 16, false);

  // Right Pulmonary Artery (RPA) passing horizontally under the arch, behind ascending aorta
  const rpaCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.16, 2.26, 0.18),
    new THREE.Vector3(0.32, 2.12, -0.32),
    new THREE.Vector3(0.88, 2.00, -0.50)
  ]);
  const rpaGeo = new THREE.TubeGeometry(rpaCurve, 16, 0.20, 16, false);

  return { trunkGeo, lpaGeo, rpaGeo };
}

