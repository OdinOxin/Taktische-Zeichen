var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;
var spawnSync = require('child_process').spawnSync;

var async = require('async');

var Handlebars = require('handlebars');

var action = "create-svgs"
var config = JSON.parse(fs.readFileSync(process.argv[2]));

var tree = [];

if(process.argv.length == 4) {
	action = process.argv[3];
}

switch(action) {
	case "create-svgs":
		createAllSets();
		break;
	case "render-all":
		renderAll();
		break;
}

function renderAll() {
	if (!fs.existsSync(path.join(__dirname, "128x128"))) {
		fs.mkdirSync(path.join(__dirname, "128x128"));
	}
	if (!fs.existsSync(path.join(__dirname, "256x256"))) {
		fs.mkdirSync(path.join(__dirname, "256x256"));
	}
	if (!fs.existsSync(path.join(__dirname, "512x512"))) {
		fs.mkdirSync(path.join(__dirname, "512x512"));
	}
	if (!fs.existsSync(path.join(__dirname, "1024x1024"))) {
		fs.mkdirSync(path.join(__dirname, "1024x1024"));
	}

	var jobs = [];


	for(var i = 0; i < config.sets.length; i++) {
		var set = config.sets[i];
		var data = set;

		if(!fs.existsSync(path.join(__dirname, '1024x1024', set.name))) {
			fs.mkdirSync(path.join(__dirname, '1024x1024', set.name));
		}
		if(!fs.existsSync(path.join(__dirname, '512x512', set.name))) {
			fs.mkdirSync(path.join(__dirname, '512x512', set.name));
		}
		if(!fs.existsSync(path.join(__dirname, '256x256', set.name))) {
			fs.mkdirSync(path.join(__dirname, '256x256', set.name));
		}
		if(!fs.existsSync(path.join(__dirname, '128x128', set.name))) {
			fs.mkdirSync(path.join(__dirname, '128x128', set.name));
		}

		for(var x = 0; x < set.symbols.length; x++) {
			var symbol = set.symbols[x];

			for(var variant in symbol.variants) {

				jobs.push({
					svgFile: path.join(__dirname, 'symbols', set.name, symbol.variants[variant] + ".svg"),
					pngFile: path.join(__dirname, '1024x1024', set.name, symbol.variants[variant] + ".png"),
					png512File: path.join(__dirname, '512x512', set.name, symbol.variants[variant] + ".png"),
					png256File: path.join(__dirname, '256x256', set.name, symbol.variants[variant] + ".png"),
					png128File: path.join(__dirname, '128x128', set.name, symbol.variants[variant] + ".png")
				});
			}
		}
	}

	async.eachLimit(jobs, 10, function(job, callback) {	
				console.log("Rendering " + job.svgFile + " -> " + job.pngFile);
				var render = spawn("wkhtmltoimage", ["--transparent", "--quality", "100", "--zoom", "4", "--crop-h", "1024", "--crop-w", "1024", job.svgFile, job.pngFile]);
				render.on('close', function(code) {
					
					console.log("Optimizing " + job.pngFile);
					spawnSync("optipng", [ job.pngFile ]);

					async.eachSeries([
						{ filename: job.png512File, factor: "50%" },
						{ filename: job.png256File, factor: "25%" },
						{ filename: job.png128File, factor: "12.5%" }
						],
						function(resizeJob, resizeFinished) {
							console.log("Resizing " + job.pngFile + " by " + resizeJob.factor + " to " + resizeJob.filename);
							var resize = spawn("magick", [ job.pngFile, "-resize", resizeJob.factor, resizeJob.filename ]);
							resize.on('close', function() {
								resizeFinished();
							});
					}, function() {
						async.eachSeries([
							{ filename: job.png512File },
							{ filename: job.png256File },
							{ filename: job.png128File }
							],
							function(optimizeJob, optimizeFinished) {
								console.log("Optimizing " + optimizeJob.filename);
								var optimize = spawn("optipng", [ optimizeJob.filename ]);
								optimize.on('close', function() {
									optimizeFinished();
								});
						}, function() {
							callback();
						});
					});
				});
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

function createAllSets() {
	if (!fs.existsSync(path.join(__dirname, "symbols"))) {
		fs.mkdirSync(path.join(__dirname, "symbols"));
	}

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

	console.log("\x1b[31mRoot\x1b[0m");
	tree.push(false);
	for(var i = 0; i < config.sets.length; i++) {
		tree[tree.length - 1] = i != config.sets.length - 1;
		var set = config.sets[i];
		set.path = path.join(__dirname, 'symbols');
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
		if(key === "attr" && dest[key] !== undefined) {
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
	println("\x1b[32m'" + set.name + "'\x1b[0m");
	
	set.path = path.join(set.path, set.name);
	if(!fs.existsSync(set.path)) {
		fs.mkdirSync(set.path);
	}
	
	createSymbols(set);
	if(set.subsets !== undefined) {
		if(set.subsetvariants === undefined)
			set.subsetvariants = [ { "name": "" } ];
		for(var i = 0; i < set.subsetvariants.length; i++) {
			if(set.subsetvariants.length > 1 || set.subsetvariants[0].name !== "") {
				tree.push(i != set.subsetvariants.length - 1);
				println("");
				println("\x1b[33m'" + set.subsetvariants[i].name + "'\x1b[0m");
			}
			tree.push(false);
			for(var j = 0; j < set.subsets.length; j++) {
				tree[tree.length - 1] = j != set.subsets.length - 1;
				var variant = {};
				copySetAttributes(variant, set.subsets[j], true, true, true);
				variant.path = path.join(set.path, set.subsetvariants[i].name);
				if(!fs.existsSync(variant.path)) {
					fs.mkdirSync(variant.path);
				}
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
			println("\x1b[31mNo Template set for '\x1b[0m" + symbol.filename + "\x1b[31m'!\x1b[0m");
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
	var finalPath = path.join(symbol.path, symbol.filename + ".svg");
	println("  \t\x1b[36m" + symbol.filename + ".svg\x1b[0m\x1b[2m  \tAttributes: [\x1b[0m " + symbol.attr + " \x1b[2m]; " + finalPath + "\x1b[0m …");
	var compiled_symbol = template(symbol);
	compiled_symbol = compiled_symbol.replace(/^\s*[\r\n]/gm, "");
	fs.writeFileSync(finalPath, compiled_symbol);
}