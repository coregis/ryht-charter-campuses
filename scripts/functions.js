// functions.js defines functions that will be called later


// global variable for the path to the historical districts data file
var districtsFile = 'data/qrySumStatsAllDistAllYears_v2.csv';
var chartersFile  = 'data/qrySumStatsAllCharterDistAllYears_v1.csv';

// mappings of field names in the CSV & mapbox account to variable names for local use.  Update references here to follow any field renaming in the data sources; add items using the same basic structure to add options.
var fieldMappings = {
	totalStudents: {
		mapboxVarName: 'CPETALLC', // field name in Mapbox
		csvVarName: 'SumOfCPETALLC', // field name in the CSV
		popupLabel: 'Total Students', // label to use in popups
		selectorLabel: 'charter school students', // label to use in variable selector dropdown; things like "# of" and "% of" will be prepended as appropriate
		chartLabel: 'charter students', // label to use on the chart itself
		tickFormat: '~s' // Y axis tick format for this variable; see https://github.com/d3/d3-format#locale_format for tick format strings
	},
	disadvantagedStudents: {
		mapboxVarName: 'CPETECOC',
		csvVarName: 'SumOfCPETECOPNUM',
		popupLabel: 'Economically Disadvantaged Students',
		selectorLabel: 'economically disadvantaged students',
		chartLabel: 'disadvantaged',
		tickFormat: '~s',
		ratioBase: 'totalStudents' // IFF this attribute is defined, then also calculate the ratio of this variable to the base and make that available in the chart as a percentage
	},
	ellStudents: {
		mapboxVarName: 'CPETLEPC',
		csvVarName: 'SumOfCPETLEPC',
		popupLabel: 'English Learners Students',
		selectorLabel: 'English learners students',
		chartLabel: 'English learners',
		tickFormat: '~s',
		ratioBase: 'totalStudents'
	},
	bleStudents: {
		mapboxVarName: 'CPETBILC',
		csvVarName: 'SumOfCPETBILC',
		popupLabel: 'Bilingual Education Students',
		selectorLabel: 'bilingual education students',
		chartLabel: 'bilingual education',
		tickFormat: '~s',
		ratioBase: 'totalStudents'
	},
	seStudents: {
		mapboxVarName: 'CPETSPEC',
		csvVarName: 'SumOfCPETSPEC',
		popupLabel: 'Special Education Students',
		selectorLabel: 'special education students',
		chartLabel: 'special education',
		tickFormat: '~s',
		ratioBase: 'totalStudents'
	},
	rating: {
		mapboxVarName: 'C_RATING_F',
		popupLabel: 'Rating' // other attributes left out for this one because being non-numeric it can't be used for the chart
	},
	campuses: {
		csvVarName: 'CountOfCAMPNAME',
		selectorLabel: 'charter school campuses',
		chartLabel: 'charter campuses',
		tickFormat: '1' // other attributes left out for this one because it only makes sense as an aggregate, so won't be displayed in popups
	}
}

// list of fields to expand in map popups, _in display order_
var popupFields = [
	'totalStudents',
	'disadvantagedStudents',
	'ellStudents',
	'bleStudents',
	'seStudents',
	'rating'
];

// list of fields to make available for the chart, _in dropdown order_
var chartFields = [
	'campuses',
	'totalStudents',
	'disadvantagedStudents',
	'ellStudents',
	'bleStudents',
	'seStudents'
];

// data structure to hold state for the chart; the actual data will be attached on load, and the leftField and rightField values specify the default variables
var chartData = {
	svgID: 'chart',
	visible: true,
	title: 'All charter schools in Texas',
	districtName: 'Statewide',
	leftField: fieldMappings.campuses,
	leftColor: '#ee5e2a',
	rightField: fieldMappings.totalStudents,
	rightColor: '#2DC4B2',
	showRatio: {
		leftField: false,
		rightField: false
	}
};

// same for filter states so we can filter by year and/or districts
var filterStates = {
	year: false,
	district: false
};

// data structure to hold a list of districts and their bounding boxes.  Format for each entry is:
// 'Name': 'W,N,E,S,Name'  // WNES being how Mapbox gives us bboxes, and the name repetition being what we feed to the chart updater
// and individual districts' values will be auto-populated from data
var districts = {
	'Statewide': '-108,25,-88,37,Statewide'
};

