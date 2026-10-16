// The template is repeated so each Act's own title keeps the site name.
export const metadata = { title: { default: 'Legal Library', template: '%s | TheLawyr' } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
