var vumigo = require("vumigo_v01");
var jed = require("jed");

if (typeof api === "undefined") {
    // testing hook (supplies api when it is not passed in by the real sandbox)
    var api = this.api = new vumigo.dummy_api.DummyApi();
    var test_utils = require('../test/utils.js');
}

var Promise = vumigo.promise.Promise;
var success = vumigo.promise.success;
var Choice = vumigo.states.Choice;
var ChoiceState = vumigo.states.ChoiceState;
var FreeText = vumigo.states.FreeText;
var EndState = vumigo.states.EndState;
var InteractionMachine = vumigo.state_machine.InteractionMachine;
var StateCreator = vumigo.state_machine.StateCreator;


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
        data = self.url_encode(data);
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
                                    longitude, location_name, date, hour,
                                    minute) {

        var ampm = (hour < 12 ? 'am': 'pm');
        var formatted_hour = ((hour + 11) % 12 + 1);
        var param = {
            'incident_title': title,
            'incident_description': description,
            'incident_date': date,
            'incident_hour': formatted_hour,
            'incident_minute': minute,
            'incident_ampm': ampm,
            'incident_category': category,
            'latitude': latitude,
            'longitude': longitude,
            'location_name': location_name,
            'task': 'report'
        };
        var response = self.ushahidi_post('report', param);
        return success(response);
    };

}

function UshahidiReport() {
    var self = this;
    StateCreator.call(self, 'report_title');

    self.ushahidi_api = function(im) {
        var cfg = im.config.ushahidi_api;
        if(!cfg) {
            im.log('Using dummy Ushahidi API.');
            return new test_utils.DummyUshahidiApi(im);
        }
        im.log('Using real Ushahidi API.');
        return new UshahidiApi(im, cfg.ushahidi_url, cfg.geocode_url);
    };

    self.add_state(new FreeText(
        "report_title",
        "report_description",
        "Welcome to Ushahidi\nWhat is the report title?"
        ));

    self.add_state(new FreeText(
        "report_description",
        "report_category",
        "What is the event description?"
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

    self.padded = function(nr) {
        return nr < 10 ? '0' + nr : nr;
    };

    self.add_state(new EndState(
        "submit_report",
        "Thank you, your report has been submitted.",
        "report_title",
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
                var d = im.get_user_answer('test_date') || new Date();
                var date = (self.padded(d.getMonth() + 1) + '/' +
                                self.padded(d.getDate()) + '/' +
                                d.getFullYear());
                var hour = d.getHours();
                var minute = d.getMinutes();
                ushahidi_api.submit_report(title, description, category,
                                            lat, lng, name, date, hour, minute);
            }
        }
    ));
}

// launch app
var states = new UshahidiReport();
var im = new InteractionMachine(api, states);
im.attach();
