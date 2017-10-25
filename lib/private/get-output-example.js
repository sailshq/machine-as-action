/**
 * Module dependencies
 */

var _ = require('@sailshq/lodash');
var rttc = require('rttc');


/**
 * getOutputExample()
 *
 * Look up the output example for the specified exit.
 * If the exit does not exist, this returns undefined.
 * The primary job of this helper is to normalize between `outputExample` & `example`
 * (for backwards compatibility)
 *
 * @required
 *            {Dictionary} machineDef
 *            Compact node machine definition.
 *              -AND-
 *            {Dictionary} exitCodeName
 *            The code name of an exit.
 *
 * •--OR--•
 *            {Dictionary} exitDef
 *            The exit definition from a compact node machine.
 *
 * ------------------------------------------------------------------------------------------
 * @returns {~Exemplar}
 *         The supposed RTTC exemplar representing the output example for this exit.
 */
module.exports = function getOutputExample(options) {
  if (!_.isObject(options)) {
    throw new Error('Consistency violation: Options must be specified as a dictionary.');
  }

  // Support both usages:
  var exitDef;
  if (_.isUndefined(options.exitDef)) {
    if (!_.isObject(options.machineDef)) {
      throw new Error('Consistency violation: `machineDef` should be a compact Node Machine definition (a dictionary).');
    }
    if (!_.isString(options.exitCodeName)) {
      throw new Error('Consistency violation: `exitCodeName` should be specified as a string.');
    }
    if (!_.isObject(options.machineDef.exits)) {
      throw new Error('Consistency violation: `machineDef` should have `exits`, specified as a dictionary of exit definitions.');
    }
    exitDef = options.machineDef.exits[options.exitCodeName];
  } else {
    if (!_.isObject(options.exitDef)) {
      throw new Error('Consistency violation: `exitDef` should be provided as a compact exit definition (a dictionary).');
    }
    exitDef = options.exitDef;
  }

  // Look up the output example:
  if (_.isUndefined(exitDef)) {
    return undefined;
  } else if (!_.isObject(exitDef)) {
    throw new Error('Consistency violation: The specified exit (`' + options.exitCodeName + '`) is not a valid exit definition (should be a dictionary).');
  } else if (!_.isUndefined(exitDef.like)) {
    throw new Error('Consistency violation: The specified exit (`' + options.exitCodeName + '`) cannot be used in machine-as-action (`like`, `itemOf`, and `getExample` are not currently supported).');
  } else if (!_.isUndefined(exitDef.itemOf)) {
    throw new Error('Consistency violation: The specified exit (`' + options.exitCodeName + '`) cannot be used in machine-as-action (`like`, `itemOf`, and `getExample` are not currently supported).');
  } else if (!_.isUndefined(exitDef.getExample)) {
    throw new Error('Consistency violation: The specified exit (`' + options.exitCodeName + '`) cannot be used in machine-as-action (`like`, `itemOf`, and `getExample` are not currently supported).');
  } else if (!_.isUndefined(exitDef.outputExample)) {
    return exitDef.outputExample;
  } else if (!_.isUndefined(exitDef.outputType)) {
    return rttc.getDefaultExemplar(exitDef.outputType);
  } else {
    return undefined;
  }
};
