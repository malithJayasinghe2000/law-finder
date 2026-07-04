import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { promises as fs, existsSync } from 'fs';
import path from 'path';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const doc = await prisma.legalDocument.findUnique({
      where: { id },
    });

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const fileName = doc.fileName;
    
    // 1. Try public/uploads
    let filePath = path.join(process.cwd(), 'public', 'uploads', fileName);
    
    // 2. If not exists, try ../lawyer-rag/data/uploads
    if (!existsSync(filePath)) {
      filePath = path.join(process.cwd(), '..', 'lawyer-rag', 'data', 'uploads', fileName);
    }

    // 3. If not exists, check if any PDF with ragDocumentName exists
    if (!existsSync(filePath) && doc.ragDocumentName) {
      filePath = path.join(process.cwd(), '..', 'lawyer-rag', 'data', 'uploads', `${doc.ragDocumentName}.pdf`);
    }

    // 4. Check if file exists finally
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
    }

    // Read file
    const fileBuffer = await fs.readFile(filePath);

    // Return response with correct content-type
    const ext = fileName.split('.').pop()?.toLowerCase();
    let contentType = 'application/pdf';
    if (ext === 'docx') {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (ext === 'txt') {
      contentType = 'text/plain';
    }

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Length', fileBuffer.length.toString());
    headers.set('Content-Disposition', `inline; filename="${fileName}"`);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=3600');

    return new Response(fileBuffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('[LEGAL_DOC_FILE_GET]', error);
    return NextResponse.json({ error: 'Failed to fetch document file' }, { status: 555 });
  }
}
