const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const EMAIL = "vagishyagnik@gmail.com";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const hasGsap = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";
const isMobile = () => matchMedia("(max-width: 900px)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

/* ---------- every load starts at the top: no restored scroll, no #hash jump ---------- */
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
if (location.hash) history.replaceState(null, "", location.pathname + location.search);
scrollTo(0, 0);
addEventListener("beforeunload", () => scrollTo(0, 0));

$$(".yr").forEach((el) => (el.textContent = new Date().getFullYear()));

/* ---------- split text into chars ---------- */
function splitChars(el) {
  const text = el.textContent;
  el.textContent = "";
  for (const ch of text) {
    const s = document.createElement("span");
    s.className = "char";
    s.textContent = ch === " " ? "\u00a0" : ch;
    el.appendChild(s);
  }
  return $$(".char", el);
}
$$(".split").forEach(splitChars);

/* ---------- WebGL shader hero: domain-warped noise, mouse-reactive ---------- */
(() => {
  const canvas = $("#gl");
  const ctx = canvas.getContext("webgl");
  if (!ctx) return;

  const vert = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
  const frag = `
    precision highp float;
    uniform vec2 r; uniform float t; uniform vec2 m;
    vec2 hash(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return -1.+2.*fract(sin(p)*43758.5453); }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p), u = f*f*(3.-2.*f);
      return mix(mix(dot(hash(i),f), dot(hash(i+vec2(1,0)),f-vec2(1,0)), u.x),
                 mix(dot(hash(i+vec2(0,1)),f-vec2(0,1)), dot(hash(i+vec2(1,1)),f-vec2(1,1)), u.x), u.y);
    }
    float fbm(vec2 p){ float v = 0., a = .5; for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.02; a *= .5; } return v; }
    void main(){
      vec2 uv = (gl_FragCoord.xy - .5*r) / r.y;
      vec2 mm = (m - .5*r) / r.y;
      float d = length(uv - mm);
      uv += (uv - mm) * .18 * exp(-d*3.);
      vec2 q = vec2(fbm(uv*1.4 + t*.05), fbm(uv*1.4 + vec2(5.2,1.3) - t*.04));
      vec2 w = vec2(fbm(uv*1.6 + 3.*q + vec2(1.7,9.2) + t*.07), fbm(uv*1.6 + 3.*q + vec2(8.3,2.8) - t*.06));
      float f = fbm(uv*1.2 + 3.5*w);
      vec3 lime = vec3(.83,1.,.23);
      vec3 violet = vec3(.35,.2,1.);
      vec3 col = vec3(.02);
      col = mix(col, violet*.55, smoothstep(.0,.6,length(q)));
      col = mix(col, lime, smoothstep(.45,.9,f*1.6 + .35) * .85);
      col += lime * .25 * exp(-d*4.);
      float lines = smoothstep(.0,.02,abs(fract(f*9.)-.5)-.46);
      col += lines * .06;
      col *= .55 + .45*smoothstep(1.4,.2,length(uv));
      gl_FragColor = vec4(col, 1.);
    }`;
  const sh = (type, src) => { const s = ctx.createShader(type); ctx.shaderSource(s, src); ctx.compileShader(s); return s; };
  const prog = ctx.createProgram();
  ctx.attachShader(prog, sh(ctx.VERTEX_SHADER, vert));
  ctx.attachShader(prog, sh(ctx.FRAGMENT_SHADER, frag));
  ctx.linkProgram(prog);
  ctx.useProgram(prog);
  const buf = ctx.createBuffer();
  ctx.bindBuffer(ctx.ARRAY_BUFFER, buf);
  ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), ctx.STATIC_DRAW);
  const loc = ctx.getAttribLocation(prog, "p");
  ctx.enableVertexAttribArray(loc);
  ctx.vertexAttribPointer(loc, 2, ctx.FLOAT, false, 0, 0);
  const U = { r: ctx.getUniformLocation(prog, "r"), t: ctx.getUniformLocation(prog, "t"), m: ctx.getUniformLocation(prog, "m") };

  // phones get a cheaper render target; the noise is soft enough that nobody can tell
  const dpr = isMobile() ? 0.75 : Math.min(devicePixelRatio, 1.5);
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let visible = true;
  const resize = () => {
    canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr;
    ctx.viewport(0, 0, canvas.width, canvas.height);
    mouse.tx = mouse.x = canvas.width * .7; mouse.ty = mouse.y = canvas.height * .5;
  };
  resize();
  addEventListener("resize", resize);
  addEventListener("pointermove", (e) => {
    const b = canvas.getBoundingClientRect();
    mouse.tx = (e.clientX - b.left) * dpr; mouse.ty = (b.height - (e.clientY - b.top)) * dpr;
  });
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);

  const start = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    if (!visible) return;
    const t = (now - start) / 1000;
    if (!finePointer) { mouse.tx = canvas.width * (.5 + .3 * Math.sin(t * .4)); mouse.ty = canvas.height * (.5 + .25 * Math.cos(t * .3)); }
    mouse.x += (mouse.tx - mouse.x) * .06; mouse.y += (mouse.ty - mouse.y) * .06;
    ctx.uniform2f(U.r, canvas.width, canvas.height);
    ctx.uniform1f(U.t, reduceMotion ? 0 : t);
    ctx.uniform2f(U.m, mouse.x, mouse.y);
    ctx.drawArrays(ctx.TRIANGLES, 0, 3);
  };
  requestAnimationFrame(frame);
})();

