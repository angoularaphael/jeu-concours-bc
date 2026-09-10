const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = window.matchMedia('(pointer: fine)').matches;

export function bootMotion() {
  document.documentElement.classList.toggle('reduce', reduce);
  requestAnimationFrame(() => document.body.classList.add('is-ready'));

  bootReveal();
  bootCounts();
  if (!reduce) {
    bootDust();
    bootPointer();
    bootParallax();
    bootProgress();
    if (fine) bootMagnetic();
  } else {
    document.querySelectorAll('[data-reveal]').forEach((el) => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
  }
}

function bootReveal() {
  if (reduce) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.16, rootMargin: '0px 0px -8% 0px' }
  );
  document.querySelectorAll('[data-reveal], .round').forEach((el) => io.observe(el));
}

function bootCounts() {
  const els = document.querySelectorAll('.count');
  if (!els.length) return;
  const run = () => els.forEach((el) => animateCount(el));
  if (reduce) {
    els.forEach((el) => {
      el.textContent = String(el.dataset.count || 0);
    });
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        run();
        io.disconnect();
      }
    },
    { threshold: 0.4 }
  );
  const host = document.querySelector('.stats') || els[0];
  io.observe(host);
}

function animateCount(el) {
  const to = Number(el.dataset.count || 0);
  const start = performance.now();
  const dur = 1400;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - (1 - t) ** 4;
    el.textContent = String(Math.round(to * eased));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function bootDust() {
  const c = document.getElementById('dust');
  if (!c) return;
  const ctx = c.getContext('2d', { alpha: true });
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let w = 0;
  let h = 0;
  let parts = [];

  const resize = () => {
    w = window.innerWidth;
    h = window.innerHeight;
    c.width = Math.floor(w * dpr);
    c.height = Math.floor(h * dpr);
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(55, (w * h) / 22000));
    parts = Array.from({ length: n }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 2.2 + 0.6,
      s: Math.random() * 0.32 + 0.07,
      a: Math.random() * 0.4 + 0.1,
      drift: (Math.random() - 0.5) * 0.28,
      hex: Math.random() > 0.45,
      hue: Math.random() > 0.7 ? 'cage' : 'gold',
    }));
  };

  const hex = (ctx, x, y, r) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };

  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.y -= p.s;
      p.x += p.drift;
      if (p.y < -6) {
        p.y = h + 6;
        p.x = Math.random() * w;
      }
      if (p.hue === 'cage') ctx.fillStyle = `rgba(62, 224, 196, ${p.a})`;
      else ctx.fillStyle = `rgba(247, 228, 180, ${p.a})`;
      if (p.hex) hex(ctx, p.x, p.y, p.r);
      else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.55, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    requestAnimationFrame(draw);
  };

  resize();
  window.addEventListener('resize', resize, { passive: true });
  requestAnimationFrame(draw);
}

function bootPointer() {
  const hero = document.querySelector('.hero');
  if (!hero || !fine) return;
  hero.addEventListener(
    'pointermove',
    (e) => {
      const r = hero.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      hero.style.setProperty('--mx', `${x}%`);
      hero.style.setProperty('--my', `${y}%`);
    },
    { passive: true }
  );
}

function bootParallax() {
  const media = document.querySelector('.hero__media');
  const ten = document.querySelector('.hero__ten');
  const cage = document.querySelector('.cage');
  if (!media) return;
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      media.style.transform = `translate3d(0, ${y * 0.22}px, 0)`;
      if (ten) ten.style.transform = `translate3d(0, ${y * 0.12}px, 0)`;
      if (cage) cage.style.transform = `translate3d(0, ${y * 0.08}px, 0) rotate(-8deg)`;
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
}

function bootProgress() {
  const bar = document.getElementById('progress');
  if (!bar) return;
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? window.scrollY / max : 0;
    bar.style.transform = `scaleX(${Math.min(1, Math.max(0, p))})`;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function bootMagnetic() {
  document.querySelectorAll('.btn-pulse').forEach((btn) => {
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      btn.style.transform = `translate(${x * 0.12}px, ${y * 0.18}px)`;
    });
    btn.addEventListener('pointerleave', () => {
      btn.style.transform = '';
    });
  });
}

export function bindOdds(form) {
  const label = document.getElementById('odds-label');
  const pips = document.querySelectorAll('#odds-pips i');
  const box = document.getElementById('odds');
  const bump = document.getElementById('odds-bump');
  if (!form || !label || !pips.length) return;
  let last = 0;

  const update = () => {
    const proof = form.querySelector('[name="avis_proof_0"]');
    const hasAvis = proof && String(proof.value || '').startsWith('data:image/');
    const filled = (prefix) =>
      ['prenom', 'nom', 'telephone'].every((k) =>
        String(form.elements[`${prefix}_${k}`]?.value || '').trim()
      );
    let n = 0;
    if (hasAvis) n = 1;
    if (hasAvis && filled('ami1') && filled('ami2')) n = 2;
    label.textContent = `×${n}`;
    pips.forEach((pip, i) => pip.classList.toggle('is-on', i < n));
    box.classList.toggle('is-up', n > 1);
    if (n !== last) {
      label.classList.remove('pop');
      void label.offsetWidth;
      label.classList.add('pop');
      if (n > last) {
        box.classList.add('ding');
        if (bump) {
          bump.textContent = `+${n - last}`;
          bump.classList.remove('is-go');
          void bump.offsetWidth;
          bump.classList.add('is-go');
        }
      }
      last = n;
      window.setTimeout(() => box.classList.remove('ding'), 700);
    }
  };

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('odds-refresh', update);
  update();
}

export function celebrate(root) {
  if (!root) return;
  root.classList.add('is-live');
  if (reduce) return;
  const host = root.querySelector('.sparks');
  if (!host) return;
  host.replaceChildren();
  for (let i = 0; i < 18; i += 1) {
    const s = document.createElement('i');
    const ang = (i / 18) * Math.PI * 2;
    const dist = 70 + (i % 5) * 18;
    s.style.setProperty('--x', `${Math.cos(ang) * dist}px`);
    s.style.setProperty('--y', `${Math.sin(ang) * dist}px`);
    s.style.animationDelay = `${i * 28}ms`;
    host.appendChild(s);
  }
}
