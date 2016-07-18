/**
 * Module dependencies
 */

var _ = require('lodash');


/**
 * getOutputExample()
 *
 * Look up the output example for the specified exit.
 * If the exit does not exist, this returns undefined.
 * The primary job of this helper is to normalize between `outputExample` & `example`
 * (for backwards compatibility)
 *
 * @required  {Dictionary} machineDef
 *            Compact node machine definition.
 *
 * @required  {Dictionary} exitCodeName
 *            The code name of an exit.
 *
 * @returns {~Exemplar}
 *         The supposed RTTC exemplar representing the output example for this exit.
 */
module.exports = function getOutputExample (options) {
  if (!_.isObject(options)) { throw new Error('Consistency violation: Options must be specified as a dictionary.'); }
  if (!_.isObject(options.machineDef)) { throw new Error('Consistency violation: `machineDef` should be a compact Node Machine definition (a dictionary).'); }
  if (!_.isString(options.exitCodeName)) { throw new Error('Consistency violation: `exitCodeName` should be specified as a string.'); }
  if (!_.isObject(options.machineDef.exits)) { throw new Error('Consistency violation: `machineDef` should have `exits`, specified as a dictionary of exit definitions.'); }

  var exitDef = options.machineDef.exits[options.exitCodeName];
  if (_.isUndefined(exitDef)) { return undefined; }
  else if (!_.isObject(exitDef)) { throw new Error('Consistency violation: The specified exit (`'+options.exitCodeName+'`) is not a valid exit definition (should be a dictionary).'); }
  else if (!_.isUndefined(exitDef.outputExample)) { return exitDef.outputExample; }
  else if (!_.isUndefined(exitDef.example)) { return exitDef.example; }
  else { return undefined; }
};
