var QueueWorker = require('./lib/queue_worker');

/**
 * @constructor
 * @param {Firebase} ref A firebase reference to the queue.
 * @param {Object} (optional) Object containing keys for jobId: the current job ID.
     and numWorkers: The number of workers to create for this job.
 * @param {Function} processingFunction A function that is called each time to
 *   process the queue item. This function is passed three parameters:
 *     - data {Object} The current data at the location.
 *     - resolve {Function} An asychronous callback function - call this
 *         function when the processingFunction completes successfully. This
 *         takes an optional Object parameter that, if passed, will overwrite
 *         the data at the queue item location
 *     - reject {Function} An asynchronous callback function - call this
 *         function if the processingFunction encounters an error. This takes
 *         an optional String or Object parameter that will be stored in the
 *         '_error_details/error' location in the queue item.
 */
module.exports = Queue;
var DEFAULT_JOB_STATE_FINISHED = "finished";
var DEFAULT_JOB_STATE_IN_PROGRESS = "in_progress";
var DEFAULT_NUM_WORKERS = 1;
var DEFAULT_TIMEOUT = 360000;
function Queue() {
  var ref, options, jobId, numWorkers, processingFunction;
  if (arguments.length === 2) {
    ref = arguments[0];
    numWorkers = DEFAULT_NUM_WORKERS;
    processingFunction = arguments[1];
  } else if (arguments.length === 3) {
    ref = arguments[0];
    options = arguments[1];
    if (typeof(options.jobId) === 'string') {
      jobId = options.jobId;
    }
    if (typeof(options.numWorkers) === 'number' && options.numWorkers % 1 === 0 && options.numWorkers > 0) {
      numWorkers = options.numWorkers;
    } else {
      numWorkers = DEFAULT_NUM_WORKERS;
    }
    processingFunction = arguments[2];
  } else {
    throw new Error('Queue must at least have the queueRef and processingFunction arguments.');
  }
  var self = this;
  self.ref = ref;
  self.workers = [];
  for (var i = 0; i < numWorkers; i++) {
    self.workers.push(QueueWorker(self.ref.child('queue'), i, processingFunction));
  }
  if (jobId !== undefined) {
    self.ref.child('jobs').child(jobId).on('value',
      function(jobSpecSnap) {
        if (jobSpecSnap.val() === null) {
          throw new Error('No job specified for this worker');
        }
        finishedState = jobSpecSnap.child('state_finished').val();
        if (finishedState === null) {
          throw new Error('No state_finished specified for this job');
        }
        inProgressState = jobSpecSnap.child('state_in_progress').val();
        if (inProgressState === null) {
          throw new Error('No state_in_progress specified for this job');
        }
        var jobSpec = {
          startState: jobSpecSnap.child('state_start').val(),
          inProgressState: inProgressState,
          finishedState: finishedState,
          jobTimeout: jobSpecSnap.child('timeout').val()
        };
        for (var i = 0; i < numWorkers; i++) {
          self.workers[i].resetJob(jobSpec);
        }
      },
      function(error) {
        throw error;
      });
  } else {
    jobSpec = {
      startState: null,
      inProgressState: DEFAULT_JOB_STATE_IN_PROGRESS,
      finishedState: DEFAULT_JOB_STATE_FINISHED,
      jobTimeout: DEFAULT_TIMEOUT
    };
    for (var j = 0; j < numWorkers; j++) {
      self.workers[j].resetJob(jobSpec);
    }
  }
  return self;
}