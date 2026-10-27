import { json, publishingConfigured } from '@/lib/server/backend';
export const dynamic = 'force-dynamic';
export function GET() { return json({ publishing: publishingConfigured() }); }
