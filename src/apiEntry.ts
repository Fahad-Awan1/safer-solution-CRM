import { createApp } from './serverApp';

const app = createApp();

export default function handler(req: any, res: any) {
  return app(req, res);
}
