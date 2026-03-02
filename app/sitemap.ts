/**
 * SITEMAP
 *
 * Generates sitemap.xml for search engines.
 * Includes Winefeed public pages + Vinkoll Access wines.
 */

import { MetadataRoute } from 'next';
import { getAccessAdmin } from '@/lib/supabase-server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://winefeed.se';
  const accessBaseUrl = process.env.NEXT_PUBLIC_APP_URL || baseUrl;

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${baseUrl}/pitch`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/restauranger`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/leverantorer`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];

  // Dynamic: Vinkoll Access wines
  let winePages: MetadataRoute.Sitemap = [];
  try {
    const supabase = getAccessAdmin();
    const { data: wines } = await supabase
      .from('access_wines')
      .select('id, updated_at')
      .eq('status', 'ACTIVE')
      .order('updated_at', { ascending: false });

    winePages = (wines || []).map((wine) => ({
      url: `${accessBaseUrl}/admin/access/vin/${wine.id}`,
      lastModified: new Date(wine.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch (err) {
    console.error('Sitemap: failed to fetch Access wines:', err);
  }

  return [...staticPages, ...winePages];
}
