import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { getSession } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

import { sanitizeFilename, validateFileMagicBytes, checkRateLimit, getClientIp } from '@/lib/security';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    // Rate Limit: 10 uploads per hour per IP/user
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit(`upload:${session.userId}:${ip}`, 10, 60 * 60 * 1000);
    if (!rateCheck.allowed) {
      const retryAfterMins = Math.ceil(rateCheck.retryAfterMs / 1000 / 60);
      return NextResponse.json(
        { error: `Too many upload requests. Please try again in ${retryAfterMins} minutes.` },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    /**
     * What the file is for. `identity` means a practising certificate or a
     * photograph of the applicant — tier 3 personal data under
     * docs/restructure/DATA-INVENTORY.md §5.
     */
    const purpose = String(formData.get('purpose') ?? 'general');

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPG, PNG, and WebP are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Anti-spoofing: validate file content magic bytes
    if (!validateFileMagicBytes(buffer, file.type)) {
      return NextResponse.json(
        { error: 'Invalid file content. The file content does not match its extension.' },
        { status: 400 }
      );
    }

    // Fallback to local storage if Cloudinary is not configured
    if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_CLOUD_NAME) {
      /**
       * The fallback writes into `public/uploads`, which Next serves to anyone
       * who knows the path. That is acceptable for a profile photograph and is
       * NOT acceptable for an identity document: a practising certificate and a
       * photograph of someone's face, reachable without signing in, on a
       * guessable `/uploads/<timestamp>-<filename>` URL.
       *
       * So an identity upload fails loudly rather than degrading quietly. A
       * misconfigured deploy that silently publishes attorneys' identity
       * documents is a worse outcome than an applicant seeing an error.
       *
       * The proper fix is an authenticated file-serving route for tier 3
       * documents — recorded in PROGRESS.md as a follow-up, because it is a new
       * subsystem rather than a guard.
       */
      if (purpose === 'identity') {
        return NextResponse.json(
          {
            error:
              'Document storage is not configured on this server, and identity documents ' +
              'are not written to a publicly readable folder. Ask an administrator to ' +
              'configure image storage before submitting your application.',
          },
          { status: 503 }
        );
      }

      console.log('[UPLOAD] Cloudinary not configured, falling back to local storage.');

      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
      }

      const sanitizedFilename = sanitizeFilename(file.name);
      const filename = `${Date.now()}-${sanitizedFilename}`;
      const filepath = path.join(uploadDir, filename);
      
      await writeFile(filepath, buffer);
      return NextResponse.json({ url: `/uploads/${filename}` }, { status: 200 });
    }

    // Cloudinary upload
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: 'lawyer_profiles', allowed_formats: ['jpg', 'png', 'webp'] },
          (error, result) => {
            if (error || !result) {
              console.error('[CLOUDINARY_ERROR]', error);
              reject(new Error('Cloudinary upload failed.'));
            } else {
              resolve(result);
            }
          }
        )
        .end(buffer);
    });

    return NextResponse.json({ url: result.secure_url }, { status: 200 });
  } catch (error) {
    console.error('[UPLOAD_ERROR]', error);
    return NextResponse.json({ error: 'Upload failed.' }, { status: 500 });
  }
}
