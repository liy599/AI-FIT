export function avg(values) {
    return values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
}
export function avgNullable(values) {
    const xs = values.filter((x) => typeof x === 'number' && Number.isFinite(x));
    if (xs.length === 0)
        return null;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
}
export function clamp01(x) {
    if (!Number.isFinite(x))
        return 0;
    return Math.min(1, Math.max(0, x));
}
export function midpointLandmark(a, b) {
    if (!a || !b)
        return undefined;
    if (Math.min(a.visibility ?? 0, b.visibility ?? 0) < 0.15)
        return undefined;
    return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        z: (a.z + b.z) / 2,
        visibility: Math.min(a.visibility ?? 0, b.visibility ?? 0)
    };
}
export function angleDeg(a, b, c) {
    if (!a || !b || !c)
        return null;
    const va = { x: a.x - b.x, y: a.y - b.y };
    const vc = { x: c.x - b.x, y: c.y - b.y };
    const m = Math.hypot(va.x, va.y) * Math.hypot(vc.x, vc.y);
    if (!m)
        return null;
    const cos = Math.max(-1, Math.min(1, (va.x * vc.x + va.y * vc.y) / m));
    return (Math.acos(cos) * 180) / Math.PI;
}
export function angleFromVerticalDeg(top, bottom) {
    if (!top || !bottom)
        return null;
    const dx = top.x - bottom.x;
    const dy = top.y - bottom.y;
    const m = Math.hypot(dx, dy);
    if (!m)
        return null;
    const cos = Math.max(-1, Math.min(1, dy / m));
    return Math.abs((Math.acos(cos) * 180) / Math.PI);
}
export function centerOfMass33(lm) {
    const ls = lm[11];
    const rs = lm[12];
    const lh = lm[23];
    const rh = lm[24];
    const pts = [ls, rs, lh, rh].filter(Boolean);
    if (pts.length < 2)
        return null;
    return {
        x: pts.reduce((acc, p) => acc + p.x, 0) / pts.length,
        y: pts.reduce((acc, p) => acc + p.y, 0) / pts.length,
        z: pts.reduce((acc, p) => acc + p.z, 0) / pts.length
    };
}
export function std(values) {
    const xs = values.filter((x) => Number.isFinite(x));
    if (xs.length === 0)
        return 0;
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    return Math.sqrt(xs.reduce((acc, x) => acc + (x - mean) * (x - mean), 0) / xs.length);
}
