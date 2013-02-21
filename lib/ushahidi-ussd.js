var vumigo = require("vumigo_v01");
var jed = require("jed");

if (typeof api === "undefined") {
    // testing hook (supplies api when it is not passed in by the real sandbox)
    var api = this.api = new vumigo.dummy_api.DummyApi();
}

var Promise = vumigo.promise.Promise;
var success = vumigo.promise.success;
var maybe_promise = vumigo.promise.maybe_promise;
var State = vumigo.states.State;
var Choice = vumigo.states.Choice;
var ChoiceState = vumigo.states.ChoiceState;
var LanguageChoice = vumigo.states.LanguageChoice;
var PaginatedChoiceState = vumigo.states.PaginatedChoiceState;
var FreeText = vumigo.states.FreeText;
var EndState = vumigo.states.EndState;
var InteractionMachine = vumigo.state_machine.InteractionMachine;
var StateCreator = vumigo.state_machine.StateCreator;

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
            return json['payload']['categories'].map(function(category) {
                return {
                    id: category['category']['id'],
                    text: category['category']['title']
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
            return json['results'].map(function(result) {
                var location = result.geometry.location;
                return {
                    id: (location.lat + "@" +
                            location.lng + "@" +
                            result['formatted_address']),
                    text: result['formatted_address']
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

function UshahidiApiError(msg) {
    var self = this;
    self.msg = msg;

    self.toString = function() {
        return "<UshahidiApiError: " + self.msg + ">";
    };
}

function UshahidiApi(im, ushahidi_url, geocode_url) {
    var self = this;

    self.im = im;
    self.ushahidi_url = ushahidi_url;
    self.geocode_url = geocode_url;
    self.headers = {
        'Content-Type': ['application/x-www-form-urlencoded']
    };

    self.check_reply = function(reply, url, method, data, ignore_error) {
        var error;
        if (reply.success && reply.code == 200) {
            var json = JSON.parse(reply.body);
            return json;
        }
        else {
            error = reply.reason;
        }
        var error_msg = ("API " + method + " to " + url + " failed: " +
                         error);
        if (typeof data != 'undefined') {
            error_msg = error_msg + '; data: ' + JSON.stringify(data);
        }
        self.im.log(error_msg);
        if (!ignore_error) {
            throw new UshahidiApiError(error_msg);
        }
    };

    self.url_encode = function(params) {
        var items = [];
        for (var key in params) {
            items[items.length] = (encodeURIComponent(key) + '=' +
                                   encodeURIComponent(params[key]));
        }
        return items.join('&');
    };

    self.ushahidi_get = function(api_cmd) {
        var p = new Promise();
        var url = self.ushahidi_url;
        url = url + '?' + self.url_encode({
            'task': api_cmd
        });
        self.im.api.request("http.get", {
                url: url,
                headers: self.headers
            },
            function(reply) {
                var json = self.check_reply(reply, url, 'GET', false);
                p.callback(json);
            });
        return p;
    };

    self.ushahidi_post = function(api_cmd, data, ignore_error) {
        var p = new Promise();
        var url = self.ushahidi_url + '?' + (encodeURIComponent('task') + '=' +
                                                encodeURIComponent(api_cmd));
        console.log(url);
        data = self.url_encode(data);
        console.log(data);
        self.im.api.request("http.post", {
                url: url,
                headers: self.headers,
                data: data
            },
            function(reply) {
                var json = self.check_reply(reply, url, 'POST', data,
                                            ignore_error);
                p.callback(json);
            });
        return p;
    };

    self.list_categories = function() {
        var p = self.ushahidi_get('categories');
        p.add_callback(function(json) {
            return json['payload']['categories'].map(function(category) {
                return {
                    id: category['category']['id'],
                    text: category['category']['title']
                };
            });
        });
        return p;
    };

    self.geolocate_get = function(address) {
        var p = new Promise();
        var url = self.geocode_url;
        var params = {
            'address': address,
            'sensor': 'false'
        };
        var items = [];
        for (var key in params) {
            items[items.length] = (encodeURIComponent(key) + '=' +
                                   encodeURIComponent(params[key]));
        }
        if (items.length !== 0) {
            url = url + '?' + items.join('&');
        }
        self.im.api.request("http.get", {
                url: url,
                headers: self.headers
            },
            function(reply) {
                var json = self.check_reply(reply, url, 'GET', false);
                p.callback(json);
            });
        return p;
    };

    self.find_addresses = function(address) {
        var addresses = self.geolocate_get(address);
        addresses.add_callback(function(json) {
            return json['results'].map(function(result) {
                var location = result.geometry.location;
                return {
                    id: (location.lat + "@" +
                            location.lng + "@" +
                            result['formatted_address']),
                    text: result['formatted_address']
                };
            });
        });
        return addresses;
    };

    self.submit_report = function(title, description, category, latitude,
                                    longitude, location_name) {
        // Do nothing, dummy API.
        var param = {
            'title': title,
            'description': description,
            'category': category,
            'latitude': latitude,
            'longitude': longitude,
            'location_name': location_name
        };
        var response = self.ushahidi_post('report', param);
        console.log(response);
        console.log(param);
        return success(true);
    };

}

function UshahidiReport() {
    var self = this;
    StateCreator.call(self, 'report_title');

    self.ushahidi_api = function(im) {
        var cfg = im.config.ushahidi_api;
        if(!cfg) {
            im.log('Using dummy Ushahidi API.');
            return new DummyUshahidiApi(im);
        }
        im.log('Using real Ushahidi API.');
        return new UshahidiApi(im, cfg.ushahidi_url, cfg.geocode_url);
    };

    self.add_state(new FreeText(
        "report_title",
        "report_description",
        "What is the title?"
        ));

    self.add_state(new FreeText(
        "report_description",
        "report_category",
        "What is the description?"
        ));

    self.add_creator("report_category", function(state_name, im) {
        var ushahidi_api = self.ushahidi_api(im);
        var p = ushahidi_api.list_categories();
        p.add_callback(function(categories) {
            var choices = categories.map(function(c) {
                return new Choice(c.id, c.text);
            });
            return new ChoiceState(
                state_name,
                'report_location',
                'Select a category:', choices
                );
        });
        return p;
    });

    self.add_state(new FreeText(
        "report_location",
        "select_location",
        "Please type in the address"
        ));

    self.add_creator("select_location", function(state_name, im) {
        var ushahidi_api = self.ushahidi_api(im);
        var given_location = im.get_user_answer("report_location");
        var p = ushahidi_api.find_addresses(given_location);
        p.add_callback(function(matches) {
            var choices = matches.map(function(m) {
                return new Choice(m.id, m.text);
            });
            choices[choices.length] = new Choice("try_again", "None of the above");
            return new ChoiceState(
                state_name,
                function(choice) {
                    return (choice.value == "try_again" ?
                            "report_location" :
                            "submit_report");
                },
                "Select a match:", choices);
        });
        return p;
    });

    self.add_state(new EndState(
        "submit_report",
        "Thank you, your report has been submitted",
        "intro",
        {
            on_enter: function() {
                var ushahidi_api = self.ushahidi_api(im);
                var select_location = im.get_user_answer('select_location').split('@');
                var lat = select_location[0];
                var lng = select_location[1];
                var name = select_location[2];
                var title = im.get_user_answer('report_title');
                var description = im.get_user_answer('report_description');
                var category = im.get_user_answer('report_category');
                ushahidi_api.submit_report(title, description, category,
                                            lat, lng, name);
            }
        }
    ));
}

// launch app
var states = new UshahidiReport();
var im = new InteractionMachine(api, states);
im.attach();
