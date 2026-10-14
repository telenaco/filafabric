const EPS = 1e-9;

/**
 * A boundary answers "is this point inside the textile?". The tiler and the base
 * depend only on this interface, so an SVG silhouette can replace RectBoundary later.
 */
export class RectBoundary {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }

  bbox() {
    return { minX: 0, minY: 0, maxX: this.width, maxY: this.height };
  }

  contains(x, y) {
    return x >= -EPS && x <= this.width + EPS && y >= -EPS && y <= this.height + EPS;
  }

  /** policy 'footprint': every point inside. 'feet-only': first and last point inside. */
  containsPolyline(points, policy = 'footprint') {
    if (points.length === 0) return true;
    if (policy === 'feet-only') {
      const a = points[0], b = points[points.length - 1];
      return this.contains(a.x, a.y) && this.contains(b.x, b.y);
    }
    return points.every((p) => this.contains(p.x, p.y));
  }
}
