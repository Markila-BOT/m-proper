'use strict';

// The World is a thin state holder: harness handles plus this scenario's
// recorded responses and created smoke rows. Intent-level API calls record
// only the scenario's *subject* requests — arrangement (probe creation) and
// internal verification reads stay unrecorded so "the response" in a Then
// step means exactly the request the scenario names.

const { setWorldConstructor, World } = require('@cucumber/cucumber');
const api = require('./api-client');
const { state, nextProbeName } = require('./harness');

class AcceptanceWorld extends World {
  constructor(options) {
    super(options);
    this.harness = state;
    this.responses = []; // this scenario's subject requests
    this.createdPropertyIds = []; // smoke rows to delete in After
    this.probeNames = []; // probe names this scenario used
    this.subjectPropertyId = null; // the property the scenario's steps focus on
  }

  // ---- recorded (subject) requests ----

  async getPropertiesList() {
    const response = await api.getPropertiesList();
    this.responses.push(response);
    return response;
  }

  async postProperty(payload) {
    const response = await api.postProperty(payload);
    this.responses.push(response);
    if (response.status === 201 && response.body && response.body.data && response.body.data.id) {
      this.createdPropertyIds.push(response.body.data.id);
    }
    return response;
  }

  async deletePropertyById(id) {
    const response = await api.deletePropertyById(id);
    this.responses.push(response);
    return response;
  }

  async deletePropertyWithoutId() {
    const response = await api.deletePropertyWithoutId();
    this.responses.push(response);
    return response;
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
    if (response.status === 201 && response.body && response.body.data && response.body.data.id) {
      this.createdPropertyIds.push(response.body.data.id);
    }
    return response;
  }

  // Internal verification read (not recorded).
  async fetchPropertiesListQuiet() {
    return api.getPropertiesList();
  }

  async checkApiHealth() {
    return api.getApiHealth();
  }

  lastResponse() {
    if (this.responses.length === 0) {
      throw new Error('No API response has been recorded for this scenario yet.');
    }
    return this.responses[this.responses.length - 1];
  }
}

setWorldConstructor(AcceptanceWorld);
