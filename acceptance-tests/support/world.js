'use strict';

// The World is a thin state holder: harness handles plus this scenario's
// recorded responses, created smoke rows, and disposable identities. Intent-
// level API calls record only the scenario's *subject* requests — arrangement
// (probe creation) and internal verification reads stay unrecorded so "the
// response" in a Then step means exactly the request the scenario names.

const { setWorldConstructor, World } = require('@cucumber/cucumber');
const api = require('./api-client');
const authState = require('./auth-state');
const identities = require('./identities');
const { removeScenarioDisposableUsers } = require('./cleanup');
const { state, nextProbeName } = require('./harness');

class AcceptanceWorld extends World {
  constructor(options) {
    super(options);
    this.harness = state;
    this.responses = []; // this scenario's subject requests
    this.createdPropertyIds = []; // smoke rows to delete in After (the primary owner's)
    this.createdProperties = []; // smoke rows created as a named owner: { id, token }
    this.probeNames = []; // probe names this scenario used
    this.subjectPropertyId = null; // the property the scenario's steps focus on
    this.disposableIdentities = []; // Auth users created for this scenario
    this.probeApis = []; // second API instances this scenario started
  }

  // ---- recorded (subject) requests ----

  async getPropertiesList() {
    const response = await api.getPropertiesList();
    this.responses.push(response);
    return response;
  }

  // A list request made with an explicit token: the cross-owner scenarios send
  // each landlord's real access token, never a forged one.
  async getPropertiesListAs(token) {
    const response = await api.getPropertiesList({ token });
    this.responses.push(response);
    return response;
  }

  async postProperty(payload, { token } = {}) {
    const response = await api.postProperty(payload, token === undefined ? {} : { token });
    this.responses.push(response);
    this.rememberCreated(response, token);
    return response;
  }

  async deletePropertyById(id, { token } = {}) {
    const response = await api.deletePropertyById(id, token === undefined ? {} : { token });
    this.responses.push(response);
    return response;
  }

  async deletePropertyWithoutId() {
    const response = await api.deletePropertyWithoutId();
    this.responses.push(response);
    return response;
  }

  // ---- seeded owners (design §9: primary = test owner A, second = owner B) ----

  // The cached session for a seeded owner. The harness signs A in at boot; B is
  // signed in once per origin on first use, in a context of its own.
  async seededSession(identity = 'primary') {
    return authState.ensureSession({
      browser: state.browser,
      origin: state.webBaseUrl,
      identity,
    });
  }

  async seededToken(identity = 'primary') {
    const session = await this.seededSession(identity);
    return session.accessToken;
  }

  // ---- unrecorded helpers (arrangement and verification) ----

  // A unique, run-stamped smoke property so scenarios never collide with each
  // other or with the operator's ledger, and cleanup can recognize them.
  probePayload(overrides = {}) {
    const name = nextProbeName();
    this.probeNames.push(name);
    return {
      name,
      address: 'Acceptance Probe Way 1',
      type: 'residential',
      units: 1,
      ...overrides,
    };
  }

  // Arrangement: create a probe property without recording it as a subject.
  async postProbeProperty(overrides = {}) {
    const payload = this.probePayload(overrides);
    const response = await api.postProperty(payload);
    this.rememberCreated(response);
    return response;
  }

  // Arrangement for another seeded owner: the row is created with that owner's
  // real access token, never the primary's, and remembered with that token so
  // the After hook deletes it as the owner who actually holds it.
  async postProbePropertyAs(identity, overrides = {}) {
    const token = await this.seededToken(identity);
    const payload = this.probePayload(overrides);
    const response = await api.postProperty(payload, { token });
    this.rememberCreated(response, token);
    return response;
  }

  rememberCreated(response, token) {
    if (!response || response.status !== 201 || !response.body || !response.body.data) return;
    const id = response.body.data.id;
    if (!id) return;
    if (token === undefined) {
      this.createdPropertyIds.push(id);
    } else {
      this.createdProperties.push({ id, token });
    }
  }

  // Internal verification read (not recorded).
  async fetchPropertiesListQuiet() {
    return api.getPropertiesList();
  }

  // Internal verification read as another owner (not recorded).
  async fetchPropertiesListAsQuiet(token) {
    return api.getPropertiesList({ token });
  }

  async checkApiHealth() {
    return api.getApiHealth();
  }

  // ---- disposable identities ----

  // Create an Auth user through the admin API and remember it for the After
  // hook. `confirmed: false` gives the refusal path its subject.
  async createDisposableIdentity({ confirmed = true, email, password } = {}) {
    const identity = await identities.createDisposableUser({ confirmed, email, password });
    this.disposableIdentities.push(identity);
    return identity;
  }

  async createUnconfirmedDisposableIdentity(options = {}) {
    return this.createDisposableIdentity({ ...options, confirmed: false });
  }

  // Adopt an account this scenario did not create through the admin helper —
  // a browser sign-up, or a user the admin link generator returned — so the
  // After hook and the run-wide sweep remove it too. The disposable guard
  // rejects any seeded or foreign address.
  adoptDisposableIdentity({ id, email, password = null, confirmed = false }) {
    const identity = identities.registerDisposableUser({ id, email, password, confirmed });
    this.disposableIdentities.push(identity);
    return identity;
  }

  async removeDisposableIdentities() {
    return removeScenarioDisposableUsers(this);
  }

  lastResponse() {
    if (this.responses.length === 0) {
      throw new Error('No API response has been recorded for this scenario yet.');
    }
    return this.responses[this.responses.length - 1];
  }
}

setWorldConstructor(AcceptanceWorld);