// now let's give "Statewide" some synonyms for usability
districts['Texas'] = districts['Statewide'];
districts['All'] = districts['Statewide'];
districts['zoom out'] = districts['Statewide'];
districts[''] = districts['Statewide'];

// same as districts, but for the charter companies
var charters = {};
charters['All'] = districts['Statewide'];
charters[''] = charters['All'];
charters['select all'] = charters['All'];

// global variable for whether the animation should be playing or not
var animationRunning = false;

// a little state storage for popups
var popupState = {};

// dynamically size the 3 core elements of the page relative to each other
function allocateScreenSpace() {
	var viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
	var viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
	// adjust text size + spacing for sidenav
	console.log(document.getElementById('console'));
	console.log(document.getElementById('console').offsetHeight);
	console.log(document.getElementById('console').style.height);
	var sidenav = document.getElementById('mySidenav');
	sidenav.style.height = viewportHeight - document.getElementById('console').offsetHeight;
	console.log(viewportWidth, viewportHeight);
	if (viewportHeight > 840) {
		sidenav.classList.add('tallpage');
		sidenav.classList.remove('shortpage');
	}
	else if (viewportHeight < 700) {
		sidenav.classList.remove('tallpage');
		sidenav.classList.add('shortpage');
	} else {
		sidenav.classList.remove('tallpage');
		sidenav.classList.remove('shortpage');
	}
	var sidenavWidth = Math.max(sidenav.clientWidth, sidenav.innerWidth || 0);
	var activeControlDiv = document.getElementById(
		(chartData.visible ? 'chart-controls' : 'chart-open-link')
	);
	var hiddenControlDiv = document.getElementById(
		(chartData.visible ? 'chart-open-link' : 'chart-controls' )
	);
	activeControlDiv.style.display = 'block';
	hiddenControlDiv.style.display = 'none';
	var activeControlStyle = (activeControlDiv.currentStyle || window.getComputedStyle(activeControlDiv));
	var activeControlPadding = [
		parseInt(activeControlStyle.paddingLeft, 10) + parseInt(activeControlStyle.paddingRight, 10),
		parseInt(activeControlStyle.paddingTop, 10) + parseInt(activeControlStyle.paddingBottom, 10)
	];
	var controlsHeight = activeControlDiv.offsetHeight;
	var svgWidth = viewportWidth - sidenavWidth;
	var svgHeight = (chartData.visible ? Math.max((viewportHeight / 4), 250) - activeControlPadding[1] : 0);
	var svg = document.getElementById(chartData.svgID);
	svg.style.width = svgWidth;
	svg.style.height = svgHeight;
	svg.style.bottom = controlsHeight;
	activeControlDiv.style.width = svgWidth - activeControlPadding[0];
	var mapDiv = document.getElementById("map");
	mapDiv.style.height = viewportHeight - svgHeight - controlsHeight;
	mapDiv.style.width = viewportWidth - sidenavWidth;
	return [svgWidth, svgHeight];
}

//Adding showHide functionality from legislative map to this map
function showHideLayer(layerName, markerName, showOnly=false, hideOnly=false) {
	var visibility = map.getLayoutProperty(layerName, 'visibility');
	if ((visibility === 'visible' || hideOnly) && !showOnly) {
		map.setLayoutProperty(layerName, 'visibility', 'none');
		this.className = '';
		if (markerName !== '') {
			document.getElementById(markerName).classList.add('inactive');
		}
	} else {
		this.className = 'active';
		map.setLayoutProperty(layerName, 'visibility', 'visible');
		if (markerName !== '') {
			document.getElementById(markerName).classList.remove('inactive');
		}
	}
}

// Update the year slider and corresponding map filter
function updateYearSlider(numberID, year) {
	filterStates.year = parseInt(year, 10);
	setFilter('campuses');
	// update text in the UI
	document.getElementById(numberID).innerText = year;
}

