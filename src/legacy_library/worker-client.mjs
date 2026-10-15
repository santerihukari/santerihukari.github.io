export function cancelled(error) { return error?.code === 'BUILD_CANCELLED'; }

export function createWorkerClient(makeWorker, { timeoutMs = 90000, onProgress = () => {} } = {}) {
  let worker, nextId = 0;
  const pending = new Map();

  function stop(reason) {
    const previous = worker; worker = null;
    previous?.terminate();
    for (const task of pending.values()) { clearTimeout(task.timer); task.reject(reason); }
    pending.clear();
  }
  function ensureWorker() {
    if (worker) return worker;
    const current = makeWorker(); worker = current;
    current.addEventListener('message', ({ data }) => {
      if (current !== worker) return;
      const task = pending.get(data.id);
      if (!task) return;
      if (data.type === 'progress') { onProgress(data); return; }
      clearTimeout(task.timer); pending.delete(data.id);
      if (data.error) task.reject(new Error(data.error)); else task.resolve(data);
    });
    current.addEventListener('error', event => {
      event.preventDefault?.();
      if (current === worker) stop(new Error(event.message || 'The geometry worker stopped.'));
    });
    current.addEventListener('messageerror', () => {
      if (current === worker) stop(new Error('Geometry response could not be read.'));
    });
    return current;
  }
  return {
    get active() { return pending.size > 0; },
    request(payload) {
      return new Promise((resolve, reject) => {
        const current = ensureWorker(), id = ++nextId;
        const timer = setTimeout(() => {
          const error = new Error(`This calculation exceeded ${Math.ceil(timeoutMs/1000)} seconds. Try less edge rounding or reset the model, then update again.`);
          error.code = 'BUILD_TIMEOUT'; stop(error);
        }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        try { current.postMessage({ ...payload, id }); }
        catch (error) { stop(error); }
      });
    },
    cancel() {
      const reason = new Error('Superseded by newer parameters.'); reason.code = 'BUILD_CANCELLED'; stop(reason);
    }
  };
}
