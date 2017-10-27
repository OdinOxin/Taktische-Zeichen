var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;
var spawnSync = require('child_process').spawnSync;

var async = require('async');

var Handlebars = require('handlebars');

var action = "create-svgs"
var config = JSON.parse(fs.readFileSync(process.argv[2]));

if(process.argv.length == 4) {
	action = process.argv[3];
}

switch(action) {
	case "create-svgs":
		createSVGs();
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

function createSVGs() {
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

	console.log("Creating " + config.sets.length + " SVG-Set(s)...");
	for(var i = 0; i < config.sets.length; i++) {
		var set = config.sets[i];
		set.path = path.join(__dirname, 'symbols');
		createSVGSet(set);
	}
}

function copySetAttributes(src, dest) {
	for(var key in src) {
		if(key === "subsets" || key === "symbols") {
			continue;
		}
		if(key === "attr" && dest[key] !== undefined) {
			for(var item in src[key])
				dest[key].push(src[key][item]);
			continue;
		}
		if(dest[key] === undefined) // If not already specialized in child...
			dest[key] = src[key]; // ... extend from parent
	}
}

function createSVGSet(set) {
	console.log("Creating SVG Set: '" + set.name + "'...");
	
	set.path = path.join(set.path, set.name);
	if(!fs.existsSync(set.path)) {
		fs.mkdirSync(set.path);
	}

	createSymbols(set);
	if(set.subsets !== undefined)
		for(var i = 0; i < set.subsets.length; i++) {
			var subset = set.subsets[i];
			copySetAttributes(set, subset);
			createSVGSet(subset);
		}
	console.log("Created SVG Set: '" + set.name + "'.");
}

function createSymbols(set) {
	if(set.symbols === undefined)
		return;
	
	console.log("Creating " + set.symbols.length + " symbol(s)...");
	for(var x = 0; x < set.symbols.length; x++) {
		var symbol = set.symbols[x];
		if(symbol.filename === undefined)
			continue;
		console.log((x+1) + ".\t" + symbol.filename);
		copySetAttributes(set, symbol);
		//console.log("\tSymbol (JSON): " + JSON.stringify(symbol));
		
		if(symbol.template === undefined) {
			console.log("\tNo Template set for " + symbol.filename);
			continue;
		}
		console.log("\tTemplate: " + symbol.template);
		console.log("\tAttributes: " + symbol.attr);

		var template = fs.readFileSync(path.join(__dirname, "templates", symbol.template), { encoding: "utf8" });
		template = Handlebars.compile(template);

		if(symbol.variantmatrix !== undefined) {
			var indices = [];
			for(var i = 0; i < symbol.variantmatrix.length; i++)
				indices.push(0);
			rek(template, symbol, symbol, indices, 0);
		}
		else
			createVariant(template, symbol);
	}
}

function rek(template, symbol, inputSymbol, indices, i) {
	for(indices[i] = 0; indices[i] < symbol.variantmatrix[i].variants.length; indices[i]++) {
		var tmpSymbol = {};
		copySetAttributes(symbol.variantmatrix[i].variants[indices[i]], tmpSymbol);
		copySetAttributes(inputSymbol, tmpSymbol);
		if(i < indices.length - 1) {
			if(symbol.variantmatrix[i].variants[indices[i]].name !== "") {
				tmpSymbol.path = path.join(tmpSymbol.path, symbol.variantmatrix[i].variants[indices[i]].name);
				if(!fs.existsSync(tmpSymbol.path)) {
					fs.mkdirSync(tmpSymbol.path);
				}
			}
			rek(template, symbol, tmpSymbol, indices, i+1);
		}
		else {
			if(symbol.variantmatrix[i].variants[indices[i]].name !== "")
				tmpSymbol.filename += "_" + symbol.variantmatrix[i].variants[indices[i]].name;
			createVariant(template, tmpSymbol);
		}
	}
}

function createVariant(template, symbol) {
	console.log("\tGenerating symbol (variant): '" + symbol.filename + ".svg'...");
	var compiled_symbol = template(symbol);
	compiled_symbol = compiled_symbol.replace(/^\s*[\r\n]/gm, "");
	//var finalPath = path.join(__dirname, "symbols");
	var finalPath = symbol.path;
	fs.writeFileSync(path.join(finalPath, symbol.filename + ".svg"), compiled_symbol);
}