// apply map filters persistently
function setFilter(sourceID) {
	if (filterStates.year && filterStates.district) {
		map.setFilter(
			sourceID,
			['all',
				['==', ['number', ['get', 'year']], filterStates.year],
				['==', ['string', ['get', filterStates.district.field]], filterStates.district.val]
			]
		);
	} else if (filterStates.year) {
		map.setFilter(
			sourceID,
			['==', ['number', ['get', 'year']], filterStates.year]
		);
	} else {
		console.log('something`s wrong, there should never be no year filter', filterStates);
	}
}


//These are the four functions written by Eldan that power the zoom-to-district feature
// runWhenLoadComplete() checks if the map has finished loading data, and once it has then it calls the next one.
//populateZoomControl() fills the dropdowns with options generated from reading the data layers for all the district names.
//getIDsList() does the actual work of fetching the district names
//zoomToPolygon() zooms the map to the district extent

function runWhenLoadComplete() {
	if (!map.loaded() || !map.getLayer('texas-school-districts-poly')) {
		setTimeout(runWhenLoadComplete, 100);
	}
	else {
		// make sure we really have enough space for Texas
		map.fitBounds([
			[-107, 25.25], // southwest coords
			[-93.25, 36.75] // northeast coords, exaggerated somewhat towards the NE to make the state appear more visually centred
		]);
		moveYearSlider('slider', 'active-year', 0); // calling this with a 0 increment will make sure that the filter, caption and slider position all match.  Without doing this, the browser seems to keep the slider position between refreshes, but reset the filter and caption so they get out of sync.
		populateZoomControl("school-districts-control", "texas-school-districts", "NAME", "Texas School Districts", districts, districts.Statewide);
		populateZoomControl("charter-filter-control", "texas-charter-companies", "ref_distnm", "All charter schools", charters, charters.All);
		map.moveLayer('texas-school-districts-lines', 'country-label-sm');
		map.moveLayer('texas-school-districts-poly', 'texas-school-districts-lines');
		for (i=0; i < loadedLineLayers.length; i++) {
			if (loadedLineLayers[i][1] !== "texas_school_districts") {
				map.moveLayer(loadedLineLayers[i][0], 'texas-school-districts-poly');
			}
		}
		// start the autocompletion event loop
		autocomplete(document.getElementById('districtAutocomplete'), districts, "campuses", false);
		autocomplete(document.getElementById('charterAutocomplete'), charters, "campuses", 'ref_distnm');
	}
}

function populateZoomControl(selectID, sourceID, fieldName, layerName, globalDataStruct, defaultVal) {
	polygons = getPolygons(sourceID, fieldName);
	var select = document.getElementById(selectID);
	select.options[0] = new Option(layerName, defaultVal + ",Statewide");
	for (i in polygons) {
		payload = polygons[i].bbox.toString() + ',' + polygons[i].name;
		select.options[select.options.length] = new Option(
			polygons[i].name, payload
		);
		globalDataStruct[polygons[i].name] = payload;
	}
	map.setLayoutProperty(sourceID + '-poly', 'visibility', 'none');
// IMPORTANT: these paint properties define the appearance of the mask layer that deemphasises districts outside the one we've zoomed to.  They will overrule anything that's set when that mask layer was loaded.
	map.setPaintProperty(sourceID + '-poly', 'fill-color', 'rgba(200, 200, 200, 0.5)');
	map.setPaintProperty(sourceID + '-lines', 'line-color', 'rgba(50, 50, 50, .7)');
}

function getPolygons(sourceID, nameField) {
	layerID = map.getSource(sourceID).vectorLayerIds[0];
	features = map.querySourceFeatures(sourceID, {'sourceLayer': layerID});
	polygons = [];
	existingItems = [];
	for (i in features) {
		existing = existingItems.indexOf(features[i].properties[nameField]);
		if (existing > -1) {
			polygons[existing].bbox = getFeatureBounds(
				features[i].toJSON().geometry.coordinates,
				polygons[existing].bbox
			);
		}
		else {
			existingItems.push(features[i].properties[nameField]);
			polygons.push({
				name: features[i].properties[nameField],
				bbox: getFeatureBounds(features[i].toJSON().geometry.coordinates)
			});
		}
	}
	polygons.sort(function(a, b){
		var x = a.name.toLowerCase();
		var y = b.name.toLowerCase();
		if (x < y) {return -1;}
		if (x > y) {return 1;}
		return 0;
	});
	return polygons;
}