/* ---------- custom cursor ---------- */
(() => {
  if (!finePointer) return;
  const c = $("#cursor"), label = $("#cursorLabel");
  let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
  addEventListener("mousemove", (e) => { x = e.clientX; y = e.clientY; });
  const loop = () => {
    cx += (x - cx) * .2; cy += (y - cy) * .2;
    c.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  };
  loop();
  document.addEventListener("mouseover", (e) => {
    const lab = e.target.closest("[data-label]");
    c.classList.toggle("labeled", !!lab);
    label.textContent = lab ? lab.dataset.label : "";
    c.classList.toggle("big", !lab && !!e.target.closest("[data-hover], input, textarea"));
  });
})();

/* ---------- text scramble on hover ---------- */
$$("[data-scramble]").forEach((el) => {
  const original = el.textContent, glyphs = "!<>-_\\/[]{}—=+*^?#01";
  let raf;
  el.addEventListener("mouseenter", () => {
    let frame = 0;
    cancelAnimationFrame(raf);
    const run = () => {
      el.textContent = [...original].map((ch, i) => (i < frame / 2 ? ch : glyphs[(Math.random() * glyphs.length) | 0])).join("");
      if (frame++ < original.length * 2) raf = requestAnimationFrame(run);
      else el.textContent = original;
    };
    run();
  });
});

/* ---------- nav: glass on scroll, hide on scroll down ---------- */
(() => {
  const nav = $(".nav");
  let last = 0;
  addEventListener("scroll", () => {
    const y = scrollY;
    nav.classList.toggle("scrolled", y > 40);
    if (!document.body.classList.contains("menu-open")) nav.classList.toggle("hide", y > last && y > 400);
    last = y;
  }, { passive: true });
})();

/* ---------- mobile menu ---------- */
const menu = (() => {
  const btn = $("#burger"), el = $("#menu");
  const set = (open) => {
    btn.setAttribute("aria-expanded", open);
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    el.classList.toggle("open", open);
    el.setAttribute("aria-hidden", !open);
    document.body.classList.toggle("menu-open", open);
  };
  btn.addEventListener("click", () => set(btn.getAttribute("aria-expanded") !== "true"));
  $$("a", el).forEach((a) => a.addEventListener("click", () => set(false)));
  addEventListener("keydown", (e) => e.key === "Escape" && set(false));
  return { close: () => set(false) };
})();

