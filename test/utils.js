var vumigo = require("vumigo_v01");
var Promise = vumigo.promise.Promise;
var success = vumigo.promise.success;

function DummyUshahidiApi(im) {
    var self = this;

    this.im = im;

    self.get_categories = function() {
        var p = new Promise();
        // response from https://vumi.crowdmap.com/api?task=categories
        p.callback({
            "payload": {
                "domain": "https:\/\/vumi.crowdmap.com\/",
                "categories": [{
                    "category": {
                        "id": "1",
                        "parent_id": "0",
                        "title": "Category 1",
                        "description": "Category 1",
                        "color": "9900CC",
                        "position": "0",
                        "icon": ""
                    },
                    "translations": []
                }, {
                    "category": {
                        "id": "2",
                        "parent_id": "0",
                        "title": "Category 2",
                        "description": "Category 2",
                        "color": "3300FF",
                        "position": "0",
                        "icon": ""
                    },
                    "translations": []
                }, {
                    "category": {
                        "id": "3",
                        "parent_id": "0",
                        "title": "Category 3",
                        "description": "Category 3",
                        "color": "663300",
                        "position": "0",
                        "icon": ""
                    },
                    "translations": []
                }, {
                    "category": {
                        "id": "4",
                        "parent_id": "0",
                        "title": "Trusted Reports",
                        "description": "Reports from trusted reporters",
                        "color": "339900",
                        "position": "0",
                        "icon": ""
                    },
                    "translations": []
                }]
            },
            "error": {
                "code": "0",
                "message": "No Error"
            }
        });
        return p;
    };

    self.list_categories = function() {
        var p = self.get_categories();
        p.add_callback(function(json) {
            var payload = json.payload;
            return payload.categories.map(function(category) {
                return {
                    id: category.category.id,
                    text: category.category.title
                };
            });
        });
        return p;
    };

    self.geolocate = function(address) {
        var p = new Promise();
        p.callback({
           "results" : [
              {
                 "address_components" : [
                    {
                       "long_name" : "1600",
                       "short_name" : "1600",
                       "types" : [ "street_number" ]
                    },
                    {
                       "long_name" : "Amphitheatre Pkwy",
                       "short_name" : "Amphitheatre Pkwy",
                       "types" : [ "route" ]
                    },
                    {
                       "long_name" : "Mountain View",
                       "short_name" : "Mountain View",
                       "types" : [ "locality", "political" ]
                    },
                    {
                       "long_name" : "Santa Clara",
                       "short_name" : "Santa Clara",
                       "types" : [ "administrative_area_level_2", "political" ]
                    },
                    {
                       "long_name" : "California",
                       "short_name" : "CA",
                       "types" : [ "administrative_area_level_1", "political" ]
                    },
                    {
                       "long_name" : "United States",
                       "short_name" : "US",
                       "types" : [ "country", "political" ]
                    },
                    {
                       "long_name" : "94043",
                       "short_name" : "94043",
                       "types" : [ "postal_code" ]
                    }
                 ],
                 "formatted_address" : "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA",
                 "geometry" : {
                    "location" : {
                       "lat" : 37.42291810,
                       "lng" : -122.08542120
                    },
                    "location_type" : "ROOFTOP",
                    "viewport" : {
                       "northeast" : {
                          "lat" : 37.42426708029149,
                          "lng" : -122.0840722197085
                       },
                       "southwest" : {
                          "lat" : 37.42156911970850,
                          "lng" : -122.0867701802915
                       }
                    }
                 },
                 "types" : [ "street_address" ]
              }
           ],
           "status" : "OK"
        });
        return p;
    };

    self.find_addresses = function(address) {
        var addresses = self.geolocate(address);
        addresses.add_callback(function(json) {
            return json.results.map(function(result) {
                var location = result.geometry.location;
                return {
                    id: (location.lat + "@" +
                            location.lng + "@" +
                            result.formatted_address),
                    text: result.formatted_address
                };
            });
        });
        return addresses;
    };


    self.submit_report = function(title, description, category, latitude,
                                    longitude, location_name) {
        // Do nothing, dummy API.
        return success(true);
    };
}

module.exports = {
    DummyUshahidiApi: DummyUshahidiApi
};