import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import type { Request } from 'express';

// In-memory, not disk — the uploaded bytes are stored straight into
// Postgres (see Report.fileData), so there's never a file on the API's
// own filesystem to lose. A hosting platform's free web service tier
// typically doesn't persist local disk writes across a restart/sleep
// cycle, which used to make an uploaded report vanish without warning.
export const reportMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, accept: boolean) => void) => {
    if (file.mimetype !== 'application/pdf') {
      callback(new BadRequestException('Only PDF files are accepted'), false);
      return;
    }
    callback(null, true);
  },
};
