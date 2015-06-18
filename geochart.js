
function Geochart(root, visTemplate) {

	var GEO = {};
	GEO.Settings = new Settings('geochart');

	var Vis = visTemplate;
	var data;
    var colorScale;
    var width, height;
    var colorChannel;
    GEO.$root = $(root);
    GEO.ClusterSettings = {
        minSize:32,
        maxSize:64,
        minAmount:2,
        maxAmount:8
    };

    var recivedData_ = null;
	


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	/* Event handlers  */

	GEO.Evt = {};






////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    /*  Additional methods, if necessary*/

	GEO.Internal = {

        getRandomInRange: function (from, to, fixed) {
            return (Math.random() * (to - from) + from).toFixed(fixed) * 1;
            // .toFixed() returns string, so ' * 1' is a trick to convert to number
        },
        getRandomLatLon: function (i) {
            return [GEO.Internal.getRandomInRange(-20, 60, 3), GEO.Internal.getRandomInRange(-120, 120, 3)];
            //return [(20 + i).toFixed(3) * 1, (0).toFixed(3) * 1];
        },
        spatializeData: function(data){
            for(var i=0; i<data.length; i++){
                if (!data[i].coordinate)
                    data[i].coordinate = GEO.Internal.getRandomLatLon(i);
            }
        },
        getDataIndex: function(id){
            for(var i=0; i<GEO.Input.data.length; i++){
                if (GEO.Input.data[i].id == id)
                    return i;
            }
            return null;
        },
		getDataIndexArrayPerSelection: function(layer){
			var indexArray = [];
			var rectBounds = layer.getBounds();
			var inputData = GEO.Input.data;
		    for(var i=0; i < inputData.length; i++){
				if(
                    inputData[i].coordinate && inputData[i].coordinate.length == 2 &&
					rectBounds.getWest() <= inputData[i].coordinate[1] &&
					inputData[i].coordinate[1] <= rectBounds.getEast() &&
					rectBounds.getSouth() <= inputData[i].coordinate[0] &&
					inputData[i].coordinate[0] <= rectBounds.getNorth()
					)
				{
					indexArray.push(i);
				}
            }
            return indexArray;
		}
    };






////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

	GEO.Render = {};



	/******************************************************************************************************************
	*
	*	Draw GEO vis
	*
	* ***************************************************************************************************************/
	GEO.Render.draw = function( receivedData, mappingCombination, iWidth, iHeight ){

		// See settings.js

		/******************************************************
		*	Define canvas dimensions
		******************************************************/
		GEO.Dimensions = GEO.Settings.getDimensions( root, iWidth, iHeight);
		width   = GEO.Dimensions.width;
		height  = GEO.Dimensions.height;
		colorScale   = d3.scale.category10();
        colorChannel = 'language';
        for(var i=0; i<mappingCombination.length; i++)
            if (mappingCombination[i].visualattribute == 'color')
                colorChannel = mappingCombination[i].facet;

        recivedData_ = receivedData;
		/******************************************************
		*	Define input variables
		******************************************************/
		GEO.Input = GEO.Settings.getInitData(receivedData );

        GEO.$root.append('<div id="mapInner" style="height:100%"></div>');

        GEO.map = L.map('mapInner');
        GEO.Render.centerMap();
        L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(GEO.map);
        GEO.Render.drawMarkers();

        $(document).keyup(function(e) {
            if (e.keyCode == 27) { // ESC
                GEO.Render.deleteCurrentSelect();
                Vis.selectItems(Vis.getAllSelectListItems(), false);
            } 
        });
	};
	GEO.Render.deleteCurrentSelect = function(){
		if(currentOneLayer != null && GEO.map.hasLayer(currentOneLayer)){
			GEO.map.removeLayer(currentOneLayer);
			currentOneLayer = null;
		}
	};
	
    var currentOneLayer = null;
	
    GEO.Render.centerMap = function(){
        GEO.map.setView([51.505, -0.09], 2);
    };

    GEO.Render.drawMarkers = function(){

        GEO.Markers = new L.MarkerClusterGroup({

            iconCreateFunction: function(cluster) {
                var markers = cluster.getAllChildMarkers();
               
                var html_markers = "";
  
                for (var i = 0; i < markers.length; i++) {
                    html_markers += markers[i].options.icon.options.html;
                }

                return L.divIcon({ html: html_markers, className: 'mycluster', iconSize: L.point(42, 100) });
            },

            spiderfyOnMaxZoom: false, showCoverageOnHover: true, zoomToBoundsOnClick: false
        });

        for(var i = 0; i < GEO.Input.data.length; i++){
			
            // this check if selected data has a coordinate
            if (GEO.Input.data[i].coordinate == null ||GEO.Input.data[i].coordinate.length < 2)
                continue;

            var currentDataObject = GEO.Input.data[i];

			// add an default image if there is not icon image
            if (recivedData_[i].previewImage == undefined){
                currentDataObject.previewImage = "http://www.mydaymyplan.com//images/no-image-large.png";
                currentDataObject.index = i;
            }else{
                // added images in currentData
                currentDataObject.previewImage = recivedData_[i].previewImage;
                currentDataObject.index = i;
            }

            currentDataObject.color = colorScale(currentDataObject.facets[colorChannel]);

            ////to add image as icon: , currentDataObject.previewImage
            var marker = new GEO.Render.Marker(GEO.Input.data[i].coordinate, { icon: GEO.Render.icon(currentDataObject.color, currentDataObject.previewImage, currentDataObject.index)});

            marker.options.dataObject = currentDataObject;

            marker.bindPopup(GEO.Input.data[i].title);

            GEO.Markers.addLayer(marker);

            marker.on('click', function(e){
                if (e && e.target && e.target.options && e.target.options.dataObject){
                    GEO.Render.deleteCurrentSelect();
                    Vis.selectItems([GEO.Internal.getDataIndex(e.target.options.dataObject.id)], true);
                }
            }).on('popupclose', function(){
                    Vis.selectItems([]);
                });

        }

        GEO.map.on('layeradd', function(e){/*console.log("START ADD", e);*/ createSlider(); });
        //TestPlugin.map.on('moveend', function(e){/*console.log("MOVE:", e);*/ createSlider(); });
        GEO.map.addLayer(GEO.Markers);

		// if we click on the cluster group it will return all indexes of the markers in this cluster group and it will highlighted them in the vis-template
        GEO.Markers.on('clusterclick', function (a) {
            var temp_markers =  a.layer.getAllChildMarkers();

            var selected_markers = [];

            for(var i = 0; i < temp_markers.length; i++){
                //console.log("TEST " + i + ": " + temp_markers[i].options.icon.options.html);

                var html_value = temp_markers[i].options.icon.options.html;
                var pos_data_index_start = html_value.search("data-index=") + ("data-index=").length + 1;
                var pos_data_index_end = html_value.indexOf("\"", pos_data_index_start);
                //console.log(html_value.substring(pos_data_index_start, pos_data_index_end));// html_value[pos_data_index] + html_value[pos_data_index + 1]);

                var data_index_value = parseInt(html_value.substring(pos_data_index_start, pos_data_index_end));
                selected_markers.push(data_index_value);
            }

            Vis.selectItems(selected_markers);
        });
    };

    //------------------------------------------------------------------------------------------------------------------
	// creating the slider 
    function createSlider(){

        $(".mycluster").slick({
            centerMode: true,
            vertical: true,
            centerPadding: '10px', //
            slidesToShow: 1,
			infinite: false, //
			focusOnSelect: true, //
			initialSlide: 1, //
            responsive: [
                {
                    breakpoint: 50,
                    settings: {
                        arrows: true,
                        centerMode: true,
                        centerPadding: '10px',
                        slidesToShow: 1
                    }
                },
                {
                    breakpoint: 50,
                    settings: {
                        arrows: true,
                        centerMode: true,
                        centerPadding: '10px',
                        slidesToShow: 1
                    }
                }
            ]
        });
    }

    GEO.Render.Marker = L.Marker.extend({
        options:{
            dataObject: null
        }
    });

    GEO.Render.icon = function(color,image, index){
        return new L.divIcon({

            iconAnchor: [0,0], //m
            className:  'leaflet-div-icon',
            
            html:'<div><a class="image-marker" href="#" data-index="' + index + '"><img style="border:3px solid '+ color +'" src="'+image+'" width="34" height="36" /></a></div>'
        });
    };

    // credits to: http://stackoverflow.com/questions/7261318/svg-chart-generation-in-javascript
    GEO.Render.makeSVG = function(tag, attrs) {
        var el= document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (var k in attrs)
            if (attrs.hasOwnProperty(k)) el.setAttribute(k, attrs[k]);
        return el;
    };

    GEO.Render.getClusterSize = function(clusterSettings, markersCount){
        var divider = clusterSettings.maxAmount - clusterSettings.minAmount;
        var sizeGrowthPerMarker = (clusterSettings.maxSize - clusterSettings.minSize) / divider;
        var sizeMultiplier = markersCount - clusterSettings.minAmount;
        if (sizeMultiplier < 0)
            sizeMultiplier = 0;
        if (sizeMultiplier > divider)
            sizeMultiplier = divider;
        var size = clusterSettings.minSize + (sizeMultiplier * sizeGrowthPerMarker);
        size = Math.round(size/4)*4; // pixel should be able to divide without remainder
        return size;
    };

    GEO.Render.drawArcs = function(paper, piePartsCountColor){
        var total = piePartsCountColor.reduce(function (previous, current) { return previous + current.count; }, 0);
        var sectorAngleArr = piePartsCountColor.map(function (v) { return 360 * v.count / total; });
        var startAngle = 0;
        var endAngle = 0;
        for (var i=0; i<sectorAngleArr.length; i++){
            startAngle = endAngle;
            endAngle = startAngle + sectorAngleArr[i];
            var x1,x2,y1,y2 ;
            x1 = parseInt(Math.round(200 + 195*Math.cos(Math.PI*startAngle/180)));
            y1 = parseInt(Math.round(200 + 195*Math.sin(Math.PI*startAngle/180)));
            x2 = parseInt(Math.round(200 + 195*Math.cos(Math.PI*endAngle/180)));
            y2 = parseInt(Math.round(200 + 195*Math.sin(Math.PI*endAngle/180)));
            var d = "M200,200  L" + x1 + "," + y1 + "  A195,195 0 " + ((endAngle-startAngle > 180) ? 1 : 0) + ",1 " + x2 + "," + (y2 == 200 ? 199 : y2) + " z";
            //alert(d); // enable to see coords as they are displayed
            // original:
            //var c = parseInt(i / sectorAngleArr.length * 360);
            //var arc = GEO.Render.makeSVG("path", {d: d, fill: "hsl(" + c + ", 66%, 50%)"});
            var arc = GEO.Render.makeSVG("path", {d: d, fill: piePartsCountColor[i].color,  transform : "rotate(-90 200 200)"});
            paper.appendChild(arc);
            //arc.onclick = clickHandler; // This is optional, of course
        }
        return paper;
    };



	/******************************************************************************************************************
	*
	*	Reset GEO  vis
	*
	* ***************************************************************************************************************/
	GEO.Render.reset = function(  ){
        GEO.map.removeLayer(GEO.markersGroup);
        GEO.Render.drawMarkers();
        GEO.Render.centerMap();
		GEO.Render.deleteCurrentSelect();
	};



    /******************************************************************************************************************
	*
	*	Highlight items
    *   @param indexArray: array with items' indices to highlight. They match items in receivedData (parameter in Render.draw)
	*
	* ***************************************************************************************************************/
	GEO.Render.highlightItems = function(indexArray){
        GEO.map.closePopup();
        indexArray.forEach(function(i) {
            GEO.markersGroup.zoomToShowLayer(GEO.Input.data[i].geoMarker, function() {
                GEO.Input.data[i].geoMarker.openPopup();
            });
            //GEO.Input.data[i].geoMarker.openPopup();
        });
		GEO.Render.deleteCurrentSelect();
    };


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

	GEO.Ext = {
		draw: function( receivedData, mappingCombination, iWidth, iHeight ){ GEO.Render.draw(receivedData, mappingCombination, iWidth, iHeight); },
		reset: function(){ GEO.Render.reset();	},
        highlightItems: function(indexArray){ GEO.Render.highlightItems(indexArray); }
	};


	return GEO.Ext;

}
