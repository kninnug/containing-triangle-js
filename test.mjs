import tape from 'tape';
import {orient2d} from 'robust-predicates';
import Delaunator from 'delaunator';
import Constrainautor from '@kninnug/constrainautor';
import containingTriangle, {isInTriangulation} from './containing-triangle.mjs';
import {loadTests, loadFile, findTest} from './delaunaytests/loader.mjs';

const N = 10000,
	testFiles = loadTests(false);

function edgesOfTri(t){ return [t * 3, t * 3 + 1, t * 3 + 2]; }

function isInTriangle(del, tri, x, y){
	const [p1, p2, p3] = edgesOfTri(tri).map(e => del.triangles[e]),
		p1x = del.coords[p1 * 2],
		p1y = del.coords[p1 * 2 + 1],
		p2x = del.coords[p2 * 2],
		p2y = del.coords[p2 * 2 + 1],
		p3x = del.coords[p3 * 2],
		p3y = del.coords[p3 * 2 + 1];
	return orient2d(p1x, p1y, p2x, p2y, x, y) >= 0 &&
		orient2d(p2x, p2y, p3x, p3y, x, y) >= 0 &&
		orient2d(p3x, p3y, p1x, p1y, x, y) >= 0;
}

function outsideAll(del, x, y){
	const numTris = del.triangles / 3;
	for(let t = 0; t < numTris; t++){
		if(isInTriangle(del, t, x, y)){
			return false;
		}
	}
	return true;
}

function testFile(t, test){
	const {points, edges} = test,
		del = Delaunator.from(points),
		con = new Constrainautor(del).constrainAll(edges),
		{minX, minY, maxX, maxY} = test.extent;
	
	let outs = 0;
	for(let i = 0; i < N; i++){
		const round = i & 1 ? Math.round : a => a,
			x = round(Math.random() * ((maxX + 1) - minX) + (minX - 1)),
			y = round(Math.random() * ((maxY + 1) - minY) + (minY - 1)),
			found = containingTriangle(del, x, y),
			isIn = isInTriangulation(del, x, y);
		
		if(found === -1){
			const outside = outsideAll(del, x, y);
			outs++;
			if(!outside){
				t.fail(`(${x}, ${y}) not found, but is in triangulation`);
			}
			if(isIn){
				t.fail(`inconsistent result from isInTriangulation (outside but isIn)`);
			}
		}else{
			const inside = isInTriangle(del, found, x, y);
			if(!inside){
				t.fail(`(${x}, ${y}) found at ${found} but is not inside`);
			}
			if(!isIn){
				t.fail(`inconsistent result from isInTriangulation (inside but not isIn)`);
			}
		}
	}
	t.pass(`passed ${N} random samples (${outs} outside)`);
	t.end();
}

function testCases(t, del, cases){
	for(const [x, y, refTri] of cases){
		const tri = containingTriangle(del, x, y),
			isIn = isInTriangulation(del, x, y);
		t.equal(tri, refTri, `(${x}, ${y}) in ${refTri}`);
		t.equal(isIn, refTri !== -1, `(${x}, ${y}) ${refTri === -1 ? 'not ' : ''}in triangulation`);
		if(tri !== -1){
			t.assert(isInTriangle(del, tri, x, y), `(${x}, ${y}) within ${tri}`);
		}else{
			t.assert(outsideAll(del, x, y), `(${x}, ${y}) outside all`);
		}
	}
}

function testDiamond(t){
	const points = [[150, 50], [50, 200], [150, 350], [250, 200]],
		edges = [[0, 2]],
		del = Delaunator.from(points),
		preStrain = [
			[150, 150, 0], // middle top
			[150, 200, 0], // middle middle
			[150, 250, 1], // middle bottom
			[100, 200, 0], // middle left
			[200, 200, 0], // middle right
			[150,  50, 0],
			[ 50, 200, 0],
			[150, 350, 1],
			[250, 200, 0]
		];
	
	testCases(t, del, preStrain);
	
	const con = new Constrainautor(del).constrainAll(edges),
		postStrain = [
			[150, 150, 0], // middle top
			[150, 200, 0], // middle middle
			[150, 250, 0], // middle bottom
			[100, 200, 1], // middle left
			[200, 200, 0], // middle right
			[150,  50, 0],
			[ 50, 200, 1],
			[150, 350, 0],
			[250, 200, 0]
		];
	
	testCases(t, del, postStrain);
	t.end();
}

function testExample(t){
	const points = [[53,98],[5,201],[194,288],[280,195],[392,148],[413,43],[278,5],[169,71],[146,171]],
		edges = [[5, 8]],
		del = Delaunator.from(points),
		con = new Constrainautor(del).constrainAll(edges),
		cases = [
			[178, 190,  3],
			[285,  75,  5],
			[219, 184,  8],
			[ 18, 120, -1],
			[406, 135, -1],
			[412,  44,  8],
			[146, 171,  0],
			[146, 172,  4]
		];
	
	testCases(t, del, cases);
	t.end();
}

function testEdges(t){
	const points = [[5, 5], [10, 5], [5, 10]],
		del = Delaunator.from(points),
		cases = [
			[6, 5, 0],
			[5, 6, 0],
			[5, 5, 0],
			[10, 5, 0],
			[5, 10, 0],
			[9, 6, 0],
			[8, 7, 0],
			[7, 8, 0],
			[6, 9, 0]
		];
	
	testCases(t, del, cases);
	t.end();
}

function testIssue1(t){
	const test = findTest(testFiles, 'rand0.json'),
		{points, edges} = test,
		del = new Constrainautor(Delaunator.from(points)).constrainAll(edges),
		cases = [
			[212, 40, 1235],
			[211, 196, 712]
		];
	
	testCases(t, del, cases);
	t.end();
}

function main(args){
	if(!args.length){
		tape.test("Example", testExample);
		tape.test("Diamond", testDiamond);
		tape.test("Edges", testEdges);
		tape.test("Issue 1", testIssue1);
	}

	for(const test of testFiles){
		tape.test(test.name, (t) => testFile(t, test));
	}
}

main(process.argv.slice(2));
