import tape from 'tape';
import fs from 'fs';
import {orient2d} from 'robust-predicates';
import Delaunator from 'delaunator';
import Constrainautor from '@kninnug/constrainautor';
import containingTriangle from './containing-triangle.mjs';

const N = 100000;

function getBounds(del){
	let minX = Infinity,
		maxX = -Infinity,
		minY = Infinity,
		maxY = -Infinity;
	
	for(const id of del.hull){
		minX = Math.min(minX, del.coords[id * 2]);
		maxX = Math.max(maxX, del.coords[id * 2]);
		minY = Math.min(minY, del.coords[id * 2 + 1]);
		maxY = Math.max(maxY, del.coords[id * 2 + 1]);
	}
	
	return {minX, maxX, minY, maxY};
}

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

function testFile(t, json){
	const {points, edges} = json,
		del = Delaunator.from(points),
		con = new Constrainautor(del).constrainAll(edges),
		{minX, minY, maxX, maxY} = getBounds(del);
	
	let outs = 0;
	for(let i = 0; i < N; i++){
		const round = i & 1 ? Math.round : a => a,
			x = round(Math.random() * (maxX - minX) + minX),
			y = round(Math.random() * (maxY - minY) + minY),
			found = containingTriangle(del, x, y);
		
		if(found === -1){
			const outside = outsideAll(del, x, y);
			outs++;
			if(!outside){
				t.fail(`(${x}, ${y}) not found, but is in triangulation`);
			}
		}else{
			const inside = isInTriangle(del, found, x, y);
			if(!inside){
				t.fail(`(${x}, ${y}) found at ${found} but is not inside`);
			}
		}
	}
	t.pass(`passed ${N} random samples (${outs} outside)`);
	t.end();
}

function testCases(t, del, cases){
	for(const [x, y, refTri] of cases){
		const tri = containingTriangle(del, x, y);
		t.equal(tri, refTri, `(${x}, ${y}) in ${refTri}`);
		if(tri !== -1){
			t.assert(isInTriangle(del, tri, x, y), `(${x}, ${y}) within ${tri}`);
		}else{
			t.assert(outsideAll(del, x, y), `(${x}, ${y}) not in triangulation`);
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
			[150, 150, 1], // middle top
			[150, 200, 1], // middle middle
			[150, 250, 1], // middle bottom
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

const files = fs.readdirSync('./tests/', 'utf8').map(f => './tests/' + f)
		.concat(fs.readdirSync('./tests/ipa/', 'utf8').map(f => './tests/ipa/' + f))
		.filter(f => f.endsWith('.json'));

function main(args){
	if(!args.length){
		tape.test("Example", testExample);
		tape.test("Diamond", testDiamond);
	}
	
	args = args.length ? args : files;

	for(const file of args){
		const json = JSON.parse(fs.readFileSync(file, 'utf8'));
		tape.test(file, (t) => testFile(t, json));
	}
}

main(process.argv.slice(2));
