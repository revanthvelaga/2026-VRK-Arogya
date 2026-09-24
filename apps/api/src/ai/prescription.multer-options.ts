import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import type { Request } from 'express';

export const PRESCRIPTION_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

export const prescriptionMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB — phone photos, not scans of whole files
  fileFilter: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, accept: boolean) => void) => {
    if (!(PRESCRIPTION_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      callback(new BadRequestException('Upload a photo (JPG, PNG, WebP) or a PDF of the prescription'), false);
      return;
    }
    callback(null, true);
  },
};
