import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { getSession } from '@/lib/auth';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    // Only logged-in LAWYERs or ADMINs can upload profile images
    if (!session || session.role === 'CLIENT') {
      return NextResponse.json({ error: 'Unauthorized to upload images' }, { status: 401 });
    }

    const data = await req.formData();
    const file: File | null = data.get('file') as unknown as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: 'lawyer_profiles', allowed_formats: ['jpg', 'png', 'webp'] }, 
        (error, result) => {
          if (error || !result) {
            reject(NextResponse.json({ error: 'Cloudinary upload failed' }, { status: 500 }));
          } else {
            resolve(NextResponse.json({ url: result.secure_url }, { status: 200 }));
          }
        }
      ).end(buffer);
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
