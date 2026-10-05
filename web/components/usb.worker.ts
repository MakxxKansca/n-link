/* eslint camelcase: 0, require-await: 0 */

import { RpcProvider } from 'worker-rpc';
// eslint-disable-next-line import/no-absolute-path
import type { Calculator } from 'web-libnspire';

console.log('[Worker] UsbWorker initialized');
const ctx: Worker = self as any;
const module = import('web-libnspire');
let calc: Calculator | undefined;
let initParams: { id: number; sab: SharedArrayBuffer; vid: number; pid: number } | undefined;

const rpcProvider = new RpcProvider((message, transfer: any) =>
  ctx.postMessage(message, transfer)
);
ctx.onmessage = (e) => rpcProvider.dispatch(e.data);

type Path = { path: string };
type Data = { data: Uint8Array };
type SrcDest = { src: string; dest: string };

async function createCalc(params: { id: number; sab: SharedArrayBuffer; vid: number; pid: number }) {
  if (calc) {
    try {
      calc.free();
    } catch (e) {
      console.warn('[Worker] Error freeing calc:', e);
    }
  }
  const mod = await module;
  calc = new mod.Calculator(params.id, params.vid, params.pid, new Int32Array(params.sab));
  return calc;
}

rpcProvider.registerRpcHandler<{id: number, sab: SharedArrayBuffer, vid: number, pid: number}>('init', async (params) => {
  initParams = params;
  await createCalc(params);
});

rpcProvider.registerRpcHandler('updateDevice', async () => {
  return calc?.update();
});

rpcProvider.registerRpcHandler<{path: [string, number]}, Uint8Array | undefined>('downloadFile', async ({ path }) => {
  return calc?.download_file(path[0], path[1]);
});

rpcProvider.registerRpcHandler<Path & Data>(
  'uploadFile',
  async ({ path, data }) => {
    calc?.upload_file(path, data);
  }
);

rpcProvider.registerRpcHandler<Data>('uploadOs', async ({ data }) => {
  calc?.upload_os(data);
});

rpcProvider.registerRpcHandler<Path>('deleteFile', async ({ path }) => {
  calc?.delete_file(path);
});

rpcProvider.registerRpcHandler<Path>('deleteDir', async ({ path }) => {
  calc?.delete_dir(path);
});

rpcProvider.registerRpcHandler<Path>('createDir', async ({ path }) => {
  calc?.create_dir(path);
});

rpcProvider.registerRpcHandler<SrcDest>('move', async ({ src, dest }) => {
  calc?.move_file(src, dest);
});

rpcProvider.registerRpcHandler<SrcDest>('copy', async ({ src, dest }) => {
  calc?.copy_file(src, dest);
});

rpcProvider.registerRpcHandler<Path>('listDir', async ({ path }) => {
  console.log('[Worker] listDir requested for path:', JSON.stringify(path));
  let lastErr: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`[Worker] listDir retry attempt #${attempt}...`);
      }
      const res = calc?.list_dir(path);
      console.log('[Worker] listDir success on attempt', attempt, 'result:', res);
      return res;
    } catch (err: any) {
      lastErr = err;
      const errMsg = String(err?.message || err);
      console.warn(`[Worker] listDir attempt #${attempt} failed:`, errMsg);
      if (errMsg.includes('Busy') && initParams) {
        console.log('[Worker] Calculator reported Busy. Re-instantiating Calculator instance to clear stuck handle/service...');
        await new Promise((r) => setTimeout(r, 350));
        try {
          await createCalc(initParams);
          await new Promise((r) => setTimeout(r, 200));
        } catch (reinitErr) {
          console.error('[Worker] Re-instantiating Calculator failed:', reinitErr);
        }
        continue;
      }
      break;
    }
  }
  throw lastErr;
});
