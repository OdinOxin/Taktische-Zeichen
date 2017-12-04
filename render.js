var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;
var spawnSync = require('child_process').spawnSync;
var async = require('async');
var Handlebars = require('handlebars');

const RST	= "\x1b[0m";
const DIM	= "\x1b[2m";
const RED	= "\x1b[31m";
const GRN	= "\x1b[32m";
const YLW	= "\x1b[33m";
const BLE	= "\x1b[34m";
const MGT	= "\x1b[35m";
const CYN	= "\x1b[36m";
const WHT	= "\x1b[37m";

const SVGPath = "svg";

var action = "create-svgs";
var config = JSON.parse(fs.readFileSync(process.argv[2]));

var tree = [];
var pngSizes = [];
var generated = 0;

if(process.argv.length == 4) {
	action = process.argv[3];
}

switch(action) {
	case "render-all":
		pngSizes = [256, 1024];
	case "create-svgs":
		createAllSets();
		break;
}

console.log(DIM + "Generated: " + RST + MGT + generated + RST + DIM + " symbols; " + RST + MGT + (pngSizes.length+1) + RST + DIM + " files / symbol; " + RST + MGT + ((pngSizes.length + 1) * generated) + RST + DIM + " total files." + RST);
console.log(RED + "Wait for '" + RST + "Done." + RED + "'!" + RST);

function renderImg(job) {
	var render = spawn("wkhtmltoimage", ["--transparent", "--quality", "100", "--zoom", job.size / 256, "--crop-h", job.size, "--crop-w", job.size, job.svgFile, job.pngFile]);
	render.on('close', function(code) {
		spawnSync("optipng", [ job.pngFile ]);
	});
}

function println(msg) {
	var indent = "";
	for(var i = 0; i < tree.length - 1; i++)
	{
		if(indent !== "")
			indent += " ";
		if(tree[i])
			indent += "|";
		else
			indent += " ";
	}
	if(indent !== "")
			indent += " ";
	if(msg !== "")
		indent += "+ ";
	else
		indent += "|";
	console.log(indent + msg);
}

function makeAttrString(src) {
	if(src === undefined || src.attr === undefined)
		return DIM + "  \t[ ]" + RST;
	return DIM + "  \t[ " + RST + src.attr + DIM + " ]" + RST;
}

function mkdir(dest) {
	var dirs = [ path.join(__dirname, SVGPath, dest) ];
	for(var i = 0; i < pngSizes.length; i++) {
		dirs.push(path.join(__dirname, String(pngSizes[i]), dest));
	}
	
	for(var i = 0; i < dirs.length; i++) {
		if (!fs.existsSync(dirs[i])) {
			fs.mkdirSync(dirs[i]);
		}
	}
}

function createAllSets() {
	mkdir("");

	var fonts = config.fonts;
	
	Handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
		switch (operator) {
			case '==':
				return (v1 == v2) ? options.fn(this) : options.inverse(this);
			case '===':
				return (v1 === v2) ? options.fn(this) : options.inverse(this);
			case '!=':
				return (v1 != v2) ? options.fn(this) : options.inverse(this);
			case '!==':
				return (v1 !== v2) ? options.fn(this) : options.inverse(this);
			case '<':
				return (v1 < v2) ? options.fn(this) : options.inverse(this);
			case '<=':
				return (v1 <= v2) ? options.fn(this) : options.inverse(this);
			case '>':
				return (v1 > v2) ? options.fn(this) : options.inverse(this);
			case '>=':
				return (v1 >= v2) ? options.fn(this) : options.inverse(this);
			case '&&':
				return (v1 && v2) ? options.fn(this) : options.inverse(this);
			case '||':
				return (v1 || v2) ? options.fn(this) : options.inverse(this);
			default:
				return options.inverse(this);
		}
	});
	
	Handlebars.registerHelper('attr', function(item, options) {
		if(this.attr != undefined && this.attr.indexOf(item) > -1)
			return options.fn(this);
		return options.inverse(this);
    });
	
	Handlebars.registerHelper('attrCond', function (v1, operator, v2, options) {
		if(this.attr != undefined)
			switch (operator) {
				case '&&':
					if(this.attr.indexOf(v1) > -1 && this.attr.indexOf(v2) > -1)
						return options.fn(this);
					break;
				case '||':
					if(this.attr.indexOf(v1) > -1 || this.attr.indexOf(v2) > -1)
						return options.fn(this);
					break;
			}
		return options.inverse(this);
	});

	console.log(RED + "Root" + RST);
	tree.push(false);
	for(var i = 0; i < config.sets.length; i++) {
		tree[tree.length - 1] = i != config.sets.length - 1;
		var set = config.sets[i];
		set.path = '';
		createSet(set);
	}
	tree.pop();
}

