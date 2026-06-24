import { redirect } from 'next/navigation';

export default async function MyPostsRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/blog/my-posts`);
}
