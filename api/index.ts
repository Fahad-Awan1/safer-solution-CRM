import { createApp } from '../server.ts';

const app = createApp();

export default function handler(req: any, res: any) {
  return app(req, res);
}
