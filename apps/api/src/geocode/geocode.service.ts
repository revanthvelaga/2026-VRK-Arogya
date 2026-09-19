import { Injectable, Logger } from '@nestjs/common';

export interface GeocodeResult {
  displayName: string;
  lat: number;
  lng: number;
  pincode?: string;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: { postcode?: string };
}

// Proxied through our own backend rather than called directly from the
// browser so the User-Agent Nominatim's usage policy requires
// (https://operations.osmfoundation.org/policies/nominatim/) is set
// consistently, and so a future switch to a paid provider only touches
// this one file.
@Injectable()
export class GeocodeService {
  private readonly logger = new Logger(GeocodeService.name);

  async search(query: string): Promise<GeocodeResult[]> {
    const trimmed = query.trim();
    if (trimmed.length < 3) return [];

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '6');
    url.searchParams.set('countrycodes', 'in');
    url.searchParams.set('q', trimmed);

    try {
      const res = await fetch(url, {
        headers: {
          // Nominatim requires a descriptive User-Agent identifying the
          // application — an unset/generic one gets silently rate-limited
          // or blocked.
          'User-Agent': 'ArogyaDiagnostics/1.0 (diagnostic lab booking platform)',
        },
      });
      if (!res.ok) {
        this.logger.warn(`Nominatim search failed: ${res.status}`);
        return [];
      }
      const results = (await res.json()) as NominatimResult[];
      return results.map((r) => ({
        displayName: r.display_name,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        pincode: r.address?.postcode,
      }));
    } catch (err) {
      this.logger.warn(`Nominatim search errored: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }
}
