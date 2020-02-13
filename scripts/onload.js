// onload.js contains all the javascript that needs to run after the core page elements have been defined

// call this a first time before anything else loads, so the map is in its likely final size
allocateScreenSpace();

mapboxgl.accessToken = 'pk.eyJ1IjoiY29yZS1naXMiLCJhIjoiaUxqQS1zQSJ9.mDT5nb8l_dWIHzbnOTebcQ';

// set max bounds to Texas + some padding (we have to pad quite a lot because otherwise very non-square window dimensions run into an issue where the E-W limit stops the whole state from fitting N-S, or vice versa)
var maxBounds = [
	[-125, 15], // southwest coords
	[-75, 45] // northeast coords
];

//let's make a map!
var map = new mapboxgl.Map({
	container: 'map', // container id
	style: 'mapbox://styles/core-gis/cjbcz8eyg70il2snv8ccgahf7', // stylesheet location; this is the style with markers turned OFF
	center: [-99.1725892, 31.3915247], // starting position [lng, lat] https://atlas.thc.state.tx.us/Details/5307002146
	zoom: 5, // starting zoom
	maxBounds: maxBounds // sets bounds as max
});

var originalZoomLevel = map.getZoom();

var loadedLineLayers = [];
var loadedPolygonLayers = [];

map.on('load', function() {
	map.addSource('points',{
		type:'vector',
		url:'mapbox://core-gis.cdf36461'
	});

	//add point data from Mapbox
	map.addLayer({
		'id': 'campuses',
		'type': 'circle',
		'source':'points',
		'source-layer':'ryht_tx_charter_campuses_11_0-2blig5',
		'filter':['==', ['number', ['get', 'year']], 1997],
		'layout':{	},
		'paint': {
			'circle-radius': [
				'interpolate',
				['linear'],
				//This will scale the points based on total enrollment at each campus
				['number', ['get', 'CPETALLC']],
				1, 6,
				1000, 15
			],
			'circle-color': [
				'interpolate',
				['linear'],
				//This will change the color of the points based on the percentage of economically disadvantaged
				//students at each campus
				['number', ['get', 'CPETECOP']],
				0, '#2DC4B2',
				20, '#3BB3C3',
				40, '#669EC4',
				50, '#8B88B6',
				60, '#A2719B',
				80, '#AA5E79'
			],
			'circle-opacity': 0.8
		}
	});

	//add data to power the zoom control
	addVectorLayer(
		map,
		{
			'sourceName': 'texas-school-districts', // data source name for internal use
			'sourceID': 'texas_school_districts_v2', // name of the Mapbox layer from which the data will be loaded
			'sourceURL': 'mapbox://core-gis.e4af0de1', // Mapbox URL
			'lineLayerName': 'texas-school-districts-lines', // OPTIONAL name we'll use for the layer that shows the outlines. Leave out or set to false if you don't want outlines displayed.
			'lineColor': '#cdcecb', // colour to draw those outlines with; safe to leave out if we're not drawing outlines, but must be explicitly set if we are
			'legendID': 'texas_school_districts', // OPTIONAL: the id in the legend, so we can set it to active or inactive as appropriate. Simply leave out for layers that don't appear in the legend
			'displayBehind': 'waterway-label', // ID of another existing layer, which Mapbox will make sure this one gets drawn behind
			'polygonLayerName': 'texas-school-districts-poly', // OPTIONAL name we'll use for the layer that invisibly stores the polygon extents. Needed if we're either going to add this layer to either the zoom to districts control or set click events (e.g. popups) on it.	Leave out or set to false if you don't want one.
			'polygonFillColor': 'rgba(200, 100, 240, 0)', // colour to fill polygons with. Needed if there's going to be a polygon layer; simply leave out if not.
			'polygonOutlineColor': 'rgba(200, 100, 240, 0)', // colour to draw polygon boundaries with. Needed if there's going to be a polygon layer; simply leave out if not.
			'visibleOnLoad': false, // set this optional argument to true to have the layer visible on load. Leave out or set to false to have it hidden on load
			'usedInZoomControl': true // set this optional argument to true if this layer will be used in the Zoom to Districts control, otherwise leave it out or set it to false.
		}
	);

	//Add districts as reference on load
	addVectorLayer(
		map,
		{
			'sourceName': 'texas-school-districts-ref',
			'sourceID': 'texas_districts_1882_v4',
			'sourceURL': 'mapbox://core-gis.b73007d3',
			'lineLayerName': 'texas-school-districts-ref-lines',
			'lineColor': '#cdcecb',
			'legendID': 'texas_school_districts-ref',
			'displayBehind': 'waterway-label',
			'polygonFillColor': 'rgba(124, 124, 124, 0)',
			'polygonOutlineColor': 'rgba(103, 65, 30, 0)',
			'visibleOnLoad': true,
			'usedInZoomControl': false
		}
	);


	// add charters as invisible data layer
	addVectorLayer(
		map,
		{
			'sourceName': 'texas-charter-companies',
			'sourceID': 'ryht_tx_charter_districts_12_-1urjcm',
			'sourceURL': 'mapbox://core-gis.8nbi875o',
			'lineLayerName': 'texas-charter-companies-lines',
			'lineColor': '#cdcecb',
			'polygonLayerName': 'texas-charter-companies-poly',
			'polygonFillColor': 'rgba(124, 124, 124, 0)',
			'polygonOutlineColor': 'rgba(103, 65, 30, 0)',
			'visibleOnLoad': true,
			'usedInZoomControl': true
		}
	);

	//add interactivity to the time slider
	document.getElementById('slider').addEventListener('input', function(e) {
		updateYearSlider('active-year', e.target.value);
	});

// When a click event occurs on a feature in the campus points layer, open a
// popup at the location of the click, with description HTML from its properties.
	map.on('click', 'campuses', function (e) {
		popupState.campusID = e.features[0].properties.CAMPUS;
		popupState.popup = new mapboxgl.Popup()
			.setLngLat(e.lngLat)
			.setHTML(fillpopup(e.features[0].properties))
			.addTo(map);
/* uncomment this block to restore the functionality that has clicks on points filtering the chart as well.
		chartData.districtName = e.features[0].properties.NAME;
		chartData.title = 'Charter schools located within ' + e.features[0].properties.NAME;
*/
		redrawChart();
	});

// Change the cursor to a pointer when the mouse is over the campuses layer.
	map.on('mouseenter', 'campuses', function () {
		map.getCanvas().style.cursor = 'pointer';
	});

// Change it back to a pointer when it leaves
	map.on('mouseleave', 'campuses', function () {
		map.getCanvas().style.cursor = '';
	});

	// call other functions which will wait until the *data load* is complete before actually running
	runWhenLoadComplete();

}); // end of map.on(load) block



