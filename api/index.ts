import { createApp } from '../src/serverApp.ts';

const app = createApp();

export default function handler(req: any, res: any) {
  return app(req, res);
}
