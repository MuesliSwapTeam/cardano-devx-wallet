import { METHOD, SENDER, TARGET } from '../../lib/config/messaging';
import type { MethodCallback } from './types';

const enable_handler: MethodCallback = (request, sendResponse) => {
  (async () => 'asdf')()
    .then((value: string) => {
      sendResponse({
        id: request.id,
        data: value,
        target: TARGET,
        sender: SENDER.extension,
      });
    })
    .catch(e => {
      sendResponse({
        id: request.id,
        error: e,
        target: TARGET,
        sender: SENDER.extension,
      });
    });
};
export const HANDLERS: Record<string, MethodCallback> = {
  [METHOD.enable]: enable_handler,
};