// Add zoom controls to the map, with the compass turned off; position is modified in CSS
map.addControl(new mapboxgl.NavigationControl({showCompass: false}), 'bottom-right');




// load and parse districtsFile + chartersFile and then call the chart-drawing function
d3.csv(districtsFile).then(function(data) {
	d3.csv(chartersFile).then(function(charterData) {
		// first tag the datasets so that we only build the statewide totals from one, not both
		var ISDs_seen = [];
		var charters_seen = [];
		data.forEach(function(d) {
			d.sumData = true;
//			if (!ISDs_seen.includes(d.NAME)) {
//				console.log(d.NAME);
//				ISDs_seen.push(d.NAME);
//			}
		});
		charterData.forEach(function(d) {
			d.sumData = false;
			if (!charters_seen.includes(d.NAME)) {
				charters_seen.push(d.NAME);
				console.log(d.NAME, charters_seen.length);
			}
		})
		data = data.concat(charterData);
		populateChartControls();
		var districtHistory = {'Statewide': {}};
		data.forEach(function(d) {
			// pre-parse the numbers to avoid repetition
			vals = {};
			for (i in chartFields) {
				varName = fieldMappings[chartFields[i]].csvVarName;
				vals[varName] = {};
				vals[varName].abs = parseInt(d[varName], 10);
				if (fieldMappings[chartFields[i]].hasOwnProperty('ratioBase')) {
					vals[varName].pct = vals[varName].abs / parseInt(d[fieldMappings[fieldMappings[chartFields[i]].ratioBase].csvVarName], 10);
				}
			}
			year = parseInt(d.year, 10);
			// add blank object to history for each new district
			if (!districtHistory.hasOwnProperty(d.NAME)) {
				districtHistory[d.NAME] = {};
			}
			// add one year of data to the relevant district's object
			districtHistory[d.NAME][year] = vals;
			if (d.sumData) {
				// add year to statewide totals object if this is the first data for it
				if (!districtHistory['Statewide'].hasOwnProperty(year)) {
					districtHistory['Statewide'][year] = vals;
				} else { // or add to the running totals otherwise
					keys = Object.keys(vals);
					for (i in keys) {
						districtHistory['Statewide'][year][keys[i]].abs += vals[keys[i]].abs;
					}
				}
			}
		});
		// then after iterating over the whole file, recalculate percentages for the statewide totals
		for (i in chartFields) {
			if (fieldMappings[chartFields[i]].hasOwnProperty('ratioBase')) {
				for (j in districtHistory['Statewide']) {
					datum = districtHistory['Statewide'][j];
					field = fieldMappings[chartFields[i]].csvVarName;
					base = fieldMappings[chartFields[i]].ratioBase;
					datum[field].pct = datum[field].abs / datum[fieldMappings[base].csvVarName].abs;
				}
			}
		}
		chartData.dataset = districtHistory;
		console.log(chartData.dataset);
		drawChart();
		window.addEventListener("resize", redrawChart);
	});
});