function getFeatureBounds(coords, startingBBOX) {
	if (startingBBOX === undefined) {
		minX = 180;
		maxX = -180;
		minY = 90;
		maxY = -90;
	}
	else {
		minX = startingBBOX[0][0];
		maxX = startingBBOX[1][0];
		minY = startingBBOX[0][1];
		maxY = startingBBOX[1][1];
	}
	for (i in coords) {
		// coords may be a simple array of coords, or an array of arrays if it's a multipolygon
		for (j in coords[i]) {
			if (!(coords[i][j][0] instanceof Array)) {
				if (coords[i][j][0] < minX) { minX = coords[i][j][0]; }
				if (coords[i][j][0] > maxX) { maxX = coords[i][j][0]; }
				if (coords[i][j][1] < minY) { minY = coords[i][j][1]; }
				if (coords[i][j][1] > maxY) { maxY = coords[i][j][1]; }
			}
			else {
				for (k in coords[i][j]) {
					if (coords[i][j][k][0] < minX) { minX = coords[i][j][k][0]; }
					if (coords[i][j][k][0] > maxX) { maxX = coords[i][j][k][0]; }
					if (coords[i][j][k][1] < minY) { minY = coords[i][j][k][1]; }
					if (coords[i][j][k][1] > maxY) { maxY = coords[i][j][k][1]; }
				}
			}
		}
	}
	return [[minX, minY], [maxX, maxY]];
}

function zoomToPolygon(sourceID, coords, filterField) {
	if (typeof coords !== 'undefined') {
		// first sync the dropdowns to reflect this selection
		var dropdowns = document.getElementsByClassName('dropdown');
		for (var i=0; i < dropdowns.length; i++) {
			var el = dropdowns[i];
			el.selectedIndex = 0;
			for (var j=0; j < el.options.length; j++) {
				if (el.options[j].value == coords) {
					el.selectedIndex = j;
				}
			}
		}
		// then parse coords to use the individual elements of it
		coords = coords.split(",");
		bbox = [
			[coords[0], coords[1]],
			[coords[2], coords[3]]
		];
		map.fitBounds(bbox, options={padding: 10, duration: 5000});
		if (coords[4] === "Statewide" || filterField) { // if we're zooming out to the whole state again, or zooming to a charter district which has no boundary image
			showHideLayer('texas-school-districts-poly', markerName='', showOnly=false, hideOnly=true);
			showHideLayer('texas-school-districts-lines', markerName='', showOnly=false, hideOnly=true);
		} else {
			showHideLayer('texas-school-districts-poly', markerName='', showOnly=true);
			showHideLayer('texas-school-districts-lines', markerName='', showOnly=true);
			map.setFilter(
				'texas-school-districts-poly',
				['!=', 'NAME', coords[4]]
			);
		}
		// and filter by charter if appropriate, or remove the filter otherwise, and set an appropriate chart title
		if (filterField && coords[4] !== 'Statewide') {
			filterStates.district = {
				'field': filterField,
				'val':   coords[4]
			};
			setFilter(sourceID);
			chartData.title = coords[4];
		} else {
			filterStates.district = false;
			setFilter(sourceID);
			chartData.title = 'Charter schools located within ' + coords[4];
		}
		// while the zoom goes, update the chart
		chartData.districtName = coords[4];
		redrawChart();
	}
}

// the following functions are to automate control over the time slider
function moveYearSlider(sliderID, numberID, increment, loop=false) {
	slider = document.getElementById(sliderID);
	minYear = parseInt(slider.min, 10);
	currentYear = parseInt(slider.value, 10);
	maxYear = parseInt(slider.max, 10);

	desiredYear = currentYear + increment;

	if (loop) { // if we're looping then wrap any overflow around
		if (desiredYear > maxYear) {desiredYear = minYear;}
		else if (desiredYear < minYear) {desiredYear = maxYear;}
	}
	else { // if not looping then keep changes within the min/max bounds
		if ((desiredYear > maxYear) || (desiredYear < minYear)) {
			desiredYear = currentYear;
			console.log('Hacking too much time');
		}
	}

	slider.value = desiredYear;
	updateYearSlider(numberID, desiredYear);
	popups = document.getElementsByClassName('popup-text-holder');
	if (popups.length > 0) {
		data = pickFeature(popupState.campusID, desiredYear, 'points');
		if (data === undefined) {
			console.log("Removing popup because campus " + popupState.campusID + " didn't exist in " + desiredYear);
			popupState.popup.remove();
		} else {
			popups[0].innerHTML = fillpopup(data);
		}
	}
}

