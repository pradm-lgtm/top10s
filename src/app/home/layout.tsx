import type { Metadata } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://top10s.vercel.app'

export const metadata: Metadata = {
  title: 'Ranked — Your take. Ranked.',
  description: 'Opinionated film & TV lists from people who care too much.',
  openGraph: {
    title: 'Ranked — Your take. Ranked.',
    description: 'Opinionated film & TV lists from people who care too much.',
    url: `${siteUrl}/home`,
    siteName: 'Ranked',
    images: [
      {
        url: `${siteUrl}/api/og/home`,
        width: 1200,
        height: 630,
        alt: 'Ranked — Your take. Ranked.',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ranked — Your take. Ranked.',
    description: 'Opinionated film & TV lists from people who care too much.',
    images: [`${siteUrl}/api/og/home`],
  },
}

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