/* ---------- 3D logo sphere ---------- */
(() => {
  const tech = [
    ["java", "Java"], ["spring", "Spring"], ["vertx", "Vert.x"], ["nodejs", "Node.js"], ["python", "Python"], ["typescript", "TypeScript"],
    ["cplusplus", "C++"], ["apachekafka", "Kafka"], ["amazonwebservices", "AWS"], ["googlecloud", "GCP"], ["kubernetes", "Kubernetes"],
    ["docker", "Docker"], ["helm", "Helm"], ["postgresql", "PostgreSQL"], ["mongodb", "MongoDB"], ["mysql", "MySQL"], ["redis", "Redis / Valkey"],
    ["elasticsearch", "Elasticsearch"], ["dynamodb", "DynamoDB"], ["graphql", "GraphQL"], ["grpc", "gRPC"], ["oauth", "OAuth 2.0"],
    ["vault", "Vault"], ["nginx", "nginx"], ["opentelemetry", "OpenTelemetry"], ["prometheus", "Prometheus"], ["grafana", "Grafana"],
    ["kibana", "Kibana"], ["jenkins", "Jenkins"], ["githubactions", "GitHub Actions"], ["git", "Git"], ["linux", "Linux"],
    ["fastapi", "FastAPI"], ["sqlalchemy", "SQLAlchemy"],
    ["claude", "Claude"], ["chatgpt", "ChatGPT"], ["gemini", "Gemini"], ["grok", "Grok"], ["sap", "SAP"], ["hrms", "HRMS"],
  ];
  const root = $("#sphere"), nameEl = $("#sphereName span");
  const pts = tech.map(([file, name], k) => {
    // stride the list across the fibonacci points so related logos (and late additions) don't bunch at one pole
    const i = (k * 7) % tech.length;
    const phi = Math.acos(1 - (2 * (i + 0.5)) / tech.length), theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const el = document.createElement("div");
    el.className = "t";
    el.innerHTML = `<img src="assets/logos/tech/${file}.svg" alt="${name}" loading="lazy" />`;
    el.dataset.name = name;
    root.appendChild(el);
    return { el, x: Math.sin(phi) * Math.cos(theta), y: Math.sin(phi) * Math.sin(theta), z: Math.cos(phi) };
  });
  const showName = (n) => {
    if (nameEl.textContent === n) return;
    nameEl.textContent = n;
    if (hasGsap) gsap.fromTo(nameEl, { yPercent: 100 }, { yPercent: 0, duration: .45, ease: "expo.out" });
  };
  root.addEventListener("mouseover", (e) => {
    const t = e.target.closest(".t");
    pts.forEach((p) => p.el.classList.toggle("on", p.el === t));
    if (t) showName(t.dataset.name);
  });

  const idle = { x: 0.0015, y: 0.002 };
  let vx = idle.x, vy = idle.y, tvx = vx, tvy = vy, visible = false, drag = null;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(root);
  root.addEventListener("mousemove", (e) => {
    if (drag) return;
    const b = root.getBoundingClientRect();
    tvy = ((e.clientX - b.left) / b.width - 0.5) * 0.022;
    tvx = -((e.clientY - b.top) / b.height - 0.5) * 0.022;
  });
  root.addEventListener("mouseleave", () => { if (!drag) { tvx = idle.x; tvy = idle.y; } });
  // touch / drag: fling the sphere, it coasts back to idle spin
  root.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY }; root.setPointerCapture(e.pointerId); });
  root.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag = { x: e.clientX, y: e.clientY };
    vy = tvy = dx * 0.004; vx = tvx = -dy * 0.004;
  });
  const release = () => { if (!drag) return; drag = null; setTimeout(() => { tvx = idle.x; tvy = idle.y; }, 900); };
  root.addEventListener("pointerup", release);
  root.addEventListener("pointercancel", release);

  let frontName = "";
  const tick = () => {
    requestAnimationFrame(tick);
    if (!visible) return;
    vx += (tvx - vx) * 0.05; vy += (tvy - vy) * 0.05;
    const R = root.clientWidth * 0.4, cX = Math.cos(vx), sX = Math.sin(vx), cY = Math.cos(vy), sY = Math.sin(vy);
    let front = null;
    for (const p of pts) {
      const y1 = p.y * cX - p.z * sX, z1 = p.y * sX + p.z * cX;
      const x2 = p.x * cY + z1 * sY, z2 = -p.x * sY + z1 * cY;
      p.x = x2; p.y = y1; p.z = z2;
      const s = 0.45 + 0.55 * ((p.z + 1) / 2);
      p.el.style.transform = `translate(-50%, -50%) translate3d(${p.x * R}px, ${p.y * R}px, 0) scale(${s})`;
      p.el.style.opacity = 0.2 + 0.8 * ((p.z + 1) / 2);
      p.el.style.zIndex = Math.round(p.z * 100) + 100;
      p.el.style.filter = p.z < -0.2 ? `blur(${(-p.z - 0.2) * 3}px)` : "none";
      if (!front || p.z > front.z) front = p;
    }
    // on touch there's no hover, so name whatever is closest to the viewer
    if (!finePointer && front.el.dataset.name !== frontName) { frontName = front.el.dataset.name; showName(frontName); }
  };
  tick();
})();