function animateYearSlider(sliderID, numberID, delay) {
	if (animationRunning) {
		moveYearSlider(sliderID, numberID, 1, loop=true);
		setTimeout(
			function() {animateYearSlider(sliderID, numberID, delay)},
			delay
		);
	}
}

function startYearAnimation(sliderID, numberID, delay, playID, stopID) {
	animationRunning = true;
	document.getElementById(playID).style.display = 'none';
	document.getElementById(stopID).style.display = 'inline';
	animateYearSlider(sliderID, numberID, delay);
}

function stopYearAnimation(playID, stopID) {
	animationRunning = false;
	document.getElementById(playID).style.display = 'inline';
	document.getElementById(stopID).style.display = 'none';
}

// now draw the time series chart
function populateChartControls() {
	var leftControl = document.getElementById('left-axis-selector');
	var rightControl = document.getElementById('right-axis-selector');
	for (i in chartFields) {
		baseLabel = fieldMappings[chartFields[i]].selectorLabel;
		fieldName = chartFields[i]
		leftControl.options[leftControl.options.length] = new Option(
			"Number of " + baseLabel,
			"abs," + fieldName
		);
		rightControl.options[rightControl.options.length] = new Option(
			"Number of " + baseLabel,
			"abs," + fieldName
		);
		if (fieldMappings[chartFields[i]].hasOwnProperty('ratioBase')) {
			leftControl.options[leftControl.options.length] = new Option(
				"% " + baseLabel,
				"pct," + fieldName
			);
			rightControl.options[rightControl.options.length] = new Option(
				"% " + baseLabel,
				"pct," + fieldName
			);
		}
	}
}

function unspoolOneDistrict() {
	var data = chartData.dataset[chartData.districtName];
	var arr = [];
	for (i in data) {
		arr.push({
			year: i,
			valueLeft: data[i][chartData.leftField.csvVarName][(chartData.showRatio.leftField ? 'pct' : 'abs')],
			valueRight: data[i][chartData.rightField.csvVarName][(chartData.showRatio.rightField ? 'pct' : 'abs')]
		});
	}
	return arr;
}

