let ioRef = null;

function setIO(io){ ioRef = io; }
function room(jobId){ return `deploy:${jobId}`; }

function emitDeploy(jobId, payload){
  if(!ioRef) return;
  ioRef.to(room(jobId)).emit('deploy:event', { jobId, ts: Date.now(), ...payload });
}

// tiny helpers
const stage = (jobId, stage) => emitDeploy(jobId, { type: 'stage', stage });
const log   = (jobId, line)  => emitDeploy(jobId, { type: 'log',   line  });
const done  = (jobId, data)  => emitDeploy(jobId, { type: 'done',  ...data });

module.exports = { setIO, emitDeploy, stage, log, done, room };
