'use strict';

// Compatibility facade: the catalog owns the command contract metadata.
const { listCommandContracts } = require('./command-catalog.cjs');

const WORKFLOW_COMMAND_CONTRACTS = Object.freeze(
  listCommandContracts().map((contract) => Object.freeze(contract))
);

module.exports = {
  WORKFLOW_COMMAND_CONTRACTS,
  listCommandContracts
};