function copySetAttributes(dest, src, withSubsets, withSubsetvariants, withSymbols) {
	for(var key in src) {
		if(key === "subsetvariants" && !withSubsetvariants)
			continue;
		if(key === "subsets" && !withSubsets)
			continue;
		if(key === "symbols" && !withSymbols)
			continue;
		if(key === "attr") {
			if(dest[key] === undefined)
				dest[key] = [];
			for(var item in src[key])
				if(dest[key].indexOf(src[key][item]) == -1) // If not already contained in attr array...
					dest[key].push(src[key][item]); // ... sum to attributes
			continue;
		}
		if(dest[key] === undefined) // If not already specialized in child...
			dest[key] = src[key]; // ... extend from parent
	}
}

function createSet(set) {
	println("");
	println(GRN + "'" + set.name + "'" + RST + makeAttrString(set));
	
	if(set.attr !== undefined && set.attr.indexOf("skip") != -1) {
		return;
	}
	
	set.path = path.join(set.path, set.name);
	mkdir(set.path);
	
	createSymbols(set);
	if(set.subsets !== undefined) {
		if(set.subsetvariants === undefined)
			set.subsetvariants = [ { "name": "" } ];
		for(var i = 0; i < set.subsetvariants.length; i++) {
			if(set.subsetvariants.length > 1 || set.subsetvariants[0].name !== "") {
				tree.push(i != set.subsetvariants.length - 1);
				println("");
				println(YLW + "'" + set.subsetvariants[i].name + "'" + RST + makeAttrString(set.subsetvariants[i]));
			}
			tree.push(false);
			for(var j = 0; j < set.subsets.length; j++) {
				tree[tree.length - 1] = j != set.subsets.length - 1;
				var variant = {};
				copySetAttributes(variant, set.subsets[j], true, true, true);
				variant.path = path.join(set.path, set.subsetvariants[i].name);
				mkdir(variant.path);
				copySetAttributes(variant, set.subsetvariants[i], false, false, true);
				copySetAttributes(variant, set, false, false, false);
				createSet(variant);
			}
			tree.pop();
			if(set.subsetvariants.length > 1 || set.subsetvariants[0].name !== "")
				tree.pop();
		}
	}
}

function createSymbols(set) {
	if(set.symbols === undefined)
		return;
	tree.push(false);
	for(var x = 0; x < set.symbols.length; x++) {
		tree[tree.length - 1] = x != set.symbols.length - 1;
		var symbol = {};
		copySetAttributes(symbol, set.symbols[x], false, false, false);
		copySetAttributes(symbol, set, false, false, false);
		if(symbol.template === undefined) {
			println(RED + "No Template set for '" + RST + symbol.filename + RED + "'!" + RST);
			continue;
		}
		var template = fs.readFileSync(path.join(__dirname, "templates", symbol.template), { encoding: "utf8" });
		template = Handlebars.compile(template);
		createSymbol(template, symbol);
	}
	tree.pop();
}

function createSymbol(template, symbol) {
	if(symbol.filename === undefined) {
		println("Filename not set.");
		return;
	}
	var symbolPath = path.join(symbol.path, symbol.filename);
	var svgPath = path.join("/" + SVGPath + "/", symbolPath + ".svg")
	println("  \t" + CYN + symbol.filename + ".svg" + RST + makeAttrString(symbol) + DIM + "; ~" + svgPath + RST + " …");
	svgPath = path.join(__dirname, svgPath);
	
	if(true) {
		var compiled_symbol = template(symbol);
		compiled_symbol = compiled_symbol.replace(/^\s*[\r\n]/gm, "");
		fs.writeFileSync(svgPath, compiled_symbol);
	}
	
	if(pngSizes.length > 0) {
		var pngJobs = [];
		for(var i = 0; i < pngSizes.length; i++)
		{
			var pngSize = pngSizes[i];
			var pngPath = path.join("/" + pngSize + "/", symbolPath + ".png");
			println("  \t" + CYN + symbol.filename + ".png" + RST + DIM + "; ~" + pngPath + RST + " …")
			pngPath = path.join(__dirname, pngPath);
			pngJobs.push({
				svgFile: svgPath,
				pngFile: pngPath,
				size: pngSize
			});
		}
		async.each(pngJobs, renderImg);
	}
	generated++;
}