function drawChart() {
	if (chartData.visible) {
		//  hide the reset chart link if we're showing statewide data
		document.getElementById('chart-reset-link').style.display = ((chartData.districtName === 'Statewide') ? 'none' : 'inline');
		// set up the sizing of everything
		var svgDims = allocateScreenSpace();
		var svgWidth = svgDims[0];
		var svgHeight = svgDims[1];
		var margin = { top: 35, right: 80, bottom: 28, left: 80 };
		var width = svgWidth - margin.left - margin.right;
		var height = svgHeight - margin.top - margin.bottom;
		// standard d3 elements setup
		svg = d3.select('#' + chartData.svgID);
		var g = svg.append("g").attr(
			"transform", "translate(" + margin.left + "," + margin.top + ")"
		);
		// parse the data
		data = unspoolOneDistrict();
		// if we get no data, then revert to statewide
		if (data.length === 0) {
			console.log("Reverting chart to statewide because there's no data for", chartData.districtName);
			var selectedDistrict = chartData.districtName;
			chartData.districtName = "Statewide";
			data = unspoolOneDistrict();
			g.append("text")
				.attr("id", "chart-subtitle")
				.attr("x", 0).attr("dx", "1em").attr("y", 0)
				.attr("text-anchor", "start")
				.text("Showing statewide data because");
			g.append("text")
				.attr("id", "chart-subtitle")
				.attr("x", 0).attr("dx", "1em").attr("y", 0).attr("dy", "2.5ex")
				.attr("text-anchor", "start")
				.text(selectedDistrict);
			g.append("text")
				.attr("id", "chart-subtitle")
				.attr("x", 0).attr("dx", "1em").attr("y", 0).attr("dy", "5ex")
				.attr("text-anchor", "start")
				.text("has no charter campuses");
		}
		// add a chart title and Y axis labels
		g.append("text")
			.attr("id", "chart-title")
			.attr("x", (width/2)).attr("y", (-margin.top/4))
			.attr("text-anchor", "middle")
			.text((chartData.districtName === "Statewide" ? "All charter schools in Texas" : chartData.title));
		g.append("text")
			.attr("id", "left-axis-label")
			.attr("fill", chartData.leftColor)
			.attr("y", 10-margin.left).attr("dy", "1ex")
			.attr("text-anchor", "end")
			.text((chartData.showRatio.leftField ? "% " : "# ") + chartData.leftField.chartLabel);
		g.append("text")
			.attr("id", "right-axis-label")
			.attr("fill", chartData.rightColor)
			.attr("y", width+margin.right-10)
			.attr("text-anchor", "end")
			.text((chartData.showRatio.rightField ? "% " : "# ") + chartData.rightField.chartLabel);
		// set up scales and add axes
		var x = d3.scaleLinear().rangeRound([0, width]);
		var yLeft = d3.scaleLinear().rangeRound([height, 0]);
		var yRight = d3.scaleLinear().rangeRound([height, 0]);
		yLeftMax = d3.max(data, function(d) { return d.valueLeft });
		yRightMax = d3.max(data, function(d) { return d.valueRight });
		xMin = d3.min(data, function(d) { return d.year });
		xMax = d3.max(data, function(d) { return d.year });
		x.domain([xMin, xMax]);
		yLeft.domain([0, yLeftMax]);
		yRight.domain([0, yRightMax]);
		g.append("g")
			.attr("transform", "translate(0," + height + ")")
			.call(
				d3.axisBottom(x)
				.ticks(Math.min((xMax - xMin), width / 50))
				.tickFormat(d3.format("1000"))
			);
		g.append("g")
			.call(
				d3.axisLeft(yLeft)
					.ticks(
						(chartData.showRatio.leftField ? 5 : Math.min(height / 25, yLeftMax))
					)
					.tickFormat(d3.format(
						(chartData.showRatio.leftField ? '~%' : chartData.leftField.tickFormat)
					))
			)
			.attr("stroke", chartData.leftColor);
		g.append("g")
			.attr("transform", "translate( " + width + ", 0 )")
			.call(
				d3.axisRight(yRight)
					.ticks(
						(chartData.showRatio.rightField ? 5 : Math.min(height / 25, yRightMax))
					)
					.tickFormat(d3.format(
						(chartData.showRatio.rightField ? '~%' : chartData.rightField.tickFormat)
					))
			)
			.attr("stroke", chartData.rightColor);
		// add the actual data
		var leftLine = d3.line()
			.x(function(d) { return x(d.year)})
			.y(function(d) { return yLeft(d.valueLeft)});
		g.append("path")
			.datum(data)
				.attr("fill", "none").attr("stroke-width", 4)
				.attr("stroke", chartData.leftColor)
				.attr("stroke-linejoin", "round").attr("stroke-linecap", "round")
				.attr("d", leftLine);
		var rightLine = d3.line()
			.x(function(d) { return x(d.year)})
			.y(function(d) { return yRight(d.valueRight)});
		g.append("path")
			.datum(data)
				.attr("fill", "none").attr("stroke-width", 4)
				.attr("stroke", chartData.rightColor)
				.attr("stroke-linejoin", "round").attr("stroke-linecap", "round")
				.attr("d", rightLine);
	} else { // if we're not drawing the chart, still call this function to keep everything laid out nicely
		allocateScreenSpace();
	}
}

// this will be called on resizing the window or changing any chart attributes; it simply resets the chart because that's the easiest way to keep it scaled correctly
function redrawChart(axis, params) {
	if (params !== undefined) {
		params = params.split(',');
		if (params.length > 1) {
			chartData[axis] = fieldMappings[params[1]];
			if (params[0] === 'pct') {
				chartData.showRatio[axis] = true;
			} else {
				chartData.showRatio[axis] = false;
			}
		}
	}
	var svg = d3.select('#' + chartData.svgID);
	svg.select("g").remove();
	drawChart();
	map.resize();
}

function showChart() {
	chartData.visible = true;
	redrawChart();
}

function hideChart() {
	chartData.visible = false;
	redrawChart();
}