/* ---------- spotlight + tilt ---------- */
$$(".side, .b-card").forEach((el) => el.addEventListener("mousemove", (e) => {
  const b = el.getBoundingClientRect();
  el.style.setProperty("--mx", e.clientX - b.left + "px");
  el.style.setProperty("--my", e.clientY - b.top + "px");
}));
if (hasGsap && finePointer) {
  $$(".client").forEach((el) => {
    const rx = gsap.quickTo(el, "rotationX", { duration: .6, ease: "power3" });
    const ry = gsap.quickTo(el, "rotationY", { duration: .6, ease: "power3" });
    el.addEventListener("mousemove", (e) => {
      const b = el.getBoundingClientRect(), px = (e.clientX - b.left) / b.width, py = (e.clientY - b.top) / b.height;
      rx((0.5 - py) * 22); ry((px - 0.5) * 22);
      el.style.setProperty("--gx", px * 100 + "%"); el.style.setProperty("--gy", py * 100 + "%");
    });
    el.addEventListener("mouseleave", () => { rx(0); ry(0); });
  });
}

/* ---------- toast + copy ---------- */
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("show"), 2200);
}
$("#copy").addEventListener("click", (e) => {
  e.preventDefault();
  navigator.clipboard.writeText(EMAIL).then(() => toast("email copied ✓"), () => toast(EMAIL));
});

