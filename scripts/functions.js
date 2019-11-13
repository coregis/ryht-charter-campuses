// functions.js defines functions that will be called later


// global variable for the path to the historical districts data file
var districtsFile = 'data/qrySumStatsAllDistAllYears.csv';
// data structure to hold state for the chart; the actual data will be attached on load
// see https://github.com/d3/d3-format#locale_format for tick format strings
var chartData = {
	svgID: 'chart',
	visible: true,
	districtName: 'Statewide',
	leftFieldName: 'campuses',
	leftFieldLabel: '# Charter campuses',
	leftColor: 'steelblue',
	leftTickFormat: '1',
	rightFieldName: 'students',
	rightFieldLabel: '# Charter students',
	rightColor: 'orange',
	rightTickFormat: '~s'
};

// global variable for whether the animation should be playing or not
var animationRunning = false;

// dynamically size the 3 core elements of the page relative to each other
function allocateScreenSpace() {
	var viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
	var viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
	var sidenavWidth = 300;
	var activeControlDiv = document.getElementById(
		(chartData.visible ? 'chart-controls' : 'chart-open-link')
	);
	var hiddenControlDiv = document.getElementById(
		(chartData.visible ? 'chart-open-link' : 'chart-controls' )
	);
	activeControlDiv.style.display = 'block';
	hiddenControlDiv.style.display = 'none';
	var activeControlStyle = (activeControlDiv.currentStyle || window.getComputedStyle(activeControlDiv));
	var activeControlPadding = parseInt(activeControlStyle.paddingTop, 10) + parseInt(activeControlStyle.paddingBottom, 10);
	var controlsWidth = activeControlDiv.offsetWidth;
	var svgWidth = viewportWidth - sidenavWidth - controlsWidth;
	var svgHeight = (chartData.visible ? Math.max((viewportHeight / 4), 250) : activeControlDiv.offsetHeight);
	var svg = document.getElementById(chartData.svgID);
	svg.style.width = svgWidth;
	svg.style.height = svgHeight;
	activeControlDiv.style.height = svgHeight - activeControlPadding;
	var mapDiv = document.getElementById("map");
	mapDiv.style.height = viewportHeight - svgHeight;
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
	map.setFilter('campuses', ['==', ['number', ['get', 'year']], parseInt(year, 10)]);
	// update text in the UI
	document.getElementById(numberID).innerText = year;
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
		populateZoomControl("school-districts-control", "texas-school-districts", "NAME", "Texas School Districts");
		map.moveLayer('texas-school-districts-lines', 'country-label-sm');
		map.moveLayer('texas-school-districts-poly', 'texas-school-districts-lines');
		for (i=0; i < loadedLineLayers.length; i++) {
			if (loadedLineLayers[i][1] !== "texas_school_districts") {
				map.moveLayer(loadedLineLayers[i][0], 'texas-school-districts-poly');
			}
		}
	}
}

function populateZoomControl(selectID, sourceID, fieldName, layerName) {
	polygons = getPolygons(sourceID, fieldName);
	var select = document.getElementById(selectID);
	select.options[0] = new Option(layerName, "-108,25,-88,37,Statewide");
	for (i in polygons) {
		select.options[select.options.length] = new Option(
			polygons[i].name,
			polygons[i].bbox.toString() + ',' + polygons[i].name
		);
	}
	map.setLayoutProperty(sourceID + '-poly', 'visibility', 'none');
// IMPORTANT: these paint properties define the appearance of the mask layer that deemphasises districts outside the one we've zoomed to.  They will overrule anything that's set when that mask layer was loaded.
	map.setPaintProperty(sourceID + '-poly', 'fill-color', 'rgba(200, 200, 200, 0.5)');
	map.setPaintProperty(sourceID + '-lines', 'line-color', 'rgba(50, 50, 50, .7)');
}

function getPolygons(sourceID, nameField) {
	layerID = map.getSource(sourceID).vectorLayerIds[0];
	features = map.querySourceFeatures(sourceID, {'sourceLayer': layerID})
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

function zoomToPolygon(sourceID, coords) {
	if (typeof coords !== 'undefined') {
		coords = coords.split(",");
		bbox = [
			[coords[0], coords[1]],
			[coords[2], coords[3]]
		];
		map.fitBounds(bbox, options={padding: 10, duration: 5000});
		if (coords[4] === "Statewide") { // if we're zooming out to the whole state again
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
function unspoolOneDistrict() {
	var data = chartData.dataset[chartData.districtName];
	var arr = [];
	for (i in data) {
		arr.push({
			year: i,
			valueLeft: data[i][chartData.leftFieldName],
			valueRight: data[i][chartData.rightFieldName]
		});
	}
	// if it was empty, then go back to statewide
	return arr;
}

function drawChart() {
	if (chartData.visible) {
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
			.text(chartData.districtName);
		g.append("text")
			.attr("id", "left-axis-label")
			.attr("fill", chartData.leftColor)
			.attr("y", 10-margin.left).attr("dy", "1ex")
			.attr("text-anchor", "end")
			.text(chartData.leftFieldLabel);
		g.append("text")
			.attr("id", "right-axis-label")
			.attr("fill", chartData.rightColor)
			.attr("y", width+margin.right-10)
			.attr("text-anchor", "end")
			.text(chartData.rightFieldLabel);
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
					.ticks(Math.min(height / 25, yLeftMax))
					.tickFormat(d3.format(chartData.leftTickFormat))
			)
			.attr("stroke", chartData.leftColor);
		g.append("g")
			.attr("transform", "translate( " + width + ", 0 )")
			.call(
				d3.axisRight(yRight)
					.ticks(Math.min(height / 25, yRightMax))
					.tickFormat(d3.format(chartData.rightTickFormat))
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
function redrawChart() {
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
	allocateScreenSpace();
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
