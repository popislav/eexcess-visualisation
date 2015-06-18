
function Timeline( root, visTemplate ){
		
	/**
	 * Steps executed when the timeline is intialized
	 * 
	 * */
	var TIMEVIS = {};
	TIMEVIS.Settings = new Settings('timeline');

	var Vis = visTemplate;										// Allows calling template's public functions
	Geometry = new Geometry();									// Ancillary functions for drawing purposes
	
	var width, focusHeight, focusMargin, contextHeight, contextMargin, centerOffset, verticalOffset;
	var xAxisChannel, yAxisChannel, colorChannel, data, keywords;	// data retrieved from Input() function
	var x, x2, y, y2, color;										// scales
	var xAxis, yAxis, xAxis2, yAxis2;								// axis functions
	var chart, focus, context;										// main graphic components
	var circles, flagLines,textInCircles, svg2, arc2;											// circles selector and flag
	var zoom, brush;												// behaviors
	var leftHandle, rightHandle;									// brush handles
	var leftHandleImg  = "../../media/left-handle.png";
	var rightHandleImg = "../../media/right-handle.png";
	var legendDomain;												// legend domain = color domain + selected attribute
	var fullExtent, currentExtent;									// extents used mainly for zooming and brushing
	var keywordNodes, keywordNodeData, kwNodes = [];				// input dataset for keyword nodes
	var selectedId;
	var delay = 400;
	
	/**
	 *  Define line function to connect nodes in focus area
	 */						
	var lineFunction = d3.svg.line()
			        	.x(function(d) { return (x(d.xValue) + d.xOffset); })
			        	.y(function(d) { return (y(d.yValue) + d.yOffset); })
			        	.interpolate("monotone");
	
	
	var getLegendDomain = function(colorDomain){
		
		var legendDomain = [];
		
		colorDomain.forEach(function(c, i){
			legendDomain[i] = { 'item': c, 'selected': false };
		});
		return legendDomain;
	};
	
	
	
	
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

	TIMEVIS.Evt = {};


	/**
	 * Brush brushed and brushended
	 * */
	TIMEVIS.Evt.brushed = function() {
		var brushExtent = brush.extent();
        console.log(((brushExtent[0]) - 12));
		leftHandle.attr("x", x2(brushExtent[0]) - 12);
		rightHandle.attr("x", x2(brushExtent[1]) - 8);
		
		x.domain(brush.empty() ? x2.domain() : brushExtent);
		TIMEVIS.Render.redraw();

	};
	
	//experimental function
	TIMEVIS.Evt.filterListPerTime = function(minDateInYears,maxDateInYears){
		var indicesToHighlight = [];
		var currentYear = 0;
		data.forEach(function(d, i){
			if(d.hasOwnProperty("year")){	
				currentYear = d.year.getFullYear();
				if(minDateInYears <= currentYear && currentYear <= maxDateInYears){
					indicesToHighlight.push(i);
				}
			}
		});
		Vis.selectItems( indicesToHighlight, true );
		FilterHandler.setCurrentFilter('time', minDateInYears, maxDateInYears);
	}
	
	TIMEVIS.Evt.brushended = function(){
	
		// update zoom after brushing
		var currentExtent = Math.abs(new Date(x.invert(width)) - new Date(x.invert(0)));	
		var scale = fullExtent / currentExtent;
		var tx = -1 * (x2(brush.extent()[0]) * scale);
		var ty = zoom.translate()[1];
		
		zoom.scale(scale);
		zoom.translate([tx, ty]);	
		
		TIMEVIS.Evt.filterListPerTime(x.invert(0).getFullYear(), x.invert(width).getFullYear());
	};
	
	
	/**
	 * Zoom zoomed
	 * */
	TIMEVIS.Evt.zoomed = function(){
		
		// Define zoom settings
		var trans = zoom.translate();
		var scale = zoom.scale();
		
		tx = Math.min(0, Math.max(width * (1 - scale), trans[0]));
		ty = trans[1];
		
		zoom.translate([tx, ty]);
		
		// update brush extent
		var brushExtent = [x.invert(0), x.invert(width)];
		context.select(".brush").call(brush.extent(brushExtent));
		
		// update handles' position
		leftHandle.attr("x", x2(brushExtent[0]) - 12);
		rightHandle.attr("x", x2(brushExtent[1]) - 8);
	
		TIMEVIS.Render.redraw();
		
		TIMEVIS.Evt.filterListPerTime(brushExtent[0].getFullYear(),brushExtent[1].getFullYear());
		
	};
	
	
	
	
	
	/**
	 * Node click handler
	 **/
	TIMEVIS.Evt.nodeClicked = function( d, index, sender ) {
	
		kwNodes = [];
		var links = [];
	
		// Remove existing lines, , kwNodes and text, and restore nodes
		TIMEVIS.Render.remove();
		
		// if the same node is selected twice and the lines were drawn in the previous run, then no lines are drawn in this run
		if(d.id == selectedId){
			selectedId = "undefined";
			flagLines = false;
			
			if( sender != Vis )
				Vis.ListItemSelected(d, index, true);	// if the method is invoked by Vis template
			
			return;
		}
		selectedId = d.id;

		// Set opacity and stroke to highlight selected node
		TIMEVIS.Render.highlightNodes( [index] );

		// highlight current datum on content list
		if( sender != Vis )
			Vis.ListItemSelected(d, index, true);
		
		/**
		 *  Draw lines linking nodes in focus area
		 */
		if(d.keywords.length == 0)
			return;
	
		flagLines = true;				// when set to true, it allows redrawing lines when brushing or zooming
	 	
		d.keywords.forEach(function(k, i){
		
			var source = { 'xValue': d[xAxisChannel], 'yValue': d[yAxisChannel], 'xOffset': 0, 'yOffset': 0 };
			var points = TIMEVIS.Internal.getKeywordNode(d, k, i);		
		
			kwNodes.push(points.target);
			links.push([source, points.midpoint, points.target]);
		});
		
		TIMEVIS.Render.DrawKeywordNodeAndLinks( links );
		
	};		// end nodeclick


	/** 
	 * Node mouseover handler
	 * */	
	TIMEVIS.Evt.nodeMouseOvered = function(d){
	
		//if(d.isHighlighted){
			currentExtent = Math.abs(new Date(x.invert(width)) - new Date(x.invert(0)));
		
			// node colored in red
			d3.select(this)
				.attr("r", function(d){ 
					var radius = Geometry.calculateRadius(fullExtent, currentExtent);
					if(d.isHighlighted)
						return parseFloat(radius) + 2;
					return parseFloat(radius) + 1;
				})
				.style("fill", "red")
				.style("stroke-width", "2.5px");					

			// Get current x/y values, then augment for the tooltip
			var xPosition = parseFloat(d3.select(this).attr("cx")) + 250;//45;
			var yPosition = parseFloat(d3.select(this).attr("cy")) + 120;//35;
	
			d3.select("#tooltip").remove();
		
			tooltip = d3.select( root ).append( "div" )
						.attr("id", "tooltip");
	
			tooltip.append("p")
			.attr("id", "value");
	
			// Show the toolxtip
			tooltip
				.style("left", xPosition + "px")
				.style("top", yPosition + "px")
				.style("opacity", 0.4)
				.transition()	// With this line the circles have black borders
				.style("opacity", 0.9)
				.duration(1000);				
	
			// Add text and link to the tooltip
			tooltip
				.select("#value")
				.html('<a target=\"_blank\" href=\"' + d.uri + '\">' + d.title + '</a><br/> <p>Year: ' + toYear(d.cx) + "</p>");
		//}
	};


	/**
	 * 	Node mouseout handler
	 * */	
	TIMEVIS.Evt.nodeMouseOuted = function(d){
	
		//if(d.isHighlighted){
			currentExtent = Math.abs(new Date(x.invert(width)) - new Date(x.invert(0)));
		
			// Restore node's fill to original color and radius
			d3.select(this)
				.attr("r", function(d){ 
					var radius = Geometry.calculateRadius(fullExtent, currentExtent);
					if(d.isHighlighted)
						return parseFloat(radius) + 1;
					return parseFloat(radius);
				})
				.style("fill", function(d){ return color(d[colorChannel]); })
				.style("stroke-width", "2px");
			
			//Hide tooltip
			tooltip.transition().duration(1500).style("opacity", 0);
	
			tooltip
				.transition()
				.remove()
				.duration(0).delay(1500);
		//}
	};
	
	
	/**
	 *	Keyword nodes' handlers
	 * */	
	TIMEVIS.Evt.kwnodeClicked = function(d){
		Vis.keywordSelected(d.title);
	};
	
	
	TIMEVIS.Evt.kwnodeMouseOvered = function(){
		//d3.select(this).select(".keywordDot").style("stroke", "red");
		d3.select(this).select(".keywordDot").style("fill", "red");
		d3.select(this).select(".shadow").style("stroke", "yellow");
		d3.select(this).select(".shadow").style("opacity", "0.3");
	};
	
	
	TIMEVIS.Evt.kwnodeMouseOuted = function(){
		//d3.select(this).select(".keywordDot").style("stroke", "none");
		d3.select(this).select(".keywordDot").style("fill", "blue");
		d3.select(this).select(".shadow").style("stroke", "#ddd");
		d3.select(this).select(".shadow").style("opacity", "0.7");
	};
	
	
	/**
	 *	Legend events' handlers
	 * */
	TIMEVIS.Evt.legendClicked = function( legendDatum, legendIndex ){
		
		var indicesToHighlight = [];
		
		if( legendDatum.selected === false ){				
			data.forEach(function(d, i){
				if(d[colorChannel] === legendDatum.item)
					indicesToHighlight.push(i);
			});
			
			legendDomain.forEach(function(l, i){
				l.selected = (i == legendIndex);
			});
		}
		else{
			legendDatum.selected = false;
		}
		
		TIMEVIS.Render.highlightNodes( indicesToHighlight, $(this).attr('class') );
		Vis.selectItems( indicesToHighlight, true );
		
		if(legendDatum.selected === true){
			$(this).find('text').css('font-weight', 'bold');
		}else{
			Vis.selectItems(Vis.getAllSelectListItems(), false);
		}
		
		d3.selectAll('.legend').select("div")
			.style("border", function(l, i){ if(i == legendIndex && legendDatum.selected) return "0.1em lime solid"; return "none"; });
		
	};
	
	
	TIMEVIS.Evt.legendMouseOvered = function(d){

		d3.select(this).select("div")
			.style("border", "0.1em yellow solid")
			.style("width", "1.4em")
			.style("height", "1.4em");
		
		d3.select(this).select("text")
			.style("font-size", "0.9em");
	};
	
	
	TIMEVIS.Evt.legendMouseOuted = function(d){
		
		d3.select(this).select("div")
			.style("border", function(){ if(d.selected) return "0.1em lime solid"; return "none"; })
			.style("width",  function(){ if(d.selected) return "1.4em"; return "1.5em"; })
			.style("height", function(){ if(d.selected) return "1.4em"; return "1.5em"; });
		
		d3.select(this).select("text")
			.style("font-size", "0.85em");
		
	};
	

	
	
	
	
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

	TIMEVIS.Internal = {};	
	
	
	
	TIMEVIS.Internal.getKeywordNode = function(d, k, i){
		
		var tGmtry = Geometry.getXandYOffset(x(d[xAxisChannel]), width, d, i);
	
		var t = { 
					'xValue'  : d[xAxisChannel], 
					'yValue'  : d[yAxisChannel],
					'xOffset' : tGmtry.xOffset, 
					'yOffset' : tGmtry.yOffset, 
					'factor'  : tGmtry.factor, 
					'title'   : k.term 
				};
		
		var mGmtry = Geometry.getMidPoint(tGmtry);
		
		var m = {
					'xValue'  : d[xAxisChannel], 
					'yValue'  : d[yAxisChannel],
					'xOffset' : mGmtry.xOffset, 
					'yOffset' : mGmtry.yOffset, 
					'factor'  : mGmtry.factor
				};
		
		return {'target': t, 'midpoint': m};
	};
	
	
	
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

	TIMEVIS.Render = {};


	
	
	/******************************************************************************************************************************
	* 
	* 	Draw function called from Vis-Template every time the visual channels or the data change
	*  
	*****************************************************************************************************************************/	
	
	TIMEVIS.Render.draw = function(initData, mapping, iWidth, iHeight){

		/******************************************************
		 * Define canvas dimensions
		 ******************************************************/
		
		TIMEVIS.Dimensions = TIMEVIS.Settings.getDimensions(root, iWidth, iHeight);
		width          = TIMEVIS.Dimensions.width;
		focusHeight    = TIMEVIS.Dimensions.focusHeight;
		focusMargin    = TIMEVIS.Dimensions.focusMargin;
		contextHeight  = TIMEVIS.Dimensions.contextHeight;
		contextMargin  = TIMEVIS.Dimensions.contextMargin;
		centerOffset   = TIMEVIS.Dimensions.centerOffset;
		verticalOffset = TIMEVIS.Dimensions.verticalOffset;
		
		
		/******************************************************
		 * Assign visual channels and processed data
		 ******************************************************/

        TIMEVIS.Input = TIMEVIS.Settings.getInitData(initData, mapping);
		xAxisChannel = TIMEVIS.Input.xAxisChannel;
		yAxisChannel = TIMEVIS.Input.yAxisChannel;
		colorChannel = TIMEVIS.Input.colorChannel;
		data 		 = TIMEVIS.Input.data;
		keywords	 = TIMEVIS.Input.keywords;
		
		selectedId = "undefined"; 
		flagLines = false;

		/******************************************************
		 *	Define scales
		 *****************************************************/

		// main X Axis
		x  = d3.time.scale()									
					.range([0, width])
					.domain(d3.extent(data, function(d){ return d[xAxisChannel]; })).nice(d3.time.year);
	
		// brush X Axis
		x2 = d3.time.scale()
					.range([0, width])
					.domain(x.domain());
	
		// main Y Axis
		y  = d3.scale.ordinal()
					.rangePoints([0, focusHeight], 1.8)
					.domain(data.map(function(d){ return d[yAxisChannel]; })); // maps to nominal values contained in d.topic
	
		
		// brush Y Axis
		y2 = d3.scale.ordinal()
					.rangePoints([0, contextHeight], 0.5)
					.domain(y.domain()); 			
		
		color = d3.scale.category20();		// selects a set of colors for the dots and legends
		
		TIMEVIS.Ext.colorScale = color;
		
		// Calculate full extent
		fullExtent = Math.abs(new Date(x2.invert(width)) - new Date(x2.invert(0)));


		/******************************************************
		 *	Define axis
		 *****************************************************/
		
		// main X Axis
		xAxis = d3.svg.axis().scale(x)
						.orient("bottom")
						.ticks(6)
						.tickFormat(d3.time.format("%Y"));
	
		// main Y Axis
		yAxis = d3.svg.axis().scale(y).orient("left");//.tickSize(-width, 0, 0);
	
		// brush X Axis
		xAxis2 = d3.svg.axis().scale(x2)
						.orient("bottom")
						.tickFormat(d3.time.format("%Y"));
	
		// brush Y Axis
		yAxis2 = d3.svg.axis().scale(y2).orient("left");
	
	
		/******************************************************
		 *	Define behaviors
		 *****************************************************/ 
	
		////	Brush
		 		
		brush = d3.svg.brush()
				.x(x2)
				.on("brush", TIMEVIS.Evt.brushed)
				.on("brushend", TIMEVIS.Evt.brushended);
	
		////	Zoom
		zoom = d3.behavior.zoom()
				.x(x)
				.scaleExtent([1, 10])
				.on("zoom", TIMEVIS.Evt.zoomed);
		
		// Call zoom
		zoom.x(x);
		
		/******************************************************
		*	Draw chart main components
		******************************************************/
	
		// Add svg main component
		var divchart = d3.select( root ).append( "div" )
			.attr("id", "div-chart");
	
		var svg = divchart.append("svg")
			.attr("class", "svg")
			.attr("width", width + focusMargin.left + focusMargin.right)
			.attr("height", focusHeight + focusMargin.top + focusMargin.bottom);
	
	
		// Add focus and context g components
		focus = svg.append("g")
			.attr("class", "focus")
			.attr("transform", "translate(" + focusMargin.left + "," + focusMargin.top + ")")
			.call(zoom);
	
		context = svg.append("g")
			.attr("class", "context")
			.attr("transform", "translate(" + contextMargin.left + "," + contextMargin.top + ")");
	
	
		// Add clip-path (area where the chart is drawn)
		var clip = focus.append("defs").append("svg:clipPath")
			.attr("id", "clip")
			.attr("pointer-events", "all")
			.append("rect")
				.attr("x", -22)
				.attr("width", width + 44)
				.attr("y", -10)
				.attr("height", focusHeight + 10)
				.attr("pointer-events", "all");
	
		// "g" that contains zoomable/brushable elements
		chart = focus.append("g")
			.attr("id", "chart")
			.attr("clip-path", "url(#clip)")
			.attr("pointer-events", "all");
	
		// Add rectangle delimiting zooming area		
		chart.append("rect")
			.attr("class", "pane")
			.attr("x", -22)
			.attr("width", width + 44)
			.attr("height", focusHeight);
	
		/**
		 *	Draw axis in focus area
		 */

		// Add X Axis
		focus.append("g")
		.attr("class", "x axis")
		.attr("transform", "translate(0," + focusHeight + ")")
		.call(xAxis)
		.append("text")
			.attr("class", "label")
			.attr("x", width)
			.attr("y", -6)
			.style("text-anchor", "end")
			.text("Time");

		// Add Y Axis
		var y_axis = focus.append("g")					
						.attr("class", "y axis")
						.call(yAxis);


		//y_axis.selectAll(".tick").style("stroke-dasharray", ("3, 3"));
 




		y_axis
			.selectAll(".tick > text")
				.attr("transform", "rotate(-45)")
				//.attr("y", "4")
				.attr("dx", "-1.0em")
				.attr("dy", "-2.4em")
				.style("text-anchor", "middle");
		 
	
		/******************************************************
		 *	Draw in focus area
		 *****************************************************/	
		
		/**
		 *	Main nodes 
		 * */
		//steff experimental code begin
		 
		//get information(number) about nodes with same x- and y-axis;
		
		//---------------------------------------------------------------------------mmis2-start------------------------------------------------------------------------//
		
		var keyForData = mapping[1].facet;
		 
		var dataDictWithTime ={}; //double dict
		
		//mmis2: function for editing dataDictWithTime
		var workInXAxis = function(dataVal,dateString,key,otherKey){
			if(dataVal[key].hasOwnProperty(dateString)){
				if(dataVal[key][dateString].hasOwnProperty("total")){ //work in x axis
					dataVal[key][dateString]["total"] += 1;
				}
				else{
					dataVal[key][dateString]["total"] = 1;
				}
				if(dataVal[key][dateString].hasOwnProperty(otherKey)){
					dataVal[key][dateString][otherKey] += 1;
				}
				else{
					dataVal[key][dateString][otherKey] = 1;
				}
			}else{
				dataVal[key][dateString] = {};
				dataVal[key][dateString]["total"] = 1;
				dataVal[key][dateString][otherKey] = 1;
			}			
		}


		//mmis2: added cx and cy in our data, tu make it easier to work in cluster function
		data.forEach(function(currentData){
            currentData.cx = x(currentData.year);
			currentData.cy = y(currentData[keyForData]);
		});


        currentExtent = Math.abs(new Date(x.invert(width)) - new Date(x.invert(0)));


        TIMEVIS.Render.clusteringTimeline(currentExtent);//----call cluster function
		
		//mmis2: fill dataDictWithTime after clustering
		data.forEach(function(currentData){
			yearInString = currentData.cx.toString();
			currentKeyValue = currentData[keyForData];
			currentOtherKeyValue = currentData[colorChannel];
			
			if(dataDictWithTime.hasOwnProperty(currentKeyValue)){//work in y axis
				workInXAxis(dataDictWithTime,yearInString,currentKeyValue,currentOtherKeyValue);
			}
			else{
				dataDictWithTime[currentKeyValue] ={};
				workInXAxis(dataDictWithTime,yearInString,currentKeyValue,currentOtherKeyValue);
			}
		});		
		//console.log(dataDictWithTime);

		
		
	//mmis2: make data after clustering, which can be used to draw donuts/pies
		var pieData=[];
		var allColorChannel = [];
		makePieData();
		
		function makePieData(){
			
				var n = 0;
				for(var i in dataDictWithTime){
						
					for (var j in dataDictWithTime[i]){
							
						pieData[n] = {};
						pieData[n].cx = new Date(j);
						pieData[n].cy = y(i);
						pieData[n][keyForData] = i;
						pieData[n][colorChannel] =[];
						function obj(lab, val){
							this.label = lab;
							this.value = val;
						}
						for(var m in dataDictWithTime[i][j]){

							if(m != "total"){
								var a = new obj;
								a["label"] = m;
								a["value"] = dataDictWithTime[i][j][m];
								pieData[n][colorChannel].push(a);
								if(allColorChannel.indexOf(m) == -1){
									allColorChannel.push(m);
								} 
							}		
						}	
						n++;
					}			
				}
			}
			
		
		//mmis2: add IDs to pieData, which should be used for events
		/* addID();
		function addID(){
			for (var i=0; i<pieData.length; i++){
				pieData[i].id = [];
				//pieData[i].keyword = [];
				for (var j=0; j<data.length; j++){
					if(pieData[i].cx.toString() == data[j].cx.toString()){
						(pieData[i].id).push(data[j].id);
						//(pieData[i].keyword).push(data[j].keyword);
					}
				}
			}
		} */
		
			/* //Log of datas		
			console.log("data");
			console.log(data);
			console.log("dataDictWithTime");
			console.log(dataDictWithTime);
			console.log("pieData");
			console.log(pieData); */

		//------       ----------      -----------    -----------mmis2-end------    ----------       ---------       ---------------       -----------//
		
		
		//---------------------------------------------------------------------------mmis2-start------------------------------------------------------------------------//
		
		//mmis2: draw donutChart and add text(total number) in the middle
		var nodesData = chart.selectAll(".pie").data(pieData);
       
		var nodes = nodesData.enter()
					.append("g")
					.attr("class", "pie");


		var radius = Geometry.calculateRadius(fullExtent, currentExtent);
		
		var pie = d3.layout.pie().sort(null);

		var arc = d3.svg.arc()
			.innerRadius(1.25*radius)
			.outerRadius(2.25*radius);


		var svg = nodes.append("svg")
			.attr("class", "svg2")
            .append("g")
            .attr("transform",function(d,i){ return "translate(" + ((x(d.cx)) ) + "," + ((d.cy) )  + ")";});

		var piePath = svg.selectAll("path")
			.data(function(d) {				
				var eachPieData =[];
				d[colorChannel].forEach(function(langs){
					//if(langs.label!="total"){
					for(var j=0; j<allColorChannel.length; j++){
						if(typeof eachPieData[j]=="undefined" || eachPieData[j] == 0){
							if(langs.label == allColorChannel[j]){
									eachPieData[j]=(langs.value);
							}else{					
								eachPieData[j] = 0;								
							}
						}
					}
					//}
				})
			return pie(eachPieData);
			})
		    .enter().append("path")
			.attr("fill", function(d, i) { return color(allColorChannel[i]); }) 
			.attr("d", arc);

			
		nodes.append("text")
			.attr("class", "number")
			.attr("x", function(d, i) { cx = d.cx; return (x(cx) - 5); })
			.attr("y", function(d, i) { return (d.cy + 3);})
			//.style("opacity", 0.3)
			.text(function(d){
				var numberWithSameTime = dataDictWithTime[d[keyForData]][d.cx.toString()]["total"];
				if(numberWithSameTime>1){
					return numberWithSameTime;
				} 
				//count same node with same y-axis and time
			});
			
		
		
		//-----    ---------         -----------      -----------    ------mmis2-end------   ------------            --------------       ------------  -------//
		
		
		textInCircles = chart.selectAll(".number");
		
		textInCircles
			.on( "click", TIMEVIS.Evt.nodeClicked );
		//steff experimental code end
		
		svg2 = chart.selectAll(".svg2");
		
		svg2 
			.on( "click", TIMEVIS.Evt.nodeClicked )
			.on( "mouseover", TIMEVIS.Evt.nodeMouseOvered )
			.on( "mouseout", TIMEVIS.Evt.nodeMouseOuted );
		
	
		// Add keyword nodes
	
		keywordNodes = chart.selectAll(".keywordNode");
		keywordNodeData = keywordNodes.data(kwNodes);
	
		
		/******************************************************
		 *	Legends
		 *****************************************************/	
		
		legendDomain = getLegendDomain(color.domain());
		
		
		var legendWrapper = d3.select("#div-chart")
						.append("div")
						.attr("id", "div-wrap-legends");
		
		legend = legendWrapper.selectAll(".legend")
			.data(legendDomain)
			.enter()
			.append("div")
				.attr("class", "legend")
				.attr("transform", function(d, i) { return "translate(40," + (i+1)*20 + ")"; })
				.on( "click", TIMEVIS.Evt.legendClicked )
				.on( "mouseover", TIMEVIS.Evt.legendMouseOvered )
				.on( "mouseout", TIMEVIS.Evt.legendMouseOuted );
		
		legend.append("div")
			.attr("x", width + 126)
			.style("background", function(d){ return color(d.item); });
		
		legend.append("text")
			.attr("x", width +120)
			.attr("y", 9)
			.attr("dy", ".35em")
			.style("text-anchor", "end")
			.text(function(d) { return d.item; });

	
		/******************************************************
		 *	Draw in context area (brush)
		 *****************************************************/		

		// Draw X Axis in context area
		context.append("g")
			.attr("class", "x axis")
			.attr("transform", "translate(0," + contextHeight + ")")
			.call(xAxis2);

	//---------------------------------------------------------------mmis2-start---------------------------------------------------------------------------//	
		// Draw small pieCharts
		var smallNodesData = context.selectAll(".small_pie").data(pieData);
		
		var smallNodes = smallNodesData.enter()
						.append("g")
						.attr("class", "small_pie");				

		
		var arc2 = d3.svg.arc()
			.outerRadius(4);
			
		var svg3 = smallNodes.append("svg")
			.attr("class", "svg3")
            .append("g")
            .attr("transform",function(d,i){ return "translate(" + ((x2(d.cx)) ) + "," + (y2(d[yAxisChannel]) )  + ")";});
		
		var smallPiePath = svg3.selectAll("path")
			.data(function(d) {				
				var eachPieData =[];
				d[colorChannel].forEach(function(langs){
					//if(langs.label!="total"){
					for(var j=0; j<allColorChannel.length; j++){
						if(typeof eachPieData[j]=="undefined" || eachPieData[j] == 0){
							if(langs.label == allColorChannel[j]){
									eachPieData[j]=(langs.value);
							}else{					
								eachPieData[j] = 0;								
							}
						}
					}
					//}
				})
			return pie(eachPieData);
			})
		    .enter().append("path")
			.attr("fill", function(d, i) { return color(allColorChannel[i]); })
			.attr("d", arc2);

		
		//-----    ---------         -----------      -----------    ------mmis2-end------   ------------            --------------       ------------  -------//
	
		
		
		// Draw left and right handles for brush
		leftHandle = context.append("image")
			.attr("width", 20)
			.attr("height",contextHeight + 10)
			.attr("x", x2(x2.domain()[0]) - 12)
			.attr("y", -7)
			.attr("xlink:href", leftHandleImg);

		rightHandle = context.append("image")
			.attr("width", 20)
			.attr("height", contextHeight + 10)
			.attr("x", x2(x2.domain()[1]) - 8)
			.attr("y", -7)
			.attr("xlink:href", rightHandleImg);
		
		// Draw brush	
		context.append("g")
			.attr("class", "x brush")
			.call(brush)
				.selectAll("rect")
				.attr("y", -2)
				.attr("height", contextHeight + 0);

		// Set brush's initial extension	
		var brushExtent = [x.invert(0), x.invert(width)];
		context.select(".brush").call(brush.extent(brushExtent));
		
	};	// end Render.draw
	
	
	
	
	
	
	/*****************************************************************************************************************
	* 
	*	Method called when a node is clicked. Displays a small green node for each keyword related to the node item,
	*	the links connecting them and te corresponding text
	*
	* ****************************************************************************************************************/
	TIMEVIS.Render.DrawKeywordNodeAndLinks = function( links ){
	
		links.forEach(function(points) { 
	
			chart.append("g")
				.attr("class", "keywordLink")
				.append("path")
					.datum(points)
					.attr("class", "link")					
					.attr("d", lineFunction(points))
					.attr("transform", "translate("+(kwNodes[0].factor * -10)+")")	// animation for keyword lines
					.transition()
					.ease("linear")
					.duration(delay)
					.attr("transform", "translate(0)");
		});

		// 	Add keyword nodes	
		keywordNodeData = keywordNodes.data(kwNodes);

		var gKeyword = keywordNodeData
			.enter()
			.append("g")
				.attr("class", "keywordNode")
				.attr("id", function(d,i){ return "keywordNode_"+i; })
				.attr("dx", function(d) { return x(d.xValue) + d.xOffset; })
				.attr("dy", function(d) { return y(d.yValue) + d.yOffset; })
				.on("click", TIMEVIS.Evt.kwnodeClicked)
				.on("mouseover", TIMEVIS.Evt.kwnodeMouseOvered)
				.on("mouseout", TIMEVIS.Evt.kwnodeMouseOuted);

		// Append circles to keywordNodes
		gKeyword
			.append("svg")
				.attr("class", "keywordDot")
				.transition()
				.attr("r", "4")		
				.attr("cx", function(d) { return x(d.xValue) + d.xOffset; })
				.attr("cy", function(d) { return y(d.yValue) + d.yOffset; })
				.duration(0).delay(delay + 50);

	
		setTimeout(function(){
			// Append text to keywordNodes
			gKeyword
			.append("text")
				.text(function(d) { return d.title; })
				.attr("class", "shadow")
				.attr("x", function(d, i) { return x(d.xValue) + d.xOffset + Geometry.getTextXoffset(d, i); })	// function getTextXoffset() in geometry.js 
				.attr("y", function(d, i) { return y(d.yValue) + d.yOffset + Geometry.getTextYoffset(d, i, kwNodes.length); });	// function getTextYoffset() in geometry.js
		
			gKeyword
				.append("text")
					.text(function(d) { return d.title; })
					.attr("class", "node_text")
					.attr("x", function(d, i) { return x(d.xValue) + d.xOffset + Geometry.getTextXoffset(d, i); })	// function getTextXoffset() in geometry.js 
					.attr("y", function(d, i) { return y(d.yValue) + d.yOffset + Geometry.getTextYoffset(d, i, kwNodes.length); });	// function getTextYoffset() in geometry.js
		
		}, delay + 100);
	};
	
	
	
	
	/******************************************************************************************************************
	* 
	*	Redraw nodes, lines and main x axis
	* 
	* ***************************************************************************************************************/
	TIMEVIS.Render.redraw = function(){
		
		currentExtent = Math.abs(new Date(x.invert(width)) - new Date(x.invert(0)));

		// update x axis
		focus.select(".x.axis").call(xAxis);

		//--------------------------------------------------------------------mmis2-start---------------------------------------------------------------------------//
		//redraw it all, after zoom f.e.
		svg2
			.select("g")
			.attr("transform",function(d,i){ return "translate(" + ((x(d.cx)) ) + "," + ((d.cy) )  + ")";});

		// redraw text
		textInCircles
			.attr("x", function(d, i) {  cx=d.cx; return (x(cx) - 5);  })
			.attr("y", function(d, i) { return (d.cy + 3); });
			
		//-----     --------            ---------         ------     -----end-------          -----------            --------             ------           ---//
		
		// if lines are already drawn, redraw them
		if(flagLines){
  		
			chart.selectAll(".link").attr("d", lineFunction);
  				
			// redraw keyword nodes
			chart.selectAll(".keywordDot")
				.attr("r", "4")		
				.attr("cx", function(d) { return x(d.xValue) + d.xOffset; })
				.attr("cy", function(d) { return y(d.yValue) + d.yOffset; })
				.attr("fill", "blue");
		
			// redraw text and shadow for keyword nodes
			chart.selectAll(".shadow")	
				.attr("x", function(d, i) { return x(d.xValue) + d.xOffset + Geometry.getTextXoffset(d, i); })
				.attr("y", function(d, i) { return y(d.yValue) + d.yOffset + Geometry.getTextYoffset(d, i, kwNodes.length); });			
			
			chart.selectAll(".node_text")	
			.attr("x", function(d, i) { return x(d.xValue) + d.xOffset + Geometry.getTextXoffset(d, i); })
			.attr("y", function(d, i) { return y(d.yValue) + d.yOffset + Geometry.getTextYoffset(d, i, kwNodes.length); });
		}  
	};

	
	//--------------------------------------------------------------------mmis2-start---------------------------------------------------------------------------//
	
		/******************************************************************************************************************
	* 
	*	Clustering
	*  -- function which cluster overlapped circles and displays 'em all in average Value of these coupled circles
	* ***************************************************************************************************************/ 
	
    TIMEVIS.Render.clusteringTimeline = function(current_extent){

        var radius = Geometry.calculateRadius(fullExtent, current_extent);
		
		//mmis2: sort our data to make clustering a lot easier
		//used great firstBy mini library
        firstBy = (function() {
            /* mixin for the `thenBy` property */
            function extend(f) {
                f.thenBy = tb;
                return f;
            }
            /* adds a secondary compare function to the target function (`this` context)
             which is applied in case the first one returns 0 (equal)
             returns a new compare function, which has a `thenBy` method as well */
            function tb(y) {
                var x = this;
                return extend(function(a, b) {
                    return x(a,b) || y(a,b);
                });
            }
            return extend;
        })();
		
		//mmis2: sorted first by cy, then by cx
        data.sort(
            firstBy(function (v1, v2) { return v1.cy - v2.cy; })
                .thenBy(function (v1, v2) { return v1.cx - v2.cx; })
        );

		
		//mmis2: do clustering
		for(var countOne = 0; countOne < data.length; countOne++){
			var posOverlapping = [];
			if(countOne == (data.length-1)){
				posOverlapping.push(countOne);
				var midValue = data[(data.length-1)].cx;
				//console.log(posOverlapping);
			}else{
				var helpCount = countOne;
				var sumValue = data[countOne].cx;
				var n = 1;
				var midValue = 0;
				posOverlapping.push(countOne);
				for( var countTwo = countOne + 1; countTwo < data.length; countTwo++){
					if(((((data[helpCount].cx) + 3.5 * (radius + 1)) >= data[countTwo].cx) && (((data[helpCount].cx) - 3.5 * (radius + 1)) <= data[countTwo].cx)) //3*r because of pieChart, and +1 because of hoover
						&& (data[helpCount].cy == data[countTwo].cy)){
						helpCount = countTwo;
						sumValue += data[countTwo].cx;
						posOverlapping.push(countTwo);
						n++;
					}
				}
				midValue = sumValue/n;
				countOne = helpCount;
				//console.log(posOverlapping);
			}
				
			for(var countPos = 0; countPos < (posOverlapping.length); countPos++){
				data[posOverlapping[countPos]].cx = x.invert(midValue);//midValue
			}
		}
    };

	//-----     --------            ---------         ------     -----end-------          -----------            --------             ------           ---//
	
	
	/******************************************************************************************************************
	* 
	*	Reset chart's elements
	* 
	* ***************************************************************************************************************/  
	TIMEVIS.Render.reset = function(){
	
		// reset zoom
		zoom.scale(1);
		zoom.translate([0, 0]);
	
		// remove lines, refdots and text, and restore dots appearance
		TIMEVIS.Render.remove();
	
		// restore x scale domain
		x.domain(x2.domain());
	
		//reset brush
		var brushExtent = [x.invert(0), x.invert(width)];
		context.select(".brush").call(brush.extent(brushExtent));
		
		// reset brush handles' position
		leftHandle.attr("x", x2(x2.domain()[0]) - 12);
		rightHandle.attr("x", x2(x2.domain()[1]) - 8);

		flagLines = false;

	};
	

	
	
	/*****************************************************************************************************************
	* 
	*	Remove links, keyword nodes and restore main nodes' style
	*
	* **************************************************************************************************************/
		
	TIMEVIS.Render.remove = function(){
			
		chart.selectAll(".keywordLink").remove();
		chart.selectAll(".link").remove();
		chart.selectAll(".keywordNode").empty();
		chart.selectAll(".keywordNode").remove();
		//chart.selectAll(".keywordDot").remove();
		chart.selectAll(".text").remove();
		
		keywordNodeData.exit().remove();
		
		currentExtent = Math.abs(new Date(x.invert(width)) - new Date(x.invert(0)));
			
		svg2
			.attr("r", Geometry.calculateRadius(fullExtent, currentExtent))
			.style("stroke", "darkgrey")
			.style("opacity", "1");
	
		textInCircles
			.style("opacity", "1");
			
		data.forEach(function(d){ d.isHighlighted = false; });
			
		$('.legend').find('text').css('font-weight', 'normal');
		d3.select('.legend').select("div").style("border", "none")
	};
		
		
		
	/******************************************************************************************************************
	* 
	*	Nodes can be highlighted from the Vis-Template though the following function
	* 
	* ***************************************************************************************************************/
		
	TIMEVIS.Render.highlightNodes = function( nodesToHighlight, sender ){

        TIMEVIS.Render.remove();

        var radius = Geometry.calculateRadius(fullExtent, currentExtent);

		// if length > 0 there are nodes to highlight, otherwise tag box is empty and no node should be highlighted
		if(nodesToHighlight.length > 0) {

	
			//circles
			svg2
				.attr("r", function(d, i){
					if(nodesToHighlight.indexOf(i) != -1){
						d.isHighlighted = true;
						return parseFloat(radius) + 1;
					}
					d.isHighlighted = false;
					return radius;
				})
				.style("stroke", function(d, i){
					if(nodesToHighlight.indexOf(i) != -1)
						return "black";
					return "darkgrey";
				})
				.style("opacity", function(d, i){
					if(nodesToHighlight.indexOf(i) != -1)
						return 1;
					return 0.1;
				});
				
			textInCircles
				.style("opacity", function(d, i){
					if(nodesToHighlight.indexOf(i) != -1)
						return 1;
					return 0.1;
				});
				
		}
        else{

            svg2
                //.attr("r", radius)
                .style("stroke", "darkgrey")
                .style("opacity", 1);
				
			textInCircles	
				.style("opacity", 1);
        }

		if(sender !== 'legend')
			this.clearLegends();
	};
		
		
		
	TIMEVIS.Render.clearLegends = function(){
			
		legendDomain.forEach(function(l){
			l.selected = false;
		});
		
		$('.legend').find('text').css('font-weight', 'normal');
		d3.selectAll('.legend').select("div").style("border", "none");
	};
	
	
	
	
	/******************************************************************************************************************
	* 
	*	Nodes can be selected from the Vis-Template by indicating a single index or an array of indices
	* 
	* *****************************************************************************************************************/

	TIMEVIS.Render.selectNodes = function( nodesIndices, sender ){
		
		if( Array.isArray(nodesIndices) ){
			TIMEVIS.Render.highlightNodes( nodesIndices );
		}
		else if( typeof nodesIndices != 'undefined' && nodesIndices != 'undefined' ){
			var index = nodesIndices;
			var datum = TIMEVIS.Input.data[index];
		
			TIMEVIS.Evt.nodeClicked(datum, index, sender);
		}	
	};
		
		

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

	TIMEVIS.Ext = {
		
		draw : function(initData, mapping, iWidth, iHeight){
			TIMEVIS.Render.draw(initData, mapping, iWidth, iHeight);
		},
		
		reset : function(){
			TIMEVIS.Render.reset();
			TIMEVIS.Render.redraw();
		},
		
		selectNodes : function( indicesToHighlight, sender ){
			TIMEVIS.Render.selectNodes( indicesToHighlight, sender );
		}
			
	};

	
	return TIMEVIS.Ext;
	
}
