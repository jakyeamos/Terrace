'use strict';

function normalizeUserAnswers(options) {
  const answers = options && Object.prototype.hasOwnProperty.call(options, 'userAnswers') ? options.userAnswers : null;
  return String(answers || '').trim();
}

function interrogationQuestions(featureId, mode, repo) {
  const normalizedMode = mode || 'init';
  const changed = repo.changed_files.slice(0, 8);
  const riskFiles = repo.files.filter((file) => /(auth|permission|billing|payment|migration|schema|api|route|server|cache)/i.test(file)).slice(0, 8);
  const surface = repo.route_hints.concat(repo.component_hints).slice(0, 8);
  return [
    'What user workflow or business outcome must ' + featureId + ' preserve?',
    'Which assumption about scope, data, permissions, rollout, or dependencies is most likely wrong?',
    'What edge cases must be tested before this is considered safe?',
    'What failure would force rollback or a scope change?',
    'Who owns the final decision if the ' + normalizedMode + ' interrogation exposes unresolved risk?',
    'Repo prompt: changed files considered: ' + (changed.length > 0 ? changed.join(', ') : 'no git diff files detected') + '.',
    'Repo prompt: risk-bearing files considered: ' + (riskFiles.length > 0 ? riskFiles.join(', ') : 'none detected from filenames') + '.',
    'Repo prompt: UI surface considered: ' + (surface.length > 0 ? surface.join(', ') : 'no UI files detected') + '.'
  ];
}

function requireInterrogationAnswers(featureId, mode, repo, options) {
  const userAnswers = normalizeUserAnswers(options);
  const questions = interrogationQuestions(featureId, mode, repo);
  if (userAnswers.length > 0) {
    return { userAnswers, questions };
  }
  const error = new Error('INTERROGATION_REQUIRES_USER_INPUT');
  error.details = {
    code: 'INTERROGATION_REQUIRES_USER_INPUT',
    feature_id: featureId,
    mode: mode || 'init',
    questions,
    next_command: 'terrace interrogate ' + (mode && mode !== 'init' ? mode + ' ' : '') + featureId + ' --paste-answers',
    remediation: 'Ask the user these questions, then rerun interrogate with the user answers from stdin or --answers-file.'
  };
  error.next_command = error.details.next_command;
  error.remediation = error.details.remediation;
  throw error;
}

function answerLines(userAnswers) {
  return String(userAnswers || '').split(/\r?\n/).map((line) => line.trimEnd());
}

module.exports = {
  interrogationQuestions,
  requireInterrogationAnswers,
  answerLines
};