/* ---------- contact: API console ---------- */
(() => {
  const form = $("#console"), payload = $("#payload"), resp = $("#response"), btn = $(".send", form);
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const val = () => ({
    intent: form.intent.value,
    from: form.from.value.trim(),
    message: form.message.value.trim(),
  });
  const render = () => {
    const v = val();
    const line = (k, s, last) => `  <span class="k">"${k}"</span><span class="p">:</span> <span class="s">"${esc(s)}"</span>${last ? "" : '<span class="p">,</span>'}`;
    payload.innerHTML = `<span class="p">{</span>\n${line("intent", v.intent)}\n${line("from", v.from || "…")}\n${line("message", v.message || "…", true)}\n<span class="p">}</span>`;
  };
  form.addEventListener("input", render);
  render();

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = val();
    if (!v.message) { form.message.focus(); toast("payload.message is required"); return; }
    btn.disabled = true;
    resp.classList.add("show");
    resp.innerHTML = "";
    const steps = [
      ['<span class="dim">→ resolving vagish.dev …</span> ok', 260],
      ['<span class="dim">→ TLS 1.3 handshake …</span> <span class="ok">✓</span>', 380],
      [`<span class="dim">→ POST /v1/vagish/hello · intent=${esc(v.intent)}</span>`, 320],
      [`<span class="ok">← 200 OK</span> <span class="dim">· ${28 + ((Math.random() * 30) | 0)}ms</span>`, 260],
      ['{ "status": "received", "reply_eta": "&lt; 24h" }', 500],
      ['<span class="dim">opening your mail client…</span>', 600],
    ];
    for (const [html, ms] of steps) { resp.innerHTML += (resp.innerHTML ? "\n" : "") + html; await wait(ms); }
    const subject = `[${v.intent}] hello from ${v.from || "your portfolio"}`;
    location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(v.message + (v.from ? `\n\n— ${v.from}` : ""))}`;
    btn.disabled = false;
  });
})();

/* ---------- Bangalore clock ---------- */
(() => {
  const el = $("#clock"), note = $("#clockNote");
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const update = () => {
    const [h, m, s] = fmt.format(new Date()).split(":");
    el.textContent = `${h}:${m}:${s}`;
    const hr = +h;
    note.textContent =
      hr < 7 ? "probably sutti babu · replies by morning" :
      hr < 10 ? "coffee + standup" :
      hr < 13 ? "deep work · shipping things" :
      hr < 14 ? "lunch, back in a bit" :
      hr < 19 ? "probably debugging something" :
      hr < 23 ? "online · good time to say hi" : "on the last PR of the day";
  };
  update();
  setInterval(update, 1000);
})();

/* ---------- badminton rally: the shuttle flies the arc, each player winds up and swings as it arrives ---------- */
(() => {
  const path = $("#rally"), sh = $("#shuttle"), armL = $("#armL"), armR = $("#armR");
  // t = phase offset from this player's hit, in half-rallies: wind back before, follow through after
  const swing = (t) => (t < 0 ? -30 * Math.max(0, 1 + t / .25) : 45 * Math.max(0, 1 - t / .2));
  const L = path.getTotalLength();
  let visible = false;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(path.ownerSVGElement);
  const ease = (u) => (u < .5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
  const tick = (now) => {
    requestAnimationFrame(tick);
    if (!visible) return;
    const k = (now / 1300) % 2, dir = k < 1 ? 1 : -1, d = ease(k < 1 ? k : 2 - k) * L;
    const a = path.getPointAtLength(d), b = path.getPointAtLength(Math.min(L, Math.max(0, d + dir * 2)));
    // cork leads, feathers trail
    sh.setAttribute("transform", `translate(${a.x} ${a.y}) rotate(${Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI})`);
    armL.setAttribute("transform", `rotate(${swing(k < 1 ? k : k - 2)} 0 -40)`);
    armR.setAttribute("transform", `rotate(${swing(k - 1)} 0 -40)`);
  };
  requestAnimationFrame(tick);
})();

/* ---------- word wrap for scroll-scrubbed copy ---------- */
const scrub = $("#scrubText");
const highlight = new Set(["hard", "middle", "plumbing", "3am."]);
scrub.innerHTML = scrub.textContent.split(" ").map((w) => `<span class="w${highlight.has(w) ? " hl" : ""}">${w}</span>`).join(" ");

/* ================= GSAP choreography ================= */
if (!hasGsap || reduceMotion) {
  $("#loader").remove();
  document.body.classList.remove("loading");
  $$(".reveal").forEach((el) => { el.style.opacity = 1; el.style.transform = "none"; });
  $$(".w").forEach((el) => (el.style.opacity = 1));
  $$("[data-count]").forEach((el) => (el.textContent = el.dataset.count));
} else {
  gsap.registerPlugin(ScrollTrigger);

  /* smooth scroll (desktop only — native momentum feels better on phones) */
  let lenis;
  if (typeof Lenis !== "undefined" && finePointer) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.stop();
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    if (id.length < 2) { e.preventDefault(); return; }
    e.preventDefault();
    menu.close();
    lenis ? lenis.scrollTo(id, { duration: 1.6 }) : $(id).scrollIntoView({ behavior: "smooth" });
  }));

  /* intro: netflix-style. A "V" is painted in two brush strokes, then the camera dives
     into the left stroke while it peels away into a bundle of light lamps */
  $$(".brush").forEach((b) => {
    const c = b.closest(".leg-r") ? "#b9e81f" : "#d4ff3a";
    for (let x = 0; x < 100;) {
      const w = Math.min(100 - x, 2 + Math.random() * 4.5), solid = 8 + Math.random() * 30;
      const f = document.createElement("i");
      f.style.cssText = `left:${x}%;width:${w + .4}%;background:linear-gradient(to bottom,${c} 0%,${c} ${solid}%,transparent ${solid + 25 + Math.random() * 45}%)`;
      b.appendChild(f);
      x += w;
    }
  });
  const lampColors = ["#d4ff3a", "#f1efe9", "#7b5cff", "#38e1ff", "#ffb13b", "#ff4d6d", "#9dff5c", "#b9e81f", "#d4ff3a"];
  for (let x = 0; x < 100;) {
    const w = .4 + Math.random() * 2.2, l = document.createElement("i");
    l.style.cssText = `left:${x}%;width:${w}%;--c:${lampColors[(Math.random() * lampColors.length) | 0]};opacity:${.45 + Math.random() * .55}`;
    $("#lamps").appendChild(l);
    x += w + Math.random() * 2.6;
  }
  gsap.set(".brush", { yPercent: -90 });

  const finish = () => {
    $("#loader")?.remove();
    document.body.classList.remove("loading");
    lenis && lenis.start();
  };
  const brushL = ".leg-l .brush", brushR = ".leg-r .brush";
  const intro = gsap.timeline({ delay: .25 });
  intro
    .to(brushL, { yPercent: 0, duration: .75, ease: "power2.inOut" })
    .to(brushR, { yPercent: 0, duration: .6, ease: "power2.inOut" }, "-=.2")
    .to("#introTag", { opacity: 1, letterSpacing: ".45em", duration: 1, ease: "power2.out" }, "-=.3")
    .addLabel("dive", "+=.1")
    .to("#nfx", { scale: isMobile() ? 14 : 22, duration: 2.3, ease: "power2.in" }, "dive")
    .to("#introTag", { opacity: 0, duration: .4 }, "dive")
    .to(brushR, { yPercent: -90, duration: 1, ease: "power2.in" }, "dive+=.1")
    .to("#lamps", { opacity: 1, duration: .5 }, "dive+=.45")
    .to(brushL, { yPercent: -90, duration: 1.3, ease: "power2.inOut" }, "dive+=.35")
    .to("#lamps i", { x: () => gsap.utils.random(-30, 30), scaleX: () => gsap.utils.random(1, 3.5), duration: 1.5, ease: "power2.in" }, "dive+=.7")
    .to("#loader", { opacity: 0, duration: .5, ease: "power1.out" }, "dive+=1.95")
    .add(finish)
    .from(".hero-title .char", { yPercent: 120, rotate: 12, opacity: 0, duration: 1.3, ease: "expo.out", stagger: 0.03 }, "-=.35")
    .from(".hero-fade", { y: 30, opacity: 0, duration: 1, ease: "expo.out", stagger: .1 }, "-=1")
    .from("#gl", { scale: 1.3, opacity: 0, duration: 2, ease: "expo.out" }, "<-.6");
  // impatient? click to skip
  $("#loader").addEventListener("click", () => intro.timeScale(4));

  /* hero parallax out */
  gsap.to(".hero-inner", {
    yPercent: -25, opacity: 0.2, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
  });
  gsap.to("#gl", { yPercent: 20, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });

  /* velocity marquee */
  const track = $("#marquee");
  const loop = gsap.to(track, { xPercent: -50, duration: 30, ease: "none", repeat: -1 });
  const skewTo = gsap.quickTo(track, "skewX", { duration: .4, ease: "power3" });
  ScrollTrigger.create({
    onUpdate: (self) => {
      const v = self.getVelocity();
      gsap.to(loop, { timeScale: 1 + Math.min(Math.abs(v) / 300, 6) * (v < 0 ? -1 : 1), duration: .2, overwrite: true });
      skewTo(gsap.utils.clamp(-12, 12, v / -150));
      clearTimeout(loop.reset);
      loop.reset = setTimeout(() => { gsap.to(loop, { timeScale: 1, duration: 1 }); skewTo(0); }, 120);
    },
  });

  /* scroll-scrubbed word fill */
  gsap.to("#scrubText .w", {
    opacity: 1, stagger: 0.1, ease: "none",
    scrollTrigger: { trigger: "#scrubText", start: "top 80%", end: "bottom 35%", scrub: true },
  });

  /* portrait: curtain reveal + inner parallax */
  gsap.fromTo(".portrait-img", { clipPath: "inset(100% 0 0 0 round 28px)" }, {
    clipPath: "inset(0% 0 0 0 round 28px)", duration: 1.6, ease: "expo.inOut",
    scrollTrigger: { trigger: "#portrait", start: "top 80%" },
  });
  gsap.fromTo("#portrait", { y: 50 }, {
    y: -50, ease: "none", scrollTrigger: { trigger: "#portrait", start: "top bottom", end: "bottom top", scrub: true },
  });
  gsap.from(".portrait figcaption span", { y: 20, opacity: 0, stagger: .1, duration: 1, ease: "expo.out", scrollTrigger: { trigger: "#portrait", start: "top 60%" } });

  const countUp = (n) => {
    const o = { v: 0 }, dec = +(n.dataset.dec || 0);
    gsap.to(o, { v: +n.dataset.count, duration: 2.2, ease: "expo.out", onUpdate: () => (n.textContent = o.v.toFixed(dec)) });
  };

  /* generic reveals */
  ScrollTrigger.batch(".reveal", {
    start: "top 88%",
    onEnter: (els) => {
      gsap.to(els, { opacity: 1, y: 0, duration: 1.2, ease: "expo.out", stagger: .08 });
      els.forEach((el) => $$("[data-count]", el).forEach(countUp));
    },
  });

  /* pinned horizontal scroll (desktop) */
  ScrollTrigger.matchMedia({
    "(min-width: 901px)": () => {
      const hs = $("#hsTrack");
      const dist = () => hs.scrollWidth - innerWidth;
      const tween = gsap.to(hs, {
        x: () => -dist(), ease: "none",
        scrollTrigger: { trigger: "#hscroll", pin: true, scrub: 1, end: () => "+=" + dist(), invalidateOnRefresh: true },
      });
      $$(".hs-card").forEach((card) => {
        gsap.from(card, {
          rotate: 8, yPercent: 20, scale: .85, ease: "none",
          scrollTrigger: { trigger: card, containerAnimation: tween, start: "left right", end: "left 40%", scrub: true },
        });
      });
    },
    "(max-width: 900px)": () => {
      gsap.from(".hs-card", { x: 120, opacity: 0, stagger: .1, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: ".hs-cards", start: "top 85%" } });
    },
  });

  /* section titles slide up */
  $$(".sphere-title, .hs-intro h2, .clients-title").forEach((el) => {
    gsap.from(el, { yPercent: 40, opacity: 0, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 85%" } });
  });

  /* sphere tiles pop in */
  gsap.from("#sphere .t", { scale: 0, duration: 1.2, ease: "elastic.out(1, .6)", stagger: { each: .02, from: "random" }, scrollTrigger: { trigger: "#sphere", start: "top 75%" } });

  /* experience logos slide in from alternating sides */
  $$(".exp-logo").forEach((h, i) => {
    gsap.from(h, { xPercent: i % 2 ? 40 : -40, opacity: 0, ease: "none", scrollTrigger: { trigger: h, start: "top bottom", end: "top 65%", scrub: true } });
  });

  /* client wall: 3D flip-in */
  gsap.from(".client", {
    rotationX: -80, y: 60, opacity: 0, transformOrigin: "50% 100%", duration: 1.2, ease: "expo.out",
    stagger: { each: .07, grid: "auto", from: "start" },
    scrollTrigger: { trigger: "#clientGrid", start: "top 80%" },
  });

  /* arena: cards deal in, then numbers count, the ring draws, the rating marker slides */
  $$("#bento [data-count]").forEach((n) => (n.textContent = 0));
  gsap.from(".b-card", {
    y: 90, opacity: 0, rotate: () => gsap.utils.random(-4, 4), duration: 1.3, ease: "expo.out", stagger: .07,
    scrollTrigger: { trigger: "#bento", start: "top 82%" },
  });
  ScrollTrigger.create({
    trigger: "#bento", start: "top 70%", once: true,
    onEnter: () => {
      $$("#bento [data-count]").forEach(countUp);
      // gsap.from() can't read inline custom properties back, so tween to the authored values explicitly
      gsap.from(".lc-bar i", { scaleX: 0, duration: 1.2, ease: "expo.out", stagger: .25, delay: .3 });
      gsap.fromTo(".gfg-logo path", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 2.2, ease: "power2.inOut", delay: .3 });
      const cf = $(".cf-bar i");
      gsap.fromTo(cf, { "--p": "0%" }, { "--p": cf.style.getPropertyValue("--p"), duration: 2, ease: "expo.out", delay: .3 });
      gsap.from(".stars", { clipPath: "inset(0 100% 0 0)", duration: 1.4, ease: "power2.out", delay: .4 });
    },
  });
  $$(".arena-title").forEach((el) => gsap.from(el, { yPercent: 40, opacity: 0, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 85%" } }));

  /* motto: lines slam in from opposite sides, then the sub-line types in */
  const mLines = $$(".m-line");
  gsap.fromTo(mLines[0], { xPercent: -30, opacity: .1 }, { xPercent: 0, opacity: 1, ease: "none", scrollTrigger: { trigger: "#motto", start: "top bottom", end: "center center", scrub: true } });
  gsap.fromTo(mLines[1], { xPercent: 30, opacity: .1 }, { xPercent: 0, opacity: 1, ease: "none", scrollTrigger: { trigger: "#motto", start: "top bottom", end: "center center", scrub: true } });
  gsap.from(".motto-sub", { opacity: 0, y: 20, duration: 1, ease: "expo.out", scrollTrigger: { trigger: ".motto-sub", start: "top 85%" } });

  /* contact: headline lines rise */
  gsap.from(".ct-line > span", {
    yPercent: 115, rotate: 4, duration: 1.4, ease: "expo.out", stagger: .12,
    scrollTrigger: { trigger: "#contactTitle", start: "top 80%" },
  });
  gsap.from(".socials a", { x: 40, opacity: 0, stagger: .08, duration: 1, ease: "expo.out", scrollTrigger: { trigger: ".socials", start: "top 90%" } });
  gsap.from(".side-top > *", { scale: .6, opacity: 0, stagger: .12, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: ".side-top", start: "top 90%" } });

  /* magnetic elements */
  if (finePointer) {
    $$(".logo, .nav-cta, .arrow, .badge, .send").forEach((el) => {
      const qx = gsap.quickTo(el, "x", { duration: .6, ease: "elastic.out(1, .4)" });
      const qy = gsap.quickTo(el, "y", { duration: .6, ease: "elastic.out(1, .4)" });
      const host = el.closest(".side") || el;
      host.addEventListener("mousemove", (e) => {
        const b = el.getBoundingClientRect();
        qx((e.clientX - b.left - b.width / 2) * .3); qy((e.clientY - b.top - b.height / 2) * .3);
      });
      host.addEventListener("mouseleave", () => { qx(0); qy(0); });
    });
  }

  addEventListener("load", () => ScrollTrigger.refresh());
}
