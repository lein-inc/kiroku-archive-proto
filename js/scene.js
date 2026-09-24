/* あさひヶ丘プロジェクト（架空）共有3Dシーン
   THREE r128 UMD + OrbitControls を読み込んだ後に使用する。
   API:
     const app = SiteScene({canvas, interactive, autoRotate});
     app.setTime(t)        // 0..26 (月インデックス, 小数可)
     app.getTime()
     app.flyTo(id|pose, ms)
     app.setPose(pose)     // {px,py,pz,tx,ty,tz} 即時適用（スクロール駆動用）
     app.onMarkerClick(cb) // cb(camId)
     app.resize()
   SiteData: MONTH_LABELS / WORKERS / FOOTAGE / MILESTONES / CAMS / phaseAt(t)
*/
(function () {
  "use strict";

  // ---------- 共有データ（架空） ----------
  var MONTH_LABELS = [];
  (function () {
    var y = 2026, m = 10;
    for (var i = 0; i < 27; i++) {
      MONTH_LABELS.push(y + "年" + m + "月");
      m++; if (m > 12) { m = 1; y++; }
    }
  })();

  var WORKERS = [800, 2400, 3200, 2100, 1800, 2000, 2200, 2500, 2800, 3000,
    3200, 3400, 3500, 3450, 3300, 3200, 3000, 2800, 2600, 2400,
    2200, 2050, 1900, 1750, 1500, 1200, 900];

  var FOOTAGE = [42, 58, 66, 48, 45, 50, 52, 55, 60, 68,
    72, 76, 80, 74, 70, 68, 64, 62, 58, 56,
    54, 52, 50, 62, 70, 88, 46];

  var MILESTONES = [
    { m: 0,  label: "造成着手・作業員の街 建設開始" },
    { m: 2,  label: "街 完成（約3,000人が居住開始）" },
    { m: 3,  label: "生コンプラント稼働" },
    { m: 4,  label: "工場 基礎工事着手" },
    { m: 9,  label: "躯体工事 最盛期" },
    { m: 14, label: "上棟" },
    { m: 18, label: "外装完了・内装工事へ" },
    { m: 23, label: "製造装置 搬入開始" },
    { m: 25, label: "竣工" }
  ];

  function phaseAt(t) {
    if (t < 2) return "第1期 造成・街の建設";
    if (t < 4) return "第2期 街の稼働・プラント整備";
    if (t < 14) return "第3期 工場躯体工事";
    if (t < 22) return "第4期 外装・内装工事";
    if (t < 25) return "第5期 製造装置搬入";
    return "竣工";
  }

  var CAMS = [
    { id: "A", label: "CAM A 北西・街", pos: [-95, 34, -55], look: [-48, 4, 8] },
    { id: "B", label: "CAM B 中央・プラント", pos: [-18, 26, 62], look: [-4, 4, -12] },
    { id: "C", label: "CAM C 東・工場", pos: [96, 30, 58], look: [38, 10, 2] },
    { id: "D", label: "CAM D 南・全景", pos: [10, 62, 118], look: [0, 0, 0] }
  ];

  window.SiteData = {
    MONTH_LABELS: MONTH_LABELS, WORKERS: WORKERS, FOOTAGE: FOOTAGE,
    MILESTONES: MILESTONES, CAMS: CAMS, phaseAt: phaseAt, MAX_T: 26
  };

  // ---------- ユーティリティ ----------
  function rng(seed) { // 決定的乱数
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function ease(x) { return x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x); }

  // ---------- シーン ----------
  window.SiteScene = function (opts) {
    var canvas = opts.canvas;
    var interactive = opts.interactive !== false;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e1118);
    scene.fog = new THREE.Fog(0x0e1118, 190, 420);

    var camera = new THREE.PerspectiveCamera(46, 2, 1, 900);
    camera.position.set(-140, 95, 150);

    var controls = null;
    if (interactive && THREE.OrbitControls) {
      controls = new THREE.OrbitControls(camera, canvas);
      controls.target.set(0, 4, 0);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.maxPolarAngle = Math.PI * 0.47;
      controls.minDistance = 30;
      controls.maxDistance = 320;
      controls.autoRotate = !!opts.autoRotate;
      controls.autoRotateSpeed = 0.35;
    }
    var lookTarget = new THREE.Vector3(0, 4, 0);

    // ライティング
    scene.add(new THREE.HemisphereLight(0x93a7c8, 0x2b2015, 0.85));
    var sun = new THREE.DirectionalLight(0xffdcb0, 1.15);
    sun.position.set(90, 120, 40);
    scene.add(sun);
    var rim = new THREE.DirectionalLight(0x4a78d6, 0.35);
    rim.position.set(-80, 60, -90);
    scene.add(rim);

    // ---------- 地形 ----------
    var W = 340, D = 220, SX = 90, SZ = 60;
    var ground = new THREE.PlaneGeometry(W, D, SX, SZ);
    ground.rotateX(-Math.PI / 2);
    var pos = ground.attributes.position;
    var colors = new Float32Array(pos.count * 3);
    var rnd = rng(20260924);
    function inSite(x, z) { // 造成エリア（有機的な形）
      var dx = x / 120, dz = z / 62;
      var r = dx * dx + dz * dz;
      var wob = 0.16 * Math.sin(x * 0.045 + 1.2) + 0.13 * Math.cos(z * 0.07 + 0.5);
      return r < 0.72 + wob;
    }
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i);
      var h = (Math.sin(x * 0.022) + Math.cos(z * 0.035 + 1.7)) * 2.2 +
              Math.sin(x * 0.008 + z * 0.011) * 3.4;
      var edge = Math.max(Math.abs(x) / (W / 2), Math.abs(z) / (D / 2));
      h += ease((edge - 0.55) / 0.45) * 7; // 外周は山なみ
      var c;
      if (inSite(x, z)) {
        h *= 0.06; // 造成で平ら
        var t0 = 0.85 + rnd() * 0.25;
        c = [0.30 * t0, 0.24 * t0, 0.165 * t0]; // 土
      } else {
        var g = 0.8 + rnd() * 0.4;
        c = [0.075 * g, 0.135 * g, 0.07 * g]; // 山林
      }
      pos.setY(i, h);
      colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
    }
    ground.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    ground.computeVertexNormals();
    scene.add(new THREE.Mesh(ground, new THREE.MeshLambertMaterial({ vertexColors: true })));

    // 場内道路
    var roadMat = new THREE.MeshLambertMaterial({ color: 0x23211d });
    [[-52, 8, 46, 4, 0], [0, -2, 4, 70, 0], [22, 8, 60, 4, 0], [-20, -22, 70, 4, 0]]
      .forEach(function (r) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(r[2], 0.3, r[3]), roadMat);
        m.position.set(r[0], 0.28, r[1]);
        scene.add(m);
      });

    // 樹木（外周）
    var treeGeo = new THREE.ConeGeometry(1.6, 4.2, 6);
    var treeMat = new THREE.MeshLambertMaterial({ color: 0x1c3320 });
    var tr = rng(7);
    for (var ti = 0; ti < 260; ti++) {
      var tx = (tr() - 0.5) * (W - 30), tz = (tr() - 0.5) * (D - 30);
      if (inSite(tx, tz)) continue;
      var tree = new THREE.Mesh(treeGeo, treeMat);
      var hh = (Math.sin(tx * 0.022) + Math.cos(tz * 0.035 + 1.7)) * 2.2 +
               Math.sin(tx * 0.008 + tz * 0.011) * 3.4;
      var ee = Math.max(Math.abs(tx) / (W / 2), Math.abs(tz) / (D / 2));
      hh += ease((ee - 0.55) / 0.45) * 7;
      tree.position.set(tx, hh + 1.8, tz);
      var sc = 0.7 + tr() * 0.9; tree.scale.set(sc, sc, sc);
      scene.add(tree);
    }

    // ---------- 建物 ----------
    var buildings = []; // {mesh, h, m0, m1, (removeAt)}
    function addB(x, z, w, h, d, color, m0, m1, removeAt) {
      var mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, 1, d),
        new THREE.MeshLambertMaterial({ color: color })
      );
      mesh.position.set(x, 0, z);
      mesh.visible = false;
      scene.add(mesh);
      buildings.push({ mesh: mesh, h: h, m0: m0, m1: m1, removeAt: removeAt });
    }

    // 街（西）: プレハブ群 2026-10〜12
    var br = rng(42);
    var townCols = [0xb9b2a4, 0x9aa4ad, 0xa8988a, 0x8f9aa8, 0xbfb6a0];
    for (var gx = 0; gx < 9; gx++) {
      for (var gz = 0; gz < 6; gz++) {
        var bx = -84 + gx * 7 + (br() - 0.5) * 2;
        var bz = -12 + gz * 8 + (br() - 0.5) * 2;
        if (!inSite(bx, bz)) continue;
        if (br() < 0.12) continue;
        var m0 = br() * 1.6;
        addB(bx, bz, 4.6, 2.4 + br() * 1.4, 3.4,
          townCols[Math.floor(br() * townCols.length)], m0, m0 + 0.9);
      }
    }
    // 街の共用棟
    addB(-58, 24, 12, 4.2, 8, 0xcac2b0, 1.2, 2.2);
    addB(-74, 24, 8, 3.4, 8, 0xb0b6bd, 1.4, 2.4);

    // 生コンプラント（中央南）2027-01〜
    addB(-8, -26, 9, 6, 7, 0x8a8d92, 2.2, 3.6);
    addB(2, -30, 7, 4, 6, 0x7d8087, 2.5, 3.8);
    (function () { // サイロ
      var siloMat = new THREE.MeshLambertMaterial({ color: 0xb8bcc2 });
      for (var s = 0; s < 3; s++) {
        var silo = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 1, 14), siloMat);
        silo.position.set(-16 + s * 4.6, 0, -30);
        silo.visible = false;
        scene.add(silo);
        buildings.push({ mesh: silo, h: 9, m0: 2.4 + s * 0.3, m1: 3.6 + s * 0.3 });
      }
    })();

    // 工場（東）2027-02〜2028
    addB(40, 6, 46, 15, 26, 0xd8dde4, 4, 20);      // メイン棟
    addB(40, -14, 30, 8, 9, 0xc2c9d2, 8, 22);      // 付属棟
    addB(16, 20, 12, 6.5, 10, 0xaab4c0, 6, 10);    // 管理棟
    addB(66, 18, 10, 10, 10, 0x9aa5b2, 12, 21);    // ユーティリティ棟

    // タワークレーン（工事期間のみ）
    function addCrane(x, z, m0, m1) {
      var g = new THREE.Group();
      var mat = new THREE.MeshLambertMaterial({ color: 0xd9a11c });
      var mast = new THREE.Mesh(new THREE.BoxGeometry(1.1, 26, 1.1), mat);
      mast.position.y = 13;
      var jib = new THREE.Mesh(new THREE.BoxGeometry(20, 0.8, 0.8), mat);
      jib.position.set(6, 26, 0);
      var cw = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 1.4), mat);
      cw.position.set(-5, 25.4, 0);
      g.add(mast); g.add(jib); g.add(cw);
      g.position.set(x, 0, z);
      g.rotation.y = Math.random() * Math.PI * 2;
      g.visible = false;
      scene.add(g);
      buildings.push({ mesh: g, h: 1, m0: m0, m1: m0 + 0.5, removeAt: m1, crane: true });
    }
    addCrane(20, 2, 3.5, 20.5);
    addCrane(58, 14, 4.2, 19.5);
    addCrane(44, -8, 7.5, 21.5);

    // ---------- 定点カメラマーカー ----------
    var markerGroup = new THREE.Group();
    scene.add(markerGroup);
    function makeLabel(text) {
      var cv = document.createElement("canvas");
      cv.width = 256; cv.height = 96;
      var ctx = cv.getContext("2d");
      ctx.fillStyle = "rgba(10,14,22,0.82)";
      ctx.strokeStyle = "#3987e5"; ctx.lineWidth = 4;
      (ctx.roundRect ? ctx.roundRect.bind(ctx) : function (x, y, w, h) { ctx.rect(x, y, w, h); })(6, 10, 244, 76, 10);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#dfe8f6";
      ctx.font = "bold 40px -apple-system, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(text, 128, 50);
      var tex = new THREE.CanvasTexture(cv);
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
      sp.scale.set(17, 6.4, 1);
      return sp;
    }
    var markers = {};
    if (opts.markers !== false) {
      [{ id: "A", x: -60, z: 34 }, { id: "B", x: -22, z: -34 }, { id: "C", x: 74, z: 34 }, { id: "D", x: 8, z: 52 }]
        .forEach(function (mk) {
          var g = new THREE.Group();
          var pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.25, 0.25, 9, 8),
            new THREE.MeshLambertMaterial({ color: 0x3987e5 })
          );
          pole.position.y = 4.5;
          var label = makeLabel("CAM " + mk.id);
          label.position.y = 12.5;
          g.add(pole); g.add(label);
          g.position.set(mk.x, 0, mk.z);
          g.userData.camId = mk.id;
          markerGroup.add(g);
          markers[mk.id] = g;
        });
    }

    // ---------- 時間適用 ----------
    var T = 0;
    function setTime(t) {
      T = Math.max(0, Math.min(SiteData.MAX_T, t));
      for (var i = 0; i < buildings.length; i++) {
        var b = buildings[i];
        var k = ease((T - b.m0) / (b.m1 - b.m0));
        var gone = b.removeAt !== undefined && T > b.removeAt;
        if (k <= 0 || gone) { b.mesh.visible = false; continue; }
        b.mesh.visible = true;
        if (b.crane) {
          b.mesh.scale.set(k, k, k);
        } else {
          var hh = Math.max(0.001, b.h * k);
          b.mesh.scale.y = hh;
          b.mesh.position.y = hh / 2;
        }
      }
    }
    setTime(0);

    // ---------- カメラ移動 ----------
    var fly = null; // {p0,p1,t0,t1,start,dur}
    function poseOf(x) {
      if (typeof x === "string") {
        for (var i = 0; i < CAMS.length; i++) if (CAMS[i].id === x) x = CAMS[i];
      }
      if (x.pos) return { p: new THREE.Vector3().fromArray(x.pos), t: new THREE.Vector3().fromArray(x.look) };
      return { p: new THREE.Vector3(x.px, x.py, x.pz), t: new THREE.Vector3(x.tx, x.ty, x.tz) };
    }
    function flyTo(x, ms) {
      var target = poseOf(x);
      fly = {
        p0: camera.position.clone(),
        t0: (controls ? controls.target : lookTarget).clone(),
        p1: target.p, t1: target.t,
        start: performance.now(), dur: ms || 1600
      };
    }
    function setPose(pose) {
      var q = poseOf(pose);
      camera.position.copy(q.p);
      if (controls) controls.target.copy(q.t); else lookTarget.copy(q.t);
    }

    // ---------- クリック ----------
    var clickCb = null;
    if (interactive) {
      var ray = new THREE.Raycaster();
      var mouse = new THREE.Vector2();
      var downXY = null;
      canvas.addEventListener("pointerdown", function (e) { downXY = [e.clientX, e.clientY]; });
      canvas.addEventListener("pointerup", function (e) {
        if (!downXY || Math.abs(e.clientX - downXY[0]) + Math.abs(e.clientY - downXY[1]) > 6) return;
        var r = canvas.getBoundingClientRect();
        mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
        ray.setFromCamera(mouse, camera);
        var hits = ray.intersectObjects(markerGroup.children, true);
        if (hits.length && clickCb) {
          var o = hits[0].object;
          while (o && !o.userData.camId) o = o.parent;
          if (o) clickCb(o.userData.camId);
        }
      });
    }

    // ---------- ループ ----------
    function resize() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) ||
          canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    }
    var running = true;
    function loop(now) {
      if (!running) return;
      requestAnimationFrame(loop);
      resize();
      if (fly) {
        var k = ease((now - fly.start) / fly.dur);
        camera.position.lerpVectors(fly.p0, fly.p1, k);
        (controls ? controls.target : lookTarget).lerpVectors(fly.t0, fly.t1, k);
        if (k >= 1) fly = null;
      }
      if (controls) controls.update();
      else camera.lookAt(lookTarget);
      renderer.render(scene, camera);
    }
    requestAnimationFrame(loop);

    return {
      setTime: setTime,
      getTime: function () { return T; },
      flyTo: flyTo,
      setPose: setPose,
      onMarkerClick: function (cb) { clickCb = cb; },
      setAutoRotate: function (v) { if (controls) controls.autoRotate = v; },
      setMarkersVisible: function (v) { markerGroup.visible = v; },
      resize: resize,
      dispose: function () { running = false; renderer.dispose(); },
      camera: camera, controls: controls
    };
  };
})();
