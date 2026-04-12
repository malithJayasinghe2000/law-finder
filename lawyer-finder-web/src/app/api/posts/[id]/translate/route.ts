import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { translateFields, type SupportedLocale } from '@/lib/translate';

// GET /api/posts/[id]/translate?locale=en — Get or generate translation
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const targetLocale = (searchParams.get('locale') || 'en') as SupportedLocale;

    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true, title: true, content: true, excerpt: true, language: true },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }

    // If already in target language, return original
    if (post.language === targetLocale) {
      return NextResponse.json({
        title: post.title,
        content: post.content,
        excerpt: post.excerpt,
        isAuto: false,
        sourceLanguage: post.language,
      });
    }

    // Check cached translation
    const cached = await prisma.postTranslation.findUnique({
      where: { postId_locale: { postId: id, locale: targetLocale } },
    });

    if (cached) {
      return NextResponse.json({
        title: cached.title,
        content: cached.content,
        excerpt: cached.excerpt,
        isAuto: cached.isAuto,
        sourceLanguage: post.language,
      });
    }

    // Generate translation using free google-translate-api-x
    const translated = await translateFields(
      { title: post.title, content: post.content, excerpt: post.excerpt },
      targetLocale,
      post.language as SupportedLocale
    );

    // Cache the translation
    await prisma.postTranslation.create({
      data: {
        postId: id,
        locale: targetLocale,
        title: translated.title || post.title,
        content: translated.content || post.content,
        excerpt: translated.excerpt || post.excerpt,
        isAuto: true,
      },
    });

    return NextResponse.json({
      title: translated.title || post.title,
      content: translated.content || post.content,
      excerpt: translated.excerpt || post.excerpt,
      isAuto: true,
      sourceLanguage: post.language,
    });
  } catch (error) {
    console.error('[POST_TRANSLATE]', error);
    return NextResponse.json({ error: 'Translation failed. Showing original content.' }, { status: 500 });
  }
}
