import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { diskStorage, StorageEngine } from 'multer';
import * as path from 'path';
import type { Request } from 'express';
import type { File } from 'multer';

// Local disk today — apps/api/uploads/reports/, gitignored. The Report
// entity's fileUrl column holds whatever path/URL actually stores the
// file, so swapping this for real S3 storage later only touches this
// one file, not the entity, service, or controller.
export const REPORTS_DIR = path.join(process.cwd(), 'uploads', 'reports');
fs.mkdirSync(REPORTS_DIR, { recursive: true });

export const reportMulterOptions = {
  storage: diskStorage({
    destination: REPORTS_DIR,
    filename: (_req: Request, file: File, callback: (error: Error | null, filename: string) => void) => {
      const ext = path.extname(file.originalname) || '.pdf';
      callback(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req: Request, file: File, callback: (error: Error | null, accept: boolean) => void) => {
    if (file.mimetype !== 'application/pdf') {
      callback(new BadRequestException('Only PDF files are accepted'), false);
      return;
    }
    callback(null, true);
  },
};
