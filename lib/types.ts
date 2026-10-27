export type CardKind = 'link' | 'text' | 'image' | 'video' | 'embed' | 'map' | 'section';
export type CardSize = 'small' | 'wide' | 'tall' | 'large';
export type PageTheme = 'paper' | 'oat' | 'night' | 'rose';
export type PageFont = 'sans' | 'serif';
export type Card = {
  id: string; kind: CardKind; size: CardSize; title: string; text: string;
  url: string; coverUrl: string; mediaId: string; alt: string; lat: number; lng: number;
};
export type ProfilePage = {
  version: 1; id: string; handle: string; name: string; bio: string; location: string;
  avatarId: string; theme: PageTheme; font: PageFont; accent: string; cards: Card[];
};
export type MediaFile = { id: string; name: string; type: string; size: number; blob: Blob; createdAt: number };
export type AssetManifest = { id: string; name: string; type: string; size: number; url: string };
export type RemoteBinding = { handle: string; ownerKey: string; revision: number; publishedRevision: number | null };
export type Workspace = { version: 1; page: ProfilePage; remote: RemoteBinding | null; updatedAt: number };
export type OwnerSnapshot = { page: ProfilePage; revision: number; publishedRevision: number | null; assets: AssetManifest[] };
export type PublicSnapshot = { page: ProfilePage; revision: number; assets: AssetManifest[] };
export type Placement = { id: string; column: number; row: number; columns: number; rows: number };
