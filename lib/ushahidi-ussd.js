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

    self.list_categories = function() {
        var p = new Promise();
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

    self.submit_report = function(title, description, category, latitude,
                                    longitude, location_name) {
        // Do nothing, dummy API.
        return success(true);
    };
}

function UshahidiReport() {
    var self = this;
    StateCreator.call(self, 'intro');

    self.ushahidi_api = function(im) {
        var cfg = im.config.ushahidi_api;
        if(!cfg) {
            im.log('Using dummy Ushahidi API.');
            return new DummyUshahidiApi(im);
        }
        im.log('Using real Ushahidi API.');
        return new UshahidiApi(im, cfg.url);
    };

    self.add_state(new ChoiceState(
        'intro',
        "report_title",
        "Select a category:", [
            new Choice("1", "Category 1"),
            new Choice("2", "Category 2"),
            new Choice("3", "Category 3")
        ],
        "Please select a valid category."
        ));

    self.add_state(new FreeText(
        "report_title",
        "report_description",
        "What is the title?"
        ));

    self.add_state(new FreeText(
        "report_description",
        "report_location",
        "What is the description?"
        ));

    self.add_state(new FreeText(
        "report_location",
        "submit_report",
        "Please type in the address"
        ));

    self.add_state(new EndState(
        "submit_report",
        "Thank you, your report has been submitted",
        "intro"
        ));
}

// launch app
var states = new UshahidiReport();
var im = new InteractionMachine(api, states);
im.attach();
