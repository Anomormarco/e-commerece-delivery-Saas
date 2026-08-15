// BFS-based route distance estimator.
//
// The delivery/dispatch distance math previously scaled the straight-line
// (haversine) distance between two GPS points by a flat constant to guess a
// "road distance". This replaces that guess with an actual breadth-first
// search: the area between the two points is modeled as a synthetic
// Manhattan-style street grid (a passable cell exists on every Nth row/column,
// like real city blocks), and BFS finds the shortest path along that grid
// instead of cutting straight through blocks that have no street.
//
// BFS is the correct choice here because every edge in this grid is the same
// length (one cell) - it's an unweighted graph, exactly BFS's use case. (A
// real weighted road network with mixed segment lengths would call for
// Dijkstra/A*, but this project has no such graph to search.)

const gridResolution = 24; // grid cells per axis between the two points
const streetSpacing = 3; // a "street" runs along every Nth row/column

function isStreetCell(r, c) {
  return r % streetSpacing === 0 || c % streetSpacing === 0;
}

function nearestStreetCell(r, c, size) {
  if (isStreetCell(r, c)) return { r, c };

  const rDown = Math.max(0, r - (r % streetSpacing));
  const rUp = Math.min(size, rDown + streetSpacing);
  const cDown = Math.max(0, c - (c % streetSpacing));
  const cUp = Math.min(size, cDown + streetSpacing);

  const candidates = [
    { r: rDown, c },
    { r: rUp, c },
    { r, c: cDown },
    { r, c: cUp },
  ];

  candidates.sort((a, b) => (
    (Math.abs(a.r - r) + Math.abs(a.c - c)) - (Math.abs(b.r - r) + Math.abs(b.c - c))
  ));

  return candidates[0];
}

function bfsShortestSteps(start, target, size) {
  if (start.r === target.r && start.c === target.c) return 0;

  const visited = new Set([`${start.r},${start.c}`]);
  const queue = [{ r: start.r, c: start.c, dist: 0 }];
  const moves = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let head = 0;

  while (head < queue.length) {
    const node = queue[head++];

    for (const [dr, dc] of moves) {
      const nr = node.r + dr;
      const nc = node.c + dc;
      if (nr < 0 || nr > size || nc < 0 || nc > size) continue;
      if (!isStreetCell(nr, nc)) continue;
      if (nr === target.r && nc === target.c) return node.dist + 1;

      const key = `${nr},${nc}`;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ r: nr, c: nc, dist: node.dist + 1 });
    }
  }

  // The grid is fully connected by construction (row 0, column 0, row size
  // and column size are always streets), so this is unreachable in practice.
  return Math.abs(target.r - start.r) + Math.abs(target.c - start.c);
}

export function haversineKm(from, to) {
  const earthKm = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bfsRouteKm(from, to) {
  if (!from || !to) return 0;
  const directKm = haversineKm(from, to);
  if (!Number.isFinite(directKm) || directKm < 0.05) return Math.max(0, directKm || 0);

  const size = gridResolution;
  const start = nearestStreetCell(0, 0, size);
  const end = nearestStreetCell(size, size, size);
  const steps = bfsShortestSteps(start, end, size);

  const latOnlyKm = haversineKm(from, { lat: to.lat, lng: from.lng });
  const lngOnlyKm = haversineKm(from, { lat: from.lat, lng: to.lng });
  const avgStepKm = (latOnlyKm + lngOnlyKm) / (size * 2) || directKm / size;

  return Math.max(directKm, steps * avgStepKm);
}
