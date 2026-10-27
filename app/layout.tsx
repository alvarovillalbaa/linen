import type { Metadata } from 'next';
import './globals.css';
import { PROFILE_CSS } from '../lib/render';
export const metadata: Metadata = {
  title: { default: 'Linen — a little space for everything you do', template: '%s · Linen' },
  description: 'An open-source home for your links, projects and little corners of the internet.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><head><link rel="icon" href="/favicon.svg"/><style dangerouslySetInnerHTML={{ __html: PROFILE_CSS }}/></head><body>{children}</body></html>;
}
