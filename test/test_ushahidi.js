var fs = require("fs");
var assert = require("assert");
var app = require("../lib/ushahidi-ussd");

describe("test_api", function() {
    it("should exist", function() {
        assert.ok(app.api);
    });
    it("should have an on_inbound_message method", function() {
        assert.ok(app.api.on_inbound_message);
    });
    it("should have an on_inbound_event method", function() {
        assert.ok(app.api.on_inbound_event);
    });
});

function reset_im(im) {
    im.user = null;
    im.i18n = null;
    im.i18n_lang = null;
    im.current_state = null;
}

function fresh_api() {
    var api = app.api;
    api.reset();
    reset_im(api.im);
    return api;
}

function maybe_call(f, that, args) {
    if (typeof f != "undefined" && f !== null) {
        f.apply(that, args);
    }
}

function check_state(user, content, next_state, expected_response, setup,
                     teardown) {
    // setup api
    var api = fresh_api();
    var from_addr = "1234567";
    var user_key = "users." + from_addr;
    api.kv_store[user_key] = user;

    maybe_call(setup, this, [api]);

    api.add_reply({
        cmd: "outbound.reply_to"
    });

    // send message
    api.on_inbound_message({
        cmd: "inbound-message",
        msg: {
            from_addr: from_addr,
            content: content,
            message_id: "123"
        }
    });

    // check result
    var saved_user = api.kv_store[user_key];
    assert.equal(saved_user.current_state, next_state);
    var reply = api.request_calls.shift();
    var response = reply.content;
    try {
        assert.ok(response);
        assert.ok(response.match(expected_response));
        assert.ok(response.length <= 163);
    } catch (e) {
        console.log(api.logs);
        console.log(response);
        console.log(expected_response);
        if (typeof response != 'undefined')
            console.log("Content length: " + response.length);
        throw e;
    }
    assert.deepEqual(app.api.request_calls, []);
    assert.equal(app.api.done_calls, 1);

    maybe_call(teardown, this, [api, saved_user]);
}

function check_close(user, next_state, setup, teardown) {
    var api = fresh_api();
    var from_addr = "1234567";
    var user_key = "users." + from_addr;
    api.kv_store[user_key] = user;

    maybe_call(setup, this, [api]);

    // send message
    api.on_inbound_message({
        cmd: "inbound-message",
        msg: {
            from_addr: from_addr,
            session_event: "close",
            content: "User Timeout",
            message_id: "123"
        }
    });

    // check result
    var saved_user = api.kv_store[user_key];
    assert.equal(saved_user.current_state, next_state);
    assert.deepEqual(app.api.request_calls, []);
    assert.equal(app.api.done_calls, 1);

    maybe_call(teardown, this, [api, saved_user]);
}

function CustomTester(custom_setup, custom_teardown) {
    var self = this;

    self._combine_setup = function(custom_setup, orig_setup) {
        var combined_setup = function (api) {
            maybe_call(custom_setup, self, [api]);
            maybe_call(orig_setup, this, [api]);
        };
        return combined_setup;
    };

    self._combine_teardown = function(custom_teardown, orig_teardown) {
        var combined_teardown = function (api, saved_user) {
            maybe_call(custom_teardown, self, [api, saved_user]);
            maybe_call(orig_teardown, this, [api, saved_user]);
        };
        return combined_teardown;
    };

    self.check_state = function(user, content, next_state, expected_response,
                                setup, teardown) {
        return check_state(user, content, next_state, expected_response,
                           self._combine_setup(custom_setup, setup),
                           self._combine_teardown(custom_teardown, teardown));
    };

    self.check_close = function(user, next_state, setup, teardown) {
        return check_close(user, next_state,
                           self._combine_setup(custom_setup, setup),
                           self._combine_teardown(custom_teardown, teardown));
    };
}

describe("test_ussd_states_for_session_1", function() {
    it("new users should see the report_title state", function () {
        check_state(null, null, "report_title", "^What is the title");
    });
    it("reply 'title' to report_title should go to description", function() {
        check_state({current_state: "report_title"}, "the title",
            "report_description",
            "^What is the description?"
        );
    });
    it("reply 'description' to report_description should go to category",
        function() {
            check_state({current_state: "report_description"}, "the description",
                "report_category",
                "^Select a category:[^]" +
                "1. Category 1[^]" +
                "2. Category 2[^]" +
                "3. Category 3[^]" +
                "4. Trusted Reports$"
           );
        });
    it("reply '1' to report_category should go to address",
        function() {
            check_state({current_state: "report_category"}, "1",
                "report_location",
                "^Please type in the address"
           );
        });
    it("reply 'address' to report_location should come with some suggestions",
        function() {
            check_state({current_state: "report_location"}, "the address",
                "select_location",
                "^Select a match:[^]" +
                "1. 1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA[^]" +
                "2. None of the above$"
            );
        });
    it("reply 'address' to report_location should come with some suggestions",
        function() {
            check_state({current_state: "report_location"}, "the address",
                "select_location",
                "^Select a match:[^]" +
                "1. 1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA[^]" +
                "2. None of the above$"
            );
        });
    it("reply '2' to select_location should try again",
        function() {
            check_state({current_state: "select_location"}, "2",
                "report_location",
                "^Please type in the address"
            );
        });
    it("reply '1' to select_location should submit the report",
        function() {
            var user = {
                current_state: "select_location",
                answers: {
                    report_title: 'The title',
                    report_description: 'The description',
                    report_category: '1'
                }
            };
            check_state(user, "1",
                "submit_report",
                "^Thank you, your report has been submitted"
            );
        });

});

describe('ushahidi_api', function() {
    var fixtures = [
        'test/fixtures/categories.json',
        'test/fixtures/geolocation.json'
    ];

    var tester = new CustomTester(function (api) {
        api.config_store.config = JSON.stringify({
            ushahidi_api: {
                ushahidi_url: "https://vumi.crowdmap.com/api",
                geocode_url: 'http://maps.googleapis.com/maps/api/geocode/json'
            }
        });
        fixtures.forEach(function (f) {
            api.load_http_fixture(f);
        });
    });

    it('should return a list of categories', function() {
        tester.check_state({current_state: 'report_description'}, 'foo',
            'report_category',
            "^Select a category"
            );
    });

    it('should return a list of location matches', function() {
        tester.check_state({current_state: 'report_location'},
            '1600 Amphitheatre Parkway',
            'select_location',
            "^Select a match:[^]" +
            "1. 1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA[^]" +
            "2. None of the above$"
            );
    });
});
