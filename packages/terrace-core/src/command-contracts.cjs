'use strict';

// Compatibility facade: the catalog owns the command contract metadata.
const { listCommandContracts: listCatalogCommandContracts } = require('./command-catalog.cjs');

const WORKFLOW_COMMAND_CONTRACTS = Object.freeze(
  listCatalogCommandContracts().map((contract) => Object.freeze(contract))
);

function listCommandContracts() {
  return listCatalogCommandContracts();
}

module.exports = {
  WORKFLOW_COMMAND_CONTRACTS,
  listCommandContracts
};
