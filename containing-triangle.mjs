import {orient2d} from 'robust-predicates';

/**
 * Next half-edge counter-clockwise in a triangle.
 *
 * @param {number} e Half-edge id.
 * @return {number} Id of the next half-edge.
 */
function nextEdge(e){ return (e % 3 === 2) ? e - 2 : e + 1; }
/**
 * Previous half-edge counter-clockwise in a triangle.
 *
 * @param {number} e Half-edge id.
 * @return {number} Id of the previous half-edge.
 */
function prevEdge(e){ return (e % 3 === 0) ? e + 2 : e - 1; }
/**
 * Id of the triangle of the given half-edge.
 *
 * @param {number} e Half-edge id.
 * @return {number} Id of the triangle.
 */
function triOfEdge(e){ return (e / 3) | 0; }
/**
 * Square distance between two points of a triangulation.
 *
 * @param {number} x1 First point x coordinate.
 * @param {number} y1 First point y coordinate.
 * @param {number} x2 Second point x coordinate.
 * @param {number} y2 Second point y coordinate.
 * @return {number} The squared distance.
 */
function sqdist(x1, y1, x2, y2){
	const dx = x2 - x1,
		dy = y2 - y1;
	
	return dx * dx + dy * dy;
}

/**
 * Distance between a point and the nearest point to it on a segment, squared.
 *
 * @source https://stackoverflow.com/a/6853926
 * @param {number} x1 The segment point 1 x-coordinate.
 * @param {number} y1 The segment point 1 y-coordinate.
 * @param {number} x2 The segment point 2 x-coordinate.
 * @param {number} y2 The segment point 2 y-coordinate.
 * @param {number} x The point x-coordinate.
 * @param {number} y The point y-coordinate.
 * @return {number} The distance squared.
 */
function segPointDistSq(x1, y1, x2, y2, x, y){
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
 * Whether a point is left of the line defined by two other points.
 *
 * @param {number} x1 The x coordinate of the first point on the line.
 * @param {number} y1 The y coordinate of the first point on the line.
 * @param {number} x2 The x coordinate of the second point on the line.
 * @param {number} y2 The y coordinate of the second point on the line.
 * @param {number} px The x coordinate of the query point.
 * @param {number} py The y coordinate of the query point.
 * @return {boolean} True if (px, py) is strictly to the left of the segment.
 */
function isLeftOf(x1, y1, x2, y2, px, py){
	return orient2d(x1, y1, x2, y2, px, py) > 0;
}

/**
 * Whether a point is right of the line defined by two other points.
 *
 * @param {number} x1 The x coordinate of the first point on the line.
 * @param {number} y1 The y coordinate of the first point on the line.
 * @param {number} x2 The x coordinate of the second point on the line.
 * @param {number} y2 The y coordinate of the second point on the line.
 * @param {number} px The x coordinate of the query point.
 * @param {number} py The y coordinate of the query point.
 * @return {boolean} True if (px, py) is strictly to the right of the segment.
 */
function isRightOf(x1, y1, x2, y2, px, py){
	return orient2d(x1, y1, x2, y2, px, py) < 0;
}

/**
 * Find the triangle that contains the given point.
 *
 * @source "A Robust Efficient Algorithm for Point Location in Triangulations"
 *          - Peter J.C. Brown, Christopher T. Faigle
 * @param {Delaunator} del The triangulation.
 * @param {number} x The x coordinate.
 * @param {number} y The y coordinate.
 * @return {number} The id of the triangle containing the point, or -1 if the
 *         point lies outside the triangulation.
 */
function containingTriangle(del, x, y){
	function isRight(edg){
		const p1 = del.triangles[edg],
			p2 = del.triangles[nextEdge(edg)];
		
		return isRightOf(del.coords[p1 * 2], del.coords[p1 * 2 + 1],
				del.coords[p2 * 2], del.coords[p2 * 2 + 1], x, y);
	}
	function isLeft(edg){
		const p1 = del.triangles[edg],
			p2 = del.triangles[nextEdge(edg)];
		
		return isLeftOf(del.coords[p1 * 2], del.coords[p1 * 2 + 1],
				del.coords[p2 * 2], del.coords[p2 * 2 + 1], x, y);
	}
	function dist(edg){
		const p1 = del.triangles[edg],
			p2 = del.triangles[nextEdge(edg)];
		
		return segPointDistSq(del.coords[p1 * 2], del.coords[p1 * 2 + 1],
				del.coords[p2 * 2], del.coords[p2 * 2 + 1], x, y);
	}
	
	let edg = 0
	if(isRight(edg)){
		edg = del.halfedges[edg];
	}
	
	while(edg !== -1){
		const org = del.triangles[edg],
			ox = del.coords[org * 2],
			oy = del.coords[org * 2 + 1],
			dPrev = nextEdge(edg),
			dst = del.triangles[dPrev],
			dx = del.coords[dst * 2],
			dy = del.coords[dst * 2 + 1],
			oNext = prevEdge(edg);
		
		if(sqdist(ox, oy, x, y) <= 0.0 || sqdist(dx, dy, x, y) <= 0.0){
			return triOfEdge(edg);
		}
		
		// half-edges are counter-clockwise, so flip the orientation
		//let op = 0;
		//if(!isLeft(oNext)){ 
		//	op += 1;
		//}
		//if(!isLeft(dPrev)){
		//	op += 2;
		//}
		const op = !isLeft(oNext)*1 + !isLeft(dPrev)*2;
		switch(op){
			case 0: return triOfEdge(edg);
			case 1: edg = del.halfedges[oNext]; break;
			case 2: edg = del.halfedges[dPrev]; break;
			case 3:
				if(dist(oNext) < dist(dPrev)){
					edg = oNext;
				}else{
					edg = dPrev;
				}
		}
	}
	
	return -1;
}

export default containingTriangle;