function resetChart() {
	chartData.districtName = 'Statewide';
	redrawChart();
}




// functions to add data to the map and toggle its visibility
function addPointLayer(map, params) {
	gus_api(params.gusID, function(jsondata) {
		var visibilityState = setVisibilityState(params);
		if (params.scalingFactor === undefined) { params.scalingFactor = 2.5; }
		map.addSource(params.sourceName, {
			type: 'geojson',
			data: jsondata
		});
		map.addLayer({
			'id': params.layerName,
			'type': 'symbol',
			'source': params.sourceName,
			'layout': {
				'icon-image': params.icon,
				'icon-size': params.iconSize,
				'icon-allow-overlap': true,
				'visibility': visibilityState
			}
		});
		map.on("zoomend", function(){
			map.setLayoutProperty(params.layerName, 'icon-size', (1 + (map.getZoom() / originalZoomLevel - 1) * params.scalingFactor) * params.iconSize);
		});
	});
}

function addVectorLayer(map, params) {
	var visibilityState = setVisibilityState(params);
	map.addSource(params.sourceName, {
		type: 'vector',
		url: params.sourceURL
	});
	if ((params.lineLayerName !== undefined) && (params.lineLayerName !== false)) {
		map.addLayer(
			{
				'id': params.lineLayerName,
				'type': 'line',
				'source': params.sourceName,
				'source-layer': params.sourceID,
				'layout': {
					'visibility': visibilityState,
					'line-join': 'round',
					'line-cap': 'round'
				},
				'paint': {
					'line-color': params.lineColor,
					'line-width': 1
				},
			},
			params.displayBehind
		);
		if (params.legendID !== undefined) {
			loadedLineLayers.push([params.lineLayerName, params.legendID]);
		}
	}
	if ((params.polygonLayerName !== undefined) && (params.polygonLayerName !== false)) {
		if (params.usedInZoomControl) { visibilityState = 'visible'; }
		map.addLayer(
			{
				'id': params.polygonLayerName,
				'type': 'fill',
				'source': params.sourceName,
				'source-layer': params.sourceID,
				'layout': {
					'visibility': visibilityState
				},
				'paint': {
					'fill-color': params.polygonFillColor,
					'fill-outline-color': params.polygonOutlineColor
				},
			}
		);
		if (params.legendID !== undefined) {
			loadedPolygonLayers.push([params.polygonLayerName, params.legendID]);
		}
	}
}

function setVisibilityState(params) {
	if ((params.visibleOnLoad === undefined) || (params.visibleOnLoad === false)) {
		return 'none';
	} else {
		return 'visible';
	}
}





function pickFeature(campusID, year, sourceID) {
	var year = parseInt(document.getElementById('active-year').innerText, 10);
	var sourceID = 'points';

	var layerID = map.getSource(sourceID).vectorLayerIds[0];
	var features = map.querySourceFeatures(sourceID, {'sourceLayer': layerID});
	for (i in features) {
		if (features[i].properties.CAMPUS === campusID && features[i].properties.year === year) {
			return features[i].properties;
		}
	}
}





// process some Mapbox data to make inner text for a popup
function popupRow(varName, data) {
	var html = "<br /><span class='varname'>";
	html += fieldMappings[varName].popupLabel;
	html += ": </span> <span class='attribute'>"
	html += data[fieldMappings[varName].mapboxVarName];
	html += "</span>";
	return html
}

function fillpopup(data){
	var html = "<span class='popup-text-holder'>";
	html += "<span class='varname'>Campus: </span> <span class='attribute'>" + data.CAMPNAME + "</span>";
	html += "<br>"
	html += "<span class='varname'>Year: </span> <span class='attribute'>" + data.year + "</span>";
	html += "<br>"
	html += "<span class='varname'>Located Within: </span> <span class='attribute'>" + data.NAME + "</span>";
	for (i in popupFields) { html += popupRow(popupFields[i], data); }
	html += "</span>";
	return html;
	//this will return the string to the calling function
}



