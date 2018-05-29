(function (root, factory) {
    define(["jasmine", "mock", "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {
    "use strict";
    const $iq = converse.env.$iq;
    const Strophe = converse.env.Strophe;
    const _ = converse.env._;
    const sizzle = converse.env.sizzle;
    const u = converse.env.utils;

    describe("XEP-0198 Stream Management", function () {

        it("gets enabled with an <enable> stanza and resumed with a <resume> stanza",
            mock.initConverse(
                null, ['connectionInitialized', 'chatBoxesInitialized'],
                { 'auto_login': false,
                  'enable_smacks': true,
                  'show_controlbox_by_default': true,
                  'smacks_max_unacked_stanzas': 2
                },
                async function (done, _converse) {

            const view = _converse.chatboxviews.get('controlbox');
            spyOn(view, 'renderControlBoxPane').and.callThrough();

            _converse.api.user.login('dummy@localhost', 'secret');
            const sent_stanzas = _converse.connection.sent_stanzas;
            let stanza = await test_utils.waitUntil(() =>
                sent_stanzas.filter(s => (s.tagName === 'enable')).pop());

            expect(_converse.session.get('smacks_enabled')).toBe(false);
            expect(Strophe.serialize(stanza)).toEqual('<enable resume="true" xmlns="urn:xmpp:sm:3"/>');

            let result = u.toStanza(`<enabled xmlns="urn:xmpp:sm:3" id="some-long-sm-id" resume="true"/>`);
            _converse.connection._dataRecv(test_utils.createRequest(result));
            expect(_converse.session.get('smacks_enabled')).toBe(true);

            await test_utils.waitUntil(() => view.renderControlBoxPane.calls.count());

            const IQ_stanzas = _converse.connection.IQ_stanzas;
            await test_utils.waitUntil(() => IQ_stanzas.length === 4);

            let iq = IQ_stanzas.pop();
            expect(Strophe.serialize(iq)).toBe(
                `<iq from="dummy@localhost/resource" id="${iq.getAttribute('id')}" to="dummy@localhost" type="get" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/disco#info"/></iq>`);

            iq = IQ_stanzas.pop();
            expect(Strophe.serialize(iq)).toBe(
                `<iq id="${iq.getAttribute('id')}" type="get" xmlns="jabber:client"><query xmlns="jabber:iq:roster"/></iq>`);

            iq = IQ_stanzas.pop();
            expect(Strophe.serialize(iq)).toBe(
                `<iq from="dummy@localhost/resource" id="${iq.getAttribute('id')}" to="localhost" type="get" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/disco#info"/></iq>`);

            iq = IQ_stanzas.pop();
            expect(Strophe.serialize(iq)).toBe(
                `<iq from="dummy@localhost" id="${iq.getAttribute('id')}" to="dummy@localhost" type="get" xmlns="jabber:client">`+
                    `<pubsub xmlns="http://jabber.org/protocol/pubsub"><items node="eu.siacs.conversations.axolotl.devicelist"/></pubsub></iq>`);

            expect(sent_stanzas.filter(s => (s.nodeName === 'r')).length).toBe(2);
            expect(_converse.session.get('unacked_stanzas').length).toBe(4);

            _converse.api.connection.reconnect();
            stanza = await test_utils.waitUntil(() =>
                sent_stanzas.filter(s => (s.tagName === 'resume')).pop());
            expect(Strophe.serialize(stanza)).toEqual('<resume h="0" previd="some-long-sm-id" xmlns="urn:xmpp:sm:3"/>');

            result = u.toStanza(`<resumed xmlns="urn:xmpp:sm:3" h="another-sequence-number" previd="some-long-sm-id"/>`);
            _converse.connection._dataRecv(test_utils.createRequest(result));

            // Another <enable> stanza doesn't get sent out
            expect(sizzle('enable', sent_stanzas).length).toBe(0);
            expect(_converse.session.get('smacks_enabled')).toBe(true);
            done();
        }));
    });
}));
