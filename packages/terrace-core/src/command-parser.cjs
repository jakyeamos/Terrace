'use strict';

const { listCommandCatalog } = require('./command-catalog.cjs');

function copyArgs(value, name) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new TypeError(name + ' must be an array of strings.');
  }
  return [...value];
}

function formMatches(form, args, rawArgs) {
  if (form.match === 'exact' && args.length !== form.literals.length) {
    return false;
  }
  if (form.match === 'prefix' && args.length < form.literals.length) {
    return false;
  }
  if (!form.literals.every((literal, index) => args[index] === literal)) {
    return false;
  }
  return (form.required_flags || []).every((flag) => rawArgs.includes(flag));
}

function candidateIdentity(candidate) {
  return [candidate.kind, candidate.owner, candidate.command_id || '', candidate.family_id || ''].join(':');
}

function candidateResult(candidate, args, rawArgs) {
  const base = {
    owner: candidate.owner,
    form_id: candidate.form_id,
    alias_id: candidate.alias_id,
    literals: [...candidate.literals],
    remaining_args: args.slice(candidate.literals.length),
    raw_args: [...rawArgs],
    args: [...args]
  };
  if (candidate.kind === 'family') {
    return {
      kind: 'family',
      family_id: candidate.family_id,
      ...base
    };
  }
  return {
    kind: 'match',
    command_id: candidate.command_id,
    ...base
  };
}

function resolveCommandDispatch(input, options) {
  const source = input || {};
  const args = copyArgs(source.args || [], 'args');
  const rawArgs = copyArgs(source.raw_args || source.rawArgs || [], 'raw_args');
  const catalog = options && options.catalog ? options.catalog : listCommandCatalog();
  const candidates = [];

  for (const entry of catalog) {
    if (!entry.dispatch) continue;
    entry.dispatch.forms.forEach((form, index) => {
      if (!formMatches(form, args, rawArgs)) return;
      candidates.push({
        kind: form.kind,
        owner: entry.dispatch.owner,
        command_id: form.kind === 'command' ? entry.id : null,
        family_id: form.kind === 'family' ? form.family_id : null,
        form_id: entry.id + ':' + index,
        alias_id: form.alias_id || null,
        literals: form.literals,
        priority: form.priority
      });
    });
  }

  if (candidates.length === 0) {
    return { kind: 'unknown', token: args[0] || null, raw_args: rawArgs, args };
  }

  candidates.sort((left, right) => right.priority - left.priority || right.literals.length - left.literals.length);
  const winner = candidates[0];
  const tied = candidates.filter((candidate) => (
    candidate.priority === winner.priority && candidate.literals.length === winner.literals.length
  ));
  const identities = [...new Set(tied.map(candidateIdentity))];
  if (identities.length > 1) {
    return {
      kind: 'ambiguous',
      candidates: identities.sort(),
      raw_args: rawArgs,
      args
    };
  }

  return candidateResult(winner, args, rawArgs);
}

module.exports = {
  resolveCommandDispatch
};
