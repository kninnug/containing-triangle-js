import {orient2d} from 'robust-predicates';

export interface DelaunatorLike {
    coords: {readonly length: number, readonly [n: number]: number};
    triangles:  {readonly length: number, [n: number]: number};
    halfedges:  {readonly length: number, [n: number]: number};
    hull:  {readonly length: number, readonly [n: number]: number};
}

/**
 * Next half-edge counter-clockwise in a triangle.
 *
 * @param e Half-edge id.
 * @return Id of the next half-edge.
 */
function nextEdge(e: number){ return (e % 3 === 2) ? e - 2 : e + 1; }
/**
 * Previous half-edge counter-clockwise in a triangle.
 *
 * @param e Half-edge id.
 * @return Id of the previous half-edge.
 */
function prevEdge(e: number){ return (e % 3 === 0) ? e + 2 : e - 1; }
/**
 * Id of the triangle of the given half-edge.
 *
 * @param e Half-edge id.
 * @return Id of the triangle.
 */
function triOfEdge(e: number){ return (e / 3) | 0; }
/**
 * Square distance between two points of a triangulation.
 *
 * @param x1 First point x coordinate.
 * @param y1 First point y coordinate.
 * @param x2 Second point x coordinate.
 * @param y2 Second point y coordinate.
 * @return The squared distance.
 */
function sqdist(x1: number, y1: number, x2: number, y2: number){
	const dx = x2 - x1,
		dy = y2 - y1;
	
	return dx * dx + dy * dy;
}

/**
 * Distance between a point and the nearest point to it on a segment, squared.
 *
 * @source https://stackoverflow.com/a/6853926
 * @param x1 The segment point 1 x-coordinate.
 * @param y1 The segment point 1 y-coordinate.
 * @param x2 The segment point 2 x-coordinate.
 * @param y2 The segment point 2 y-coordinate.
 * @param x The point x-coordinate.
 * @param y The point y-coordinate.
 * @return The distance squared.
 */
function segPointDistSq(x1: number, y1: number, x2: number, y2: number, x: number, y: number){
	const A = x - x1,
		B = y - y1,
		C = x2 - x1,
		D = y2 - y1,

		dot = A * C + B * D,
		lenSq = C * C + D * D,
		param = lenSq === 0 ? -1 : dot / lenSq;

	let xx, yy;

	if(param < 0){
		xx = x1;
		yy = y1;
	}else if(param > 1){
		xx = x2;
		yy = y2;
	}else{
		xx = x1 + param * C;
		yy = y1 + param * D;
	}

	return sqdist(x, y, xx, yy);
}

/**
 * Find the triangle that contains the given point.
 *
 * @source "A Robust Efficient Algorithm for Point Location in Triangulations"
 *          - Peter J.C. Brown, Christopher T. Faigle
 * @param del The triangulation.
 * @param x The x coordinate.
 * @param y The y coordinate.
 * @return The id of the triangle containing the point, or -1 if the
 *         point lies outside the triangulation.
 */
function containingTriangle(del: DelaunatorLike, x: number, y: number){
	const triangles = del.triangles,
		halfedges = del.halfedges,
		coords = del.coords;
	
	function isRight(e: number){
		const p1 = triangles[e],
			p1x = coords[p1 * 2],
			p1y = coords[p1 * 2 + 1],
			p2 = triangles[nextEdge(e)],
			p2x = coords[p2 * 2],
			p2y = coords[p2 * 2 + 1];
		
		return orient2d(p1x, p1y, p2x, p2y, x, y) < 0;
	}
	function isLeft(e: number){
		const p1 = triangles[e],
			p1x = coords[p1 * 2],
			p1y = coords[p1 * 2 + 1],
			p2 = triangles[nextEdge(e)],
			p2x = coords[p2 * 2],
			p2y = coords[p2 * 2 + 1];
		
		return orient2d(p1x, p1y, p2x, p2y, x, y) >= 0;
	}
	function dist(e: number){
		const p1 = triangles[e],
			p1x = coords[p1 * 2],
			p1y = coords[p1 * 2 + 1],
			p2 = triangles[nextEdge(e)],
			p2x = coords[p2 * 2],
			p2y = coords[p2 * 2 + 1];
		
		return segPointDistSq(p1x, p1y, p2x, p2y, x, y);
	}
	
	let edg = 0
	if(isRight(edg)){
		edg = halfedges[edg];
	}
	
	while(edg !== -1){
		const dPrev = nextEdge(edg),
			oNext = prevEdge(edg),
			p1 = triangles[edg],
			p1x = coords[p1 * 2],
			p1y = coords[p1 * 2 + 1],
			p2 = triangles[dPrev],
			p2x = coords[p2 * 2],
			p2y = coords[p2 * 2 + 1];
		
		if(sqdist(p1x, p1y, x, y) === 0.0 || sqdist(p2x, p2y, x, y) === 0.0){
			return triOfEdge(edg);
		}
		
		let op = 0;
		if(!isLeft(oNext)){
			op += 1;
		}
		
		if(!isLeft(dPrev)){
			op += 2;
		}
		switch(op){
			case 0: return triOfEdge(edg);
			case 1: edg = halfedges[oNext]; break;
			case 2: edg = halfedges[dPrev]; break;
			case 3: {
				const dn = dist(dPrev),
					dp = dist(oNext);
				if(dn < dp){
					edg = oNext;
				}else{
					edg = dPrev;
				}
			}
		}
	}
	
	return -1;
}

/**
 * Whether a given point is inside the convex hull of a triangulation.
 *
 * @param del The triangulation.
 * @param x The x coordinate.
 * @param y The y coordinate.
 * @return True if the point (x, y) is inside the triangulation.
 */

function isInTriangulation(del: DelaunatorLike, x: number, y: number){
	const hull = del.hull,
		len = hull.length,
		coords = del.coords;
	
	let prv = hull[len - 1];
	for(let i = 0; i < len; i++){
		const cur = hull[i],
			p1x = coords[prv * 2], p1y = coords[prv * 2 + 1],
			p2x = coords[cur * 2], p2y = coords[cur * 2 + 1];
		
		if(orient2d(p1x, p1y, p2x, p2y, x, y) < 0){
			return false;
		}
		
		prv = cur;
	}
	
	return true;
}

export {isInTriangulation, containingTriangle as default};
