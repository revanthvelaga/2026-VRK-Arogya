import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import type { Request } from 'express';

// Same rationale as reports.multer-options.ts: in-memory, straight into
// Postgres bytea, nothing written to the API's own (ephemeral) disk.
export const sampleImageMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB — a phone-camera JPEG, not a raw file
  fileFilter: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, accept: boolean) => void) => {
    if (!file.mimetype.startsWith('image/')) {
      callback(new BadRequestException('Only image files are accepted'), false);
      return;
    }
    callback(null, true);
  },
};
