var allStores;

var map,
    markers,
    infoWindows,
    geocoder,
    distanceService,
    directionsDisplay,
    directionsService;

$.getJSON("25stores.json", function(data) {
    allStores = data;
});

google.maps.event.addDomListener(window, 'load', initialize);

function initialize() {
    var mapOptions = {
        zoom: 4,
        center: new google.maps.LatLng(40.037588, -100.393117),
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
    geocoder = new google.maps.Geocoder();
    distanceService = new google.maps.DistanceMatrixService();
    directionsService = new google.maps.DirectionsService();
    directionsDisplay = new google.maps.DirectionsRenderer();
    directionsDisplay.setMap(map);
    directionsDisplay.setPanel(document.getElementById('directions_panel'));

    updateAllMarkers();

    google.maps.event.addListener(map, 'click', function(event) {
        geocoder.geocode({'latLng': event.latLng}, function(results, status) {
            if (status == google.maps.GeocoderStatus.OK) {
                map.setCenter(results[0].geometry.location);
                document.getElementById('user_location').value = results[0].formatted_address;
                distance_panel.innerHTML = '';
                clearMarkers();
                clearDirections();
                display_hide_markers_button.innerHTML = 'Show stores';
                document.getElementById("calculate_distances").style.display='none';
            }
            else {
                alert("Geocoder failed due to: " + status);
            }
        });
    });

    // autocomplete
    var input = (document.getElementById('user_location'));
    var autocomplete = new google.maps.places.Autocomplete(input);

    autocomplete.addListener('place_changed', function() {
        distance_panel.innerHTML = '';
        clearDirections();
        clearMarkers();
        display_hide_markers_button.innerHTML = 'Show stores';
        document.getElementById("calculate_distances").style.display='none';
        var place = autocomplete.getPlace();
        var address = '';
        if (place.address_components) {
            address = [
                (place.address_components[0] && place.address_components[0].short_name || ''),
                (place.address_components[1] && place.address_components[1].short_name || ''),
                (place.address_components[2] && place.address_components[2].short_name || '')
            ].join(' ');
        }
    });
}

function updateAllMarkers() {
    // reset the markers
    if(markers && markers.length > 0) {
        clearMarkers();
    }

    markers = [];
    infoWindows = [];
    if(allStores !== undefined) {
        allStores.forEach(function(store) {

            var marker = new google.maps.Marker({
                position: new google.maps.LatLng(store.lat, store.lng),
                title:store.name
            });
            var infoWindow = new google.maps.InfoWindow();
            infoWindows.push(infoWindow);
            marker.addListener('click', function() {
                geocoder.geocode({latLng: marker.getPosition()}, function(results, status) {
                    if(status === google.maps.GeocoderStatus.OK) {
                        infoWindows[markers.indexOf(marker)].setContent('<h3>' + marker.title + '</h3>' +
                            '<p>' + results[0].formatted_address + '</p>');
                        if(document.getElementById('user_location').value !== '') {
                            infoWindows[markers.indexOf(marker)].setContent(infoWindows[markers.indexOf(marker)].getContent() +
                                '<p><button id="show_directions" type="button" ' +
                                'onclick="showDirections(' + markers.indexOf(marker) + ');">Directions</button></p>');
                        }
                    } else {
                        infoWindows[markers.indexOf(marker)].setContent('<h3>' + marker.title + '</h3><br>revere geocode failed:' + status);
                    }
                });
                infoWindows[markers.indexOf(marker)].open(map, marker);
            });
            markers.push(marker);
        });
    }
}

function showHideMarkers(buttonId) {
    var numberOfStores = document.getElementById('number_of_stores').value;
    if(document.getElementById(buttonId).innerHTML === 'Show stores') {
        //if user has given its location
        if(document.getElementById('user_location').value !== '') {
            calculateDistances(function(response, status) {
                if (status != google.maps.DistanceMatrixStatus.OK) {
                    alert('Error was: ' + status);
                } else {
                    updateAllStores(response);
                    // recreate markers for the sorted stores
                    updateAllMarkers();
                    setMapBounds(markers.slice(0, numberOfStores));
                    showMarkers(markers.slice(0, numberOfStores));
                }
            });
        } else {
            setMapBounds(markers.slice(0, numberOfStores));
            showMarkers(markers.slice(0, numberOfStores));
        }
        if(document.getElementById('user_location').value) {
            document.getElementById("calculate_distances").style.display='block';
        }
        document.getElementById(buttonId).innerHTML = 'Hide stores';
    } else {
        clearMarkers();
        clearDirections();
        distance_panel.innerHTML = '';
        document.getElementById("calculate_distances").style.display='none';
        document.getElementById(buttonId).innerHTML = 'Show stores';
    }
}

function showMarkers(mapMarkers) {
    if(mapMarkers) {
        mapMarkers.forEach(function(marker) {
            marker.setMap(map);
        });
    }
}
function setMapBounds(mapMarkers) {
    if(mapMarkers) {
        var bounds = new google.maps.LatLngBounds();
        mapMarkers.forEach(function(marker) {
            bounds.extend(marker.getPosition());
        });
        map.fitBounds(bounds);
    }
}

function clearMarkers() {
    markers.forEach(function(marker) {
        marker.setMap(null);
        // the code below works better than infowindow.close()
        infoWindows[markers.indexOf(marker)].setMap(null);
        infoWindows[markers.indexOf(marker)].setAnchor(null);
    });
}

function adjustValue(inputId) {
    var number = document.getElementById(inputId);
    if(number.value < 1) {
        number.value = 1;
    } else if(number.value > 25) {
        number.value = 25;
    }

    if(display_hide_markers_button.innerHTML === 'Hide stores') {
        clearMarkers();
        clearDirections();
        setMapBounds(markers.slice(0, number.value));
        showMarkers(markers.slice(0, number.value));
        distance_panel.innerHTML = '';
    }
}

function showHideDistance(inputId) {
    if(document.getElementById(inputId).value && display_hide_markers_button.innerHTML === 'Hide stores') {
        document.getElementById("calculate_distances").style.display='block';
    } else {
        document.getElementById("calculate_distances").style.display='none';
        distance_panel.innerHTML = '';
    }
}

function updateAllStores(response) {
    var origins = response.originAddresses;
    for(var i = 0; i < origins.length; i++) {
        var results = response.rows[i].elements;
        for(var j = 0; j < results.length; j++) {
            var element = results[j];
            if(element.status === 'OK') {
                allStores[j].distance = element.distance;
            } else {
                allStores[j].distance = {
                    value: 0,
                    text: 'unreachable'
                };
            }
        }
    }
    // sort stores depending on distance
    allStores.sort(function(a, b){
        return a.distance.value - b.distance.value;
    });
}

function calculateDistances(callback) {
    var origin = document.getElementById('user_location').value;
    if(origin) {
        var destinations = [];
        allStores.forEach(function (store) {
            destinations.push(store.address);
        });
        distanceService.getDistanceMatrix(
            {
                origins: [origin],
                destinations: destinations,
                travelMode: google.maps.TravelMode.DRIVING,
                unitSystem: google.maps.UnitSystem.METRIC,
                avoidHighways: false,
                avoidTolls: false
            }, callback);
    }
}

function displayDistances() {
    // clear what is in distance_panel
    clearDirections();
    distance_panel.innerHTML = '';
    var numberOfStores = document.getElementById('number_of_stores').value;
    for(var i = 0; i < numberOfStores; i++) {
        distance_panel.innerHTML += allStores[i].distance.text + " from " + allStores[i].address + "<br />";
    }
    // update markers
    clearMarkers();
    setMapBounds(markers.slice(0, numberOfStores));
    showMarkers(markers.slice(0, numberOfStores));
}

function showDirections(markerId) {
    var request = {
        origin : document.getElementById('user_location').value,
        destination : allStores[markerId].address,
        travelMode : google.maps.DirectionsTravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC
    };

    directionsService.route(request, function(response, status) {
        if(status == google.maps.DirectionsStatus.OK) {
            distance_panel.innerHTML = '';
            directionsDisplay.setMap(map);
            directionsDisplay.setDirections(response);
        } else {
            distance_panel.innerHTML = '';
            directions_panel.innerHTML = 'Unreachable. Cannot get directions.';
        }
    });
}

function clearDirections() {
    directionsDisplay.setMap(null);
    directions_panel.innerHTML = '';
}
