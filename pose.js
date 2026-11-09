(function (root) {
  'use strict';
  const add = (a, b) => a.map((v, i) => v + b[i]);
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const mul = (a, k) => a.map(v => v * k);
  const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
  const cross = ([a,b,c], [d,e,f]) => [b*f-c*e,c*d-a*f,a*e-b*d];
  const unit = a => mul(a, 1 / Math.hypot(...a));
  const mix = (a,b,t) => add(a, mul(sub(b,a),t));
  const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
  const ease = t => .5 - .5 * Math.cos(Math.PI * clamp(t, 0, 1));
  const bench = { front: -.20, back: .67, top: .48, halfWidth: .53 };
  const sides = [-1, 1];

  function pose(progress, variant = 'standard', error = 'none') {
    const t = clamp(progress,0,1);
    const dip = t <= .48 ? ease(t / .48) : t <= .60 ? 1 : 1 - ease((t - .60) / .40);
    const angle = (39.35 - 14.35 * dip) * Math.PI / 180;
    const axis = [Math.cos(angle), Math.sin(angle), 0];
    const ankle = [-1.22,.11,0];
    const fromAnkle = d => add(ankle,mul(axis,d));
    const shoulder = fromAnkle(1.48);
    const hip = add(fromAnkle(.93), [0,error === 'sag' ? -.15 : 0,0]);
    const knee = add(fromAnkle(.46), [0,error === 'sag' ? -.038 : 0,0]);
    const neckAxis = error === 'neck' ? unit(add(axis,[.12,-.75,0])) : axis;
    const neck = add(shoulder,mul(axis,.105));
    const head = add(neck,mul(neckAxis,.15));
    if (error === 'neck') head[1] -= .018;
    const narrow = variant === 'narrow';
    const arms = sides.map(side => {
      const s = add(shoulder, [0,0,.193 * side]);
      const wrist = [-.115,bench.top + .038,(narrow ? .133 : .274) * side];
      const d = sub(wrist, s), dist = Math.hypot(...d), direction = unit(d);
      const upper = .285, lower = .265;
      const along = (upper*upper - lower*lower + dist*dist) / (2*dist);
      const radius = Math.sqrt(Math.max(0,upper*upper - along*along));
      const target = error === 'flare' ? [-.10,.07,1.4*side]
        : narrow ? [-.92,.24,-.10*side] : [-.85,.25,.57*side];
      const bend = unit(sub(target, mul(direction,dot(direction,target))));
      const elbow = add(add(s,mul(direction,along)),mul(bend,radius));
      return { shoulder:s, elbow, wrist };
    });
    return { ankle, shoulder, hip, knee, neck, head, axis, neckAxis, arms };
  }
  const api = { pose, bench, sides, add, sub, mul, dot, cross, unit, mix, clamp };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PushupPose = api;
})(globalThis);
