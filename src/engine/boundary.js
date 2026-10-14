const EPS = 1e-9;

/**
 * A boundary answers "is this point inside the textile?" and "where does this line cross it?". The base, the
 * tiler and the squiggle layers depend only on this interface, so an SVG outline can replace the rectangle.
 */
export class RectBoundary {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.isRectangle = true;
  }

  bbox() {
    return { minX: 0, minY: 0, maxX: this.width, maxY: this.height };
  }

  contains(x, y) {
    return x >= -EPS && x <= this.width + EPS && y >= -EPS && y <= this.height + EPS;
  }

  /** policy 'footprint': every point inside. 'feet-only': first and last point inside. */
  containsPolyline(points, policy = 'footprint') {
    return polylineInside(this, points, policy);
  }

  /** Inside stretches of the line y = c (axis 'y') or x = c (axis 'x'), as sorted [from, to] pairs. */
  intervals(axis, c) {
    if (axis === 'y') return c >= -EPS && c <= this.height + EPS ? [[0, this.width]] : [];
    return c >= -EPS && c <= this.width + EPS ? [[0, this.height]] : [];
  }
}

/**
 * Any outline made of closed rings (in mm), filled with the even-odd rule, so a ring inside another is a hole
 * (the counter of an "O"). Rings are arrays of { x, y }; the last point joins back to the first.
 */
export class PolygonBoundary {
  constructor(rings) {
    this.rings = rings.filter((r) => r.length >= 3);
    if (this.rings.length === 0) throw new Error('An outline needs at least one ring of three points');
    this.isRectangle = false;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const ring of this.rings) {
      for (const p of ring) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
    }
    this.box = { minX, minY, maxX, maxY };
  }

  bbox() {
    return { ...this.box };
  }

  contains(x, y) {
    let inside = false;
    for (const ring of this.rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[i], b = ring[j];
        if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
      }
    }
    return inside;
  }

  containsPolyline(points, policy = 'footprint') {
    return polylineInside(this, points, policy);
  }

  intervals(axis, c) {
    const cuts = [];
    const along = axis === 'y' ? 'x' : 'y';
    for (const ring of this.rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[j], b = ring[i];
        // half-open test, so a vertex lying exactly on the line is counted once
        if ((a[axis] <= c) !== (b[axis] <= c)) {
          cuts.push(a[along] + ((c - a[axis]) * (b[along] - a[along])) / (b[axis] - a[axis]));
        }
      }
    }
    cuts.sort((p, q) => p - q);
    const out = [];
    for (let i = 0; i + 1 < cuts.length; i += 2) if (cuts[i + 1] - cuts[i] > EPS) out.push([cuts[i], cuts[i + 1]]);
    return out;
  }
}

function polylineInside(boundary, points, policy) {
  if (points.length === 0) return true;
  if (policy === 'feet-only') {
    const a = points[0], b = points[points.length - 1];
    return boundary.contains(a.x, a.y) && boundary.contains(b.x, b.y);
  }
  return points.every((p) => boundary.contains(p.x, p.y));
}
