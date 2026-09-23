import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import type { Request } from 'express';

// Same in-memory-into-Postgres-bytea pattern as reports/sample images.
// A certificate is realistically a scanned PDF or a photo of the paper
// certificate — both accepted, nothing else.
const ALLOWED = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

export const certificateMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, accept: boolean) => void) => {
    if (!ALLOWED.has(file.mimetype)) {
      callback(new BadRequestException('Only PDF, JPEG, PNG, or WebP files are accepted'), false);
      return;
    }
    callback(null, true);
  },
};
