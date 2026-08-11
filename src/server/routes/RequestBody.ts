import {Request} from '../Request';

export class RequestBodyError extends Error {}

export function readJsonRequest(req: Request, maxLength: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    let tooLarge = false;
    req.on('data', (data) => {
      if (tooLarge) {
        return;
      }
      body += data.toString();
      tooLarge = body.length > maxLength;
    });
    req.once('end', () => {
      if (tooLarge) {
        reject(new RequestBodyError('Request body is too large'));
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (_error) {
        reject(new RequestBodyError('Request body must be valid JSON'));
      }
    });
  });
}