var autocompleteEntries = {};
// text box autocompletion functions adapted from https://www.w3schools.com/howto/howto_js_autocomplete.asp
function autocomplete(inp, obj, sourceID, filterField) {
	autocompleteEntries[inp.id] = Object.keys(obj);
	var currentFocus;
	/*execute a function when someone writes in the text field:*/
	inp.addEventListener("input", function(e) {
		var a, b, i, val = this.value;
		/*close any already open lists of autocompleted values*/
		closeAllLists(this);
		if (!val) { return false;}
		currentFocus = -1;
		/*create a DIV element that will contain the items (values):*/
		a = document.createElement("div");
		a.setAttribute("id", this.id + "autocomplete-list");
		a.setAttribute("class", "autocomplete-items");
		/*append the DIV element as a child of the autocomplete container:*/
		this.parentNode.appendChild(a);
		/*for each item in the array...*/
		for (i = 0; i < autocompleteEntries[this.id].length; i++) {
			/*check if the item starts with the same letters as the text field value:*/
			if (autocompleteEntries[this.id][i].substr(0, val.length).toUpperCase() == val.toUpperCase()) {
				/*create a DIV element for each matching element:*/
				b = document.createElement("div");
				/*make the matching letters bold:*/
				b.innerHTML = "<strong>" + autocompleteEntries[this.id][i].substr(0, val.length) + "</strong>";
				b.innerHTML += autocompleteEntries[this.id][i].substr(val.length);
				/*insert a input field that will hold the current array item's value:*/
				b.innerHTML += "<input type='hidden' value='" + autocompleteEntries[this.id][i] + "'>";
				/*execute a function when someone clicks on the item value (DIV element):*/
					b.addEventListener("click", function(e) {
					/*insert the value for the autocomplete text field:*/
					inp.value = this.getElementsByTagName("input")[0].value;
					// zoom to it
					zoomToPolygon(sourceID, obj[inp.value], filterField);
					/*close the list of autocompleted values,
					(or any other open lists of autocompleted values:*/
					closeAllLists();
				});
				a.appendChild(b);
			}
		}
	});
	/*execute a function presses a key on the keyboard:*/
	inp.addEventListener("keydown", function(e) {
		var x = document.getElementById(this.id + "autocomplete-list");
		if (x) x = x.getElementsByTagName("div");
		if (e.keyCode == 40) {
			/*If the arrow DOWN key is pressed, increase the currentFocus variable:*/
			currentFocus++;
			/*and and make the current item more visible:*/
			addActive(x);
		} else if (e.keyCode == 38) { //up
			/*If the arrow UP key is pressed, decrease the currentFocus variable:*/
			currentFocus--;
			/*and and make the current item more visible:*/
			addActive(x);
		} else if (e.keyCode == 13) {
			//If the ENTER key is pressed, and we have an active item, go to its district
			var active = document.getElementsByClassName('autocomplete-active');
			if (active.length > 0) {
				if (autocompleteEntries[this.id].indexOf(active[0].innerText) > -1) {
					zoomToPolygon(sourceID, obj[active[0].innerText], filterField);
					closeAllLists();
				}
			}
		}
	});
	function addActive(x) {
		if (!x) return false;
		if (currentFocus >= x.length) { // don't allow overflows, just leave it at the end of the list
			currentFocus = x.length - 1;
		} else if (currentFocus < 0) { // don't allow or wrap underflows, just clear the active one
			currentFocus = -1;
			removeActive(x);
		} else { // if we are in within range, move the focus
			removeActive(x);
			x[currentFocus].classList.add("autocomplete-active");
		}
	}
	function removeActive(x) {
		/*a function to remove the "active" class from all autocomplete items:*/
		for (var i = 0; i < x.length; i++) {
			x[i].classList.remove("autocomplete-active");
		}
	}
/*execute a function when someone clicks in the document:*/
	document.addEventListener("click", function (e) {
		closeAllLists(e.target);
	});
}



function closeAllLists(elmnt) {
	/*close all autocomplete lists in the document */
	var x = document.getElementsByClassName("autocomplete-items");
	for (var i = 0; i < x.length; i++) {
		if (elmnt != x[i]) {
			x[i].parentNode.removeChild(x[i]);
		}
	}
	// and blank the autocomplete boxes
	x = document.getElementsByClassName('autocompleteTextbox');
	for (var i = 0; i < x.length; i++) {
		if (elmnt != x[i]) {
			x[i].value = '';
		}
	}
}
